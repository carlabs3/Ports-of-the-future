// Final ranking (E4): finalScore is the mean of the UNROUNDED per-round raw
// ratios (×100), rounded only for display; teams share a rank only when their
// unrounded means are exactly equal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFinalRanking } from '../src/services/strategyService.js'

const mean = a => a.reduce((s, v) => s + v, 0) / a.length
const roundedMean = raws => mean(raws.map(r => Math.round(r * 100))) // the OLD (wrong) way

test('raw-mean order differs from rounded-mean order', () => {
  // X: rounded scores 86,86,84 → mean 85.33; raw mean 85.13.
  // Y: rounded scores 85,85,85 → mean 85.00; raw mean 85.20.
  const X = { group: 'X', strategyRaws: [0.855, 0.855, 0.844] }
  const Y = { group: 'Y', strategyRaws: [0.852, 0.852, 0.852] }

  // The OLD mean-of-rounded method would rank X above Y…
  assert.ok(roundedMean(X.strategyRaws) > roundedMean(Y.strategyRaws), 'rounded means put X first')

  // …but the correct raw-mean ranking puts Y first.
  const ranking = computeFinalRanking([X, Y])
  assert.deepEqual(ranking.map(r => r.group), ['Y', 'X'])
  assert.equal(ranking[0].rank, 1)
  assert.equal(ranking[1].rank, 2)
  assert.notEqual(ranking[0].finalScore, ranking[1].finalScore) // not tied
})

test('teams share a rank only when their unrounded means are exactly equal', () => {
  const A = { group: 'A', strategyRaws: [0.90, 0.80, 0.70] }  // mean 0.80
  const B = { group: 'B', strategyRaws: [0.80, 0.80, 0.80] }  // mean 0.80 (exactly)
  const C = { group: 'C', strategyRaws: [0.80, 0.80, 0.7999] } // mean just below
  const ranking = computeFinalRanking([A, B, C])
  const byGroup = Object.fromEntries(ranking.map(r => [r.group, r]))
  assert.equal(byGroup.A.rank, byGroup.B.rank, 'A and B tie (exactly equal means)')
  assert.equal(byGroup.A.finalScore, byGroup.B.finalScore)
  assert.ok(byGroup.C.rank > byGroup.A.rank, 'C ranks below the exact tie')
})

test('fallback: strategyScore/100 is applied by the caller shape (no raws → 0)', () => {
  // computeFinalRanking consumes strategyRaws; a team with none scores 0.
  const ranking = computeFinalRanking([
    { group: 'P', strategyRaws: [0.5, 0.5, 0.5] },
    { group: 'Q', strategyRaws: [] },
  ])
  assert.deepEqual(ranking.map(r => r.group), ['P', 'Q'])
  assert.equal(ranking.find(r => r.group === 'Q').finalScore, 0)
})

test('totalDamage is summed from the raw damages, order by finalScore only', () => {
  const ranking = computeFinalRanking([
    { group: 'L', strategyRaws: [0.4], damages: [1.1, 2.2] },
    { group: 'M', strategyRaws: [0.9], damages: [0.5] },
  ])
  assert.deepEqual(ranking.map(r => r.group), ['M', 'L']) // M higher strategy
  assert.equal(Math.round(ranking.find(r => r.group === 'L').totalDamage * 10) / 10, 3.3)
})
