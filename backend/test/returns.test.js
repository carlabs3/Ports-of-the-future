// Card returns (G1): round 1 nothing to return; rounds 2 and 3 allow any number
// at full cost, only before the spin. Pure-state tests on roundsService.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buyCard, returnCard, lockRound, recordSpin } from '../src/services/roundsService.js'
import { applyCultureMeasureBonus } from '../src/services/cultureService.js'

// A state parked at a given round with a held portfolio (no prior round entries
// needed — the return logic only reads currentRound / portfolio / spin state).
function at(round, { portId = 'boreal', startingBand = 'aware', portfolio = [], coins = 0 } = {}) {
  return { portId, startingBand, portfolio: [...portfolio], coins, roundStartCoins: coins, currentRound: round, roundLocked: false, roundBought: [], roundReturned: null, roundRefund: 0, rounds: [] }
}

test('round 1: returns are rejected (nothing to return)', () => {
  const s = at(1, { portfolio: [24] })
  const r = returnCard(s, 24)
  assert.equal(r.ok, false)
  assert.match(r.error, /Cards cannot be returned in round 1\./)
})

test('round 2: returning several cards refunds each full cost; balance is correct', () => {
  const s = at(2, { portfolio: [24, 13, 14], coins: 0 }) // costs 3, 3, 3
  assert.equal(returnCard(s, 24).refund, 3)
  assert.equal(s.coins, 3)
  assert.equal(returnCard(s, 13).refund, 3)
  assert.equal(s.coins, 6)
  assert.equal(returnCard(s, 14).refund, 3)
  assert.equal(s.coins, 9)            // 0 + 3 + 3 + 3, all full cost
  assert.deepEqual(s.portfolio, [])
  assert.equal(s.roundRefund, 9)      // total refund tracked for the round
})

test('round 2: returning an enabler (#19) lowers the effective culture level', () => {
  const s = at(2, { portfolio: [19, 23], startingBand: 'aware' })
  assert.equal(applyCultureMeasureBonus('aware', s.portfolio), 'developing') // #19 raises it
  assert.equal(returnCard(s, 19).ok, true)
  assert.equal(applyCultureMeasureBonus('aware', s.portfolio), 'aware')      // back down
})

test('round 3: returning several cards refunds each full cost', () => {
  const s = at(3, { portfolio: [24, 13, 14], coins: 0 })
  assert.equal(returnCard(s, 24).refund, 3)
  assert.equal(returnCard(s, 13).refund, 3)
  assert.equal(s.coins, 6)
  assert.deepEqual(s.portfolio, [14])
})

test('rounds 2 & 3: returning a card not held is rejected', () => {
  const s = at(2, { portfolio: [24] })
  const r = returnCard(s, 13)
  assert.equal(r.ok, false)
  assert.match(r.error, /does not hold measure 13/)
})

test('a return after the round has been spun is rejected (409 once drawn)', () => {
  const s = at(2, { portfolio: [24, 13] })
  assert.equal(lockRound(s).ok, true)
  recordSpin(s, 'SS')
  const r = returnCard(s, 24)
  assert.equal(r.ok, false)
  assert.match(r.error, /already been spun/)
})

test('a return while the round is locked is rejected', () => {
  const s = at(2, { portfolio: [24] })
  assert.equal(lockRound(s).ok, true)
  const r = returnCard(s, 24)
  assert.equal(r.ok, false)
  assert.match(r.error, /locked/)
})
