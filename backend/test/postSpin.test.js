// Post-spin panel helpers (E6 card status/order, E7 culture line). Pure frontend
// utils, run here against the real measure config.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardStatus, orderCards, cultureLine } from '../../frontend/src/utils/postSpin.js'
import { MEASURES_BY_ID } from '../src/config/measures.js'

const getMeasure = id => MEASURES_BY_ID[id]

// ── E6 · status ──────────────────────────────────────────────────────────────
test('cardStatus: HELPED / RAISED CULTURE / NOT THIS TIME', () => {
  const opts = { drawnEvent: 'WF', startingBand: 'aware', getMeasure }
  assert.equal(cardStatus(8, opts), 'HELPED')          // #8 WF protection > 0
  assert.equal(cardStatus(11, opts), 'HELPED')         // #11 WF > 0
  assert.equal(cardStatus(19, opts), 'RAISED CULTURE') // enabler, not at proactive
  assert.equal(cardStatus(26, opts), 'NOT THIS TIME')  // #26 WF = 0, not enabler
})

test('cardStatus: an enabler held while already Proactive is MAX CULTURE', () => {
  const opts = { drawnEvent: 'SI', startingBand: 'proactive', getMeasure }
  assert.equal(cardStatus(19, opts), 'MAX CULTURE')
  assert.equal(cardStatus(23, opts), 'HELPED')         // #23 SI > 0 regardless of culture
})

// ── E6 · order (HELPED, then RAISED CULTURE, then the rest; sorted in group) ──
test('orderCards groups HELPED, then RAISED CULTURE, then the rest', () => {
  // Case B deck, draws WF: helped 8,11,23 · raised 19 · not 26.
  const order = orderCards([26, 23, 19, 11, 8], { drawnEvent: 'WF', startingBand: 'aware', getMeasure })
  assert.deepEqual(order, [8, 11, 23, 19, 26])
})

test('orderCards: a MAX-CULTURE enabler sorts into the last group', () => {
  // Proactive start: #19 is MAX CULTURE → last group, after HELPED #23.
  const order = orderCards([19, 23, 2], { drawnEvent: 'SI', startingBand: 'proactive', getMeasure })
  assert.deepEqual(order, [23, 2, 19]) // HELPED 23 · rest (2, then 19) by number
})

// ── E7 · culture line selection ──────────────────────────────────────────────
test('cultureLine: one enabler raised one level', () => {
  assert.equal(
    cultureLine({ startingBand: 'developing', startLabel: 'Developing', startMult: '1.0', raisedLevels: 1, enablerIds: [19] }),
    'Started Developing (×1.0). Card 19 raised it one level.')
})

test('cultureLine: two enablers raised two levels', () => {
  assert.equal(
    cultureLine({ startingBand: 'aware', startLabel: 'Aware', startMult: '0.9', raisedLevels: 2, enablerIds: [19, 20] }),
    'Started Aware (×0.9). Cards 19 and 20 raised it two levels.')
})

test('cultureLine: no enabler held', () => {
  assert.equal(
    cultureLine({ startingBand: 'aware', startLabel: 'Aware', startMult: '0.9', raisedLevels: 1, enablerIds: [] }),
    'Starting level. No enabler held.')
})

test('cultureLine: already at Proactive', () => {
  assert.equal(
    cultureLine({ startingBand: 'proactive', startLabel: 'Proactive', startMult: '1.1', raisedLevels: 1, enablerIds: [19] }),
    'Started Proactive (×1.1). Already at the maximum level.')
})

test('cultureLine: two enablers capped to one gained level reads "one level"', () => {
  // Developing + #19 + #20 → Proactive (only one level gained, capped).
  assert.equal(
    cultureLine({ startingBand: 'developing', startLabel: 'Developing', startMult: '1.0', raisedLevels: 1, enablerIds: [19, 20] }),
    'Started Developing (×1.0). Cards 19 and 20 raised it one level.')
})
