// The two scripted cases from the v5 results prompt, asserted end-to-end: play a
// round with the exact cards, FORCE the drawn event via recordSpin(state, event)
// (no production force-draw hook exists, and none is added), then check every
// displayed number through the real formatters. If a number differs, the
// implementation (or the case) is wrong.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buyCard, lockRound, recordSpin } from '../src/services/roundsService.js'
import { precomputeBestPossible, bestPossibleExpectedProtection } from '../src/services/strategyService.js'
import { applyCultureMeasureBonus } from '../src/services/cultureService.js'
import { MEASURES_BY_ID } from '../src/config/measures.js'
import { formatEurM, formatPercent, formatScore10, damageBreakdown } from '../../frontend/src/utils/format.js'

precomputeBestPossible()

function play({ portId, startingBand, cards, event }) {
  const state = { portId, startingBand, portfolio: [], coins: 6, roundStartCoins: 6, currentRound: 1, roundLocked: false, roundBought: [], roundReturned: null, rounds: [] }
  for (const id of cards) assert.equal(buyCard(state, id).ok, true, `buy #${id}`)
  assert.equal(state.coins, 0, 'spent exactly 6 coins')
  assert.equal(lockRound(state).ok, true)
  const r = recordSpin(state, event)
  assert.equal(r.ok, true)
  return { state, entry: r.entry }
}

// Derive the E6 card groups straight from config (the Commit-2 UI must match these).
function groups({ cards, event, startingBand, effBand }) {
  const prot = id => MEASURES_BY_ID[id].protection
  const enabler = id => !!MEASURES_BY_ID[id].raisesCultureLevel
  const helped = cards.filter(id => (prot(id)[event] || 0) > 0).sort((a, b) => a - b)
  const raised = cards.filter(id => enabler(id) && effBand !== startingBand).sort((a, b) => a - b)
  const notThisTime = cards.filter(id => !helped.includes(id) && !raised.includes(id)).sort((a, b) => a - b)
  return { helped, raised, notThisTime }
}

test('Case A · Nord-Maris, Team A, Developing, #2 #19 #23, draws Snow & ice', () => {
  const cards = [2, 19, 23]
  const { entry } = play({ portId: 'nord-maris', startingBand: 'developing', cards, event: 'SI' })
  const effBand = applyCultureMeasureBonus('developing', cards)

  assert.equal(effBand, 'proactive') // Developing + card 19 → Proactive
  assert.deepEqual(groups({ cards, event: 'SI', startingBand: 'developing', effBand }),
    { helped: [23], raised: [19], notThisTime: [2] })

  // Protection this event, damage, losses avoided, potential losses (€M, J1/J5).
  assert.equal(formatPercent(entry.rawLossesAvoidedPct / 10), '11%')
  assert.equal(entry.potentialLossM, 300)                      // SI potential loss €300M
  const d = damageBreakdown(entry.damageBill, entry.potentialLossM)
  assert.equal(formatEurM(d.damageShown), '€267M')
  assert.equal(formatEurM(d.avoidedShown), '€33M')
  assert.equal(formatEurM(d.potentialShown), '€300M')
  assert.equal(d.damageShown + d.avoidedShown, d.potentialShown)

  // Strategy: expected 48.5% ÷ best 60.6% → 8.0 / 10.
  assert.ok(Math.abs(entry.expectedProtection - 48.5) < 0.1, `expected ≈48.5, got ${entry.expectedProtection}`)
  assert.ok(Math.abs(bestPossibleExpectedProtection('nord-maris', 1, 'developing') - 60.6) < 0.1)
  assert.equal(formatScore10(entry.strategyScoreRaw), '8.0 / 10')
})

test('Case B · Meridia, Team B, Aware, #8 #11 #19 #23 #26, draws Wildfire', () => {
  const cards = [8, 11, 19, 23, 26]
  const { entry } = play({ portId: 'meridia', startingBand: 'aware', cards, event: 'WF' })
  const effBand = applyCultureMeasureBonus('aware', cards)

  assert.equal(effBand, 'developing') // Aware + card 19 → Developing
  assert.deepEqual(groups({ cards, event: 'WF', startingBand: 'aware', effBand }),
    { helped: [8, 11, 23], raised: [19], notThisTime: [26] })

  assert.equal(formatPercent(entry.rawLossesAvoidedPct / 10), '42%')
  assert.equal(entry.potentialLossM, 300)                      // WF potential loss €300M
  const d = damageBreakdown(entry.damageBill, entry.potentialLossM)
  assert.equal(formatEurM(d.damageShown), '€173M')
  assert.equal(formatEurM(d.avoidedShown), '€127M')
  assert.equal(formatEurM(d.potentialShown), '€300M')
  assert.equal(d.damageShown + d.avoidedShown, d.potentialShown)

  // Strategy: expected 44.0% ÷ best 51.5% → 8.6 / 10.
  assert.ok(Math.abs(entry.expectedProtection - 44.0) < 0.1, `expected ≈44.0, got ${entry.expectedProtection}`)
  assert.ok(Math.abs(bestPossibleExpectedProtection('meridia', 1, 'aware') - 51.5) < 0.1)
  assert.equal(formatScore10(entry.strategyScoreRaw), '8.6 / 10')
})
