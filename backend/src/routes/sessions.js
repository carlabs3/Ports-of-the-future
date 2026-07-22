import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import Session from '../models/Session.js'
import FootprintResult from '../models/FootprintResult.js'
import Participant from '../models/Participant.js'
import TeamActions from '../models/TeamActions.js'
import { ACTIONS } from '../utils/actions.js'
import { generateCode } from '../utils/generateCode.js'

const STEP_MAP = { waiting: 1, active: 2, closed: 3 }

export default function sessionsRouter(io) {
  const router = Router()

  // Public: info needed by join/waiting screens (groups, name, status, resultsRevealed)
  router.get('/:code/info', async (req, res) => {
    try {
      const session = await Session.findOne({ code: req.params.code }, 'code name groups status currentStep resultsRevealed step3Revealed winnersRevealed')
      // Note: 'draft' and 'closed' statuses are intentionally included
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      res.json({
        code:            session.code,
        name:            session.name,
        groups:          session.groups,
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

  // Public: step 3 data — all team actions + rankings
  router.get('/:code/step3', async (req, res) => {
    try {
      const { code } = req.params
      const [session, teamActions, results] = await Promise.all([
        Session.findOne({ code }, 'groups step3Revealed winnersRevealed'),
        TeamActions.find({ sessionCode: code }),
        FootprintResult.find({ sessionCode: code }),
      ])
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })

      // Group average original carbon tons
      const groupAvg = {}
      const groupCount = {}
      for (const r of results) {
        groupAvg[r.group]   = (groupAvg[r.group]   || 0) + r.carbonTons
        groupCount[r.group] = (groupCount[r.group] || 0) + 1
      }
      Object.keys(groupAvg).forEach(g => { groupAvg[g] = groupAvg[g] / groupCount[g] })

      const groups = session.groups || []
      const teams = groups.map(group => {
        const ta  = teamActions.find(t => t.group === group)
        const orig = groupAvg[group] ?? null
        const red  = ta?.totalReduction || 0
        return {
          group,
          confirmed:      ta?.confirmed      || false,
          confirmedFinal: ta?.confirmedFinal || false,
          actions:        ta?.actions        || [],
          pointsUsed:     ta?.pointsUsed     || 0,
          totalReduction: red,
          originalTons:   orig ? Math.round(orig * 100) / 100 : null,
          newTons:        orig ? Math.max(0, Math.round((orig - red / 1000) * 100) / 100) : null,
        }
      })

      // Action stats (only when revealed)
      const actionStats = session.step3Revealed
        ? ACTIONS.map(a => {
            const choosers = teamActions.filter(ta => ta.actions.includes(a.id))
            return { ...a, count: choosers.length, teams: choosers.map(ta => ta.group) }
          }).filter(a => a.count > 0).sort((a, b) => b.co2Reduction - a.co2Reduction)
        : []

      const allConfirmed      = groups.length > 0 && groups.every(g => teamActions.find(t => t.group === g)?.confirmed)
      const allConfirmedFinal = groups.length > 0 && groups.every(g => teamActions.find(t => t.group === g)?.confirmedFinal)

      res.json({
        teams,
        actionStats,
        allConfirmed,
        allConfirmedFinal,
        step3Revealed:   session.step3Revealed,
        winnersRevealed: session.winnersRevealed,
        totalGroups:     groups.length,
      })
    } catch {
      res.status(500).json({ error: 'Error al obtener datos step 3' })
    }
  })

  router.use(authMiddleware)

  router.post('/', async (req, res) => {
    try {
      const { groups, name } = req.body
      const code = await generateCode()
      const session = await Session.create({
        code,
        facilitatorId: req.user.id,
        name: name || '',
        groups: groups || [],
      })
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

  router.patch('/:code/reveal', async (req, res) => {
    try {
      const code = req.params.code
      const results = await FootprintResult.find({ sessionCode: code })

      let summary = null
      if (results.length > 0) {
        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
        const values = results.map(r => r.carbonTons).sort((a, b) => a - b)
        const groupMap = results.reduce((acc, r) => {
          if (!acc[r.group]) acc[r.group] = []
          acc[r.group].push(r.carbonTons)
          return acc
        }, {})
        summary = {
          totalParticipants: results.length,
          averageCarbonTons: Math.round(avg(values) * 10) / 10,
          medianCarbonTons:  Math.round(values[Math.floor(values.length / 2)] * 10) / 10,
          minCarbonTons:     Math.round(values[0] * 10) / 10,
          maxCarbonTons:     Math.round(values[values.length - 1] * 10) / 10,
          byArea: {
            transport:   Math.round(avg(results.map(r => r.areas?.transport   || 0)) * 10) / 10,
            energy:      Math.round(avg(results.map(r => r.areas?.energy      || 0)) * 10) / 10,
            food:        Math.round(avg(results.map(r => r.areas?.food        || 0)) * 10) / 10,
            consumption: Math.round(avg(results.map(r => r.areas?.consumption || 0)) * 10) / 10,
            waste:       Math.round(avg(results.map(r => r.areas?.waste       || 0)) * 10) / 10,
          },
          byGroup: Object.entries(groupMap).map(([group, vals]) => ({
            group,
            average: Math.round(avg(vals) * 10) / 10,
            count: vals.length,
          })),
          calculatedAt: new Date(),
        }
      }

      const session = await Session.findOneAndUpdate(
        { code, facilitatorId: req.user.id },
        { resultsRevealed: true, ...(summary && { summary }) },
        { new: true }
      )
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      io.to(code).emit('results:revealed')
      res.json(session)
    } catch {
      res.status(500).json({ error: 'Error al revelar resultados' })
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

  // Team actions — facilitator sets actions for each team
  router.post('/:code/team-actions', async (req, res) => {
    try {
      const { group, actions, totalReduction, newCarbonTons } = req.body
      const ta = await TeamActions.findOneAndUpdate(
        { sessionCode: req.params.code, group },
        { actions: actions || [], totalReduction: totalReduction || 0, newCarbonTons: newCarbonTons ?? 0, confirmed: true },
        { upsert: true, new: true }
      )
      res.json(ta)
    } catch {
      res.status(500).json({ error: 'Error al guardar acciones del equipo' })
    }
  })

  router.get('/:code/team-actions', async (req, res) => {
    try {
      const ta = await TeamActions.find({ sessionCode: req.params.code })
      res.json(ta)
    } catch {
      res.status(500).json({ error: 'Error al obtener acciones' })
    }
  })

  // Reveal actions to all team screens (alias for step3 reveal)
  router.patch('/:code/reveal-actions', async (req, res) => {
    try {
      const { code } = req.params
      await Session.findOneAndUpdate(
        { code, facilitatorId: req.user.id },
        { step3Revealed: true }
      )
      const allTA = await TeamActions.find({ sessionCode: code })
      io.to(code).emit('step3:revealed', { allActions: allTA.map(ta => ta.toObject()) })
      io.to(code).emit('actions:revealed')
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Error al revelar acciones' })
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

      const results = await FootprintResult.find({ sessionCode: code })

      let summary = null
      if (results.length > 0) {
        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
        const values = results.map(r => r.carbonTons).sort((a, b) => a - b)
        const groupMap = results.reduce((acc, r) => {
          if (!acc[r.group]) acc[r.group] = []
          acc[r.group].push(r.carbonTons)
          return acc
        }, {})
        summary = {
          totalParticipants: results.length,
          averageCarbonTons: Math.round(avg(values) * 10) / 10,
          medianCarbonTons:  Math.round(values[Math.floor(values.length / 2)] * 10) / 10,
          minCarbonTons:     Math.round(values[0] * 10) / 10,
          maxCarbonTons:     Math.round(values[values.length - 1] * 10) / 10,
          byArea: {
            transport:   Math.round(avg(results.map(r => r.areas?.transport   || 0)) * 10) / 10,
            energy:      Math.round(avg(results.map(r => r.areas?.energy      || 0)) * 10) / 10,
            food:        Math.round(avg(results.map(r => r.areas?.food        || 0)) * 10) / 10,
            consumption: Math.round(avg(results.map(r => r.areas?.consumption || 0)) * 10) / 10,
            waste:       Math.round(avg(results.map(r => r.areas?.waste       || 0)) * 10) / 10,
          },
          byGroup: Object.entries(groupMap).map(([group, vals]) => ({
            group,
            average: Math.round(avg(vals) * 10) / 10,
            count: vals.length,
          })),
          calculatedAt: new Date(),
        }
      }

      const session = await Session.findOneAndUpdate(
        { code, facilitatorId: req.user.id },
        { status: 'closed', ...(summary && { summary }) },
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
        FootprintResult.deleteMany({ sessionCode: code }),
        Participant.deleteMany({ sessionCode: code }),
        TeamActions.deleteMany({ sessionCode: code }),
      ])

      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Error al eliminar sesión' })
    }
  })

  return router
}
