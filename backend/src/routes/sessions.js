import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import Session from '../models/Session.js'
import Participant from '../models/Participant.js'
import TeamStrategy from '../models/TeamStrategy.js'
import ParIndexResult from '../models/ParIndexResult.js'
import { generateCode } from '../utils/generateCode.js'
import { generateTeamNames, validateTeamCount, assignRandomPorts } from '../services/portAssignmentService.js'
import { buildSessionSummary } from '../services/parSubmissionService.js'

export default function sessionsRouter(io) {
  const router = Router()

  // Public: info needed by join/waiting screens (groups, name, status, resultsRevealed)
  router.get('/:code/info', async (req, res) => {
    try {
      const session = await Session.findOne({ code: req.params.code }, 'code name groups portAssignments status phase currentStep resultsRevealed step3Revealed winnersRevealed')
      // Note: 'draft' and 'closed' statuses are intentionally included
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      res.json({
        code:            session.code,
        name:            session.name,
        groups:          session.groups,
        portAssignments: session.portAssignments || [],
        status:          session.status,
        phase:           session.phase || 'join',
        currentStep:     session.currentStep,
        resultsRevealed: session.resultsRevealed,
        step3Revealed:   session.step3Revealed,
        winnersRevealed: session.winnersRevealed,
      })
    } catch {
      res.status(500).json({ error: 'Error al obtener sesión' })
    }
  })

  router.use(authMiddleware)

  router.post('/', async (req, res) => {
    try {
      const { name, teamCount } = req.body

      // Teams are generated server-side (Team A … Team H) from a count, and each
      // team is assigned a RANDOM distinct port. The client never names teams or
      // picks ports.
      const count = Number(teamCount)
      const check = validateTeamCount(count)
      if (!check.ok) return res.status(400).json({ error: check.error })

      const groups = generateTeamNames(count)
      const portAssignments = assignRandomPorts(groups)

      const code = await generateCode()
      const session = await Session.create({
        code,
        facilitatorId: req.user.id,
        name: name || '',
        groups,
        portAssignments,
      })

      // Create one TeamStrategy per group (measures empty, cultureBand null now).
      await TeamStrategy.insertMany(
        portAssignments.map(pa => ({ sessionCode: code, group: pa.group, portId: pa.portId }))
      )

      res.status(201).json(session)
    } catch {
      res.status(500).json({ error: 'Error al crear sesión' })
    }
  })

  // Facilitator: re-roll the random port assignment. Allowed ONLY before the
  // Strategy phase (join/par) — once teams start locking measures against their
  // port, re-shuffling would be unfair, so this returns 409 from 'strategy' on.
  // Ports stay hidden on the projected screen until the Roulette tab regardless.
  const SHUFFLE_BLOCKED_PHASES = ['strategy', 'wheel', 'debrief']
  router.post('/:code/shuffle-ports', async (req, res) => {
    try {
      const { code } = req.params
      const session = await Session.findOne({ code, facilitatorId: req.user.id })
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })

      if (SHUFFLE_BLOCKED_PHASES.includes(session.phase)) {
        return res.status(409).json({
          error: 'Ports can no longer be shuffled: the Strategy phase has started.',
          phase: session.phase,
        })
      }

      const portAssignments = assignRandomPorts(session.groups || [])
      session.portAssignments = portAssignments
      await session.save()

      // Re-point each team's strategy at its new port (measures stay untouched;
      // in join/par they are still empty and no draw has happened).
      await Promise.all(portAssignments.map(pa =>
        TeamStrategy.updateOne({ sessionCode: code, group: pa.group }, { portId: pa.portId })
      ))

      res.json({ ok: true, portAssignments })
    } catch {
      res.status(500).json({ error: 'Could not shuffle the ports' })
    }
  })

  router.get('/', async (req, res) => {
    try {
      const sessions = await Session.find({ facilitatorId: req.user.id }).sort({ createdAt: -1 })
      res.json(sessions)
    } catch {
      res.status(500).json({ error: 'Error al obtener sesiones' })
    }
  })

  router.get('/:code', async (req, res) => {
    try {
      const session = await Session.findOne({ code: req.params.code, facilitatorId: req.user.id })
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      res.json(session)
    } catch {
      res.status(500).json({ error: 'Error al obtener sesión' })
    }
  })

  // Activate a draft session so participants can join
  router.patch('/:code/activate', async (req, res) => {
    try {
      const session = await Session.findOneAndUpdate(
        { code: req.params.code, facilitatorId: req.user.id },
        { status: 'active' },
        { new: true }
      )
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Error al activar sesión' })
    }
  })

  // Facilitator-driven control-centre phase. Manual only — never derived from
  // data. Persists so a reload / different laptop stays on the same phase, and
  // broadcasts phase:change to the room. Independent of currentStep/STEP_MAP.
  const SESSION_PHASES = ['join', 'par', 'strategy', 'wheel', 'debrief']
  router.patch('/:code/phase', async (req, res) => {
    try {
      const { phase } = req.body
      if (!SESSION_PHASES.includes(phase)) {
        return res.status(400).json({ error: 'Fase no válida' })
      }
      const session = await Session.findOneAndUpdate(
        { code: req.params.code, facilitatorId: req.user.id },
        { phase },
        { new: true }
      )
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      io.to(req.params.code).emit('phase:change', { phase })
      res.json({ ok: true, phase })
    } catch {
      res.status(500).json({ error: 'Error al cambiar de fase' })
    }
  })

  // Close session (keep data, notify participants). Computes and stores the
  // aggregate PARI summary at close.
  router.patch('/:code/close', async (req, res) => {
    try {
      const { code } = req.params
      const summary = await buildSessionSummary(code)
      const session = await Session.findOneAndUpdate(
        { code, facilitatorId: req.user.id },
        { status: 'closed', ...(summary && { summary }) },
        { new: true }
      )
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      io.to(code).emit('session:closed')
      res.json({ ok: true, summary: session.summary || null })
    } catch (err) {
      console.error('Close session error:', err.message)
      res.status(500).json({ error: 'Error al cerrar sesión' })
    }
  })

  router.delete('/:code', async (req, res) => {
    try {
      const { code } = req.params
      const session = await Session.findOne({ code, facilitatorId: req.user.id })
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })

      // Notify participants before deleting
      io.to(code).emit('session:closed')

      await Promise.all([
        Session.deleteOne({ code }),
        Participant.deleteMany({ sessionCode: code }),
        ParIndexResult.deleteMany({ sessionCode: code }),
        TeamStrategy.deleteMany({ sessionCode: code }),
      ])

      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Error al eliminar sesión' })
    }
  })

  return router
}
