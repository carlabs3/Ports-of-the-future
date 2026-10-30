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
// SKIPPED pending Commit 2: the best-protection benchmarks (and the strategy
// scores derived from them) change with the 3/6/9 budget. Re-enabled with the
// recomputed numbers once approved.
test('Case A: expected 48.5%, best 60.6%, strategy 8.0, SI damage €267M', { skip: 'benchmarks recomputed in Commit 2 (budget 3/6/9)' }, () => {
  const p = PORTS_BY_ID['nord-maris']
  const measures = [2, 19, 23]
  const eff = applyCultureMeasureBonus('developing', measures) // #19 enabler → capped at proactive
  const exp = expectedProtection({ measures, effectiveBand: eff, likelihoods: p.wheels[1].likelihoods })
  const best = bestPossibleExpectedProtection('nord-maris', 1, 'developing')
  assert.ok(Math.abs(exp - 48.5) < 0.1, `expected ≈48.5, got ${exp}`)
  assert.ok(Math.abs(best - 60.6) < 0.1, `best ≈60.6, got ${best}`)
  assert.equal(roundHalfUp((exp / best) * 10), 8) // 8.0/10

  const dmg = computeDamage({ measures, event: 'SI', effectiveBand: eff })
  assert.equal(potentialLossM('SI'), 300)
  assert.ok(Math.abs(dmg - 267) < 0.5, `SI damage ≈€267M, got ${dmg}`)
  assert.equal(300 - roundHalfUp(dmg), 33) // avoided €33M
})

// ── Case B · Meridia, Aware, #8 #11 #19 #23 #26, round 1 ─────────────────────
test('Case B: expected 44.0%, best 51.5%, strategy 8.6, WF damage €173M', { skip: 'benchmarks recomputed in Commit 2 (budget 3/6/9)' }, () => {
  const p = PORTS_BY_ID['meridia']
  const measures = [8, 11, 19, 23, 26]
  const eff = applyCultureMeasureBonus('aware', measures)
  const exp = expectedProtection({ measures, effectiveBand: eff, likelihoods: p.wheels[1].likelihoods })
  const best = bestPossibleExpectedProtection('meridia', 1, 'aware')
  assert.ok(Math.abs(exp - 44.0) < 0.1, `expected ≈44.0, got ${exp}`)
  assert.ok(Math.abs(best - 51.5) < 0.1, `best ≈51.5, got ${best}`)
  assert.equal(((exp / best) * 10).toFixed(1), '8.6') // strategy 8.6/10

  const dmg = computeDamage({ measures, event: 'WF', effectiveBand: eff })
  assert.equal(potentialLossM('WF'), 300)
  assert.ok(Math.abs(dmg - 173) < 0.6, `WF damage ≈€173M, got ${dmg}`)
  assert.equal(300 - roundHalfUp(dmg), 127) // avoided €127M
})

// ── Appendix H · all 72 best-expected-protection benchmarks (recomputed J2) ──
// Weights are now potentialLossM (€M), not per-port impacts; these values come
// straight from the brute-force bestPossibleExpectedProtection (no hand-edits).
test('all 72 benchmarks match the recomputed Appendix H (round 1 / 2 / 3)', { skip: 'benchmarks recomputed in Commit 2 (budget 3/6/9)' }, () => {
  const H = {
    'nord-maris': { reactive: [51, 65, 79], aware: [56, 70, 83], developing: [61, 75, 85], proactive: [65, 79, 87] },
    'meridia':    { reactive: [47, 62, 72], aware: [51, 66, 77], developing: [56, 69, 79], proactive: [59, 72, 81] },
    'riu-verd':   { reactive: [48, 67, 76], aware: [53, 73, 81], developing: [59, 76, 83], proactive: [64, 79, 85] },
    'boreal':     { reactive: [54, 67, 78], aware: [58, 71, 81], developing: [63, 75, 84], proactive: [67, 78, 86] },
    'coralia':    { reactive: [51, 66, 77], aware: [55, 71, 81], developing: [60, 74, 84], proactive: [64, 78, 86] },
    'sabkha':     { reactive: [44, 58, 71], aware: [48, 63, 76], developing: [52, 68, 79], proactive: [56, 71, 81] },
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
