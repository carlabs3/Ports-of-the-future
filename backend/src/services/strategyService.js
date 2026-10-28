import { PORTS, PORTS_BY_ID } from '../config/ports/index.js'
import { MEASURES_BY_ID } from '../config/measures.js'
import { cumulativeBudgets } from '../config/game.js'
import { applyCultureMeasureBonus, BAND_ORDER } from './cultureService.js'
import { expectedProtection, impactsForRound } from './preparednessService.js'

// Strategy scoring (v5, Appendix C) — pure, server-side. Reuses expectedProtection
// (and through it the single preparedness formula); no second copy of the maths.

const round1 = x => Math.round(x * 10) / 10
const mean = a => a.reduce((s, v) => s + v, 0) / a.length

// ── Best possible expected protection ──────────────────────────────────────
// For each (port, round, starting culture level) the maximum expected protection
// reachable by any subset of the port's deck whose total cost fits the round's
// CUMULATIVE budget (6 / 9 / 12). The starting level is BEFORE enablers; enablers
// in the subset raise it. The 72 values (6×3×4) are computed once and cached by
// `port|round|level`. The winning combinations are never stored or returned.
let BEST = null

function bestForPort(port) {
  const deck = port.deck
  const n = deck.length
  const costs = deck.map(id => MEASURES_BY_ID[id].cost)
  const maxBudget = cumulativeBudgets[cumulativeBudgets.length - 1]
  const out = {}
  for (const round of [1, 2, 3]) for (const band of BAND_ORDER) out[`${round}|${band}`] = 0

  for (let mask = 0; mask < (1 << n); mask++) {
    let cost = 0
    const subset = []
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { cost += costs[i]; subset.push(deck[i]) }
    if (cost > maxBudget) continue // unaffordable at every round — prune
    // Effective band per starting level is independent of the round.
    const effByBand = {}
    for (const band of BAND_ORDER) effByBand[band] = applyCultureMeasureBonus(band, subset)
    for (const round of [1, 2, 3]) {
      if (cost > cumulativeBudgets[round - 1]) continue
      const likelihoods = port.wheels[round].likelihoods
      const impacts = impactsForRound(port, round)
      for (const band of BAND_ORDER) {
        const exp = expectedProtection({ measures: subset, effectiveBand: effByBand[band], likelihoods, impacts })
        if (exp > out[`${round}|${band}`]) out[`${round}|${band}`] = exp
      }
    }
  }
  return out
}

export function precomputeBestPossible() {
  BEST = new Map()
  for (const port of PORTS) {
    const best = bestForPort(port)
    for (const [k, v] of Object.entries(best)) BEST.set(`${port.id}|${k}`, v)
  }
  return BEST.size
}

// Full-precision best expected protection for (port, round, starting level).
export function bestPossibleExpectedProtection(portId, round, startingBand) {
  if (!BEST) precomputeBestPossible()
  return BEST.get(`${portId}|${round}|${startingBand}`) ?? null
}

// ── Strategy score ─────────────────────────────────────────────────────────
// expected protection ÷ best possible, as a whole %. Both inputs are UNROUNDED;
// the ratio is rounded ONCE, half-up (D9). The denominator uses the team's
// STARTING culture level and the round's budget; it does not change on a return.
export function computeStrategyScore({ expectedProtection: exp, portId, round, startingBand }) {
  const best = bestPossibleExpectedProtection(portId, round, startingBand)
  if (!best) return 0
  return Math.round((exp / best) * 100)
}

// ── Final ranking ──────────────────────────────────────────────────────────
// Average of the 3 strategy scores, highest first; ties share a rank. Luck = sum
// of the 3 damages (shown next to the ranking, never used to rank).
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

// Convenience: a port's per-round wheel likelihoods (server-side only).
export function portWheel(portId, round) {
  return PORTS_BY_ID[portId]?.wheels?.[round]?.likelihoods || {}
}
