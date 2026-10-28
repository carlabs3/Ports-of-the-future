// v5 migration: this v4 suite is skipped in Commit 1 and rewritten in Commit 2/3
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { precomputeBestPossible } from '../src/services/strategyService.js'
import { buyCard, returnCard, undoCard, lockRound, unlockRound, recordSpin, advanceRound } from '../src/services/roundsService.js'

precomputeBestPossible()

function fresh(portId = 'boreal', startingBand = 'aware') {
  return { portId, startingBand, portfolio: [], coins: 6, roundStartCoins: 6, currentRound: 1, roundLocked: false, roundBought: [], roundReturned: null, rounds: [] }
}

test.skip('full 3-round playthrough for Boreal, including a return — every number', () => {
  const s = fresh()

  // ── Round 1: buy 24 (2) + 13 (3) + 19 (1) = 6 coins, spin SI ──────────────
  for (const id of [24, 13, 19]) assert.equal(buyCard(s, id).ok, true)
  assert.equal(s.coins, 0)
  assert.deepEqual(s.portfolio, [24, 13, 19])
  assert.equal(lockRound(s).ok, true)
  const r1 = recordSpin(s, 'SI').entry
  assert.deepEqual([r1.coinsStart, r1.coinsSpent, r1.refund, r1.coinsLeft], [6, 6, 0, 0])
  assert.equal(r1.lossesAvoidedPct, 76)     // P = 7.6
  assert.equal(r1.damageBill, 0.5)          // 3 × 0.24 = 0.72 → 0.5
  assert.equal(r1.expectedProtection, 51.4) // displays 51
  assert.equal(r1.strategyScore, 88)        // 51 / best 58
  assert.equal(r1.coinsThatHelped, 5)       // #24 (2) + #13 (3); #19 none
  assert.equal(r1.heldCost, 6)              // 24(2) + 13(3) + 19(1)
  assert.equal(r1.lossValue, 3)             // SI loss value
  assert.equal(r1.cultureLevel, 'developing') // Aware + 1 enabler
  assert.equal(advanceRound(s).ok, true)
  assert.equal(s.coins, 2)                  // 0 + 2

  // ── Round 2: return 13 (refund 1), buy 17 (2), spin WS ────────────────────
  assert.equal(returnCard(s, 13).refund, 1) // floor(3/2)
  assert.equal(s.coins, 3)
  assert.deepEqual(s.portfolio, [24, 19])
  assert.equal(buyCard(s, 17).ok, true)
  assert.equal(s.coins, 1)
  assert.equal(lockRound(s).ok, true)
  const r2 = recordSpin(s, 'WS').entry
  assert.deepEqual([r2.coinsStart, r2.coinsSpent, r2.refund, r2.coinsLeft], [2, 2, 1, 1])
  assert.deepEqual(r2.bought, [17])
  assert.equal(r2.returned, 13)
  assert.equal(r2.lossesAvoidedPct, 30)     // P = 3.0 (#17 WS 3)
  assert.equal(r2.damageBill, 3)            // 4 × 0.7 = 2.8 → 3.0
  assert.equal(r2.expectedProtection, 46.4)
  assert.equal(r2.strategyScore, 69)        // 46 / best 67
  assert.equal(r2.coinsThatHelped, 2)       // #17 only
  assert.equal(r2.heldCost, 5)              // 24(2) + 19(1) + 17(2)
  assert.equal(advanceRound(s).ok, true)
  assert.equal(s.coins, 3)                  // 1 + 2

  // ── Round 3: buy 6 (3), spin SS ───────────────────────────────────────────
  assert.equal(buyCard(s, 6).ok, true)
  assert.equal(s.coins, 0)
  assert.equal(lockRound(s).ok, true)
  const r3 = recordSpin(s, 'SS').entry
  assert.deepEqual([r3.coinsStart, r3.coinsSpent, r3.refund, r3.coinsLeft], [3, 3, 0, 0])
  assert.equal(r3.lossesAvoidedPct, 44)     // P = 4.4 (#17 SS2 + #6 SS3)
  assert.equal(r3.damageBill, 2)            // 4 × 0.56 = 2.24 → 2.0
  assert.equal(r3.expectedProtection, 62.48)
  assert.equal(r3.strategyScore, 82)        // 62 / best 76
  assert.equal(r3.coinsThatHelped, 5)       // #17 (2) + #6 (3)
  assert.equal(r3.heldCost, 8)              // 24(2) + 19(1) + 17(2) + 6(3)

  assert.deepEqual(s.portfolio, [24, 19, 17, 6])
  assert.equal(s.rounds.length, 3)
  assert.equal(advanceRound(s).ok, false)   // no round 4
})

