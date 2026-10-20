import { Router } from 'express'
import { Resend } from 'resend'
import { authMiddleware } from '../middleware/authMiddleware.js'
import ParIndexResult from '../models/ParIndexResult.js'
import TeamStrategy from '../models/TeamStrategy.js'
import Session from '../models/Session.js'
import { PORTS, PORTS_BY_ID } from '../config/ports/index.js'
import { EVENTS_BY_CODE, EVENT_CODES } from '../config/events.js'
import { getPublicQuestionnaire } from '../services/questionnaireService.js'
import { persistParSubmission, buildParRanking, computeParGroups } from '../services/parSubmissionService.js'
import { validateMeasureSelection, getPublicMeasures, MEASURE_BUDGET } from '../services/measuresService.js'
import { computeEffectiveCultureBand, computeCultureBand } from '../services/cultureService.js'
import { computePreparedness, computeExpectedLossesAvoided, computeCoinsThatHelped } from '../services/preparednessService.js'
import { drawEvent, topExposureEvents } from '../services/wheelService.js'

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
        .select('group portId measures coinsSpent confirmed -_id')
      const out = await Promise.all(strategies.map(async s => ({
        group:       s.group,
        portId:      s.portId,
        measures:    s.measures || [],
        coinsSpent:  s.coinsSpent || 0,
        coinsRemaining: MEASURE_BUDGET - (s.coinsSpent || 0),
        confirmed:   !!s.confirmed,
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

      // Locked once confirmed — measures can't be edited afterwards.
      const existing = await TeamStrategy.findOne({ sessionCode: code, group })
      if (!existing) return res.status(404).json({ error: 'Estrategia de mesa no encontrada' })
      if (existing.confirmed) {
        return res.status(409).json({ error: 'Las medidas de esta mesa están confirmadas y bloqueadas.' })
      }

      const check = validateMeasureSelection(measures || [])
      if (!check.ok) return res.status(400).json({ error: check.error, budget: MEASURE_BUDGET })

      const cultureBand = await computeEffectiveCultureBand(code, group, measures || [])

      const updated = await TeamStrategy.findOneAndUpdate(
        { sessionCode: code, group },
        { measures: measures || [], coinsSpent: check.cost, cultureBand },
        { new: true }
      )

      const payload = {
        group:          updated.group,
        portId:         updated.portId,
        measures:       updated.measures,
        coinsSpent:     updated.coinsSpent,
        coinsRemaining: MEASURE_BUDGET - updated.coinsSpent,
        cultureBand:    updated.cultureBand,
        confirmed:      updated.confirmed,
      }

      // Live tablero update, same style as par:update.
      io.to(code).emit('strategy:update', payload)

      res.json({ ok: true, strategy: payload })
    } catch (err) {
      console.error('PAR strategy save error:', err.message)
      res.status(500).json({ error: 'Error al guardar estrategia' })
    }
  })

  // Facilitator-only: confirm (lock) a table's measures. After this the table's
  // measures can't be edited, and it counts toward the wheel gate.
  router.patch('/:code/strategy/:group/confirm', authMiddleware, async (req, res) => {
    try {
      const { code, group } = req.params
      const updated = await TeamStrategy.findOneAndUpdate(
        { sessionCode: code, group },
        { confirmed: true },
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
        confirmed:      updated.confirmed,
      }
      io.to(code).emit('strategy:update', payload)
      res.json({ ok: true, strategy: payload })
    } catch (err) {
      console.error('PAR strategy confirm error:', err.message)
      res.status(500).json({ error: 'Error al confirmar medidas' })
    }
  })

  // Facilitator-only: unlock (re-open) a table's measures. Reverts confirmed to
  // false so measures can be edited again — which also makes the wheel gate fail
  // until it's re-confirmed. SAFEGUARD: refuse if the table has already drawn
  // (drawnEvent present); by then it knows its exposure weights, so re-editing
  // measures with the result known would be the exact leak the gate prevents.
  router.patch('/:code/strategy/:group/unlock', authMiddleware, async (req, res) => {
    try {
      const { code, group } = req.params
      const strategy = await TeamStrategy.findOne({ sessionCode: code, group })
      if (!strategy) return res.status(404).json({ error: 'Estrategia de mesa no encontrada' })
      if (strategy.drawnEvent) {
        return res.status(409).json({
          error: 'No se puede desbloquear una mesa que ya ha girado la ruleta: conoce su exposición y podría editar medidas con el resultado conocido.',
        })
      }

      strategy.confirmed = false
      await strategy.save()

      const payload = {
        group:          strategy.group,
        portId:         strategy.portId,
        measures:       strategy.measures,
        coinsSpent:     strategy.coinsSpent,
        coinsRemaining: MEASURE_BUDGET - strategy.coinsSpent,
        cultureBand:    strategy.cultureBand,
        confirmed:      strategy.confirmed,
      }
      io.to(code).emit('strategy:update', payload)
      res.json({ ok: true, strategy: payload })
    } catch (err) {
      console.error('PAR strategy unlock error:', err.message)
      res.status(500).json({ error: 'Error al desbloquear medidas' })
    }
  })

  // Facilitator-only: wheel composition for ONE team, revealed only after every
  // table is locked (same gate as the draw). Returns the exposure weights so the
  // client can render the wheel + "what this wheel holds" legend BEFORE spinning.
  // Does NOT draw — no event is chosen and nothing is persisted.
  router.get('/:code/strategy/:group/wheel', authMiddleware, async (req, res) => {
    try {
      const { code, group } = req.params
      const strategy = await TeamStrategy.findOne({ sessionCode: code, group })
      if (!strategy) return res.status(404).json({ error: 'Estrategia de mesa no encontrada' })

      // Same gate as the draw: exposure weights are only revealed once every
      // table is locked, so no measure decision can still be contaminated.
      const all = await TeamStrategy.find({ sessionCode: code }).select('group confirmed -_id')
      const pending = all.filter(s => !s.confirmed).map(s => s.group)
      if (all.length === 0 || pending.length > 0) {
        return res.status(409).json({
          error: `Todas las mesas deben confirmar sus medidas antes de abrir la ruleta. Pendientes: ${pending.join(', ') || '—'}`,
          pending,
        })
      }

      const port = PORTS_BY_ID[strategy.portId]
      const exposure = EVENT_CODES.map(c => ({
        code: c,
        name: EVENTS_BY_CODE[c]?.name || c,
        weight: port?.exposureWeights?.[c] || 0,
      }))
      const cultureBand = await computeEffectiveCultureBand(code, group, strategy.measures || [])
      res.json({
        group,
        portName:   port?.name || null,
        exposure,                        // [{ code, name, weight }] — weights sum 10
        measures:   strategy.measures || [],
        cultureBand,
        // Two highest-exposure events → illustration motifs (safe here: all
        // teams are locked, so exposure is already revealed for this team).
        illustrationMotifs: topExposureEvents(port?.exposureWeights || {}),
        drawn:      !!strategy.drawnEvent,
        eventCode:  strategy.drawnEvent || null,
      })
    } catch (err) {
      console.error('PAR wheel error:', err.message)
      res.status(500).json({ error: 'Error al obtener la ruleta' })
    }
  })

  // Facilitator-only: spin the roulette for a table. Draws an event from the
  // port's SECRET exposure weights, computes preparedness with the table's
  // measures + effective culture band, and stores the outcome snapshot.
  // GATE: rejects (409) unless EVERY table in the session is confirmed — this is
  // what makes revealing the exposure weights (below) safe.
  router.post('/:code/strategy/:group/draw', authMiddleware, async (req, res) => {
    try {
      const { code, group } = req.params
      const strategy = await TeamStrategy.findOne({ sessionCode: code, group })
      if (!strategy) return res.status(404).json({ error: 'Estrategia de mesa no encontrada' })

      // GATE: every table in the session must be confirmed before any draw. This
      // is what makes revealing the exposure weights safe (no decision left to
      // contaminate). Reject otherwise.
      const allStrategies = await TeamStrategy.find({ sessionCode: code }).select('group confirmed -_id')
      const pending = allStrategies.filter(s => !s.confirmed).map(s => s.group)
      if (allStrategies.length === 0 || pending.length > 0) {
        return res.status(409).json({
          error: `Todas las mesas deben confirmar sus medidas antes de girar la ruleta. Pendientes: ${pending.join(', ') || '—'}`,
          pending,
        })
      }

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
      const port = PORTS_BY_ID[strategy.portId]
      // Exposure weights are revealed HERE ONLY (wheel phase, all tables locked)
      // so the client can draw proportional wheel slices. Never sent earlier.
      const exposure = EVENT_CODES.map(c => ({
        code: c,
        name: EVENTS_BY_CODE[c]?.name || c,
        weight: port?.exposureWeights?.[c] || 0,
      }))
      const payload = {
        group,
        portName:    port?.name || null,
        eventCode,
        eventName:   event?.name || eventCode,
        exposure,    // [{ code, name, weight }] — 7 slices, weights sum 10
        cultureBand,
        preparedness,
        lossesAvoidedPct,
        breakdown, // per-measure sᵢ (debrief)
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

  // Facilitator-only: DEBRIEF — luck vs strategy. For each team: the actual
  // result (losses avoided from its draw) and the EXPECTED result (plan value
  // across all events, weighted by exposure), plus coins that helped. Expected
  // results are sent ONLY in the debrief phase, after all draws. Exposure
  // weights are used server-side only — just the resulting numbers go out.
  router.get('/:code/debrief', authMiddleware, async (req, res) => {
    try {
      const { code } = req.params
      const session = await Session.findOne({ code, facilitatorId: req.user.id })
      if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
      if (session.phase !== 'debrief') {
        return res.status(409).json({ error: 'Los resultados esperados solo están disponibles en la fase de Debrief.' })
      }

      const strategies = await TeamStrategy.find({ sessionCode: code })
        .select('group portId measures coinsSpent drawnEvent lossesAvoidedPct -_id')

      const teams = await Promise.all(strategies.map(async s => {
        const port = PORTS_BY_ID[s.portId]
        const measures = s.measures || []
        // BASE culture band (from PARI mean); computeExpectedLossesAvoided applies
        // the #19/#20 bump itself, matching the effective band used at draw time.
        const baseBand = await computeCultureBand(code, s.group)
        const expected = computeExpectedLossesAvoided({
          measures, cultureBand: baseBand, exposureWeights: port?.exposureWeights || {},
        })
        const drawn = s.drawnEvent || null
        return {
          group:           s.group,
          portName:        port?.name || null,
          drawn:           !!drawn,
          eventCode:       drawn,
          eventName:       drawn ? (EVENTS_BY_CODE[drawn]?.name || drawn) : null,
          result:          s.lossesAvoidedPct ?? null, // actual drawn outcome (0–100)
          expected,                                     // plan's expected (0–100, 2dp)
          coinsThatHelped: drawn ? computeCoinsThatHelped({ measures, event: drawn }) : 0,
          coinsSpent:      s.coinsSpent || 0,
          // Two highest-exposure events → illustration motifs (debrief only).
          illustrationMotifs: topExposureEvents(port?.exposureWeights || {}),
        }
      }))

      // Sorted by the actual result desc; un-drawn teams (null) go last.
      teams.sort((a, b) => (b.result ?? -1) - (a.result ?? -1))
      res.json({ budget: MEASURE_BUDGET, teams })
    } catch (err) {
      console.error('PAR debrief error:', err.message)
      res.status(500).json({ error: 'Error al obtener el debrief' })
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
