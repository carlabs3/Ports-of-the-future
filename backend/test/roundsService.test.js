// Rounds state machine (workshop v5). The structural numbers (coins, grants,
// refunds, portfolio, lock/undo rules) are asserted as literals — they are the
// point of this service. The per-spin scoring fields are verified against an
// INDEPENDENT recomputation (round wheel + impactsForRound + effective band),
// which catches a wrong-round / wrong-band wiring bug in recordSpin without
// hardcoding numbers that aren't in an appendix. The scoring maths themselves
// are pinned to the appendix in scoringV5.test.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PORTS_BY_ID } from '../src/config/ports/index.js'
import { roundGrants } from '../src/config/game.js'
import { precomputeBestPossible, computeStrategyScore } from '../src/services/strategyService.js'
import { applyCultureMeasureBonus } from '../src/services/cultureService.js'
import { computePreparedness, expectedProtection, impactsForRound } from '../src/services/preparednessService.js'
import { buyCard, returnCard, undoCard, lockRound, unlockRound, recordSpin, advanceRound } from '../src/services/roundsService.js'

precomputeBestPossible()

function fresh(portId = 'boreal', startingBand = 'aware') {
  return { portId, startingBand, portfolio: [], coins: 6, roundStartCoins: 6, currentRound: 1, roundLocked: false, roundBought: [], roundReturned: null, roundRefund: 0, rounds: [] }
}

// Independently recompute what a spin's scoring fields SHOULD be, from the round
// wheel, the round's impacts, and the effective culture band — then assert the
// recorded entry matches. If recordSpin used the wrong round's wheel, used base
// impacts in round 3, or skipped the enabler bonus, these diverge.
function assertSpinScoring(entry, { portId, startingBand, portfolio, round, event }) {
  const port = PORTS_BY_ID[portId]
  const effBand = applyCultureMeasureBonus(startingBand, portfolio)
  const prep = computePreparedness({ measureIds: portfolio, eventCode: event, cultureBand: effBand })
  const impacts = impactsForRound(port, round)
  const impact = impacts[event] ?? 0
  const expDamage = impact * (1 - prep.rawPreparedness / 10)
  const exp = expectedProtection({ measures: portfolio, effectiveBand: effBand, likelihoods: port.wheels[round].likelihoods, impacts })

  assert.equal(entry.cultureLevel, effBand, 'effective band')
  assert.equal(entry.impact, impact, 'drawn-event impact for this port/round')
  assert.equal(entry.rawLossesAvoidedPct, prep.rawLossesAvoidedPct, 'losses avoided')
  assert.ok(Math.abs(entry.damageBill - expDamage) < 1e-9, `damage full precision (${entry.damageBill} vs ${expDamage})`)
  assert.ok(Math.abs(entry.expectedProtection - exp) < 1e-9, 'expected protection uses this round\'s wheel')
  assert.equal(entry.strategyScore, computeStrategyScore({ expectedProtection: exp, portId, round, startingBand }), 'strategy score')
  assert.ok(entry.lossValue == null, 'v5 spins do not write lossValue')
}

test('full 3-round playthrough for Boreal: coins, grants, returns, and per-round scoring', () => {
  const s = fresh()

  // ── Round 1 (budget 6): buy 24 (3) + 17 (2) + 19 (1) = 6, spin SI ─────────
  for (const id of [24, 17, 19]) assert.equal(buyCard(s, id).ok, true)
  assert.equal(s.coins, 0)
  assert.deepEqual(s.portfolio, [24, 17, 19])
  assert.equal(lockRound(s).ok, true)
  const r1 = recordSpin(s, 'SI').entry
  assert.deepEqual([r1.coinsStart, r1.coinsSpent, r1.refund, r1.coinsLeft], [6, 6, 0, 0])
  assert.equal(r1.heldCost, 6)              // 24(3) + 17(2) + 19(1)
  assert.equal(r1.cultureLevel, 'developing') // Aware + 1 enabler (#19)
  assert.equal(r1.impact, 5)                // Boreal SI impact = 5
  assertSpinScoring(r1, { portId: 'boreal', startingBand: 'aware', portfolio: [24, 17, 19], round: 1, event: 'SI' })
  assert.equal(advanceRound(s).ok, true)
  assert.equal(s.coins, roundGrants[1])     // 0 + 3

  // ── Round 2 (grant +3): NO returns allowed; buy 6 (2), spin WS ────────────
  assert.equal(returnCard(s, 24).ok, false) // round 2: returns rejected (G1)
  assert.match(returnCard(s, 24).error, /Returns are not allowed in round 2\./)
  assert.equal(buyCard(s, 6).ok, true)
  assert.equal(s.coins, 1)                   // 3 − 2
  assert.equal(lockRound(s).ok, true)
  const r2 = recordSpin(s, 'WS').entry
  assert.deepEqual([r2.coinsStart, r2.coinsSpent, r2.refund, r2.coinsLeft], [3, 2, 0, 1])
  assert.deepEqual(r2.bought, [6])
  assert.equal(r2.heldCost, 8)              // 24(3) + 17(2) + 19(1) + 6(2)
  assert.equal(r2.impact, 3)                // Boreal WS impact = 3
  assertSpinScoring(r2, { portId: 'boreal', startingBand: 'aware', portfolio: [24, 17, 19, 6], round: 2, event: 'WS' })
  assert.equal(advanceRound(s).ok, true)
  assert.equal(s.coins, 1 + roundGrants[2]) // 1 + 3

  // ── Round 3 (grant +3): return 24 for its FULL cost, buy 14, spin SS ──────
  assert.equal(returnCard(s, 24).refund, 3)  // full cost (not floor/2)
  assert.equal(s.coins, 7)                   // 4 + 3
  assert.deepEqual(s.portfolio, [17, 19, 6])
  assert.equal(buyCard(s, 14).ok, true)
  assert.equal(s.coins, 4)                   // 7 − 3
  assert.equal(lockRound(s).ok, true)
  const r3 = recordSpin(s, 'SS').entry
  assert.deepEqual([r3.coinsStart, r3.coinsSpent, r3.refund, r3.coinsLeft], [4, 3, 3, 4])
  assert.equal(r3.heldCost, 8)              // 17(2) + 19(1) + 6(2) + 14(3)
  assert.equal(r3.impact, 4)                // Boreal SS base 3, +1 in round 3 (impactRound3Plus)
  assertSpinScoring(r3, { portId: 'boreal', startingBand: 'aware', portfolio: [17, 19, 6, 14], round: 3, event: 'SS' })

  assert.deepEqual(s.portfolio, [17, 19, 6, 14])
  assert.equal(s.rounds.length, 3)
  assert.equal(advanceRound(s).ok, false)   // no round 4
})

