const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const Event = require('../models/Event')
const Message = require('../models/Message')
const { verifyToken, verifyOrganizer, verifyStaff } = require('../middleware/auth')

// POST /api/events/create  — organizer only
router.post('/create', verifyOrganizer, async (req, res) => {
  try {
    const { name, location, sections, startTime, endTime } = req.body
    if (!name || !location || !startTime || !endTime)
      return res.status(400).json({ error: 'name, location, startTime, endTime are required' })

    const event = await Event.create({
      name,
      location,
      sections: sections || ['A', 'B', 'C', 'D'],
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      organizerId: req.user.id,
      qrToken: uuidv4(),
    })

    res.status(201).json(event)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/events  — staff's events
router.get('/', verifyStaff, async (req, res) => {
  try {
    let events
    if (req.user.role === 'security') {
      // Security guards see all active events (or assigned ones, but for now all active)
      events = await Event.find({ isActive: true }).sort({ createdAt: -1 })
    } else {
      // Organizers see only their own events
      events = await Event.find({ organizerId: req.user.id }).sort({ createdAt: -1 })
    }
    res.json(events)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/events/:id  — single event detail
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
    if (!event) return res.status(404).json({ error: 'Event not found' })
    res.json(event)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/events/:id/close  — organizer closes event
router.put('/:id/close', verifyOrganizer, async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizerId: req.user.id },
      { isActive: false },
      { new: true }
    )
    if (!event) return res.status(404).json({ error: 'Event not found' })

    await Message.deleteMany({ eventId: event._id });

    const io = req.app.get('io')
    if (io) {
      const shutdownMessage = 'This event has been deactivated. All activities are now stopped.'
      
      // Notify and disconnect all attendees in this event
      for (const section of event.sections) {
        const roomName = `${event._id}_${section}`
        io.to(roomName).emit('event_deactivated', { message: shutdownMessage })
      }
      
      // Forcefully disconnect the sockets mapped to this event constraint
      const sockets = await io.fetchSockets()
      for (const socket of sockets) {
        if (socket.eventId === event._id.toString()) {
          socket.disconnect(true)
        }
      }
      
      // Optionally notify organizers watching the dashboard socket view
      const state = require('../sockets/state')
      for (const [sid, eid] of Object.entries(state.organizerWatching || {})) {
        if (eid === event._id.toString()) {
          io.to(sid).emit('event_deactivated_alert', { message: shutdownMessage, eventId: eid })
        }
      }
    }

    res.json({ message: 'Event closed', event })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/events/join  — attendee joins with QR token
router.post('/join', async (req, res) => {
  try {
    const { qrToken } = req.body
    if (!qrToken) return res.status(400).json({ error: 'QR token required' })

    const event = await Event.findOne({ qrToken })
    if (!event) return res.status(404).json({ error: 'Invalid event code' })
    if (!event.isActive) return res.status(403).json({ error: 'This event has ended' })

    const now = new Date()
    if (now > event.endTime) return res.status(403).json({ error: 'Event has already ended' })

    // Assign anonymous ID
    const anonymousId = 'Anon_' + uuidv4().slice(0, 8).toUpperCase()
    const token = jwt.sign(
      { anonymousId, eventId: event._id, role: 'attendee' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    )

    res.json({
      token,
      anonymousId,
      event: {
        id: event._id,
        name: event.name,
        location: event.location,
        sections: event.sections,
        endTime: event.endTime,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/events/:eventId/history?section=A  — message history
router.get('/:eventId/history', verifyToken, async (req, res) => {
  try {
    const { section } = req.query
    const query = { eventId: req.params.eventId }
    if (section) query.section = section
    const messages = await Message.find(query).sort({ time: 1 }).limit(100)
    res.json(messages)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
