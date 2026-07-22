import Participant from '../models/Participant.js'
import FootprintResult from '../models/FootprintResult.js'
import Session from '../models/Session.js'
import TeamActions from '../models/TeamActions.js'
import { ACTIONS } from '../utils/actions.js'
import { getCategory } from '../utils/category.js'

const AREA_KEY_MAP = {
  transporte:   'transport',
  energia:      'energy',
  alimentacion: 'food',
  consumo:      'consumption',
  residuos:     'waste',
}

// In-memory name store: participantId (string) -> display name
const participantNames = new Map()

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

        // Send existing ranking so the facilitator recovers after refresh/reconnect
        const existing = await FootprintResult.find({ sessionCode: code }).sort({ carbonTons: 1 })
        if (existing.length > 0) {
          const individual = existing.map(r => ({
            name:     participantNames.get(r.participantId?.toString()) || 'Anónimo',
            group:    r.group,
            tons:     r.carbonTons,
            category: r.category,
            areas:    r.areas || {},
            answers:  r.answers || {},
          }))
          socket.emit('ranking:update', { individual })
        }
      } catch {}
    })

    socket.on('session:join', async ({ code, name, group, age, gender }) => {
      try {
        socket.data.name = name || 'Anónimo'
        socket.data.group = group
        socket.data.sessionCode = code

        // Join the room IMMEDIATELY before any async DB operations
        // so the socket receives broadcasts (step:change etc.) without race conditions
        socket.join(code)
        console.log(`[socket] ${socket.id} joined room ${code} (group: ${group})`)

        const participant = await Participant.findOneAndUpdate(
          { socketId: socket.id },
          { sessionCode: code, group, age: age || '', gender: gender || '', socketId: socket.id },
          { upsert: true, new: true }
        )
        if (participant?._id) {
          participantNames.set(participant._id.toString(), socket.data.name)
        }

        // Track unique participant by group+name (reconnects reuse the same slot)
        const uniqueKey = `${group}_${name || socket.id}`
        if (!sessionParticipants.has(code)) sessionParticipants.set(code, new Map())
        sessionParticipants.get(code).set(uniqueKey, { name, group, socketId: socket.id })
        const totalUnique = sessionParticipants.get(code).size

        io.to(code).emit('participant:joined', { total: totalUnique, name, group })

        const session = await Session.findOne({ code }, 'status currentStep resultsRevealed step3Revealed')
        if (session) {
          if (session.currentStep >= 2) socket.emit('step:change', { step: session.currentStep })
          if (session.resultsRevealed)  socket.emit('results:revealed')
          if (session.status === 'closed') socket.emit('session:closed')
        }
      } catch {
        socket.emit('error', { message: 'Error al unirse a la sesión' })
      }
    })

    socket.on('team:join', async ({ code, group }) => {
      try {
        socket.join(code)
        socket.data.teamGroup = group
        socket.data.isTeamScreen = true

        const [session, results] = await Promise.all([
          Session.findOne({ code }, 'status currentStep resultsRevealed step3Revealed winnersRevealed'),
          FootprintResult.find({ sessionCode: code }),
        ])

        console.log(`[team:join] code=${code} urlGroup="${group}" | DB groups:`, results.map(r => r.group))

        if (session?.currentStep >= 2) socket.emit('step:change', { step: session.currentStep })
        if (session?.resultsRevealed)  socket.emit('results:revealed')
        if (session?.status === 'closed') socket.emit('session:closed')

        // Send confirmed actions for this team (handles late joiners)
        const teamTA = await TeamActions.findOne({ sessionCode: code, group })
        if (teamTA?.confirmed) {
          socket.emit('team:actionsConfirmed', {
            group: teamTA.group,
            actions: teamTA.actions,
            totalReduction: teamTA.totalReduction,
            newCarbonTons: teamTA.newCarbonTons,
            showValues: session?.step3Revealed || false,
          })
        }
        if (session?.step3Revealed) {
          const allTA = await TeamActions.find({ sessionCode: code })
          socket.emit('step3:revealed', { allActions: allTA.map(ta => ta.toObject()) })
        }

        if (results.length > 0) {
          const individual = results.map(r => ({
            name:     participantNames.get(r.participantId?.toString()) || 'Anónimo',
            group:    r.group,
            tons:     r.carbonTons,
            category: r.category,
            areas:    r.areas || {},
            answers:  r.answers || {},
          }))
          socket.emit('ranking:update', { individual })
        }
      } catch {
        socket.emit('error', { message: 'Error al unirse como equipo' })
      }
    })

    socket.on('step:change', async ({ sessionCode, step }) => {
      try {
        await Session.findOneAndUpdate({ code: sessionCode }, { currentStep: step })
        io.to(sessionCode).emit('step:change', { step })
      } catch {}
    })

    socket.on('results:reveal', async ({ sessionCode }) => {
      try {
        await Session.findOneAndUpdate({ code: sessionCode }, { resultsRevealed: true })
      } catch {}
      io.to(sessionCode).emit('results:revealed')
    })

    socket.on('footprint:submit', async ({ submissionId, sessionCode, group, age, gender, carbonTons, areas, answers }) => {
      try {
        // Only look up by socket.id — never fall back to group to avoid overwriting another participant's data
        const participant = await Participant.findOne({ socketId: socket.id })

        if (participant?._id && socket.data.name) {
          participantNames.set(participant._id.toString(), socket.data.name)
        }

        const category = getCategory(carbonTons)
        const mappedAreas = Object.fromEntries(
          Object.entries(areas || {}).map(([k, v]) => [AREA_KEY_MAP[k] ?? k, v])
        )

        const fallbackId = submissionId || `${sessionCode}_${group}_${carbonTons}`
        const updateDoc = {
          submissionId: fallbackId, sessionCode, group,
          age: age || '', gender: gender || '', carbonTons,
          areas: mappedAreas, category, answers: answers || {},
          participantId: participant?._id ?? null,
        }

        try {
          await FootprintResult.findOneAndUpdate(
            { submissionId: fallbackId },
            updateDoc,
            { upsert: true }
          )
        } catch (err) {
          if (err.code === 11000) {
            // Race between socket and HTTP fallback — document already inserted, just update
            await FootprintResult.findOneAndUpdate({ submissionId: fallbackId }, updateDoc)
          } else {
            throw err
          }
        }

        socket.emit('footprint:saved')

        const results = await FootprintResult.find({ sessionCode }).sort({ carbonTons: 1 })

        const individual = results.map(r => ({
          name: participantNames.get(r.participantId?.toString()) || 'Anónimo',
          group: r.group,
          tons: r.carbonTons,
          category: r.category,
          areas: r.areas || {},
          answers: r.answers || {},
        }))

        io.to(sessionCode).emit('ranking:update', { individual })
      } catch {
        socket.emit('error', { message: 'Error al guardar huella' })
      }
    })

    // ── Step 3 ─────────────────────────────────────────────────────────────────

    // Facilitator confirms actions for a team
    socket.on('team:confirmActions', async ({ sessionCode, group, actions, totalReduction, newCarbonTons }) => {
      try {
        await TeamActions.findOneAndUpdate(
          { sessionCode, group },
          { actions: actions || [], totalReduction: totalReduction || 0, newCarbonTons: newCarbonTons ?? 0, confirmed: true },
          { upsert: true, new: true }
        )
        const confirmedCount = await TeamActions.countDocuments({ sessionCode, confirmed: true })
        // Broadcast to room — TeamScreen filters by group
        io.to(sessionCode).emit('team:actionsConfirmed', {
          group,
          actions: actions || [],
          totalReduction: totalReduction || 0,
          newCarbonTons: newCarbonTons ?? 0,
          showValues: false,
        })
        // Notify facilitator of confirmation count
        io.to(sessionCode).emit('team:confirmed', { group, confirmedCount })
      } catch {
        socket.emit('error', { message: 'Error al confirmar acciones' })
      }
    })

    // Facilitator reveals all — sends CO2 values to all team screens
    socket.on('step3:reveal', async ({ sessionCode }) => {
      try {
        await Session.findOneAndUpdate({ code: sessionCode }, { step3Revealed: true })
        const allTeamActions = await TeamActions.find({ sessionCode })
        io.to(sessionCode).emit('step3:revealed', {
          allActions: allTeamActions.map(ta => ta.toObject()),
        })
      } catch {
        socket.emit('error', { message: 'Error al revelar step 3' })
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
