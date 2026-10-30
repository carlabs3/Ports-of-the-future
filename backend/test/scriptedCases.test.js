// Two scripted 3-round cases for the 3 / 6 / 9 budget with card returns (G1).
// Commit 1 asserts only the budget / return / culture mechanics — all
// benchmark-independent. The result-display numbers (damage, protection,
// strategy score) return once the Commit-2 benchmarks are approved.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buyCard, returnCard, lockRound, recordSpin, advanceRound } from '../src/services/roundsService.js'
import { applyCultureMeasureBonus } from '../src/services/cultureService.js'

const fresh = (portId, startingBand) => ({
  portId, startingBand, portfolio: [], coins: 3, roundStartCoins: 3, currentRound: 1,
  roundLocked: false, roundBought: [], roundReturned: null, roundRefund: 0, rounds: [],
})
const buy = (s, ...ids) => { for (const id of ids) assert.equal(buyCard(s, id).ok, true, `buy #${id}`) }

// Case A · Nord-Maris, starting Developing. R1 a 3-coin plan with an enabler;
// R2 returns several cards (incl. the enabler) then re-buys; R3 one return + buy.
test('Case A · Nord-Maris: 3/6/9 budget with a round-2 multi-card return', () => {
  const s = fresh('nord-maris', 'developing')

  // R1 (budget 3): #19 (1, enabler) + #8 (2) = 3.
  buy(s, 19, 8)
  assert.equal(s.coins, 0)
  assert.equal(applyCultureMeasureBonus('developing', s.portfolio), 'proactive') // +1 enabler
  assert.equal(lockRound(s).ok, true)
  assert.equal(recordSpin(s, 'SI').entry.potentialLossM, 300)
  assert.equal(advanceRound(s).ok, true)
  assert.equal(s.coins, 3) // +3

  // R2 (budget 6): return #19 (enabler) and #8, then buy #2 + #23.
  assert.equal(returnCard(s, 19).refund, 1)
  assert.equal(returnCard(s, 8).refund, 2)
  assert.equal(s.coins, 6)
  assert.deepEqual(s.portfolio, [])
  assert.equal(applyCultureMeasureBonus('developing', s.portfolio), 'developing') // enabler gone
  buy(s, 2, 23) // 4 + 1
  assert.equal(s.coins, 1)
  assert.equal(s.roundRefund, 3)
  assert.equal(lockRound(s).ok, true)
  assert.equal(recordSpin(s, 'WS').entry.potentialLossM, 500)
  assert.equal(advanceRound(s).ok, true)
  assert.equal(s.coins, 4) // 1 + 3

  // R3 (budget 9): return #23, buy #6.
  assert.equal(returnCard(s, 23).refund, 1)
  assert.equal(s.coins, 5)
  buy(s, 6) // 2
  assert.equal(s.coins, 3)
  assert.deepEqual(s.portfolio, [2, 6])
  assert.equal(lockRound(s).ok, true)
  assert.equal(recordSpin(s, 'SS').entry.potentialLossM, 600)
  assert.equal(advanceRound(s).ok, false) // no round 4
})

// Case B · Meridia, starting Aware. Same shape, different port/deck.
test('Case B · Meridia: 3/6/9 budget with a round-2 enabler return', () => {
  const s = fresh('meridia', 'aware')

  // R1 (budget 3): #19 (1, enabler) + #11 (1) + #23 (1) = 3.
  buy(s, 19, 11, 23)
  assert.equal(s.coins, 0)
  assert.equal(applyCultureMeasureBonus('aware', s.portfolio), 'developing') // +1 enabler
  assert.equal(lockRound(s).ok, true)
  assert.equal(recordSpin(s, 'WF').entry.potentialLossM, 300)
  assert.equal(advanceRound(s).ok, true)
  assert.equal(s.coins, 3)

  // R2 (budget 6): return #19 (enabler) and #11, then buy #8 + #10.
  assert.equal(returnCard(s, 19).refund, 1)
  assert.equal(returnCard(s, 11).refund, 1)
  assert.equal(s.coins, 5)
  assert.deepEqual(s.portfolio, [23])
  assert.equal(applyCultureMeasureBonus('aware', s.portfolio), 'aware') // enabler gone
  buy(s, 8, 10) // 2 + 2
  assert.equal(s.coins, 1)
  assert.equal(lockRound(s).ok, true)
  assert.equal(recordSpin(s, 'HW').entry.potentialLossM, 200)
  assert.equal(advanceRound(s).ok, true)
  assert.equal(s.coins, 4)

  // R3 (budget 9): return #10, buy #4 + #26.
  assert.equal(returnCard(s, 10).refund, 2)
  assert.equal(s.coins, 6)
  buy(s, 4, 26) // 2 + 1
  assert.equal(s.coins, 3)
  assert.deepEqual(s.portfolio, [23, 8, 4, 26])
  assert.equal(lockRound(s).ok, true)
  assert.equal(recordSpin(s, 'DR').entry.potentialLossM, 300)
  assert.equal(advanceRound(s).ok, false)
})
