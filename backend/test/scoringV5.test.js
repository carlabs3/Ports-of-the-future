import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PORTS_BY_ID } from '../src/config/ports/index.js'
import { expectedProtection, computeDamage, potentialLossM } from '../src/services/preparednessService.js'
import { precomputeBestPossible, bestPossibleExpectedProtection, computeStrategyScore } from '../src/services/strategyService.js'
import { applyCultureMeasureBonus, BAND_ORDER } from '../src/services/cultureService.js'

precomputeBestPossible()

const roundHalfUp = x => Math.round(x) // JS Math.round rounds .5 up for positives (D9)

// ── J1/J2 · one potential loss per event, same for every port (€ millions) ───
test('potentialLossM: the J1 table (SS 600 … HW 200), same for all ports', () => {
  assert.equal(potentialLossM('SS'), 600)
  assert.equal(potentialLossM('WS'), 500)
  assert.equal(potentialLossM('RF'), 400)
  assert.equal(potentialLossM('DR'), 300)
  assert.equal(potentialLossM('WF'), 300)
  assert.equal(potentialLossM('SI'), 300)
  assert.equal(potentialLossM('HW'), 200)
})

// ── Case A · Nord-Maris, Developing, #2 #19 #23, round 1 (worked example) ────
// ── Best round-1 Aware combination at 3 coins reaches the Aware/r1 benchmark ──
// Pins both the reported combos and the round-1 Aware benchmarks (budget 3). A
// combo's expected protection, rounded, equals that port's Aware r1 value.
test('each port: the best 3-coin Aware round-1 combo reaches its benchmark', () => {
  const COMBOS = {
    'nord-maris': { cards: [10, 23], pct: 34 },
    'meridia':    { cards: [10, 11], pct: 35 },
    'riu-verd':   { cards: [22],     pct: 32 },
    'boreal':     { cards: [10, 23], pct: 34 },
    'coralia':    { cards: [10, 23], pct: 34 },
    'sabkha':     { cards: [10, 11], pct: 31 },
  }
  for (const [portId, { cards, pct }] of Object.entries(COMBOS)) {
    const p = PORTS_BY_ID[portId]
    const eff = applyCultureMeasureBonus('aware', cards)
    const exp = expectedProtection({ measures: cards, effectiveBand: eff, likelihoods: p.wheels[1].likelihoods })
    assert.equal(roundHalfUp(exp), pct, `${portId}: combo rounds to ${roundHalfUp(exp)}, expected ${pct}`)
    assert.equal(roundHalfUp(bestPossibleExpectedProtection(portId, 1, 'aware')), pct, `${portId}: Aware r1 benchmark`)
  }
})

// ── Appendix H · all 72 best-expected-protection benchmarks (budget 3/6/9) ───
// Weights are potentialLossM (€M); values come straight from the brute-force
// bestPossibleExpectedProtection at the 3/6/9 cumulative budget (no hand-edits).
test('all 72 benchmarks match the recomputed Appendix H (round 1 / 2 / 3)', () => {
  const H = {
    'nord-maris': { reactive: [30, 51, 67], aware: [34, 56, 72], developing: [37, 60, 76], proactive: [40, 65, 81] },
    'meridia':    { reactive: [31, 48, 61], aware: [35, 53, 66], developing: [38, 57, 70], proactive: [42, 61, 73] },
    'riu-verd':   { reactive: [29, 49, 67], aware: [32, 54, 72], developing: [36, 59, 75], proactive: [39, 65, 79] },
    'boreal':     { reactive: [30, 53, 68], aware: [34, 58, 72], developing: [37, 63, 76], proactive: [40, 67, 79] },
    'coralia':    { reactive: [30, 50, 65], aware: [34, 55, 69], developing: [37, 59, 74], proactive: [40, 64, 79] },
    'sabkha':     { reactive: [28, 45, 59], aware: [31, 50, 64], developing: [34, 53, 69], proactive: [37, 57, 72] },
  }
  for (const [portId, byBand] of Object.entries(H)) {
    for (const band of BAND_ORDER) {
      for (const round of [1, 2, 3]) {
        const got = roundHalfUp(bestPossibleExpectedProtection(portId, round, band))
        assert.equal(got, byBand[band][round - 1], `${portId} round ${round} ${band}: got ${got}, Appendix H ${byBand[band][round - 1]}`)
      }
    }
  }
})

// ── J6 · no round-3 increase: benchmarks rise across rounds only via budget ──
// (sanity) every benchmark is a sensible percentage and non-decreasing by band.
test('benchmarks are 0–100 and non-decreasing as the starting culture rises', () => {
  for (const portId of Object.keys(PORTS_BY_ID)) {
    for (const round of [1, 2, 3]) {
      let prev = -1
      for (const band of BAND_ORDER) {
        const v = bestPossibleExpectedProtection(portId, round, band)
        assert.ok(v >= 0 && v <= 100, `${portId} r${round} ${band}: ${v} out of range`)
        assert.ok(v >= prev - 1e-9, `${portId} r${round} ${band}: ${v} < previous band ${prev}`)
        prev = v
      }
    }
  }
})

// ── damage is full precision €M now (D1 — no rounding in the engine) ─────────
test('computeDamage keeps full precision (€M, not rounded)', () => {
  // One card (#6 SS 3) at Aware (×0.9): sAdj 2.7 → P = 2.7 → damage = 600 × (1 − 0.27) = 438.
  const d = computeDamage({ measures: [6], event: 'SS', effectiveBand: 'aware' })
  assert.ok(Math.abs(d - 438) < 1e-6, `expected €438M, got ${d}`)
})

// ── strategy score = round(expected ÷ best × 100), unrounded inputs (D9) ─────
test('strategy score: empty plan 0; expected == best gives 100', () => {
  assert.equal(computeStrategyScore({ expectedProtection: 0, portId: 'boreal', round: 1, startingBand: 'aware' }), 0)
  const best = bestPossibleExpectedProtection('boreal', 1, 'aware')
  assert.equal(computeStrategyScore({ expectedProtection: best, portId: 'boreal', round: 1, startingBand: 'aware' }), 100)
})
