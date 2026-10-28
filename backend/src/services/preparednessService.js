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

// ── v5 scoring (Appendix C) ─────────────────────────────────────────────────

// The impact (coins 1–5) per event for a port in a given round. Base impacts are
// used in rounds 1 & 2; in round 3 the two `impactRound3Plus` events gain +1.
// Events with no base impact are absent (they can't occur on this port's wheel).
export function impactsForRound(port, round) {
  const base = port?.impacts || {}
  const plus = new Set(round === 3 ? (port?.impactRound3Plus || []) : [])
  const out = {}
  for (const [code, v] of Object.entries(base)) out[code] = v + (plus.has(code) ? 1 : 0)
  return out
}

// Damage for the DRAWN event (D1): impact × (1 − P/10), at FULL precision — no
// rounding to 0.5 any more. P is the preparedness (0–10) for that event with the
// team's effective culture band. A score only; it never removes coins.
export function computeDamage({ measures = [], event, effectiveBand = null, impact = 0 }) {
  const P = computePreparedness({ measureIds: measures, eventCode: event, cultureBand: effectiveBand }).rawPreparedness
  return (Number(impact) || 0) * (1 - P / 10)
}

// Expected protection (%) for a round: Σ_e (L_e × I_e × P_e/10) ÷ Σ_e (L_e × I_e),
// ×100, over all events, where L is the likelihood on the ROUND's wheel and I the
// impact in the ROUND. P_e uses the team's EFFECTIVE band. Does not depend on the
// drawn event. Full precision — display rounds half-up (D9). The L scale cancels
// in the ratio, so likelihoods may be in percent.
export function expectedProtection({ measures = [], effectiveBand = null, likelihoods = {}, impacts = {} }) {
  let avoided = 0
  let possible = 0
  for (const code of EVENT_CODES) {
    const L = Number(likelihoods[code]) || 0
    const I = Number(impacts[code]) || 0
    if (L <= 0 || I <= 0) continue
    const P = computePreparedness({ measureIds: measures, eventCode: code, cultureBand: effectiveBand }).rawPreparedness
    avoided += L * I * (P / 10)
    possible += L * I
  }
  return possible > 0 ? (avoided / possible) * 100 : 0
}

// ── v4 (deprecated, kept importable until Commit 3 rewires rounds) ───────────
// Damage bill (v4) = event losses × (1 − P/10), rounded to the nearest 0.5. v5
// uses computeDamage (full precision, per-port/round impact) instead.
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
