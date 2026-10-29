// Standings (G5): computeStandings over the rounds played so far, with movement
// after round 2. Money is € millions, whole numbers (J5); the backend aggregates
// are checked directly here (the frontend debriefTotals is covered in format.test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStandings } from '../src/services/strategyService.js'

// Team A / Team B fixtures in € millions (J1/J3). Strategy B 9.0, A 8.3; after
// round 1 avoided B 42% (€170M of €400M), A 11% (€22M of €200M).
const r = (round, strategyScoreRaw, damageBill, potentialLossM) => ({ round, strategyScoreRaw, damageBill, potentialLossM })
const teamB = { group: 'Team B', portId: 'meridia', rounds: [r(1, 0.90, 230.4, 400), r(2, 0.70, 63, 300)] }
const teamA = { group: 'Team A', portId: 'nord-maris', rounds: [r(1, 0.83, 178, 200), r(2, 0.95, 106, 200)] }

test('standings after round 1: strategy and avoided values', () => {
  const st = computeStandings([teamA, teamB], 1)
  const byGroup = Object.fromEntries(st.teams.map(t => [t.group, t]))
  // strategy (/10 = finalScore/10)
  assert.equal(byGroup['Team B'].finalScore / 10, 9.0)
  assert.equal(byGroup['Team A'].finalScore / 10, 8.3)
  // avoided %
  assert.equal(byGroup['Team B'].avoidedPct, 42)
  assert.equal(byGroup['Team A'].avoidedPct, 11)
  // shown € millions (J5: whole; avoided = potential − round(damage))
  assert.equal(byGroup['Team B'].totalPotential, 400)
  assert.equal(byGroup['Team B'].avoidedShown, 170) // 400 − 230
  assert.equal(byGroup['Team A'].totalPotential, 200)
  assert.equal(byGroup['Team A'].avoidedShown, 22)  // 200 − 178
  // ranks (B higher on both boards); no movement after round 1
  assert.equal(byGroup['Team B'].strategyRank, 1)
  assert.equal(byGroup['Team B'].avoidedRank, 1)
  assert.equal(byGroup['Team B'].strategyMove, null)
})

test('standings after round 2: movement is computed from the round-1 positions', () => {
  // After R1: strategy B(9.0) > A(8.3) → B#1, A#2.
  // After R2: A mean (0.83+0.95)/2=0.89 > B mean (0.90+0.70)/2=0.80 → A#1, B#2.
  const st = computeStandings([teamA, teamB], 2)
  const byGroup = Object.fromEntries(st.teams.map(t => [t.group, t]))
  assert.equal(byGroup['Team A'].strategyRank, 1)
  assert.equal(byGroup['Team B'].strategyRank, 2)
  assert.equal(byGroup['Team A'].strategyMove, 1)  // 2 → 1, moved up one
  assert.equal(byGroup['Team B'].strategyMove, -1) // 1 → 2, moved down one
})

test('exactly-equal values share a rank', () => {
  const t1 = { group: 'T1', portId: 'meridia', rounds: [r(1, 0.8, 100, 300)] }
  const t2 = { group: 'T2', portId: 'nord-maris', rounds: [r(1, 0.8, 100, 300)] }
  const st = computeStandings([t1, t2], 1)
  const [a, b] = st.teams
  assert.equal(a.strategyRank, b.strategyRank)
  assert.equal(a.avoidedRank, b.avoidedRank)
})
