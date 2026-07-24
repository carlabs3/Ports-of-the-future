import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

import authRoutes from './src/routes/auth.js'
import sessionsRouter from './src/routes/sessions.js'
import parRouter from './src/routes/par.js'
import { registerSocketHandlers } from './src/sockets/sessionSocket.js'
import { registerParSocketHandlers } from './src/sockets/parSocket.js'
import { validateConfig } from './src/config/validateConfig.js'
import User from './src/models/User.js'

dotenv.config()

// Fail-fast: refuse to start if the domain catalogues are invalid.
const configSummary = validateConfig()
console.log(`Config OK — events: ${configSummary.events}, measures: ${configSummary.measures}, ports: ${configSummary.ports}`)

// Allowed frontend origins for CORS + Socket.io. FRONTEND_URL may be a single
// origin or a comma-separated list (e.g. local + the Vercel URL). Falls back to
// the Vite dev-server origins so local development works with no config.
// The SAME list is applied to both Express CORS and Socket.io below.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

app.set('io', io)
app.use(cors(corsOptions))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/sessions', sessionsRouter(io))
app.use('/api/par', parRouter(io))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

registerSocketHandlers(io)
registerParSocketHandlers(io)

const PORT = process.env.PORT || 5000

// Inicia el servidor HTTP de forma independiente a MongoDB
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected')
    await seedAdmin()
  })
  .catch((err) => {
    console.error(`MongoDB connection error: ${err.message}`)
    console.error('Los endpoints que requieren BD no estarán disponibles.')
  })

async function seedAdmin() {
  // Defensive: shout in the log if insecure defaults / missing secrets are in
  // use, so a forgotten env var in production is obvious instead of silent.
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️  WARNING: usando ADMIN_PASSWORD por defecto — NO usar en producción. Define ADMIN_PASSWORD en las variables de entorno.')
  }
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: JWT_SECRET no está definido — NO usar en producción. Define JWT_SECRET en las variables de entorno.')
  }

  // Admin credentials come from the environment. Defaults exist ONLY so local
  // development works with no setup; production must override both.
  const email    = process.env.ADMIN_EMAIL    || 'admin@portsofthefuture.com'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  const existing = await User.findOne({ email })
  if (existing) {
    console.log(`Admin already exists, skipping — ${email}`)
    return
  }

  try {
    const hash = await bcrypt.hash(password, 10)
    await User.create({ email, password: hash })
    console.log(`Admin created — ${email}`)
  } catch (err) {
    // Idempotent across restarts / races: a concurrent create just means it
    // now exists — never fail startup on a duplicate.
    if (err.code === 11000) {
      console.log(`Admin already exists, skipping — ${email}`)
    } else {
      console.error(`Admin seed error: ${err.message}`)
    }
  }
}
