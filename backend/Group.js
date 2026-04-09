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

// ── App Init ─────────────────────────────────────────────
const app = express()

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}))

app.use(express.json())

// ── Routes ───────────────────────────────────────────────
const { geoRateLimiter, enforceGeoFencing } = require('./middleware/geoFencing.middleware');

app.use('/api', geoRateLimiter, enforceGeoFencing);

app.use('/api/users', userController)
app.use('/api/events', eventController)

// ── Start Function (IMPORTANT) ───────────────────────────
const startServer = async () => {
  try {
   
    await connectDB()

    const server = http.createServer(app)

    const io = new Server(server, {
      cors: { origin: '*' }
    })

    app.set('io', io)

    io.use(verifySocketToken)

    io.on('connection', (socket) => {
      registerSocketHandlers(io, socket)
    })


    initCleanupJob(io)

    const PORT = process.env.PORT || 5000

    server.listen(PORT, () => {
      console.log(`SecureCrowd server running on port ${PORT}`)
    })

  } catch (err) {
    console.error("Server failed to start:", err.message)
    process.exit(1)
  }
}


startServer()