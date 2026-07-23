import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import Session from '../models/Session.js'
import Participant from '../models/Participant.js'
import TeamStrategy from '../models/TeamStrategy.js'
import ParIndexResult from '../models/ParIndexResult.js'
import { generateCode } from '../utils/generateCode.js'
import { validatePortAssignments } from '../services/portAssignmentService.js'

const STEP_MAP = { waiting: 1, active: 2, closed: 3 }

export default function sessionsRouter(io) {
  const router = Router()

  // Public: info needed by join/waiting screens (groups, name, status, resultsRevealed)
  router.get('/:code/info', async (req, res) => {
    try {
      const session = await Session.findOne({ code: req.params.code }, 'code name groups portAssignments status currentStep resultsRevealed step3Revealed winnersRevealed')
      // Note: 'draft' and 'closed' statuses are intentionally included
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      res.json({
        code:            session.code,
        name:            session.name,
        groups:          session.groups,
        portAssignments: session.portAssignments || [],
        status:          session.status,
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
      const { groups, name, portAssignments } = req.body
      const groupList = groups || []

      // Phase 6: validate port assignments (one distinct existing port per group).
      const check = validatePortAssignments(groupList, portAssignments || [])
      if (!check.ok) return res.status(400).json({ error: check.error })

      const code = await generateCode()
      const session = await Session.create({
        code,
        facilitatorId: req.user.id,
        name: name || '',
        groups: groupList,
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

  router.patch('/:code/status', async (req, res) => {
    try {
      const { status } = req.body
      const session = await Session.findOneAndUpdate(
        { code: req.params.code, facilitatorId: req.user.id },
        { status },
        { new: true }
      )
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      io.to(req.params.code).emit('step:change', { step: STEP_MAP[status] ?? 1 })
      res.json(session)
    } catch {
      res.status(500).json({ error: 'Error al actualizar estado' })
    }
  })

  router.patch('/:code/step', async (req, res) => {
    try {
      const { step } = req.body
      const session = await Session.findOneAndUpdate(
        { code: req.params.code, facilitatorId: req.user.id },
        { currentStep: step },
        { new: true }
      )
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Error al actualizar step' })
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

  // Close session (keep data, notify participants)
  router.patch('/:code/close', async (req, res) => {
    try {
      const { code } = req.params
      const session = await Session.findOneAndUpdate(
        { code, facilitatorId: req.user.id },
        { status: 'closed' },
        { new: true }
      )
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      io.to(code).emit('session:closed')
      res.json({ ok: true })
    } catch {
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
