import { PORTS, PORTS_BY_ID } from '../config/ports/index.js'
import { MEASURES_BY_ID } from '../config/measures.js'
import { cumulativeBudgets } from '../config/game.js'
import { applyCultureMeasureBonus, BAND_ORDER } from './cultureService.js'
import { expectedProtection } from './preparednessService.js'
import { roundPotentialM, roundDamageM } from './roundMoney.js'

// Strategy scoring (v5, Appendix C) — pure, server-side. Reuses expectedProtection
// (and through it the single preparedness formula); no second copy of the maths.

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
      for (const band of BAND_ORDER) {
        const exp = expectedProtection({ measures: subset, effectiveBand: effByBand[band], likelihoods })
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
// Raw strategy = expected protection ÷ best possible (0..1), UNROUNDED. The
// denominator uses the team's STARTING culture level and the round's budget; it
// does not change on a return. computeStrategyScore is the rounded whole-% form
// (D9) kept for back-compat; the display derives both the % and the /10 score
// from the raw value.
export function computeStrategyScoreRaw({ expectedProtection: exp, portId, round, startingBand }) {
  const best = bestPossibleExpectedProtection(portId, round, startingBand)
  if (!best) return 0
  return exp / best
}

export function computeStrategyScore(args) {
  return Math.round(computeStrategyScoreRaw(args) * 100)
}

// ── Final ranking ──────────────────────────────────────────────────────────
// Final score = mean of the three rounds' RAW strategy ratios (×100), kept
// UNROUNDED here and rounded only for display (fixes the earlier D9 violation of
// averaging pre-rounded scores). Highest first. Two teams share a rank only when
// their unrounded means are exactly equal — never because they round the same.
// `strategyRaws` are the per-round raw ratios (0..1); callers fall back to
// strategyScore/100 for entries saved before strategyScoreRaw existed. Luck =
// sum of the 3 damages (shown next to the ranking, never used to rank).
export function computeFinalRanking(teams = []) {
  const rows = teams.map(t => {
    const raws = (t.strategyRaws || []).filter(v => v != null)
    const totalDamageRaw = (t.damages || []).reduce((s, d) => s + (Number(d) || 0), 0)
    const totalPotential = (t.potentials || []).reduce((s, p) => s + (Number(p) || 0), 0)
    return {
      group: t.group,
      portId: t.portId ?? null,
      finalScore: raws.length ? mean(raws) * 100 : 0,                         // unrounded (display rounds)
      totalDamage: totalDamageRaw,                                            // kept for back-compat
      totalDamageRaw,                                                         // Σ damageBill (F2, raw)
      totalPotential,                                                         // Σ impact (F2)
      avoidedPctRaw: totalPotential > 0 ? 1 - totalDamageRaw / totalPotential : 0, // F2 (raw ratio 0..1)
    }
  })
  rows.sort((a, b) => b.finalScore - a.finalScore)
  let rank = 0, prev = null
  rows.forEach((row, i) => {
    if (prev === null || row.finalScore !== prev) { rank = i + 1; prev = row.finalScore }
    row.rank = rank
  })
  return rows
}

// Awards (F1), from ranking rows. Best overall strategy = highest finalScore;
// Most losses avoided = highest avoidedPctRaw. Both on the UNROUNDED values;
// exact ties return every winning row (the UI joins the names with " & ").
export function computeAwards(rows = []) {
  const winners = (key) => {
    if (!rows.length) return []
    const max = Math.max(...rows.map(r => Number(r[key]) || -Infinity))
    return rows.filter(r => (Number(r[key]) || -Infinity) === max)
  }
  return { bestStrategy: winners('finalScore'), mostAvoided: winners('avoidedPctRaw') }
}

// ── Standings (G5) ───────────────────────────────────────────────────────────
// Per-team standings using only the rounds played up to `throughRound`, reusing
// the F2/F3 maths. Returns raw aggregates (for ranking) and the shown money
// (sums of the per-round shown values). Ranks are computed for BOTH boards
// (by strategy = finalScore, by losses avoided = avoidedPctRaw); teams share a
// rank only on exactly equal values. After round 2, each team's movement vs its
// position after round 1 is included (+ = moved up). Money is in € millions,
// rounded to whole numbers (J5); totals sum the per-round shown values.
export function computeStandings(strategies = [], throughRound = 1) {
  const rows = strategies.map(s => {
    const played = (s.rounds || []).filter(r => r.round <= throughRound)
    const raws = played.map(r => r.strategyScoreRaw != null ? r.strategyScoreRaw : (r.strategyScore != null ? r.strategyScore / 100 : null)).filter(v => v != null)
    const totalDamageRaw = played.reduce((a, r) => a + roundDamageM(r), 0)       // €M (J3)
    const totalPotential = played.reduce((a, r) => a + roundPotentialM(r), 0)    // €M (J3)
    const totalDamageShown = played.reduce((a, r) => a + Math.round(roundDamageM(r)), 0) // J5: whole
    return {
      group: s.group,
      portId: s.portId ?? null,
      finalScore: raws.length ? mean(raws) * 100 : 0,                       // raw mean ×100
      totalDamageRaw,
      totalPotential,
      avoidedPctRaw: totalPotential > 0 ? 1 - totalDamageRaw / totalPotential : 0,
      totalDamageShown,
      avoidedShown: totalPotential - totalDamageShown,                      // J5: whole
      avoidedPct: totalPotential > 0 ? Math.round((1 - totalDamageRaw / totalPotential) * 100) : 0, // from raw
    }
  })

  const ranksBy = (key) => {
    const sorted = [...rows].sort((a, b) => b[key] - a[key])
    const map = {}
    let rank = 0, prev = null
    sorted.forEach((r, i) => { if (prev === null || r[key] !== prev) { rank = i + 1; prev = r[key] } map[r.group] = rank })
    return map
  }
  const strategyRank = ranksBy('finalScore')
  const avoidedRank = ranksBy('avoidedPctRaw')

  // Movement vs the standings after the previous round (round 2 only).
  let prevStrat = {}, prevAvoid = {}
  if (throughRound === 2) {
    const prev = computeStandings(strategies, 1)
    prevStrat = Object.fromEntries(prev.teams.map(t => [t.group, t.strategyRank]))
    prevAvoid = Object.fromEntries(prev.teams.map(t => [t.group, t.avoidedRank]))
  }
  const move = (now, before) => (before == null ? null : before - now) // + = up

  return {
    throughRound,
    teams: rows.map(r => ({
      ...r,
      strategyRank: strategyRank[r.group],
      avoidedRank: avoidedRank[r.group],
      strategyMove: throughRound === 2 ? move(strategyRank[r.group], prevStrat[r.group]) : null,
      avoidedMove: throughRound === 2 ? move(avoidedRank[r.group], prevAvoid[r.group]) : null,
    })),
  }
}

// Convenience: a port's per-round wheel likelihoods (server-side only).
export function portWheel(portId, round) {
  return PORTS_BY_ID[portId]?.wheels?.[round]?.likelihoods || {}
}
