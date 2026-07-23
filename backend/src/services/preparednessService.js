import { MEASURES_BY_ID } from '../config/measures.js'

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
    breakdown,
  }
}
