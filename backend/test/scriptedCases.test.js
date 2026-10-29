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
import { formatEurBn, formatPercent, formatScore10, damageBreakdown } from '../../frontend/src/utils/format.js'

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

  // Protection this event, damage, losses avoided, potential losses.
  assert.equal(formatPercent(entry.rawLossesAvoidedPct / 10), '11%')
  const d = damageBreakdown(entry.damageBill, entry.impact)
  assert.equal(formatEurBn(d.damageShown), '€1.8bn')
  assert.equal(formatEurBn(d.avoidedShown), '€0.2bn')
  assert.equal(formatEurBn(d.potentialShown), '€2.0bn')
  assert.equal(d.damageShown + d.avoidedShown, d.potentialShown)

  // Strategy: expected 50.2% ÷ best 60.6% → 8.3 / 10.
  assert.ok(Math.abs(entry.expectedProtection - 50.2) < 0.1, `expected ≈50.2, got ${entry.expectedProtection}`)
  assert.ok(Math.abs(bestPossibleExpectedProtection('nord-maris', 1, 'developing') - 60.6) < 0.1)
  assert.equal(formatScore10(entry.strategyScoreRaw), '8.3 / 10')
})

test('Case B · Meridia, Team B, Aware, #8 #11 #19 #23 #26, draws Wildfire', () => {
  const cards = [8, 11, 19, 23, 26]
  const { entry } = play({ portId: 'meridia', startingBand: 'aware', cards, event: 'WF' })
  const effBand = applyCultureMeasureBonus('aware', cards)

  assert.equal(effBand, 'developing') // Aware + card 19 → Developing
  assert.deepEqual(groups({ cards, event: 'WF', startingBand: 'aware', effBand }),
    { helped: [8, 11, 23], raised: [19], notThisTime: [26] })

  assert.equal(formatPercent(entry.rawLossesAvoidedPct / 10), '42%')
  const d = damageBreakdown(entry.damageBill, entry.impact)
  assert.equal(formatEurBn(d.damageShown), '€2.3bn')
  assert.equal(formatEurBn(d.avoidedShown), '€1.7bn')
  assert.equal(formatEurBn(d.potentialShown), '€4.0bn')
  assert.equal(d.damageShown + d.avoidedShown, d.potentialShown)

  assert.ok(Math.abs(entry.expectedProtection - 53.9) < 0.1, `expected ≈53.9, got ${entry.expectedProtection}`)
  assert.ok(Math.abs(bestPossibleExpectedProtection('meridia', 1, 'aware') - 60.2) < 0.1)
  assert.equal(formatScore10(entry.strategyScoreRaw), '9.0 / 10')
})