test.skip('purchase is rejected for over-budget, not-in-deck, duplicate', () => {
  const s = fresh('boreal', 'aware') // boreal deck has no #2; coins 6
  assert.equal(buyCard(s, 1).ok, true)                   // #1 (cost 5), in boreal deck
  assert.equal(s.coins, 1)
  assert.equal(buyCard(s, 1).ok, false)                  // duplicate
  assert.match(buyCard(s, 1).error, /already holds/)
  assert.equal(buyCard(s, 2).ok, false)                  // #2 not in boreal deck
  assert.match(buyCard(s, 2).error, /not in this port/)
  assert.equal(buyCard(s, 12).ok, false)                 // #12 cost 4 > 1 left
  assert.match(buyCard(s, 12).error, /Not enough coins/)
})

test.skip('returns: none in round 1, at most one per round', () => {
  const s = fresh()
  buyCard(s, 24)
  assert.equal(returnCard(s, 24).ok, false)              // round 1: no returns
  assert.match(returnCard(s, 24).error, /rounds 2 and 3/)
  lockRound(s); recordSpin(s, 'SI'); advanceRound(s)     // → round 2
  assert.equal(returnCard(s, 24).ok, true)
  assert.equal(returnCard(s, 19).ok, false)              // second return blocked
  assert.match(returnCard(s, 19).error, /one card/)
})

test.skip('locking needs a starting level; cannot unlock after the spin', () => {
  const s = fresh('boreal', null)                        // no starting level
  assert.equal(lockRound(s).ok, false)
  assert.match(lockRound(s).error, /starting culture level/)
  s.startingBand = 'aware'
  assert.equal(lockRound(s).ok, true)
  assert.equal(unlockRound(s).ok, true)                  // before spin: fine
  lockRound(s); recordSpin(s, 'SI')
  assert.equal(unlockRound(s).ok, false)                 // after spin: 409-equivalent
  assert.match(unlockRound(s).error, /already been spun/)
})

test.skip('undo in round 1: full refund, card removed, return allowance untouched', () => {
  const s = fresh() // coins 6
  assert.equal(buyCard(s, 24).ok, true) // cost 2 -> coins 4
  assert.equal(buyCard(s, 13).ok, true) // cost 3 -> coins 1
  const r = undoCard(s, 24)
  assert.equal(r.ok, true)
  assert.equal(r.refund, 2)             // FULL cost, not floor(2/2)
  assert.equal(s.coins, 3)              // 1 + 2
  assert.deepEqual(s.portfolio, [13])
  assert.deepEqual(s.roundBought, [13])
  assert.equal(s.roundReturned, null)   // undo never touches the return allowance
})

test.skip('undo a same-round card in round 2: full refund, one-return-per-round still available', () => {
  const s = fresh()
  assert.equal(buyCard(s, 24).ok, true) // coins 4
  lockRound(s); recordSpin(s, 'SI'); advanceRound(s) // round 2, coins 6, portfolio [24]
  assert.equal(buyCard(s, 17).ok, true) // cost 2 -> coins 4, roundBought [17]
  const r = undoCard(s, 17)
  assert.equal(r.ok, true)
  assert.equal(r.refund, 2)             // FULL refund (returnCard would be floor(2/2)=1)
  assert.equal(s.coins, 6)
  assert.deepEqual(s.portfolio, [24])
  assert.deepEqual(s.roundBought, [])
  assert.equal(s.roundReturned, null)   // untouched by the undo
  // The one real return is still available this round (undo did not consume it):
  const rr = returnCard(s, 24)          // 24 is a previous-round card -> half refund
  assert.equal(rr.ok, true)
  assert.equal(rr.refund, 1)
  assert.equal(s.roundReturned, 24)
})

test.skip('undo is rejected once the round is locked', () => {
  const s = fresh()
  buyCard(s, 24)
  lockRound(s)
  const r = undoCard(s, 24)
  assert.equal(r.ok, false)
  assert.match(r.error, /locked/)
})

test.skip('undo is rejected for a card bought in a previous round', () => {
  const s = fresh()
  buyCard(s, 24)
  lockRound(s); recordSpin(s, 'SI'); advanceRound(s) // round 2; 24 was bought in round 1
  const r = undoCard(s, 24)
  assert.equal(r.ok, false)
  assert.match(r.error, /not bought this round/)
})

test.skip('cannot advance before the current round is spun', () => {
  const s = fresh()
  buyCard(s, 24); lockRound(s)
  assert.equal(advanceRound(s).ok, false)
  assert.match(advanceRound(s).error, /not been spun/)
})
