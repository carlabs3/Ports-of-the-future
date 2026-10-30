// Standings (G5): computeStandings over the rounds played so far, with movement
// after round 2. Money is € millions, whole numbers (J5); the backend aggregates
// are checked directly here (the frontend debriefTotals is covered in format.test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStandings, precomputeBestPossible } from '../src/services/strategyService.js'
import { buyCard, lockRound, recordSpin, advanceRound } from '../src/services/roundsService.js'

precomputeBestPossible()

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

// ── regression: fresh session, real spins → correct standings (not ×1000) ────
const fresh = (portId, startingBand) => ({
  portId, startingBand, portfolio: [], coins: 6, roundStartCoins: 6, currentRound: 1,
  roundLocked: false, roundBought: [], roundReturned: null, roundRefund: 0, rounds: [],
})

test('fresh session with 2 rounds spun gives correct standings (Case A round 1)', () => {
  const s = fresh('nord-maris', 'developing')
  for (const id of [2, 19, 23]) assert.equal(buyCard(s, id).ok, true) // 6 coins
  assert.equal(lockRound(s).ok, true)
  assert.equal(recordSpin(s, 'SI').ok, true) // Case A: potential 300, damage 267

  // Every entry carries the explicit €M marker + a stored potential loss.
  assert.equal(s.rounds[0].moneyUnit, 'eurM')
  assert.equal(s.rounds[0].potentialLossM, 300)

  const after1 = computeStandings([{ group: 'A', portId: 'nord-maris', rounds: s.rounds }], 1).teams[0]
  assert.equal(after1.missingPotential, false)
  assert.equal(after1.totalPotential, 300)
  assert.equal(after1.totalDamageShown, 267) // NOT 267000
  assert.equal(after1.avoidedShown, 33)
  assert.equal(after1.avoidedPct, 11)

  // Round 2: carry on, draw storm surge (potential 600).
  assert.equal(advanceRound(s).ok, true)
  assert.equal(lockRound(s).ok, true)
  assert.equal(recordSpin(s, 'SS').ok, true)
  const d2 = Math.round(s.rounds[1].damageBill)

  const after2 = computeStandings([{ group: 'A', portId: 'nord-maris', rounds: s.rounds }], 2).teams[0]
  assert.equal(after2.missingPotential, false)
  assert.equal(after2.totalPotential, 900)            // 300 + 600, not ×1000
  assert.equal(after2.totalDamageShown, 267 + d2)
  assert.equal(after2.avoidedShown, 900 - (267 + d2))
  assert.ok(after2.avoidedShown >= 0)
})

test('a legacy coin entry still converts (impact → ×1000)', () => {
  const legacy = { group: 'L', portId: 'boreal', rounds: [{ round: 1, strategyScoreRaw: 0.5, impact: 4, damageBill: 2 }] }
  const t = computeStandings([legacy], 1).teams[0]
  assert.equal(t.totalPotential, 4000)     // 4 coins × €1000M
  assert.equal(t.totalDamageShown, 2000)   // 2 coins × €1000M
  assert.equal(t.avoidedShown, 2000)
  assert.equal(t.missingPotential, false)
})

test('a round with no readable potential → missingPotential true, avoided 0', () => {
  const broken = { group: 'X', portId: 'meridia', rounds: [{ round: 1, strategyScoreRaw: 0.5, moneyUnit: 'eurM', damageBill: 100 }] }
  const t = computeStandings([broken], 1).teams[0]
  assert.equal(t.totalPotential, 0)
  assert.equal(t.missingPotential, true)   // UI shows "—"
  assert.equal(t.avoidedShown, 0)          // never negative
})
