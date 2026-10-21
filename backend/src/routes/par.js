import { Router } from 'express'
import { Resend } from 'resend'
import { authMiddleware } from '../middleware/authMiddleware.js'
import ParIndexResult from '../models/ParIndexResult.js'
import TeamStrategy from '../models/TeamStrategy.js'
import Session from '../models/Session.js'
import { PORTS, PORTS_BY_ID } from '../config/ports/index.js'
import { MEASURES_BY_ID } from '../config/measures.js'
import { EVENTS_BY_CODE, EVENT_CODES } from '../config/events.js'
import { getPublicQuestionnaire } from '../services/questionnaireService.js'
import { persistParSubmission, buildParRanking, computeParGroups } from '../services/parSubmissionService.js'
import { getPublicMeasures } from '../services/measuresService.js'
import { computeCultureBand, applyCultureMeasureBonus, BAND_ORDER } from '../services/cultureService.js'
import { drawEvent, topExposureEvents } from '../services/wheelService.js'
import { buyCard, returnCard, lockRound, unlockRound, recordSpin, advanceRound, ROUND_BUDGET } from '../services/roundsService.js'
import { computeFinalRanking } from '../services/strategyService.js'

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

  // Facilitator-only: port catalogue. PUBLIC fields only — exposureWeights is
  // SECRET and never exposed. Explicit field copy, NOT a spread of the port.
  router.get('/ports', authMiddleware, (_req, res) => {
    res.json(PORTS.map(p => ({
      id:             p.id,
      name:           p.name,
      climateZone:    p.climateZone,
      coastalSetting: p.coastalSetting,
      size:           p.size,
      governance:     p.governance,
      deck:           p.deck,
    })))
  })

  // Facilitator-only: measure catalogue for the strategy-entry panel. PUBLIC
  // fields only (id, name, cost) — protection scores are secret until scoring.
  router.get('/measures', authMiddleware, (_req, res) => {
    res.json(getPublicMeasures())
  })

  // ── v4 rounds: helpers ──────────────────────────────────────────────────────
  // Facilitator-facing team state. NEVER includes exposure weights or the
  // best-strategy combinations — only the team's own cards, coins and results.
  function publicStrategy(doc) {
    const port = PORTS_BY_ID[doc.portId]
    return {
      group:           doc.group,
      portId:          doc.portId,
      portName:        port?.name || null,
      startingBand:    doc.startingBand,
      cultureLevel:    applyCultureMeasureBonus(doc.startingBand, doc.portfolio),
      coins:           doc.coins,
      roundStartCoins: doc.roundStartCoins,
      currentRound:    doc.currentRound,
      roundLocked:     doc.roundLocked,
      roundBudget:     ROUND_BUDGET[(doc.currentRound || 1) - 1],
      portfolio:       doc.portfolio.map(id => ({ id, name: MEASURES_BY_ID[id]?.name || `Measure ${id}`, cost: MEASURES_BY_ID[id]?.cost ?? null })),
      roundBought:     [...doc.roundBought],
      roundReturned:   doc.roundReturned,
      rounds:          doc.rounds.map(r => (r.toObject ? r.toObject() : r)),
    }
  }

  // "Every team has locked round 1" — the point from which a team's wheel may be
  // revealed (its composition + B11 motifs), for the team being drawn only.
  const allLockedRound1 = (strategies) =>
    strategies.length > 0 && strategies.every(s => s.rounds.some(r => r.round === 1) || (s.currentRound === 1 && s.roundLocked))

  // Run a pure round-logic mutation on a team's doc, save + broadcast on success.
  async function mutateStrategy(code, group, res, fn, badStatus = 400) {
    const doc = await TeamStrategy.findOne({ sessionCode: code, group })
    if (!doc) return res.status(404).json({ error: 'Team strategy not found' })
    const r = fn(doc)
    if (!r.ok) return res.status(badStatus).json({ error: r.error })
    await doc.save()
    const payload = publicStrategy(doc)
    io.to(code).emit('strategy:update', payload)
    return res.json({ ok: true, strategy: payload, ...(r.refund != null ? { refund: r.refund } : {}) })
  }

  // Facilitator-only: full round state for every team (control centre + reconnect).
  router.get('/:code/strategies', authMiddleware, async (req, res) => {
    try {
      const strategies = await TeamStrategy.find({ sessionCode: req.params.code })
      res.json({ roundBudgets: ROUND_BUDGET, strategies: strategies.map(publicStrategy) })
    } catch (err) {
      console.error('PAR strategies error:', err.message)
      res.status(500).json({ error: 'Could not load team strategies' })
    }
  })

  // Facilitator-only: set a team's STARTING culture level (for a team with no
  // PARI answers). Allowed only before round 1 is locked.
  router.patch('/:code/strategy/:group/starting-level', authMiddleware, async (req, res) => {
    const { code, group } = req.params
    const { band } = req.body
    if (!BAND_ORDER.includes(band)) return res.status(400).json({ error: 'Invalid culture level' })
    const doc = await TeamStrategy.findOne({ sessionCode: code, group })
    if (!doc) return res.status(404).json({ error: 'Team strategy not found' })
    if (doc.roundLocked || doc.rounds.length > 0) {
      return res.status(409).json({ error: 'The starting level is fixed once round 1 is locked.' })
    }
    doc.startingBand = band
    await doc.save()
    const payload = publicStrategy(doc)
    io.to(code).emit('strategy:update', payload)
    res.json({ ok: true, strategy: payload })
  })

  // Facilitator-only: buy / return a card this round; lock / unlock the round.
  router.post('/:code/strategy/:group/buy', authMiddleware, (req, res) =>
    mutateStrategy(req.params.code, req.params.group, res, doc => buyCard(doc, Number(req.body.measureId))))

  router.post('/:code/strategy/:group/return', authMiddleware, (req, res) =>
    mutateStrategy(req.params.code, req.params.group, res, doc => returnCard(doc, Number(req.body.measureId))))

  router.patch('/:code/strategy/:group/unlock', authMiddleware, (req, res) =>
    mutateStrategy(req.params.code, req.params.group, res, doc => unlockRound(doc), 409))

  // Lock: derive the starting level from PARI first (if not already set), then lock.
  router.patch('/:code/strategy/:group/lock', authMiddleware, async (req, res) => {
    const { code, group } = req.params
    const doc = await TeamStrategy.findOne({ sessionCode: code, group })
    if (!doc) return res.status(404).json({ error: 'Team strategy not found' })
    if (doc.startingBand == null) {
      const base = await computeCultureBand(code, group) // PARI mean → band, or null
      if (base) doc.startingBand = base
    }
    const r = lockRound(doc) // 409 if still no starting level
    if (!r.ok) return res.status(409).json({ error: r.error })
    await doc.save()
    const payload = publicStrategy(doc)
    io.to(code).emit('strategy:update', payload)
    res.json({ ok: true, strategy: payload })
  })

  // Facilitator-only: wheel composition for ONE team — revealed only once EVERY
  // team has locked round 1, and returned only for the requested team. This is
  // what lets the "What this wheel holds" legend show before the spin.
  router.get('/:code/strategy/:group/wheel', authMiddleware, async (req, res) => {
    try {
      const { code, group } = req.params
      const doc = await TeamStrategy.findOne({ sessionCode: code, group })
      if (!doc) return res.status(404).json({ error: 'Team strategy not found' })

      const all = await TeamStrategy.find({ sessionCode: code })
      if (!allLockedRound1(all)) {
        return res.status(409).json({ error: 'Every team must lock round 1 before any wheel is shown.' })
      }

      const port = PORTS_BY_ID[doc.portId]
      const exposure = EVENT_CODES.map(c => ({ code: c, name: EVENTS_BY_CODE[c]?.name || c, weight: port?.exposureWeights?.[c] || 0 }))
      const spun = doc.rounds.find(r => r.round === doc.currentRound)
      res.json({
        group,
        portName:           port?.name || null,
        exposure,                        // [{ code, name, weight }] — weights sum 10
        portfolio:          doc.portfolio,
        cultureLevel:       applyCultureMeasureBonus(doc.startingBand, doc.portfolio),
        illustrationMotifs: topExposureEvents(port?.exposureWeights || {}),
        currentRound:       doc.currentRound,
        drawnThisRound:     !!spun,
        eventCode:          spun?.drawnEvent || null,
      })
    } catch (err) {
      console.error('PAR wheel error:', err.message)
      res.status(500).json({ error: 'Could not load the wheel' })
    }
  })

  // Facilitator-only: spin the current round for a team. GATE: every team must
  // have LOCKED the current round first (Option A). Draws from the port's secret
  // weights, records the round snapshot (P, losses avoided, damage, expected,
  // strategy score, coins that helped), and returns the result + exposure slices.
  router.post('/:code/strategy/:group/draw', authMiddleware, async (req, res) => {
    try {
      const { code, group } = req.params
      const doc = await TeamStrategy.findOne({ sessionCode: code, group })
      if (!doc) return res.status(404).json({ error: 'Team strategy not found' })

      const all = await TeamStrategy.find({ sessionCode: code })
      const pending = all.filter(s => !s.roundLocked).map(s => s.group)
      if (all.length === 0 || pending.length > 0) {
        return res.status(409).json({ error: `Every team must lock this round before any spin. Pending: ${pending.join(', ') || '—'}`, pending })
      }

      const eventCode = drawEvent(doc.portId)
      if (!eventCode) return res.status(400).json({ error: 'Could not draw an event (port has no weights).' })

      const r = recordSpin(doc, eventCode)
      if (!r.ok) return res.status(409).json({ error: r.error })
      await doc.save()

      const port = PORTS_BY_ID[doc.portId]
      const exposure = EVENT_CODES.map(c => ({ code: c, name: EVENTS_BY_CODE[c]?.name || c, weight: port?.exposureWeights?.[c] || 0 }))
      const payload = {
        group,
        portName:  port?.name || null,
        round:     r.entry.round,
        eventCode,
        eventName: EVENTS_BY_CODE[eventCode]?.name || eventCode,
        exposure,
        illustrationMotifs: topExposureEvents(port?.exposureWeights || {}),
        entry:     r.entry, // losses avoided, damage, expected, strategy score, coins that helped
      }
      io.to(code).emit('outcome:update', { group, round: r.entry.round })
      io.to(code).emit('strategy:update', publicStrategy(doc))
      res.json({ ok: true, outcome: payload })
    } catch (err) {
      console.error('PAR draw error:', err.message)
      res.status(500).json({ error: 'Could not spin the wheel' })
    }
  })

  // Facilitator-only: advance ALL teams to the next round (+2 coins). GATE: every
  // team must have spun the current round.
  router.post('/:code/next-round', authMiddleware, async (req, res) => {
    try {
      const { code } = req.params
      const all = await TeamStrategy.find({ sessionCode: code })
      const notSpun = all.filter(s => !s.rounds.some(r => r.round === s.currentRound)).map(s => s.group)
      if (all.length === 0 || notSpun.length > 0) {
        return res.status(409).json({ error: `Every team must spin before the next round. Pending: ${notSpun.join(', ') || '—'}`, pending: notSpun })
      }
      for (const doc of all) { advanceRound(doc); await doc.save() }
      const round = all[0].currentRound
      io.to(code).emit('rounds:advanced', { round })
      res.json({ ok: true, round })
    } catch (err) {
      console.error('PAR next-round error:', err.message)
      res.status(500).json({ error: 'Could not advance the round' })
    }
  })

  // Facilitator-only: per-team round snapshots (ranking / debrief source). No
  // exposure weights, no best-strategy combinations.
  router.get('/:code/outcomes', authMiddleware, async (req, res) => {
    try {
      const strategies = await TeamStrategy.find({ sessionCode: req.params.code })
      const teams = strategies.map(s => ({
        group:    s.group,
        portName: PORTS_BY_ID[s.portId]?.name || null,
        rounds:   s.rounds.map(r => (r.toObject ? r.toObject() : r)),
      }))
      res.json({ teams })
    } catch (err) {
      console.error('PAR outcomes error:', err.message)
      res.status(500).json({ error: 'Could not load outcomes' })
    }
  })

  // Facilitator-only: DEBRIEF — luck vs strategy over the three rounds. Final
  // rank is the mean of the three strategy scores (skill); total damage across
  // rounds is the luck line. Per round: event, losses avoided, damage bill,
  // expected protection, strategy score, coins that helped. Exposure weights are
  // used server-side only — just the resulting numbers go out. (Frontend B10
  // adaptation lands in Commit 6; this is the data source.)
  router.get('/:code/debrief', authMiddleware, async (req, res) => {
    try {
      const { code } = req.params
      const session = await Session.findOne({ code, facilitatorId: req.user.id })
      if (!session) return res.status(404).json({ error: 'Session not found' })
      if (session.phase !== 'debrief') {
        return res.status(409).json({ error: 'The debrief is only available in the debrief phase.' })
      }

      const strategies = await TeamStrategy.find({ sessionCode: code })

      const ranking = computeFinalRanking(strategies.map(s => ({
        group:          s.group,
        portId:         s.portId,
        strategyScores: s.rounds.map(r => r.strategyScore).filter(v => v != null),
        damages:        s.rounds.map(r => r.damageBill),
      })))
      const rankByGroup = Object.fromEntries(ranking.map(r => [r.group, r]))

      const teams = strategies.map(s => {
        const port = PORTS_BY_ID[s.portId]
        const row = rankByGroup[s.group] || {}
        return {
          group:        s.group,
          portName:     port?.name || null,
          rank:         row.rank ?? null,
          finalScore:   row.finalScore ?? 0,     // mean of the 3 strategy scores (skill)
          totalDamage:  row.totalDamage ?? 0,    // sum of the 3 damage bills (luck)
          portfolio:    s.portfolio.map(id => ({ id, name: MEASURES_BY_ID[id]?.name || `Measure ${id}`, cost: MEASURES_BY_ID[id]?.cost ?? null })),
          rounds:       s.rounds.map(r => {
            const o = r.toObject ? r.toObject() : r
            return { ...o, eventName: o.drawnEvent ? (EVENTS_BY_CODE[o.drawnEvent]?.name || o.drawnEvent) : null }
          }),
          illustrationMotifs: topExposureEvents(port?.exposureWeights || {}),
        }
      })

      teams.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      res.json({ roundBudgets: ROUND_BUDGET, teams })
    } catch (err) {
      console.error('PAR debrief error:', err.message)
      res.status(500).json({ error: 'Could not load the debrief' })
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
