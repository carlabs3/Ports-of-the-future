import { Router } from 'express'
import { Resend } from 'resend'
import { authMiddleware } from '../middleware/authMiddleware.js'
import ParIndexResult from '../models/ParIndexResult.js'
import { getPublicQuestionnaire } from '../services/questionnaireService.js'
import { persistParSubmission, buildParRanking, computeParGroups } from '../services/parSubmissionService.js'

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
