import Participant from '../models/Participant.js'
import Session from '../models/Session.js'

// Unique participant tracker: code -> Map(uniqueKey -> { name, group, socketId })
const sessionParticipants = new Map()

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('facilitator:join', async ({ code }) => {
      socket.join(code)
      try {
        const mapSize = sessionParticipants.get(code)?.size ?? 0
        const total = mapSize > 0 ? mapSize : await Participant.countDocuments({ sessionCode: code })
        socket.emit('participant:joined', { total })
      } catch {}
    })

    socket.on('session:join', async ({ code, name, group }) => {
      try {
        socket.data.name = name || 'Anónimo'
        socket.data.group = group
        socket.data.sessionCode = code

        // Join the room IMMEDIATELY before any async DB operations
        // so the socket receives broadcasts without race conditions
        socket.join(code)
        console.log(`[socket] ${socket.id} joined room ${code} (group: ${group})`)

        await Participant.findOneAndUpdate(
          { socketId: socket.id },
          { sessionCode: code, group, socketId: socket.id },
          { upsert: true, new: true }
        )

        // Track unique participant by group+name (reconnects reuse the same slot)
        const uniqueKey = `${group}_${name || socket.id}`
        if (!sessionParticipants.has(code)) sessionParticipants.set(code, new Map())
        sessionParticipants.get(code).set(uniqueKey, { name, group, socketId: socket.id })
        const totalUnique = sessionParticipants.get(code).size

        io.to(code).emit('participant:joined', { total: totalUnique, name, group })

        const session = await Session.findOne({ code }, 'status')
        if (session && session.status === 'closed') socket.emit('session:closed')
      } catch {
        socket.emit('error', { message: 'Error al unirse a la sesión' })
      }
    })

    socket.on('disconnect', async () => {
      await Participant.findOneAndUpdate({ socketId: socket.id }, { socketId: null }).catch(() => {})

      // Mark disconnected but keep in unique count so it doesn't drop
      sessionParticipants.forEach(participants => {
        participants.forEach(p => {
          if (p.socketId === socket.id) p.socketId = null
        })
      })
    })
  })
}
