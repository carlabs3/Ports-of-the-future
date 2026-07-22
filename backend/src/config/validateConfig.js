// Fail-fast validator for the domain catalogues (events / measures / ports).
// Run at server startup: if any invariant is violated it throws with the full
// list of problems, so bad data stops the server before it can serve wrong
// scoring.
import { EVENTS, EVENT_CODES } from './events.js'
import { MEASURES } from './measures.js'
import { PORTS } from './ports/index.js'

const isInt = v => Number.isInteger(v)

export function validateConfig({ events = EVENTS, measures = MEASURES, ports = PORTS } = {}) {
  const errors = []
  const validCodes = new Set(EVENT_CODES)

  // ── events ────────────────────────────────────────────────────────────────
  if (events.length !== 7) errors.push(`events: expected 7, got ${events.length}`)
  const seenCodes = new Set()
  for (const e of events) {
    if (!isInt(e.lossValue) || e.lossValue < 1 || e.lossValue > 5) {
      errors.push(`event ${e.code}: lossValue must be an integer 1–5, got ${e.lossValue}`)
    }
    if (seenCodes.has(e.code)) errors.push(`event code duplicated: ${e.code}`)
    seenCodes.add(e.code)
  }

  // ── measures ──────────────────────────────────────────────────────────────
  if (measures.length !== 25) errors.push(`measures: expected 25, got ${measures.length}`)
  const ids = measures.map(m => m.id).sort((a, b) => a - b)
  for (let i = 0; i < 25; i++) {
    if (ids[i] !== i + 1) { errors.push(`measures: ids must be 1..25 with no gaps (missing/duplicate near ${i + 1})`); break }
  }
  for (const m of measures) {
    if (!isInt(m.cost) || m.cost < 1) errors.push(`measure #${m.id}: cost must be an integer >= 1, got ${m.cost}`)
    const keys = Object.keys(m.protection || {})
    if (keys.length !== 7 || !EVENT_CODES.every(c => c in m.protection)) {
      errors.push(`measure #${m.id}: protection must have exactly the 7 event keys, got [${keys.join(', ')}]`)
    }
    for (const [code, val] of Object.entries(m.protection || {})) {
      if (!validCodes.has(code)) errors.push(`measure #${m.id}: protection has unknown event code "${code}"`)
      if (!isInt(val) || val < 0 || val > 10) errors.push(`measure #${m.id}: protection.${code} must be an integer 0–10, got ${val}`)
    }
    const shouldRaise = m.id === 19 || m.id === 20
    if (Boolean(m.raisesCultureBand) !== shouldRaise) {
      errors.push(`measure #${m.id}: raisesCultureBand must be ${shouldRaise} (only #19 and #20 raise it)`)
    }
  }

  // ── ports ─────────────────────────────────────────────────────────────────
  if (ports.length !== 10) errors.push(`ports: expected 10, got ${ports.length}`)
  const seenPortIds = new Set()
  for (const p of ports) {
    if (seenPortIds.has(p.id)) errors.push(`port id duplicated: ${p.id}`)
    seenPortIds.add(p.id)
    const w = p.exposureWeights || {}
    for (const code of Object.keys(w)) {
      if (!validCodes.has(code)) errors.push(`port ${p.name}: exposureWeights has unknown event code "${code}"`)
      if (!isInt(w[code]) || w[code] < 0) errors.push(`port ${p.name}: exposureWeights.${code} must be a non-negative integer, got ${w[code]}`)
    }
    const sum = Object.values(w).reduce((s, v) => s + (Number(v) || 0), 0)
    if (sum !== 10) errors.push(`port ${p.name}: exposureWeights must sum to exactly 10, got ${sum}`)
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed (${errors.length}):\n - ${errors.join('\n - ')}`)
  }

  return { events: events.length, measures: measures.length, ports: ports.length }
}
