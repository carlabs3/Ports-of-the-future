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
import { registerSocketHandlers } from './src/sockets/sessionSocket.js'
import User from './src/models/User.js'

dotenv.config()

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

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

registerSocketHandlers(io)

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
