require('dotenv').config()

const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid')

const connectDB = require('./config/db')
const { verifySocketToken } = require('./middleware/auth')
const { detectUrgency } = require('./services/urgencyDetector')
const Message = require('./models/Message')
const Event = require('./models/Event')
const userController = require('./Controllers/UserController')
const eventController = require('./Controllers/EventController')

const app = express()
app.use(cors())
app.use(express.json())

connectDB()

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

// ── REST Routes ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'SecureCrowd server running', version: '2.0' }))
app.use('/api/users', userController)
app.use('/api/events', eventController)

// ── Socket.IO Auth Middleware ─────────────────────────────────────────────────
io.use(verifySocketToken)

// ── In-Memory State ───────────────────────────────────────────────────────────
// sectionMembers[eventId][section] = [{ anonymousId, socketId }]
const sectionMembers = {}
// privateRooms[roomId] = { requesterId, targetId, topic, participants: [] }
const privateRooms = {}
// organizerSockets[organizerId] = socketId  (organizer watching an event)
const organizerWatching = {} // socketId → eventId

const getMemberList = (eventId, section) =>
  (sectionMembers[eventId]?.[section] || []).map((m) => m.anonymousId)

const addMember = (eventId, section, anonymousId, socketId) => {
  if (!sectionMembers[eventId]) sectionMembers[eventId] = {}
  if (!sectionMembers[eventId][section]) sectionMembers[eventId][section] = []
  const exists = sectionMembers[eventId][section].find((m) => m.socketId === socketId)
  if (!exists) sectionMembers[eventId][section].push({ anonymousId, socketId })
}

const removeMember = (eventId, section, socketId) => {
  if (!sectionMembers[eventId]?.[section]) return
  sectionMembers[eventId][section] = sectionMembers[eventId][section].filter(
    (m) => m.socketId !== socketId
  )
}

// Push per-section member list to all organizers watching this event
const notifyOrganizersSectionUpdate = (eventId, section) => {
  const members = getMemberList(eventId, section)
  for (const [sid, eid] of Object.entries(organizerWatching)) {
    if (eid === eventId) {
      io.to(sid).emit('organizer_section_update', { section, members, eventId })
    }
  }
}

