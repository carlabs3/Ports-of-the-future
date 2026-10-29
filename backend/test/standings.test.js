// Standings (G5): computeStandings over the rounds played so far, with movement
// after round 2. Shown money checked through debriefTotals (as in format.test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStandings } from '../src/services/strategyService.js'
import { debriefTotals } from '../../frontend/src/utils/format.js'

// Team A / Team B round-1 fixtures from the debrief prompt (strategy B 9.0, A 8.3;
// avoided B 42%/€1.7 of €4.0; A 11%/€0.2 of €2.0).
const r = (round, strategyScoreRaw, damageBill, impact) => ({ round, strategyScoreRaw, damageBill, impact })
const teamB = { group: 'Team B', portId: 'meridia', rounds: [r(1, 0.90, 2.304, 4), r(2, 0.70, 1.2, 3)] }
const teamA = { group: 'Team A', portId: 'nord-maris', rounds: [r(1, 0.83, 1.78, 2), r(2, 0.95, 0.4, 2)] }

test('standings after round 1: strategy and avoided values', () => {
  const st = computeStandings([teamA, teamB], 1)
  const byGroup = Object.fromEntries(st.teams.map(t => [t.group, t]))
  // strategy (/10 = finalScore/10)
  assert.equal(byGroup['Team B'].finalScore / 10, 9.0)
  assert.equal(byGroup['Team A'].finalScore / 10, 8.3)
  // avoided %
  assert.equal(byGroup['Team B'].avoidedPct, 42)
  assert.equal(byGroup['Team A'].avoidedPct, 11)
  // shown € via the shared F3 helper (round-1 only)
  const B = debriefTotals(teamB.rounds.slice(0, 1))
  assert.equal(B.avoidedShown, 1.7); assert.equal(B.totalPotential, 4)
  const A = debriefTotals(teamA.rounds.slice(0, 1))
  assert.equal(A.avoidedShown, 0.2); assert.equal(A.totalPotential, 2)
  assert.equal(byGroup['Team B'].avoidedShown, 1.7)
  assert.equal(byGroup['Team A'].avoidedShown, 0.2)
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
  const t1 = { group: 'T1', portId: 'meridia', rounds: [r(1, 0.8, 1, 3)] }
  const t2 = { group: 'T2', portId: 'nord-maris', rounds: [r(1, 0.8, 1, 3)] }
  const st = computeStandings([t1, t2], 1)
  const [a, b] = st.teams
  assert.equal(a.strategyRank, b.strategyRank)
  assert.equal(a.avoidedRank, b.avoidedRank)
})
