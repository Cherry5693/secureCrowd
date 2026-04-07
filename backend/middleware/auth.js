const jwt = require('jsonwebtoken')

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Access token required' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

const verifyOrganizer = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'organizer') {
      return res.status(403).json({ error: 'Organizer access required' })
    }
    next()
  })
}

const verifyStaff = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== 'organizer' && req.user.role !== 'security') {
      return res.status(403).json({ error: 'Staff access required' })
    }
    next()
  })
}

// For Socket.IO middleware — call next(err) on failure
const verifySocketToken = (socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Authentication required'))
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    next(new Error('Invalid token'))
  }
}

module.exports = { verifyToken, verifyOrganizer, verifyStaff, verifySocketToken }
