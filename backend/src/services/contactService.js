// Contact-request validation — pure, server-side, no DB. The contact form on
// the landing page posts here. Requests are not stored; a valid one is emailed.

// Per-field length limits (characters). Generous but bounded to curb abuse.
export const CONTACT_LIMITS = {
  name: 120, organisation: 160, email: 200, country: 80,
  participants: 10, dates: 120, message: 2000,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Validate a contact request. name, organisation and a valid email are
// required; consent must be true; every field has a length cap.
// Returns { ok, error, data } — data is the trimmed, safe-to-send subset.
export function validateContactRequest(body = {}) {
  const b = body || {}
  const name = String(b.name ?? '').trim()
  const organisation = String(b.organisation ?? '').trim()
  const email = String(b.email ?? '').trim()

  if (!name) return { ok: false, error: 'Name is required' }
  if (!organisation) return { ok: false, error: 'Organisation is required' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'A valid email is required' }
  if (b.consent !== true) return { ok: false, error: 'Consent is required' }

  for (const [field, max] of Object.entries(CONTACT_LIMITS)) {
    if (String(b[field] ?? '').length > max) {
      return { ok: false, error: `${field} is too long (max ${max})` }
    }
  }

  return {
    ok: true,
    data: {
      name, organisation, email,
      country:      String(b.country ?? '').trim(),
      participants: String(b.participants ?? '').trim(),
      dates:        String(b.dates ?? '').trim(),
      message:      String(b.message ?? '').trim(),
    },
  }
}

// Honeypot: a hidden field real users never fill. Non-empty → treat as spam.
export function isHoneypotFilled(body = {}) {
  return !!String(body?.website ?? '').trim()
}
