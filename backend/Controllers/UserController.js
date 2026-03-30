const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const signToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )

// POST /api/users/register  (organizer account)
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' })

    const existing = await User.findOne({ username })
    if (existing) return res.status(409).json({ error: 'Username already taken' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await User.create({ username, password: hashed, role: 'organizer' })
    const token = signToken(user)

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/users/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' })

    const user = await User.findOne({ username })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(401).json({ error: 'Invalid credentials' })

    const token = signToken(user)
    res.json({
      token,
      user: { id: user._id, username: user.username, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