test('purchase is rejected for over-budget, not-in-deck, duplicate', () => {
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

test('returns: rejected in rounds 1 and 2 (G1)', () => {
  const s = fresh()
  buyCard(s, 24)
  assert.equal(returnCard(s, 24).ok, false)              // round 1: nothing to return
  assert.match(returnCard(s, 24).error, /Cards cannot be returned in round 1\./)
  lockRound(s); recordSpin(s, 'SI'); advanceRound(s)     // → round 2
  assert.equal(returnCard(s, 24).ok, false)              // round 2: none
  assert.match(returnCard(s, 24).error, /Returns are not allowed in round 2\./)
})

test('advanceRound grants the configured coins for the new round', () => {
  const s = fresh()
  buyCard(s, 24); lockRound(s); recordSpin(s, 'SI')
  const before2 = s.coins
  advanceRound(s)                                        // → round 2
  assert.equal(s.currentRound, 2)
  assert.equal(s.coins, before2 + roundGrants[1])        // +3
  lockRound(s); recordSpin(s, 'SI')
  const before3 = s.coins
  advanceRound(s)                                        // → round 3
  assert.equal(s.currentRound, 3)
  assert.equal(s.coins, before3 + roundGrants[2])        // +3
})

test('locking needs a starting level; cannot unlock after the spin', () => {
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

test('undo in round 1: full refund, card removed, return allowance untouched', () => {
  const s = fresh() // coins 6
  assert.equal(buyCard(s, 24).ok, true) // cost 3 -> coins 3
  assert.equal(buyCard(s, 13).ok, true) // cost 3 -> coins 0
  const r = undoCard(s, 24)
  assert.equal(r.ok, true)
  assert.equal(r.refund, 3)             // FULL cost, not floor(3/2)
  assert.equal(s.coins, 3)              // 0 + 3
  assert.deepEqual(s.portfolio, [13])
  assert.deepEqual(s.roundBought, [13])
  assert.equal(s.roundReturned, null)   // undo never touches the return allowance
})

test('undo a same-round card in round 2: full refund; returns are not allowed in round 2', () => {
  const s = fresh()
  assert.equal(buyCard(s, 24).ok, true)
  lockRound(s); recordSpin(s, 'SI'); advanceRound(s) // round 2, portfolio [24]
  assert.equal(buyCard(s, 17).ok, true) // roundBought [17]
  const r = undoCard(s, 17)
  assert.equal(r.ok, true)
  assert.equal(r.refund, 2)             // FULL refund of the just-bought card
  assert.deepEqual(s.portfolio, [24])
  assert.deepEqual(s.roundBought, [])
  // Returning the carried-over card is rejected in round 2 (G1).
  const rr = returnCard(s, 24)
  assert.equal(rr.ok, false)
  assert.match(rr.error, /Returns are not allowed in round 2\./)
})

test('undo is rejected once the round is locked', () => {
  const s = fresh()
  buyCard(s, 24)
  lockRound(s)
  const r = undoCard(s, 24)
  assert.equal(r.ok, false)
  assert.match(r.error, /locked/)
})

test('undo is rejected for a card bought in a previous round', () => {
  const s = fresh()
  buyCard(s, 24)
  lockRound(s); recordSpin(s, 'SI'); advanceRound(s) // round 2; 24 was bought in round 1
  const r = undoCard(s, 24)
  assert.equal(r.ok, false)
  assert.match(r.error, /not bought this round/)
})

test('cannot advance before the current round is spun', () => {
  const s = fresh()
  buyCard(s, 24); lockRound(s)
  assert.equal(advanceRound(s).ok, false)
  assert.match(advanceRound(s).error, /not been spun/)
})
