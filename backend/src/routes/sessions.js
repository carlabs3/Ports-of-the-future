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
      const session = await Session.findOne({ code: req.params.code }, 'code name groups portAssignments status phase currentStep resultsRevealed step3Revealed winnersRevealed configVersion')
      // Note: 'draft' and 'closed' statuses are intentionally included
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      // How many people joined each team (vs how many submitted — that comes from
      // the CAP results). Used by the Teams screen's "N of M answered".
      const counts = await Participant.aggregate([
        { $match: { sessionCode: req.params.code } },
        { $group: { _id: '$group', n: { $sum: 1 } } },
      ])
      const memberCounts = Object.fromEntries(counts.map(c => [c._id, c.n]))
      res.json({
        code:            session.code,
        name:            session.name,
        groups:          session.groups,
        portAssignments: session.portAssignments || [],
        memberCounts,
        status:          session.status,
        phase:           session.phase || 'join',
        currentStep:     session.currentStep,
        resultsRevealed: session.resultsRevealed,
        step3Revealed:   session.step3Revealed,
        winnersRevealed: session.winnersRevealed,
        configVersion:   session.configVersion || null,
        // Legacy (pre-v4) sessions are test data — flag so the UI can say the
        // session was created with an older version of the workshop.
        isLegacy:        session.configVersion !== 'v4',
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
        configVersion: 'v4',
      })

      // Create one TeamStrategy per group. v4 defaults apply: portfolio empty,
      // coins 6, round 1, startingBand null until PARI/lock.
      await TeamStrategy.insertMany(
        portAssignments.map(pa => ({ sessionCode: code, group: pa.group, portId: pa.portId }))
      )

      res.status(201).json(session)
    } catch {
      res.status(500).json({ error: 'Error al crear sesión' })
    }
  })

  // Facilitator: re-roll the random port assignment. Allowed ONLY until a team
  // commits to its port — once ANY team has bought a card, re-shuffling is
  // blocked (409). v4 decks are port-specific, so reshuffling after a buy would
  // orphan cards that don't exist in the new port's deck. Ports stay hidden on
  // the projected screen until the Roulette tab regardless.
  router.post('/:code/shuffle-ports', async (req, res) => {
    try {
      const { code } = req.params
      const session = await Session.findOne({ code, facilitatorId: req.user.id })
      if (!session) return res.status(404).json({ error: 'Session not found' })

      const committed = await TeamStrategy.findOne({
        sessionCode: code,
        $or: [
          { 'portfolio.0': { $exists: true } },
          { roundLocked: true },
          { 'rounds.0': { $exists: true } },
        ],
      }).select('group -_id')
      if (committed) {
        return res.status(409).json({
          error: 'Ports can no longer be shuffled: a team has already committed to its port.',
        })
      }

      const portAssignments = assignRandomPorts(session.groups || [])
      session.portAssignments = portAssignments
      await session.save()

      // Re-point each team's strategy at its new port. The gate above guarantees
      // every portfolio is still empty, so no bought card is orphaned.
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
  const SESSION_PHASES = ['join', 'par', 'teams', 'strategy', 'wheel', 'debrief']
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
