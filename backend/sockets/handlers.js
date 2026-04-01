const { v4: uuidv4 } = require('uuid')
const { detectUrgency } = require('../services/urgencyDetector')
const { uploadImage } = require('../services/cloudinaryUpload')
const Message = require('../models/Message')
const Event = require('../models/Event')
 const axios = require('axios')

const state = require('./state')

/**
 * registerSocketHandlers
 * Attaches all domain-specific socket events to a connected client.
 * 
 * @param {import('socket.io').Server} io - the global socket server instance
 * @param {import('socket.io').Socket} socket - the individual connected client
 */
module.exports = function registerSocketHandlers(io, socket) {
  const user = socket.user // decoded JWT payload

  // ── Helper ─────────────────────────────────────────────────────────────
  const notifyOrganizersSectionUpdate = (eventId, section) => {
    const members = state.getMemberList(eventId, section)
    for (const [sid, eid] of Object.entries(state.organizerWatching)) {
      if (eid === eventId) {
        io.to(sid).emit('organizer_section_update', { section, members, eventId })
      }
    }
  }

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

      state.addMember(eventId, section, socket.anonymousId, socket.id)
      io.to(roomName).emit('members_update', state.getMemberList(eventId, section))
      notifyOrganizersSectionUpdate(eventId, section)

      const history = await Message.find({ eventId, section, isPrivate: false })
        .sort({ time: 1 })
        .limit(50)
      socket.emit('message_history', history)

      console.log(`  → ${socket.anonymousId} joined [${section}] of event ${eventId}`)
    } catch (err) {
      socket.emit('error', { message: 'Failed to join section' })
    }
  })

  // ── SEND MESSAGE ─────────────────────────────────────────────────────────
  socket.on('send_message', async ({ eventId, section, message, imageUrl, privateChatMode = 'controlled' }) => {
    if (!message?.trim() && !imageUrl) return

    if (state.isRateLimited(socket.id)) {
      return socket.emit('rate_limited', {
        message: 'You are sending messages too fast. Please wait a moment.',
      })
    }

    let urgency = detectUrgency(message || '')

    // HYBRID AI: Only call Python if NORMAL
    if (urgency.level === 'NORMAL' && message && message.length > 15) {
      try {
        const mlRes = await axios.post('http://localhost:8000/analyze', {
          message,
          section
        })

        const ml = mlRes.data

        // Override ONLY if ML detects emergency
        if (ml.emergency) {
          urgency = {
            level: ml.severity === 'high' ? 'CRITICAL' : 'HIGH',
            confidence: ml.confidence,
            keywords: [],
            labels: [ml.category],
            isEmergency: true
          }
        }

      } catch (err) {
        console.error('[ML API ERROR]', err.message)
        // fallback: keep keyword result
      }
    }

    const roomName = `${eventId}_${section}`

    try {
      let finalImageUrl = null

      if (imageUrl) {
        try {
          finalImageUrl = await uploadImage(imageUrl)
        } catch (uploadErr) {
          console.error('[Cloudinary] Upload failed:', uploadErr.message)
          return socket.emit('error', { message: 'Image upload failed. Please try again.' })
        }
      }

      const saved = await Message.create({
        section,
        eventId,
        sender: socket.anonymousId,
        anonymousId: socket.anonymousId,
        message: message || '',
        messageType: finalImageUrl
          ? 'image'
          : urgency.isEmergency
          ? 'emergency'
          : 'normal',

        urgencyLevel: urgency.level,
        urgencyKeywords: urgency.keywords,
        isEmergency: urgency.isEmergency,
        privateChatMode: urgency.isEmergency ? privateChatMode : 'controlled',
        imageUrl: finalImageUrl,
        time: new Date(),
      })

      io.to(roomName).emit('receive_message', saved)

      //  EMERGENCY FLOW 
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
        } catch (err) {
          console.error('Cross-section broadcast error:', err)
        }

        // Organizer alerts
        for (const [sid, eid] of Object.entries(state.organizerWatching)) {
          if (eid === eventId) io.to(sid).emit('organizer_alert', alert)
        }
      }

      // Organizer normal messages
      for (const [sid, eid] of Object.entries(state.organizerWatching)) {
        if (eid === eventId) io.to(sid).emit('organizer_message', saved)
      }

    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // ── REQUEST PRIVATE CHAT ─────────────────────────────────────────────────
  socket.on('request_private_chat', async ({ eventId, section, topic, targetAnonymousId, alertId }) => {
    const roomId = 'priv_' + uuidv4().slice(0, 12)
    state.privateRooms[roomId] = {
      roomId,
      requesterId: socket.anonymousId,
      requesterSocketId: socket.id,
      targetId: targetAnonymousId,
      topic,
      section,
      eventId,
      alertId,
      participants: [socket.id],
    }

    // Lookup original message to detect open or controlled mode
    let mode = 'controlled'
    if (alertId) {
      try {
        const msg = await Message.findById(alertId).lean()
        if (msg) mode = msg.privateChatMode || 'controlled'
      } catch (err) { }
    }

    let targetSockets = []
    for (const [sid, sock] of io.of('/').sockets) {
      if (sock.anonymousId === targetAnonymousId) {
        targetSockets.push(sock)
      }
    }

    if (mode === 'open') {
      // Auto-accept the request instantly
      socket.join(roomId)
      for (const tSock of targetSockets) {
        tSock.join(roomId)
        state.privateRooms[roomId].participants.push(tSock.id)
      }

      // Ensure both requester and target mount the UI
      const targetRoomPayload = { roomId, topic, requesterId: socket.anonymousId, targetId: targetAnonymousId }
      socket.emit('private_room_created', targetRoomPayload)
      for (const tSock of targetSockets) {
        tSock.emit('private_room_created', targetRoomPayload)
      }

      // Notify both parties that chat is instantly open
      const joinedPayload = {
        roomId,
        participants: [socket.anonymousId, targetAnonymousId],
        topic,
      }
      
      // Delay slightly so the UI renders the room before joined signal hits
      setTimeout(() => io.to(roomId).emit('private_chat_joined', joinedPayload), 100)
      
      console.log(`  → Instant Private chat [OPEN] ${roomId} between ${socket.anonymousId} and ${targetAnonymousId}`)
      
    } else {
      // Controlled mode — require target to Accept 
      let targetNotified = false
      for (const tSock of targetSockets) {
        tSock.emit('private_chat_request', {
          roomId,
          requesterId: socket.anonymousId,
          targetId: targetAnonymousId,
          topic,
          urgency: 'HIGH',
        })
        targetNotified = true
      }

      if (!targetNotified) {
        const targetRoom = `${eventId}_${section}`
        io.to(targetRoom).emit('private_chat_request', {
          roomId,
          requesterId: socket.anonymousId,
          targetId: targetAnonymousId,
          topic,
          urgency: 'HIGH',
        })
      }

      socket.emit('private_room_created', { roomId, topic, requesterId: socket.anonymousId, targetId: targetAnonymousId })
    }
  })

  // ── RESOLVE PRIVATE CHAT ─────────────────────────────────────────────────
  socket.on('resolve_private_chat', ({ roomId }) => {
    const room = state.privateRooms[roomId]
    if (!room) return
    if (room.targetId !== socket.anonymousId) {
      return socket.emit('error', { message: 'Only the original sender can resolve this emergency.' })
    }

    io.to(roomId).emit('private_chat_resolved', {
      roomId,
      resolvedBy: socket.anonymousId,
      message: 'Issue resolved. This private channel has been closed.',
    })

    const resolvedPayload = {
      alertId:   room.alertId,
      roomId,
      topic:     room.topic,
      resolvedBy: socket.anonymousId,
      eventId:   room.eventId,
      originalSection: room.section,
      time: new Date(),
    }
    if (state.sectionMembers[room.eventId]) {
      for (const sec of Object.keys(state.sectionMembers[room.eventId])) {
        io.to(`${room.eventId}_${sec}`).emit('emergency_resolved', resolvedPayload)
      }
    }
    for (const [sid, eid] of Object.entries(state.organizerWatching)) {
      if (eid === room.eventId) io.to(sid).emit('emergency_resolved', resolvedPayload)
    }

    delete state.privateRooms[roomId]
    console.log(`  → Private room ${roomId} resolved by ${socket.anonymousId} (alert: ${room.alertId})`)
  })

  // ── ACCEPT PRIVATE CHAT ──────────────────────────────────────────────────
  socket.on('accept_private_chat', async ({ roomId }) => {
    const room = state.privateRooms[roomId]
    if (!room) return socket.emit('error', { message: 'Room not found' })

    room.participants.push(socket.id)
    socket.join(roomId)
    io.to(room.requesterSocketId).socketsJoin(roomId)

    io.to(roomId).emit('private_chat_joined', {
      roomId,
      participants: [room.requesterId, socket.anonymousId],
      topic: room.topic,
    })

    try {
      const history = await Message.find({ privateRoomId: roomId, isPrivate: true })
        .sort({ time: 1 })
        .limit(100)
      if (history.length > 0) {
        io.to(roomId).emit('private_message_history', history)
      }
    } catch (err) {
      console.error('[DB] Failed to load private message history:', err.message)
    }
  })

  // ── SEND PRIVATE MESSAGE ─────────────────────────────────────────────────
  socket.on('send_private_message', async ({ roomId, message }) => {
    if (!message?.trim()) return
    const room = state.privateRooms[roomId]
    if (!room) return

    const msg = {
      roomId,
      sender: socket.anonymousId,
      message,
      time: new Date(),
    }

    try {
      await Message.create({
        section:      room.section,
        eventId:      room.eventId,
        sender:       socket.anonymousId,
        anonymousId:  socket.anonymousId,
        message,
        messageType:  'private',
        urgencyLevel: 'NORMAL',
        isEmergency:  false,
        isPrivate:    true,
        privateRoomId: roomId,
        time:         msg.time,
      })
    } catch (err) {
      console.error('[DB] Failed to persist private message:', err.message)
    }

    io.to(roomId).emit('receive_private_message', msg)
  })

  // ── ORGANIZER BROADCAST ──────────────────────────────────────────────────
  socket.on('organizer_broadcast', async ({ eventId, message }) => {
    if (user.role !== 'organizer' || !message?.trim()) return

    try {
      const saved = await Message.create({
        eventId,
        section: 'ALL',      // special section identifier for broadcasts
        sender: 'ORGANIZER',
        anonymousId: 'ORGANIZER',
        message: message.trim(),
        messageType: 'announcement',
        urgencyLevel: 'NORMAL',
        isEmergency: false,
        time: new Date(),
      })

      const event = await Event.findById(eventId).lean()
      if (event) {
        for (const section of event.sections) {
          // We attach an isAnnouncement flag so the frontend knows how to style it
          io.to(`${eventId}_${section}`).emit('receive_message', {
            ...saved.toObject(),
            isAnnouncement: true,
          })
        }
      }

      // Echo back to checking organizers
      for (const [sid, eid] of Object.entries(state.organizerWatching)) {
        if (eid === eventId) io.to(sid).emit('organizer_message', saved)
      }
      
      console.log(`  → Organizer ${user.username} broadcasted to event ${eventId}`)
    } catch (err) {
      console.error('[Broadcast Error]', err)
      socket.emit('error', { message: 'Failed to broadcast message' })
    }
  })

  // ── ORGANIZER WATCH EVENT ────────────────────────────────────────────────
  socket.on('organizer_watch', async ({ eventId }) => {
    if (user.role !== 'organizer') return
    state.organizerWatching[socket.id] = eventId

    const event = await Event.findById(eventId)
    if (event) {
      for (const section of event.sections) {
        socket.join(`${eventId}_${section}`)
        socket.emit('organizer_section_update', {
          section,
          members: state.getMemberList(eventId, section),
          eventId,
        })
      }
    }
    socket.emit('organizer_watching', { eventId })
    console.log(`  → Organizer ${user.username} watching event ${eventId}`)
  })

  socket.on('organizer_unwatch', () => {
    delete state.organizerWatching[socket.id]
  })

  // ── DISCONNECT ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { eventId, section, anonymousId } = socket
    if (eventId && section) {
      state.removeMember(eventId, section, socket.id)
      io.to(`${eventId}_${section}`).emit('members_update', state.getMemberList(eventId, section))
      notifyOrganizersSectionUpdate(eventId, section)
    }
    state.cleanupSocket(socket.id)
    console.log(`[-] Disconnected: ${anonymousId || user.username} (${socket.id})`)
  })
}
