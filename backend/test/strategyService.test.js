// v5 migration: this v4 suite is skipped in Commit 1 and rewritten in Commit 2/3
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PORTS_BY_ID } from '../src/config/ports/index.js'
import { computeExpectedLossesAvoided } from '../src/services/preparednessService.js'
import {
  precomputeBestPossible, bestPossibleExpectedProtection,
  computeStrategyScore, computeFinalRanking,
} from '../src/services/strategyService.js'

precomputeBestPossible()

// Appendix E — best possible expected protection, budgets 6/8/10 by level.
const APPENDIX_E = {
  'nord-maris': [[46, 56, 64], [51, 60, 68], [55, 64, 74], [59, 68, 76]],
  'meridia':    [[51, 60, 68], [56, 65, 72], [60, 68, 75], [64, 72, 78]],
  'riu-verd':   [[49, 62, 70], [55, 67, 76], [60, 73, 79], [65, 76, 81]],
  'boreal':     [[53, 62, 71], [58, 67, 76], [62, 71, 80], [67, 76, 82]],
  'coralia':    [[49, 59, 68], [54, 64, 73], [59, 68, 76], [63, 73, 79]],
  'sabkha':     [[49, 59, 68], [54, 64, 72], [59, 68, 75], [64, 72, 78]],
}
const BANDS = ['reactive', 'aware', 'developing', 'proactive']
const BUDGETS = [6, 8, 10]

test.skip('all 72 best-possible values match Appendix E within ±1', () => {
  for (const [port, rows] of Object.entries(APPENDIX_E)) {
    BANDS.forEach((band, bi) => BUDGETS.forEach((budget, ci) => {
      const got = bestPossibleExpectedProtection(port, band, budget)
      assert.ok(Math.abs(got - rows[bi][ci]) <= 1, `${port} ${band} ${budget}: got ${got}, expected ~${rows[bi][ci]}`)
    }))
  }
})

test.skip('Nord-Maris Aware at 10 coins is exactly 68.5', () => {
  assert.equal(bestPossibleExpectedProtection('nord-maris', 'aware', 10), 68.5)
})

test.skip('Boreal worked example — Winterisation + mooring + governance, Aware', () => {
  const weights = PORTS_BY_ID['boreal'].exposureWeights
  const expected = computeExpectedLossesAvoided({ measures: [24, 13, 19], cultureBand: 'aware', exposureWeights: weights })
  assert.equal(Math.round(expected), 51)                                   // 51%
  assert.equal(bestPossibleExpectedProtection('boreal', 'aware', 6), 57.85) // displays 58
  assert.equal(computeStrategyScore({ expectedProtection: expected, portId: 'boreal', startingBand: 'aware', budget: 6 }), 88)
})

test.skip('Nord-Maris worked example — coastal defence + governance, Aware', () => {
  const weights = PORTS_BY_ID['nord-maris'].exposureWeights
  const expected = computeExpectedLossesAvoided({ measures: [1, 19], cultureBand: 'aware', exposureWeights: weights })
  assert.equal(Math.round(expected), 41)                                   // 41%
  assert.equal(computeStrategyScore({ expectedProtection: expected, portId: 'nord-maris', startingBand: 'aware', budget: 6 }), 80)
  // Emergency plan + insurance + structural health monitoring at Aware → 51%.
  const alt = computeExpectedLossesAvoided({ measures: [10, 23, 6], cultureBand: 'aware', exposureWeights: weights })
  assert.equal(Math.round(alt), 51)
})

test.skip('computeStrategyScore uses the displayed integers (D16)', () => {
  // 51 / 58 → 88 (not 89 from the raw 51.4 / 57.85).
  assert.equal(computeStrategyScore({ expectedProtection: 51.4, portId: 'boreal', startingBand: 'aware', budget: 6 }), 88)
})

test.skip('computeFinalRanking averages the 3 scores, ranks desc, ties share a rank', () => {
  const ranked = computeFinalRanking([
    { group: 'Team A', strategyScores: [80, 90, 100], damages: [1, 0, 2] },   // avg 90
    { group: 'Team B', strategyScores: [90, 90, 90], damages: [4, 4, 4] },    // avg 90 (tie)
    { group: 'Team C', strategyScores: [50, 60, 70], damages: [0, 0, 0] },    // avg 60
  ])
  assert.deepEqual(ranked.map(r => r.group), ['Team A', 'Team B', 'Team C'])
  assert.equal(ranked[0].rank, 1)
  assert.equal(ranked[1].rank, 1) // tie shares rank 1
  assert.equal(ranked[2].rank, 3) // next rank skips to 3
  assert.equal(ranked[0].totalDamage, 3)  // luck = total damage
  assert.equal(ranked[1].totalDamage, 12)
})
