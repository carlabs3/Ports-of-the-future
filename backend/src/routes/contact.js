import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Resend } from 'resend'
import { validateContactRequest, isHoneypotFilled } from '../services/contactService.js'

// Escape user text before putting it in the HTML email.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

// Rate limit: 5 requests per hour per client IP (memory store). Exported so the
// test can mount it. Requires app.set('trust proxy', 1) so req.ip is the real
// client IP behind Railway's proxy, not the shared proxy address.
export function createContactLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  })
}

export default function contactRouter() {
  const router = Router()

  router.post('/', createContactLimiter(), async (req, res) => {
    // Honeypot: a bot filled the hidden field → pretend success, send nothing.
    if (isHoneypotFilled(req.body)) return res.json({ ok: true })

    const check = validateContactRequest(req.body)
    if (!check.ok) return res.status(400).json({ error: check.error })

    // Email target comes from the environment — never hardcoded.
    if (!process.env.RESEND_API_KEY || !process.env.CONTACT_TO_EMAIL) {
      return res.status(503).json({ error: 'The contact form is not available right now.' })
    }

    const d = check.data
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Ports of the Future <noreply@apps.threeoclock.co>',
        to: process.env.CONTACT_TO_EMAIL,
        replyTo: d.email, // reply goes to the requester
        subject: `Workshop request — ${d.organisation}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0B1B33;">
            <h2 style="margin: 0 0 16px;">New workshop request</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #555;">Name</td><td style="padding: 6px 0; font-weight: 600;">${esc(d.name)}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;">Organisation</td><td style="padding: 6px 0; font-weight: 600;">${esc(d.organisation)}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;">Email</td><td style="padding: 6px 0; font-weight: 600;">${esc(d.email)}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;">Country</td><td style="padding: 6px 0;">${esc(d.country) || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;">Expected participants</td><td style="padding: 6px 0;">${esc(d.participants) || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;">Preferred dates</td><td style="padding: 6px 0;">${esc(d.dates) || '—'}</td></tr>
            </table>
            ${d.message ? `<p style="margin: 16px 0 0; font-size: 14px; white-space: pre-wrap;"><strong>Notes:</strong><br>${esc(d.message)}</p>` : ''}
          </div>
        `,
      })
      res.json({ ok: true })
    } catch (err) {
      console.error('Contact email error:', err.message)
      res.status(500).json({ error: 'Could not send the request. Please try again.' })
    }
  })

  return router
}
