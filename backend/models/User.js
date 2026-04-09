const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, sparse: true, unique: true, trim: true },
    isEmailVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    password: { type: String, required: true },
    role: { type: String, enum: ['organizer', 'attendee', 'security'], default: 'organizer' },
    seat: { type: String, default: '' },
    section: { type: String, default: '' },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdAt: { type: Date, default: Date.now },
})

const User = mongoose.model("User", userSchema)
module.exports = User