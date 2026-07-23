import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePreparedness, adjustScore, cultureFactor } from '../src/services/preparednessService.js'
import { drawEvent } from '../src/services/wheelService.js'
import { MEASURES } from '../src/config/measures.js'

// The formula tests need measures with KNOWN protection scores for a chosen
// event. Rather than depend on specific config values, build a synthetic set:
// pick, per desired score, a real measure whose protection for some event
// equals that score. Simpler + robust: use the real config and choose an event
// + measures that yield the documented scores. To stay decoupled from config
// drift we instead test computePreparedness via a helper that stubs protection
// by choosing measures whose protection[event] matches.
//
// Find a measure id whose protection for `event` equals `score`.
function measureWithScore(event, score) {
  const m = MEASURES.find(x => (x.protection?.[event] ?? -1) === score)
  assert.ok(m, `need a real measure with protection.${event} === ${score}`)
  return m.id
}

// Use event 'SS' as the drawn event for the formula tests.
const EV = 'SS'

test('one measure, effective score 8 → P = 8.0', () => {
  const id = measureWithScore(EV, 8) // measure #1 Coastal defences SS=8
  const r = computePreparedness({ measureIds: [id], eventCode: EV, cultureBand: 'developing' })
  assert.equal(r.preparedness, 8.0)
})

test('two measures, scores 5 and 5 → P = 7.5', () => {
  const id5 = measureWithScore(EV, 5) // #3 Deployable flood barriers SS=5
  const r = computePreparedness({ measureIds: [id5, id5], eventCode: EV, cultureBand: 'developing' })
  assert.equal(r.preparedness, 7.5)
})

test('three measures, scores 8, 3, 2 → P = 8.9', () => {
  // Build via measures whose SS scores are 8, 3, 2.
  const id8 = measureWithScore(EV, 8) // #1
  const id3 = measureWithScore(EV, 3) // #6 SS=3
  const id2 = measureWithScore(EV, 2) // #14 SS=2
  const r = computePreparedness({ measureIds: [id8, id3, id2], eventCode: EV, cultureBand: 'developing' })
  assert.equal(r.preparedness, 8.9)
})

test('two measures, scores 2 and 3 → P = 4.4', () => {
  const id2 = measureWithScore(EV, 2)
  const id3 = measureWithScore(EV, 3)
  const r = computePreparedness({ measureIds: [id2, id3], eventCode: EV, cultureBand: 'developing' })
  assert.equal(r.preparedness, 4.4)
})

test('no measures → P = 0, lossesAvoidedPct = 0', () => {
  const r = computePreparedness({ measureIds: [], eventCode: EV, cultureBand: 'developing' })
  assert.equal(r.preparedness, 0)
  assert.equal(r.lossesAvoidedPct, 0)
})

test('lossesAvoidedPct: P = 8.0 → 80', () => {
  const id = measureWithScore(EV, 8)
  const r = computePreparedness({ measureIds: [id], eventCode: EV, cultureBand: 'developing' })
  assert.equal(r.lossesAvoidedPct, 80)
})

// ── Culture multiplier / order of operations ─────────────────────────────────
test('one measure sᵢ=8, proactive (×1.1) → 8.8 → P = 8.8', () => {
  const id = measureWithScore(EV, 8)
  const r = computePreparedness({ measureIds: [id], eventCode: EV, cultureBand: 'proactive' })
  assert.equal(r.preparedness, 8.8)
})

test('two measures sᵢ=5,5 proactive (×1.1 each) → P = 8.0 (discriminates order)', () => {
  const id5 = measureWithScore(EV, 5)
  const r = computePreparedness({ measureIds: [id5, id5], eventCode: EV, cultureBand: 'proactive' })
  // If the multiplier were (wrongly) applied to final P it would be 7.5×1.1=8.25.
  assert.equal(r.preparedness, 8.0)
})

test('culture cap: adjustScore caps at 10 (sᵢ=10 × 1.1 = 11 → 10)', () => {
  // Config has no protection of 10 (max is 8), so the cap can only be exercised
  // directly on the per-measure adjustment step where it lives.
  assert.equal(adjustScore(10, cultureFactor('proactive')), 10)
  // And a below-cap value is not clamped:
  assert.ok(adjustScore(8, cultureFactor('proactive')) < 10)
})

test('cultureBand null → factor 1.0', () => {
  const id8 = measureWithScore(EV, 8)
  const r = computePreparedness({ measureIds: [id8], eventCode: EV, cultureBand: null })
  assert.equal(r.preparedness, 8.0)
})

// ── Roulette ─────────────────────────────────────────────────────────────────
// Nord-Maris (portId 1): SS4 RF1 HW0 WS3 DR1 WF0 SI1 → cumulative on
// [SS,RF,HW,WS,DR,WF,SI]: SS[0,4) RF[4,5) WS[5,8) DR[8,9) SI[9,10). HW/WF = 0.
test('drawEvent respects weights with a deterministic rng', () => {
  assert.equal(drawEvent(1, () => 0),     'SS') // r=0
  assert.equal(drawEvent(1, () => 0.45),  'RF') // r=4.5
  assert.equal(drawEvent(1, () => 0.70),  'WS') // r=7.0
  assert.equal(drawEvent(1, () => 0.85),  'DR') // r=8.5
  assert.equal(drawEvent(1, () => 0.95),  'SI') // r=9.5
})

test('drawEvent never returns a zero-weight event for a port', () => {
  // Nord-Maris has HW=0 and WF=0 — sweep rng across [0,1) and assert never drawn.
  for (let i = 0; i < 1000; i++) {
    const code = drawEvent(1, () => i / 1000)
    assert.notEqual(code, 'HW')
    assert.notEqual(code, 'WF')
  }
})
