const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  sections: { type: [String], default: ['A', 'B', 'C', 'D'] },
  qrToken: { type: String, unique: true, default: () => uuidv4() },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  maxAttendees: { type: Number, default: 10000 },
  aiDebrief: { type: String },
  incidentCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
})

eventSchema.methods.isExpired = function () {
  return new Date() > this.endTime
}

eventSchema.methods.isJoinable = function () {
  const now = new Date()
  return this.isActive && now >= this.startTime && now <= this.endTime
}

module.exports = mongoose.model('Event', eventSchema)
