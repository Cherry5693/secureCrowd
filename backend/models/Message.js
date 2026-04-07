const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
  section: { type: String, required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  sender: { type: String, default: 'Anonymous' },
  anonymousId: String,
  message: { type: String, required: true },
  messageType: {
    type: String,
    enum: ['normal', 'emergency', 'private', 'image', 'announcement'],
    default: 'normal',
  },
  urgencyLevel: {
    type: String,
    enum: ['NORMAL', 'HIGH', 'CRITICAL'],
    default: 'NORMAL',
  },
  urgencyKeywords: [String],
  isEmergency: { type: Boolean, default: false },
  translation: String,
  isPrivate: { type: Boolean, default: false },
  privateRoomId: String,
  privateChatMode: {
    type: String,
    enum: ['open', 'controlled'],
    default: 'controlled',
  },
  location: {
    lat: Number,
    lng: Number,
  },
  resolved: { type: Boolean, default: false },
  resolvedBy: String,
  imageUrl: String,
  time: { type: Date, default: Date.now },
})

// Auto-delete messages after 24 hours
messageSchema.index({ time: 1 }, { expireAfterSeconds: 86400 })

module.exports = mongoose.model('Message', messageSchema)