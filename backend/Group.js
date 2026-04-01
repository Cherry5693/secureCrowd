require('dotenv').config()

const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')

const connectDB = require('./config/db')
const { verifySocketToken } = require('./middleware/auth')
const userController = require('./Controllers/UserController')
const eventController = require('./Controllers/EventController')
const registerSocketHandlers = require('./sockets/handlers')
const { initCleanupJob } = require('./cron/eventCleanup')

// ── App Init ────────────────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

// ── Database ────────────────────────────────────────────────────────────────
connectDB()

// ── Server & Socket ────────────────────────────────────────────────────────
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })
app.set('io', io)

// ── REST Routes ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'SecureCrowd server running', version: '2.0' }))
app.use('/api/users', userController)
app.use('/api/events', eventController)

// ── Socket Core ─────────────────────────────────────────────────────────────
io.use(verifySocketToken)

io.on('connection', (socket) => {
  // Delegate all functional socket logic to handlers module
  registerSocketHandlers(io, socket)
})

// ── Start ───────────────────────────────────────────────────────────────────
initCleanupJob(io);

const PORT = process.env.PORT || 5000
server.listen(PORT, () => console.log(`🛡️  SecureCrowd server running on port ${PORT}`))