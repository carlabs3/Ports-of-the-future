import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

import authRoutes from './src/routes/auth.js'
import sessionsRouter from './src/routes/sessions.js'
import resultRoutes from './src/routes/results.js'
import parRouter from './src/routes/par.js'
import { registerSocketHandlers } from './src/sockets/sessionSocket.js'
import { registerParSocketHandlers } from './src/sockets/parSocket.js'
import { validateConfig } from './src/config/validateConfig.js'
import User from './src/models/User.js'

dotenv.config()

// Fail-fast: refuse to start if the domain catalogues are invalid.
const configSummary = validateConfig()
console.log(`Config OK — events: ${configSummary.events}, measures: ${configSummary.measures}, ports: ${configSummary.ports}`)

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://co2-sprint-app.vercel.app',
  'https://co2-sprint-app-carlabs3s-projects.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean)

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
app.use('/api/results', resultRoutes)
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
  const existing = await User.findOne({ email: 'admin@co2sprint.com' })
  if (!existing) {
    const hash = await bcrypt.hash('admin123', 10)
    await User.create({ email: 'admin@co2sprint.com', password: hash })
    console.log('Admin creado — email: admin@co2sprint.com / password: admin123')
  }
}
