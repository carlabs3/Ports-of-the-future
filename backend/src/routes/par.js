import { Router } from 'express'
import { Resend } from 'resend'
import { authMiddleware } from '../middleware/authMiddleware.js'
import ParIndexResult from '../models/ParIndexResult.js'
import TeamStrategy from '../models/TeamStrategy.js'
import { PORTS, PORTS_BY_ID } from '../config/ports/index.js'
import { EVENTS_BY_CODE } from '../config/events.js'
import { getPublicQuestionnaire } from '../services/questionnaireService.js'
import { persistParSubmission, buildParRanking, computeParGroups } from '../services/parSubmissionService.js'
import { validateMeasureSelection, getPublicMeasures, MEASURE_BUDGET } from '../services/measuresService.js'
import { computeEffectiveCultureBand } from '../services/cultureService.js'
import { computePreparedness } from '../services/preparednessService.js'
import { drawEvent } from '../services/wheelService.js'

const BAND_LABELS = {
  reactive:   'Reactive',
  aware:      'Aware',
  developing: 'Developing',
  proactive:  'Proactive',
}

export default function parRouter(io) {
  const router = Router()

  // Public: questionnaire structure WITHOUT any option scores.
  router.get('/questionnaire', (_req, res) => {
    res.json(getPublicQuestionnaire())
  })

  // Facilitator-only: port catalogue for session creation. PUBLIC fields only
  // (id, name, meta) — exposureWeights and other secrets are never exposed.
  // Explicit field copy, NOT a spread of the port object.
  router.get('/ports', authMiddleware, (_req, res) => {
    res.json(PORTS.map(p => ({
      id:   p.id,
      name: p.name,
      meta: { zone: p.meta?.zone, size: p.meta?.size, description: p.meta?.description },
    })))
  })

  // Facilitator-only: measure catalogue for the strategy-entry panel. PUBLIC
  // fields only (id, name, cost) — protection scores are secret until scoring.
  router.get('/measures', authMiddleware, (_req, res) => {
    res.json(getPublicMeasures())
  })

  // Facilitator-only: per-group strategy state for the control centre. The
  // effective culture band is recomputed live (current PARI base + measure
  // bonus) so it never goes stale as new PARs arrive.
  router.get('/:code/strategies', authMiddleware, async (req, res) => {
    try {
      const strategies = await TeamStrategy.find({ sessionCode: req.params.code })
        .select('group portId measures coinsSpent -_id')
      const out = await Promise.all(strategies.map(async s => ({
        group:       s.group,
        portId:      s.portId,
        measures:    s.measures || [],
        coinsSpent:  s.coinsSpent || 0,
        coinsRemaining: MEASURE_BUDGET - (s.coinsSpent || 0),
        cultureBand: await computeEffectiveCultureBand(req.params.code, s.group, s.measures || []),
      })))
      res.json({ budget: MEASURE_BUDGET, strategies: out })
    } catch (err) {
      console.error('PAR strategies error:', err.message)
      res.status(500).json({ error: 'Error al obtener estrategias' })
    }
  })

  // Facilitator-only: save a table's bought measures (budget = 6 coins).
  router.put('/:code/strategy/:group', authMiddleware, async (req, res) => {
    try {
      const { code, group } = req.params
      const { measures } = req.body

      const check = validateMeasureSelection(measures || [])
      if (!check.ok) return res.status(400).json({ error: check.error, budget: MEASURE_BUDGET })

      const cultureBand = await computeEffectiveCultureBand(code, group, measures || [])

      // Strategies are pre-created at session creation (they carry the required
      // portId), so update the existing doc rather than upsert.
      const updated = await TeamStrategy.findOneAndUpdate(
        { sessionCode: code, group },
        { measures: measures || [], coinsSpent: check.cost, cultureBand },
        { new: true }
      )
      if (!updated) return res.status(404).json({ error: 'Estrategia de mesa no encontrada' })

      const payload = {
        group:          updated.group,
        portId:         updated.portId,
        measures:       updated.measures,
        coinsSpent:     updated.coinsSpent,
        coinsRemaining: MEASURE_BUDGET - updated.coinsSpent,
        cultureBand:    updated.cultureBand,
      }

      // Live tablero update, same style as par:update.
      io.to(code).emit('strategy:update', payload)

      res.json({ ok: true, strategy: payload })
    } catch (err) {
      console.error('PAR strategy save error:', err.message)
      res.status(500).json({ error: 'Error al guardar estrategia' })
    }
  })

  // Facilitator-only: spin the roulette for a table. Draws an event from the
  // port's SECRET exposure weights, computes preparedness with the table's
  // measures + effective culture band, and stores the outcome snapshot.
  router.post('/:code/strategy/:group/draw', authMiddleware, async (req, res) => {
    try {
      const { code, group } = req.params
      const strategy = await TeamStrategy.findOne({ sessionCode: code, group })
      if (!strategy) return res.status(404).json({ error: 'Estrategia de mesa no encontrada' })

      const eventCode = drawEvent(strategy.portId)
      if (!eventCode) return res.status(400).json({ error: 'No se pudo sortear el evento (puerto sin pesos)' })

      // Recompute the effective culture band live so the outcome uses fresh state.
      const cultureBand = await computeEffectiveCultureBand(code, group, strategy.measures || [])
      const { preparedness, lossesAvoidedPct, breakdown } = computePreparedness({
        measureIds: strategy.measures || [], eventCode, cultureBand,
      })

      strategy.drawnEvent = eventCode
      strategy.preparedness = preparedness
      strategy.lossesAvoidedPct = lossesAvoidedPct
      await strategy.save()

      const event = EVENTS_BY_CODE[eventCode]
      const payload = {
        group,
        portName:    PORTS_BY_ID[strategy.portId]?.name || null,
        eventCode,
        eventName:   event?.name || eventCode,
        cultureBand,
        preparedness,
        lossesAvoidedPct,
        breakdown, // per-measure sᵢ (debrief) — no exposure weights, no full matrix
      }

      io.to(code).emit('outcome:update', payload)
      res.json({ ok: true, outcome: payload })
    } catch (err) {
      console.error('PAR draw error:', err.message)
      res.status(500).json({ error: 'Error al sortear el evento' })
    }
  })

  // Facilitator-only: per-table outcomes for the ranking, ordered by
  // lossesAvoidedPct desc. Includes the drawn event NAME and per-measure
  // breakdown (debrief) — never exposure weights or the raw protection matrix.
  router.get('/:code/outcomes', authMiddleware, async (req, res) => {
    try {
      const { code } = req.params
      const strategies = await TeamStrategy.find({ sessionCode: code })
        .select('group portId measures drawnEvent preparedness lossesAvoidedPct -_id')

      const outcomes = await Promise.all(strategies.map(async s => {
        const drawn = s.drawnEvent || null
        let breakdown = []
        if (drawn) {
          const cultureBand = await computeEffectiveCultureBand(code, s.group, s.measures || [])
          breakdown = computePreparedness({ measureIds: s.measures || [], eventCode: drawn, cultureBand }).breakdown
        }
        return {
          group:            s.group,
          portName:         PORTS_BY_ID[s.portId]?.name || null,
          drawn:            !!drawn,
          eventCode:        drawn,
          drawnEvent:       drawn ? (EVENTS_BY_CODE[drawn]?.name || drawn) : null,
          preparedness:     s.preparedness ?? null,
          lossesAvoidedPct: s.lossesAvoidedPct ?? null,
          breakdown,
        }
      }))

      // Sort by lossesAvoidedPct desc; un-drawn tables (null) go last.
      outcomes.sort((a, b) => (b.lossesAvoidedPct ?? -1) - (a.lossesAvoidedPct ?? -1))
      res.json({ outcomes })
    } catch (err) {
      console.error('PAR outcomes error:', err.message)
      res.status(500).json({ error: 'Error al obtener resultados de la ruleta' })
    }
  })

  // List all PAR results for a session — same shape as the 'par:update' event
  // (individual), plus aligned demographics, so the facilitator control centre
  // can populate on load and after a reconnect. Read-only; all aggregation
  // happens client-side. Single query so individual[i] and demographics[i]
  // refer to the same submission (needed to average score by port size).
  // Facilitator-only (JWT) — participant endpoints below stay public.
  router.get('/:code/results', authMiddleware, async (req, res) => {
    try {
      const docs = await ParIndexResult.find({ sessionCode: req.params.code })
        .select('group score band areas portSize worldZone -_id')
        .sort({ score: -1 })
      const individual = docs.map(d => ({
        group: d.group, score: d.score, band: d.band, areas: d.areas,
      }))
      const demographics = docs.map(d => ({
        group: d.group, portSize: d.portSize || '', worldZone: d.worldZone || '',
      }))
      res.json({ individual, demographics, groups: computeParGroups(individual) })
    } catch (err) {
      console.error('PAR results error:', err.message)
      res.status(500).json({ error: 'Error al obtener resultados PAR' })
    }
  })

  // Public: submit answers, compute the PAR Index server-side.
  router.post('/submit', async (req, res) => {
    try {
      const { submissionId, sessionCode, group, portSize, worldZone, answers } = req.body
      if (!sessionCode || !group || !answers) {
        return res.status(400).json({ error: 'Faltan datos' })
      }

      const result = await persistParSubmission({
        submissionId, sessionCode, group, portSize, worldZone, answers,
      })

      io.to(sessionCode).emit('par:update', await buildParRanking(sessionCode))

      res.json({ ok: true, result: { score: result.score, band: result.band, areas: result.areas } })
    } catch (err) {
      console.error('PAR submit error:', err.message)
      res.status(500).json({ error: 'Error al guardar resultado' })
    }
  })

  // Public: email the participant their PAR Index result. Uses Resend, the same
  // provider as the footprint email endpoint; 503 (graceful) when not configured.
  router.post('/send-email', async (req, res) => {
    const { email, score, band, areas } = req.body

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email no válido' })
    }
    if (score == null || !band) {
      return res.status(400).json({ error: 'Faltan datos del resultado' })
    }
    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'Servicio de email no configurado' })
    }

    const bandLabel = BAND_LABELS[band] || band
    const a = areas || {}

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Ports of the Future <noreply@apps.threeoclock.co>',
        to: email,
        subject: `Your PAR Index result — ${score}/100 (${bandLabel})`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <p style="font-size: 13px; color: #666; margin: 0 0 24px; line-height: 1.7;">Thank you for taking part in the Ports of the Future PAR Index assessment.</p>
            <div style="background: #000; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
              <p style="color: rgba(255,255,255,0.55); font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Your PAR Index</p>
              <h2 style="color: #fff; font-size: 52px; font-weight: 700; margin: 0;">${score}<span style="font-size: 20px; color: rgba(255,255,255,0.55);">/100</span></h2>
              <p style="color: rgba(255,255,255,0.75); font-size: 16px; margin: 12px 0 0;">Band: <strong>${bandLabel}</strong></p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #555;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Governance &amp; Strategy</td><td style="padding: 8px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f0f0f0;">${a.governance ?? 0}/20</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Organisation &amp; People</td><td style="padding: 8px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f0f0f0;">${a.organisation ?? 0}/20</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Budget &amp; Finance</td><td style="padding: 8px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f0f0f0;">${a.budget ?? 0}/20</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">Implemented Measures</td><td style="padding: 8px 0; text-align: right; font-weight: 600; border-bottom: 1px solid #f0f0f0;">${a.measures ?? 0}/20</td></tr>
              <tr><td style="padding: 8px 0;">Preparedness &amp; Monitoring</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${a.preparedness ?? 0}/20</td></tr>
            </table>
            <p style="font-size: 11px; color: #aaa; margin-top: 32px; text-align: center;">Ports of the Future · A Three o'clock initiative</p>
          </div>
        `,
      })
      res.json({ ok: true })
    } catch (err) {
      console.error('PAR email error:', err.message)
      res.status(500).json({ error: 'Error al enviar el email' })
    }
  })

  return router
}
