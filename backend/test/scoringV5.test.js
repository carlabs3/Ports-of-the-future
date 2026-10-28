import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PORTS_BY_ID } from '../src/config/ports/index.js'
import { expectedProtection, computeDamage, impactsForRound } from '../src/services/preparednessService.js'
import { precomputeBestPossible, bestPossibleExpectedProtection, computeStrategyScore } from '../src/services/strategyService.js'
import { applyCultureMeasureBonus, BAND_ORDER } from '../src/services/cultureService.js'

precomputeBestPossible()

const roundHalfUp = x => Math.round(x) // JS Math.round rounds .5 up for positives (D9)

// ── Appendix G · Port of Velmar (test fixture only, never added to config) ───
test('Velmar: expected protection 39%, damage RF 0.6, damage SS 4', () => {
  const velmar = { likelihoods: { RF: 40, SS: 30, WS: 20, HW: 10 }, impacts: { RF: 4, SS: 4, WS: 3, HW: 1 } }
  const measures = [15, 4, 19]          // Drainage, Green infrastructure, Governance (enabler)
  const eff = 'developing'              // Aware + one enabler → Developing (×1.0)

  const exp = expectedProtection({ measures, effectiveBand: eff, likelihoods: velmar.likelihoods, impacts: velmar.impacts })
  assert.equal(Math.abs(exp - 39.43) < 0.01, true, `expected ≈39.43, got ${exp}`)
  assert.equal(roundHalfUp(exp), 39)

  assert.equal(Math.abs(computeDamage({ measures, event: 'RF', effectiveBand: eff, impact: 4 }) - 0.6) < 1e-9, true)
  assert.equal(computeDamage({ measures, event: 'SS', effectiveBand: eff, impact: 4 }), 4) // P = 0 → full impact
})

// ── Appendix H · all 72 best-expected-protection benchmarks (rounded half-up) ─
test('all 72 benchmarks match Appendix H (round 1 / 2 / 3)', () => {
  const H = {
    'nord-maris': { reactive: [51, 68, 79], aware: [56, 73, 83], developing: [61, 77, 85], proactive: [65, 81, 87] },
    'meridia':    { reactive: [56, 70, 78], aware: [60, 74, 82], developing: [64, 77, 84], proactive: [68, 79, 86] },
    'riu-verd':   { reactive: [51, 69, 78], aware: [56, 75, 83], developing: [62, 78, 84], proactive: [67, 80, 86] },
    'boreal':     { reactive: [53, 68, 76], aware: [58, 72, 80], developing: [62, 76, 84], proactive: [66, 80, 86] },
    'coralia':    { reactive: [50, 68, 75], aware: [55, 72, 80], developing: [59, 75, 82], proactive: [64, 78, 84] },
    'sabkha':     { reactive: [54, 70, 78], aware: [58, 74, 82], developing: [63, 77, 84], proactive: [68, 80, 86] },
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

// ── Appendix I · the round-1 Aware combination reaches the Aware/2026 benchmark
test('each port: the Appendix I combo reaches the Aware 2026 benchmark exactly', () => {
  const I = {
    'nord-maris': [6, 8, 10], 'meridia': [10, 11, 19, 25], 'riu-verd': [11, 17, 21],
    'boreal': [6, 10, 17], 'coralia': [10, 13, 19], 'sabkha': [11, 16, 19, 26],
  }
  for (const [portId, combo] of Object.entries(I)) {
    const p = PORTS_BY_ID[portId]
    const eff = applyCultureMeasureBonus('aware', combo)
    const exp = expectedProtection({ measures: combo, effectiveBand: eff, likelihoods: p.wheels[1].likelihoods, impacts: impactsForRound(p, 1) })
    const benchmark = roundHalfUp(bestPossibleExpectedProtection(portId, 1, 'aware'))
    assert.equal(roundHalfUp(exp), benchmark, `${portId}: combo rounds to ${roundHalfUp(exp)}, Aware/2026 benchmark ${benchmark}`)
  }
})

// ── impacts per round (Appendix F): +1 for two events in round 3 only ────────
test('impactsForRound applies the round-3 +1 and nothing in rounds 1/2', () => {
  const nm = PORTS_BY_ID['nord-maris'] // base RF 2, HW 1; +1 in round 3: RF, HW
  assert.deepEqual(impactsForRound(nm, 1), { SS: 5, RF: 2, HW: 1, WS: 4, SI: 2 })
  assert.deepEqual(impactsForRound(nm, 2), { SS: 5, RF: 2, HW: 1, WS: 4, SI: 2 })
  assert.deepEqual(impactsForRound(nm, 3), { SS: 5, RF: 3, HW: 2, WS: 4, SI: 2 })
})

// ── damage is full precision now (D1 — no rounding to 0.5) ───────────────────
test('computeDamage keeps full precision (not rounded to 0.5)', () => {
  // One card (#6 SS 3) at Aware (×0.9): sAdj 2.7 → P = 2.7 → damage = 5 × (1 − 0.27) = 3.65.
  const d = computeDamage({ measures: [6], event: 'SS', effectiveBand: 'aware', impact: 5 })
  assert.equal(Math.abs(d - 3.65) < 1e-9, true, `expected 3.65, got ${d}`)
})

// ── strategy score = round(expected ÷ best), unrounded inputs (D9) ───────────
test('strategy score: empty plan 0; the optimal round-1 Aware combo ≈100', () => {
  assert.equal(computeStrategyScore({ expectedProtection: 0, portId: 'boreal', round: 1, startingBand: 'aware' }), 0)
  const p = PORTS_BY_ID['boreal']
  const combo = [6, 10, 17]
  const eff = applyCultureMeasureBonus('aware', combo)
  const exp = expectedProtection({ measures: combo, effectiveBand: eff, likelihoods: p.wheels[1].likelihoods, impacts: impactsForRound(p, 1) })
  const score = computeStrategyScore({ expectedProtection: exp, portId: 'boreal', round: 1, startingBand: 'aware' })
  assert.ok(score >= 99 && score <= 100, `optimal combo strategy score should be ~100, got ${score}`)
})
