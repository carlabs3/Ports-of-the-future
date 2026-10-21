import { persistParSubmission, buildParRanking } from '../services/parSubmissionService.js'

// PAR Index socket handlers. Registered in parallel with the existing
// sessionSocket handlers — this file does NOT touch sessionSocket.js.
export function registerParSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('par:submit', async ({ submissionId, sessionCode, group, portSize, governance, climateZone, coastalSetting, answers }) => {
      try {
        if (!sessionCode || !group || !answers) {
          socket.emit('error', { message: 'Faltan datos del PAR Index' })
          return
        }

        const result = await persistParSubmission({
          submissionId, sessionCode, group, portSize, governance, climateZone, coastalSetting, answers,
        })

        // Broadcast the full session ranking to everyone in the room.
        io.to(sessionCode).emit('par:update', await buildParRanking(sessionCode))

        // Send the computed result back to the submitting socket only, so its
        // result screen can display score/band/areas.
        socket.emit('par:result', {
          score: result.score,
          band:  result.band,
          areas: result.areas,
        })
      } catch (err) {
        console.error('par:submit error:', err.message)
        socket.emit('error', { message: 'Error al guardar el PAR Index' })
      }
    })
  })
}
