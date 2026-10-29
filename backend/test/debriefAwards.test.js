// Debrief per-team totals (F2) + awards (F1). Raw values drive ranking and the
// awards; the SHOWN totals (F3) are covered in format.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFinalRanking, computeAwards } from '../src/services/strategyService.js'
import { debriefTotals } from '../../frontend/src/utils/format.js'

// The two fixture teams from the prompt.
const teamB = {
  group: 'Team B', portId: 'meridia',
  strategyRaws: [0.90, 0.90, 0.95],                 // some high strategy
  damages: [2.304, 0.63, 0.56], potentials: [4, 3, 4],
}
const teamA = {
  group: 'Team A', portId: 'nord-maris',
  strategyRaws: [0.60, 0.55, 0.65],
  damages: [1.78, 1.06, 1.84], potentials: [2, 2, 4],
}

test('F2 · per-team raw totals and avoidedPctRaw', () => {
  const rows = computeFinalRanking([teamB, teamA])
  const B = rows.find(r => r.group === 'Team B')
  const A = rows.find(r => r.group === 'Team A')

  assert.ok(Math.abs(B.totalDamageRaw - 3.494) < 1e-9)
  assert.equal(B.totalPotential, 11)
  assert.ok(Math.abs(B.avoidedPctRaw - (1 - 3.494 / 11)) < 1e-9) // ≈ 0.6824

  assert.ok(Math.abs(A.totalDamageRaw - 4.68) < 1e-9)
  assert.equal(A.totalPotential, 8)
  assert.ok(Math.abs(A.avoidedPctRaw - (1 - 4.68 / 8)) < 1e-9)   // 0.415
})

test('F3 · shown money adds up; % from raw (Team B €3.5 / €11.0 / €7.5 / 68%)', () => {
  const B = debriefTotals(teamB.damages.map((d, i) => ({ damageBill: d, impact: teamB.potentials[i] })))
  assert.equal(B.totalDamageShown, 3.5)
  assert.equal(B.totalPotential, 11)
  assert.equal(B.avoidedShown, 7.5)
  assert.equal(B.avoidedPct, 68) // round(0.68236 × 100)
  assert.equal(B.totalDamageShown + B.avoidedShown, B.totalPotential)
})

test('F3 · shown money adds up; % from raw (Team A €4.7 / €8.0 / €3.3 / 42%)', () => {
  const A = debriefTotals(teamA.damages.map((d, i) => ({ damageBill: d, impact: teamA.potentials[i] })))
  assert.equal(A.totalDamageShown, 4.7)
  assert.equal(A.totalPotential, 8)
  assert.equal(A.avoidedShown, 3.3)
  assert.equal(A.avoidedPct, 42) // from raw: 1 − 4.68/8 = 0.415 → 42% (not shown 3.3/8 = 41%)
  assert.equal(A.totalDamageShown + A.avoidedShown, A.totalPotential)
})

test('F1 · Most losses avoided goes to the higher avoidedPctRaw (Team B)', () => {
  const rows = computeFinalRanking([teamA, teamB])
  const { mostAvoided } = computeAwards(rows)
  assert.deepEqual(mostAvoided.map(r => r.group), ['Team B'])
})

test('F1 · Best overall strategy goes to the higher finalScore', () => {
  const rows = computeFinalRanking([teamA, teamB])
  const { bestStrategy } = computeAwards(rows)
  assert.deepEqual(bestStrategy.map(r => r.group), ['Team B']) // teamB raws are higher
})

test('F1/F4 · equal raw values share the award and the rank', () => {
  const t1 = { group: 'T1', strategyRaws: [0.8, 0.8, 0.8], damages: [1, 1, 1], potentials: [3, 3, 3] }
  const t2 = { group: 'T2', strategyRaws: [0.8, 0.8, 0.8], damages: [1, 1, 1], potentials: [3, 3, 3] }
  const rows = computeFinalRanking([t1, t2])
  assert.equal(rows[0].rank, rows[1].rank) // shared rank (equal finalScore)
  const { bestStrategy, mostAvoided } = computeAwards(rows)
  assert.deepEqual(bestStrategy.map(r => r.group).sort(), ['T1', 'T2'])
  assert.deepEqual(mostAvoided.map(r => r.group).sort(), ['T1', 'T2'])
})
