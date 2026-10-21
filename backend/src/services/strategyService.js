import { PORTS, PORTS_BY_ID } from '../config/ports/index.js'
import { MEASURES_BY_ID } from '../config/measures.js'
import { applyCultureMeasureBonus, BAND_ORDER } from './cultureService.js'
import { expectedProtectionPct } from './preparednessService.js'

// Strategy scoring (v4) — pure, server-side. Reuses expectedProtectionPct (and
// through it the single preparedness formula); no second copy of the maths.

export const CUMULATIVE_BUDGETS = [6, 8, 10] // rounds 1 / 2 / 3

const round1 = x => Math.round(x * 10) / 10
const mean = a => a.reduce((s, v) => s + v, 0) / a.length

// ── Best possible expected protection ──────────────────────────────────────
// For each (port, starting culture level, budget) the maximum expected
// protection reachable by any subset of the port's deck whose total cost fits
// the budget — enablers included, since they raise the culture level. The 72
// values are computed once at startup and cached. The WINNING COMBINATIONS are
// never stored or returned — only the numbers.
let BEST = null // Map `${portId}|${band}|${budget}` -> number (precise %)

function bestForPort(port) {
  const deck = port.deck
  const n = deck.length
  const costs = deck.map(id => MEASURES_BY_ID[id].cost)
  const weights = port.exposureWeights
  const best = {}
  for (const band of BAND_ORDER) for (const b of CUMULATIVE_BUDGETS) best[`${band}|${b}`] = 0

  for (let mask = 0; mask < (1 << n); mask++) {
    let cost = 0
    const subset = []
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { cost += costs[i]; subset.push(deck[i]) }
    if (cost > 10) continue // unaffordable at every budget — prune
    for (const band of BAND_ORDER) {
      const eff = applyCultureMeasureBonus(band, subset)
      const exp = expectedProtectionPct({ measures: subset, effectiveBand: eff, exposureWeights: weights })
      for (const b of CUMULATIVE_BUDGETS) {
        if (cost <= b && exp > best[`${band}|${b}`]) best[`${band}|${b}`] = exp
      }
    }
  }
  return best
}

export function precomputeBestPossible() {
  BEST = new Map()
  for (const port of PORTS) {
    const best = bestForPort(port)
    for (const [k, v] of Object.entries(best)) BEST.set(`${port.id}|${k}`, v)
  }
  return BEST.size
}

export function bestPossibleExpectedProtection(portId, startingBand, budget) {
  if (!BEST) precomputeBestPossible()
  return BEST.get(`${portId}|${startingBand}|${budget}`) ?? null
}

// ── Strategy score ─────────────────────────────────────────────────────────
// expected protection ÷ best possible, as a whole %, from the DISPLAYED integers
// (D16). The denominator uses the team's STARTING culture level and the round's
// cumulative budget; it does not change if the team lost coins on a return.
export function computeStrategyScore({ expectedProtection, portId, startingBand, budget }) {
  const best = bestPossibleExpectedProtection(portId, startingBand, budget)
  if (!best) return 0
  return Math.round((Math.round(expectedProtection) / Math.round(best)) * 100)
}

// ── Final ranking ──────────────────────────────────────────────────────────
// Average of the 3 strategy scores, highest first; ties share a rank. Luck =
// total damage across the 3 spins (shown next to the ranking, never used to rank).
export function computeFinalRanking(teams = []) {
  const rows = teams.map(t => ({
    group: t.group,
    portId: t.portId ?? null,
    finalScore: (t.strategyScores && t.strategyScores.length) ? round1(mean(t.strategyScores)) : 0,
    totalDamage: (t.damages || []).reduce((s, d) => s + (Number(d) || 0), 0),
  }))
  rows.sort((a, b) => b.finalScore - a.finalScore)
  let rank = 0, prev = null
  rows.forEach((row, i) => {
    if (row.finalScore !== prev) { rank = i + 1; prev = row.finalScore }
    row.rank = rank
  })
  return rows
}

// Convenience: expected protection for a team's current portfolio (base band +
// its own enabler bump), via the existing expected-protection function.
export function portExposureWeights(portId) {
  return PORTS_BY_ID[portId]?.exposureWeights || {}
}
