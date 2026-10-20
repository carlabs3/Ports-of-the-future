import { PORTS_BY_ID } from '../config/ports/index.js'
import { EVENT_CODES } from '../config/events.js'

// Event roulette. Uses the port's SECRET exposureWeights (sum 10) as
// probabilities. Server-side only — weights never leave this layer.
// rng is injectable for deterministic tests (defaults to Math.random).
// A port with weight 0 for an event can NEVER draw that event.
export function drawEvent(portId, rng = Math.random) {
  const port = PORTS_BY_ID[portId]
  if (!port) return null
  const weights = port.exposureWeights || {}
  const total = Object.values(weights).reduce((s, v) => s + (Number(v) || 0), 0)
  if (total <= 0) return null

  const r = rng() * total
  let acc = 0
  for (const code of EVENT_CODES) {
    const w = weights[code] || 0
    if (w <= 0) continue // zero-weight events are skipped entirely
    acc += w
    if (r < acc) return code
  }
  // Fallback for r === total (rng() === 1): return the last non-zero event.
  const nonZero = EVENT_CODES.filter(c => (weights[c] || 0) > 0)
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