// ── Socket.IO Events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const user = socket.user // decoded JWT payload
  console.log(`[+] Connected: ${user.anonymousId || user.username} (${socket.id})`)

  // ── JOIN SECTION ─────────────────────────────────────────────────────────
  socket.on('join_section', async ({ eventId, section }) => {
    try {
      const event = await Event.findById(eventId)
      if (!event || !event.isActive) {
        return socket.emit('error', { message: 'Event not found or inactive' })
      }
      if (!event.sections.includes(section)) {
        return socket.emit('error', { message: 'Invalid section' })
      }

      socket.eventId = eventId
      socket.section = section
      socket.anonymousId = user.anonymousId || user.username

      const roomName = `${eventId}_${section}`
      socket.join(roomName)

      addMember(eventId, section, socket.anonymousId, socket.id)
      io.to(roomName).emit('members_update', getMemberList(eventId, section))
      notifyOrganizersSectionUpdate(eventId, section)  // ← real-time organizer update

      // Load recent message history
      const history = await Message.find({ eventId, section, isPrivate: false })
        .sort({ time: 1 })
        .limit(50)
      socket.emit('message_history', history)

      console.log(`  → ${socket.anonymousId} joined [${section}] of event ${eventId}`)
    } catch (err) {
      socket.emit('error', { message: 'Failed to join section' })
    }
  })

  // ── SEND MESSAGE (auto urgency detection) ────────────────────────────────
  socket.on('send_message', async ({ eventId, section, message, imageUrl }) => {
    if (!message?.trim() && !imageUrl) return

    const urgency = detectUrgency(message || '')
    const roomName = `${eventId}_${section}`

    try {
      const saved = await Message.create({
        section,
        eventId,
        sender: socket.anonymousId,
        anonymousId: socket.anonymousId,
        message: message || '',
        messageType: imageUrl ? 'image' : urgency.isEmergency ? 'emergency' : 'normal',
        urgencyLevel: urgency.level,
        urgencyKeywords: urgency.keywords,
        isEmergency: urgency.isEmergency,
        imageUrl: imageUrl || null,
        time: new Date(),
      })

      io.to(roomName).emit('receive_message', saved)

      // Broadcast emergency alert if CRITICAL or HIGH
      if (urgency.isEmergency) {
        const alert = {
          _id: saved._id,
          section,
          eventId,
          sender: socket.anonymousId,
          message,
          urgencyLevel: urgency.level,
          urgencyKeywords: urgency.keywords,
          time: saved.time,
        }

        // ── Broadcast ONLY emergency_alert to all other sections ────────────
        // (No public receive_message — responders must use private chat only)
        try {
          const eventDoc = await Event.findById(eventId).select('sections').lean()
          if (eventDoc) {
            for (const sec of eventDoc.sections) {
              if (sec === section) continue
              io.to(`${eventId}_${sec}`).emit('emergency_alert', {
                ...alert,
                crossSection: true,
                originalSection: section,
              })
            }
          }
        } catch (broadcastErr) {
          console.error('Cross-section broadcast error:', broadcastErr)
        }

        // Notify all organizers watching this event
        for (const [sid, eid] of Object.entries(organizerWatching)) {
          if (eid === eventId) {
            io.to(sid).emit('organizer_alert', alert)
          }
        }
      }

      // Forward message to organizers watching the event
      for (const [sid, eid] of Object.entries(organizerWatching)) {
        if (eid === eventId) {
          io.to(sid).emit('organizer_message', saved)
        }
      }
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // ── REQUEST PRIVATE CHAT ─────────────────────────────────────────────────
  socket.on('request_private_chat', ({ eventId, section, topic, targetAnonymousId, alertId }) => {
    const roomId = 'priv_' + uuidv4().slice(0, 12)
    privateRooms[roomId] = {
      roomId,
      requesterId: socket.anonymousId,
      requesterSocketId: socket.id,
      targetId: targetAnonymousId,
      topic,
      section,
      eventId,
      alertId,          // ← the MongoDB _id of the emergency message
      participants: [socket.id],
    }

    // Find the target's socket and notify ONLY them (not the whole section)
    // This ensures the private chat request is delivered even across sections
    let targetNotified = false
    for (const [sid, sock] of io.of('/').sockets) {
      if (sock.anonymousId === targetAnonymousId) {
        io.to(sid).emit('private_chat_request', {
          roomId,
          requesterId: socket.anonymousId,
          topic,
          urgency: 'HIGH',
        })
        targetNotified = true
        break
      }
    }

    if (!targetNotified) {
      // Target not currently connected — fallback: broadcast to their section
      const targetRoom = `${eventId}_${section}`
      io.to(targetRoom).emit('private_chat_request', {
        roomId,
        requesterId: socket.anonymousId,
        topic,
        urgency: 'HIGH',
      })
    }

    socket.emit('private_room_created', { roomId, topic })
  })

  // ── RESOLVE PRIVATE CHAT (marks issue as done, closes both ends) ──────────
  socket.on('resolve_private_chat', ({ roomId }) => {
    const room = privateRooms[roomId]
    if (!room) return

    // 1. Close the private channel for both participants
    io.to(roomId).emit('private_chat_resolved', {
      roomId,
      resolvedBy: socket.anonymousId,
      message: 'Issue resolved. This private channel has been closed.',
    })

    // 2. Broadcast resolution to ALL sections — so Emergency Broadcasts panel auto-updates
    const resolvedPayload = {
      alertId:   room.alertId,
      roomId,
      topic:     room.topic,
      resolvedBy: socket.anonymousId,
      eventId:   room.eventId,
      originalSection: room.section,
      time: new Date(),
    }
    if (sectionMembers[room.eventId]) {
      for (const sec of Object.keys(sectionMembers[room.eventId])) {
        io.to(`${room.eventId}_${sec}`).emit('emergency_resolved', resolvedPayload)
      }
    }
    // Also notify organizers watching this event
    for (const [sid, eid] of Object.entries(organizerWatching)) {
      if (eid === room.eventId) io.to(sid).emit('emergency_resolved', resolvedPayload)
    }

    delete privateRooms[roomId]
    console.log(`  → Private room ${roomId} resolved by ${socket.anonymousId} (alert: ${room.alertId})`)
  })

  // ── ACCEPT PRIVATE CHAT ──────────────────────────────────────────────────
  socket.on('accept_private_chat', ({ roomId }) => {
    const room = privateRooms[roomId]
    if (!room) return socket.emit('error', { message: 'Room not found' })

    room.participants.push(socket.id)
    socket.join(roomId)
    io.to(room.requesterSocketId).socketsJoin(roomId)

    io.to(roomId).emit('private_chat_joined', {
      roomId,
      participants: [room.requesterId, socket.anonymousId],
      topic: room.topic,
    })
  })

  // ── SEND PRIVATE MESSAGE ─────────────────────────────────────────────────
  socket.on('send_private_message', ({ roomId, message }) => {
    if (!message?.trim()) return
    const room = privateRooms[roomId]
    if (!room) return

    const msg = {
      roomId,
      sender: socket.anonymousId,
      message,
      time: new Date(),
    }
    io.to(roomId).emit('receive_private_message', msg)
  })

  // ── ORGANIZER WATCH EVENT ────────────────────────────────────────────────
  socket.on('organizer_watch', async ({ eventId }) => {
    if (user.role !== 'organizer') return
    organizerWatching[socket.id] = eventId

    // Join all section rooms for this event
    const event = await Event.findById(eventId)
    if (event) {
      for (const section of event.sections) {
        socket.join(`${eventId}_${section}`)
      }
      // Send current member snapshot for every section immediately
      for (const section of event.sections) {
        socket.emit('organizer_section_update', {
          section,
          members: getMemberList(eventId, section),
          eventId,
        })
      }
    }
    socket.emit('organizer_watching', { eventId })
    console.log(`  → Organizer ${user.username} watching event ${eventId}`)
  })

  socket.on('organizer_unwatch', () => {
    delete organizerWatching[socket.id]
  })

  // ── DISCONNECT ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { eventId, section, anonymousId } = socket
    if (eventId && section) {
      removeMember(eventId, section, socket.id)
      io.to(`${eventId}_${section}`).emit('members_update', getMemberList(eventId, section))
      notifyOrganizersSectionUpdate(eventId, section)
    }
    delete organizerWatching[socket.id]
    console.log(`[-] Disconnected: ${anonymousId || user.username} (${socket.id})`)
  })
})

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000
server.listen(PORT, () => console.log(`🛡️  SecureCrowd server running on port ${PORT}`))