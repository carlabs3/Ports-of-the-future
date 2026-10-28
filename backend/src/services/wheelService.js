import { PORTS_BY_ID } from '../config/ports/index.js'
import { EVENT_CODES } from '../config/events.js'

// Event roulette (v5). Draws from the port's SECRET per-ROUND wheel likelihoods
// (percent, sum 100). Server-side only — likelihoods never leave this layer.
// rng is injectable for deterministic tests (defaults to Math.random). An event
// with likelihood 0 that round can NEVER be drawn.
export function drawEvent(portId, round, rng = Math.random) {
  const port = PORTS_BY_ID[portId]
  const likelihoods = port?.wheels?.[round]?.likelihoods || {}
  const total = Object.values(likelihoods).reduce((s, v) => s + (Number(v) || 0), 0)
  if (total <= 0) return null

  const r = rng() * total
  let acc = 0
  for (const code of EVENT_CODES) {
    const w = likelihoods[code] || 0
    if (w <= 0) continue // zero-likelihood events are skipped entirely
    acc += w
    if (r < acc) return code
  }
  // Fallback for r === total (rng() === 1): return the last non-zero event.
  const nonZero = EVENT_CODES.filter(c => (likelihoods[c] || 0) > 0)
  return nonZero[nonZero.length - 1] || null
}

// The port's N highest-exposure events (default 2), as event codes. Used to pick
// the illustration motifs. Ties break by the canonical EVENT_CODES order so the
// result is deterministic. Pure — takes the weights, not the whole port.
export function topExposureEvents(weights = {}, n = 2) {
  return EVENT_CODES
    .filter(c => (Number(weights[c]) || 0) > 0)
    .sort((a, b) => ((Number(weights[b]) || 0) - (Number(weights[a]) || 0))
      || (EVENT_CODES.indexOf(a) - EVENT_CODES.indexOf(b)))
    .slice(0, n)
}
