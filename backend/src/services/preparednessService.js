import { MEASURES_BY_ID } from '../config/measures.js'
import { EVENT_CODES, EVENTS_BY_CODE } from '../config/events.js'

// Preparedness scoring — pure, server-side, no DB. This is the phase-8 maths.
//
// Order of operations (do NOT change):
//   for each measure → take its protection score sᵢ for the DRAWN event →
//   multiply by the culture factor → cap at 10 → THEN feed into the product.
// The culture factor is applied to each score, never to the final P.

// (1) Culture multiplier by effective culture band. null → 1.0.
const CULTURE_FACTOR = { reactive: 0.8, aware: 0.9, developing: 1.0, proactive: 1.1 }
export function cultureFactor(cultureBand) {
  return CULTURE_FACTOR[cultureBand] ?? 1.0
}

const round1 = x => Math.round(x * 10) / 10

// Per-measure adjustment: apply the culture factor then cap at 10. This is
// where the cap lives — exported so it can be tested directly. (Note: with the
// real config, max protection is 8, so ×1.1 = 8.8 never reaches the cap; the
// cap is defensive.)
export function adjustScore(sOriginal, factor) {
  return Math.min(10, sOriginal * factor)
}

// (2)+(3) Preparedness and losses-avoided for a table against one drawn event.
//   computePreparedness({ measureIds, eventCode, cultureBand })
//     → { preparedness, lossesAvoidedPct, breakdown }
//   P = 10 × [ 1 − Π(1 − sᵢ_adj/10) ]  over all bought measures.
//   lossesAvoidedPct = P × 10.
export function computePreparedness({ measureIds = [], eventCode, cultureBand = null }) {
  const factor = cultureFactor(cultureBand)
  const breakdown = []
  let residual = 1

  for (const id of measureIds) {
    const m = MEASURES_BY_ID[id]
    if (!m) continue // unknown id — skip defensively, never throw
    const sOriginal = m.protection?.[eventCode] ?? 0
    // culture factor → cap at 10, per measure, BEFORE the product.
    const sAdjusted = adjustScore(sOriginal, factor)
    residual *= (1 - sAdjusted / 10)
    breakdown.push({ measureId: id, name: m.name, sOriginal, sAdjusted: round1(sAdjusted) })
  }

  // No measures → P = 0 (empty product would give 1 → 0 anyway; explicit for clarity).
  const rawP = measureIds.length === 0 ? 0 : 10 * (1 - residual)

  return {
    preparedness:     round1(rawP),
    lossesAvoidedPct: round1(rawP * 10),
    // Unrounded values (full precision). The display path uses the rounded ones;
    // the expected-value maths and the damage bill need the unrounded ones so
    // weighted sums / roundings aren't skewed by per-event rounding (D16).
    rawPreparedness:     rawP,
    rawLossesAvoidedPct: rawP * 10,
    breakdown,
  }
}

// ── v5 scoring (Appendix C), with J1/J2 potential losses ────────────────────

// Potential loss (€ millions) for an event — the SAME for every port and round.
export function potentialLossM(event) {
  return EVENTS_BY_CODE[event]?.potentialLossM || 0
}

// Damage for the DRAWN event (D1): potentialLossM × (1 − P/10), full precision
// (€ millions). P is the preparedness (0–10) with the team's effective band.
export function computeDamage({ measures = [], event, effectiveBand = null }) {
  const P = computePreparedness({ measureIds: measures, eventCode: event, cultureBand: effectiveBand }).rawPreparedness
  return potentialLossM(event) * (1 - P / 10)
}

// Expected protection (%) for a round: Σ_e (L_e × W_e × P_e/10) ÷ Σ_e (L_e × W_e),
// ×100, over the events on the ROUND's wheel, where L is the likelihood and W the
// event's potential loss (potentialLossM, same for every port). P_e uses the
// team's EFFECTIVE band. Does not depend on the drawn event. The L scale cancels
// in the ratio, so likelihoods may be in percent.
export function expectedProtection({ measures = [], effectiveBand = null, likelihoods = {} }) {
  let avoided = 0
  let possible = 0
  for (const code of EVENT_CODES) {
    const L = Number(likelihoods[code]) || 0
    const W = potentialLossM(code)
    if (L <= 0 || W <= 0) continue
    const P = computePreparedness({ measureIds: measures, eventCode: code, cultureBand: effectiveBand }).rawPreparedness
    avoided += L * W * (P / 10)
    possible += L * W
  }
  return possible > 0 ? (avoided / possible) * 100 : 0
}

// (5) Coins that helped against the DRAWN event: the sum of the costs of the
// measures whose protection score for that event is above 0.
export function computeCoinsThatHelped({ measures = [], event }) {
  return (measures || []).reduce((sum, id) => {
    const m = MEASURES_BY_ID[id]
    if (!m) return sum
    const protection = m.protection?.[event] ?? 0
    return protection > 0 ? sum + (m.cost || 0) : sum
  }, 0)
}
