import { MEASURES_BY_ID } from '../config/measures.js'
import { EVENT_CODES } from '../config/events.js'
import { applyCultureMeasureBonus } from './cultureService.js'

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

const round2 = x => Math.round(x * 100) / 100

// Damage bill (D14) = event losses × (1 − P/10), rounded to the nearest 0.5 with
// halves rounding up. A score only; it never removes coins. P is the full-
// precision preparedness (0–10).
export function computeDamageBill(lossValue, P) {
  const raw = (Number(lossValue) || 0) * (1 - (Number(P) || 0) / 10)
  return Math.round(raw / 0.5) * 0.5 // Math.round takes exact halves up
}

// Expected protection over ALL the port's events, weighted by exposure, using an
// EFFECTIVE culture band (already including any enabler bump). Σ (weight/10) ×
// lossesAvoided(e), per-event values UNROUNDED; result rounded to 2 decimals.
export function expectedProtectionPct({ measures = [], effectiveBand = null, exposureWeights = {} }) {
  let sum = 0
  for (const code of EVENT_CODES) {
    const w = Number(exposureWeights[code]) || 0
    if (w <= 0) continue
    const { rawLossesAvoidedPct } = computePreparedness({ measureIds: measures, eventCode: code, cultureBand: effectiveBand })
    sum += (w / 10) * rawLossesAvoidedPct
  }
  return round2(sum)
}

// (4) Expected losses-avoided for a team across ALL events, weighted by the
// port's exposure. Reuses computePreparedness (so the culture multiplier and the
// per-measure formula are not duplicated) and applyCultureMeasureBonus (so the
// #19/#20 culture bump is applied) — `cultureBand` is the BASE band.
//
//   computeExpectedLossesAvoided({ measures, cultureBand, exposureWeights })
//     = Σ over events e of (weight_e / 10) × lossesAvoidedPct(measures, e, effBand)
//   where effBand = applyCultureMeasureBonus(cultureBand, measures).
// Returned rounded to 2 decimals; per-event values are taken UNROUNDED.
export function computeExpectedLossesAvoided({ measures = [], cultureBand = null, exposureWeights = {} }) {
  const effectiveBand = applyCultureMeasureBonus(cultureBand, measures)
  return expectedProtectionPct({ measures, effectiveBand, exposureWeights })
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
