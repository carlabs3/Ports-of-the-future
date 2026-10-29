// Fail-fast validator for the domain catalogues (events / measures / ports).
// Run at server startup: if any invariant is violated it throws with the full
// list of problems, so bad data stops the server before it can serve wrong
// scoring. Workshop v5: 28 measures, 6 ports, 85 cards, per-round wheels (% in
// steps of 5, sum 100) and one potentialLossM (€M, > 0) per event (J1/J2).
import { EVENTS, EVENT_CODES } from './events.js'
import { MEASURES, SHARED_MEASURE_IDS } from './measures.js'
import { PORTS } from './ports/index.js'

const isInt = v => Number.isInteger(v)

export function validateConfig({ events = EVENTS, measures = MEASURES, ports = PORTS } = {}) {
  const errors = []
  const validCodes = new Set(EVENT_CODES)

  // ── events ────────────────────────────────────────────────────────────────
  // J1/J2: each event carries potentialLossM (€M, > 0), the same for every port.
  if (events.length !== 7) errors.push(`events: expected 7, got ${events.length}`)
  const seenCodes = new Set()
  for (const e of events) {
    if (seenCodes.has(e.code)) errors.push(`event code duplicated: ${e.code}`)
    seenCodes.add(e.code)
    if (!validCodes.has(e.code)) errors.push(`event has unknown code "${e.code}"`)
    if (!(Number(e.potentialLossM) > 0)) errors.push(`event ${e.code}: potentialLossM must be > 0, got ${e.potentialLossM}`)
  }

  // ── measures ──────────────────────────────────────────────────────────────
  const COUNT = 28
  if (measures.length !== COUNT) errors.push(`measures: expected ${COUNT}, got ${measures.length}`)
  const sortedIds = measures.map(m => m.id).sort((a, b) => a - b)
  for (let i = 0; i < COUNT; i++) {
    if (sortedIds[i] !== i + 1) { errors.push(`measures: ids must be 1..${COUNT} with no gaps (missing/duplicate near ${i + 1})`); break }
  }
  const measureIds = new Set(measures.map(m => m.id))
  for (const m of measures) {
    if (!isInt(m.cost) || m.cost < 1 || m.cost > 5) errors.push(`measure #${m.id}: cost must be an integer 1–5, got ${m.cost}`)
    const keys = Object.keys(m.protection || {})
    if (keys.length !== 7 || !EVENT_CODES.every(c => c in m.protection)) {
      errors.push(`measure #${m.id}: protection must have exactly the 7 event keys, got [${keys.join(', ')}]`)
    }
    for (const [code, val] of Object.entries(m.protection || {})) {
      if (!validCodes.has(code)) errors.push(`measure #${m.id}: protection has unknown event code "${code}"`)
      if (!isInt(val) || val < 0 || val > 10) errors.push(`measure #${m.id}: protection.${code} must be an integer 0–10, got ${val}`)
    }
    // Enablers (#19, #20) raise the culture level and have no protection.
    const shouldRaise = m.id === 19 || m.id === 20
    if (Boolean(m.raisesCultureLevel) !== shouldRaise) {
      errors.push(`measure #${m.id}: raisesCultureLevel must be ${shouldRaise} (only #19 and #20 raise it)`)
    }
    if (shouldRaise && Object.values(m.protection || {}).some(v => v !== 0)) {
      errors.push(`measure #${m.id}: an enabler must have no protection`)
    }
  }

  // ── ports ─────────────────────────────────────────────────────────────────
  if (ports.length !== 6) errors.push(`ports: expected 6, got ${ports.length}`)
  const seenPortIds = new Set()
  let totalCards = 0
  for (const p of ports) {
    if (seenPortIds.has(p.id)) errors.push(`port id duplicated: ${p.id}`)
    seenPortIds.add(p.id)

    // deck: no duplicates, every id exists, all 6 shared present.
    const deck = p.deck || []
    totalCards += deck.length
    const deckSet = new Set(deck)
    if (deckSet.size !== deck.length) errors.push(`port ${p.name}: deck has duplicate card ids`)
    for (const id of deck) {
      if (!measureIds.has(id)) errors.push(`port ${p.name}: deck card #${id} does not exist among the measures`)
    }
    for (const id of SHARED_MEASURE_IDS) {
      if (!deckSet.has(id)) errors.push(`port ${p.name}: deck is missing shared card #${id}`)
    }

    // wheels: one per round (1/2/3); likelihoods are non-negative multiples of 5
    // and sum to exactly 100.
    const wheels = p.wheels || {}
    for (const round of [1, 2, 3]) {
      const w = wheels[round]
      if (!w || typeof w.likelihoods !== 'object') { errors.push(`port ${p.name}: missing wheel for round ${round}`); continue }
      let sum = 0
      for (const [code, val] of Object.entries(w.likelihoods)) {
        if (!validCodes.has(code)) errors.push(`port ${p.name} round ${round}: wheel has unknown event code "${code}"`)
        if (!isInt(val) || val < 0 || val % 5 !== 0) errors.push(`port ${p.name} round ${round}: likelihood ${code}=${val} must be a non-negative multiple of 5`)
        sum += Number(val) || 0
      }
      if (sum !== 100) errors.push(`port ${p.name} round ${round}: likelihoods must sum to 100, got ${sum}`)
    }
    // J2/J6: ports no longer carry an impact table — potential losses live on
    // the events (checked above), the same for every port and round.
  }

  const EXPECTED_CARDS = 85
  if (totalCards !== EXPECTED_CARDS) errors.push(`total card count must be ${EXPECTED_CARDS}, got ${totalCards}`)

  if (errors.length > 0) {
    throw new Error(`Config validation failed (${errors.length}):\n - ${errors.join('\n - ')}`)
  }

  return { events: events.length, measures: measures.length, ports: ports.length, cards: totalCards }
}
