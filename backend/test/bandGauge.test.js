// Maturity-band gauge geometry. The gauge util lives with the frontend but is
// pure, so it runs here (like format.test). The key invariant: the quarter the
// arrow sits in always equals the band the SERVER assigns (getBand) — one set of
// thresholds, so the arrow can never sit inside a different band than its label.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampScore, gaugeQuarter, GAUGE_BANDS } from '../../frontend/src/utils/bandGauge.js'
import { getBand } from '../src/services/scoringService.js'

test('clampScore: arrow tip position is the score, clamped to 0–100', () => {
  assert.equal(clampScore(0), 0)
  assert.equal(clampScore(100), 100)
  assert.equal(clampScore(47), 47)
  assert.equal(clampScore(-20), 0)   // never pushed below 0
  assert.equal(clampScore(140), 100) // never pushed past 100
  assert.equal(clampScore('63'), 63)
})

test('arrow quarter matches the server band at 0, 100, every threshold and band middle', () => {
  // endpoints · each getBand cut point and the value just past it · band middles
  const scores = [0, 100, 25, 26, 50, 51, 75, 76, 12, 13, 38, 63, 88]
  for (const s of scores) {
    assert.equal(GAUGE_BANDS[gaugeQuarter(s)], getBand(s), `score ${s}: arrow quarter vs server band`)
  }
})

test('the arrow never sits in a band different from the server band (0..100 sweep)', () => {
  for (let s = 0; s <= 100; s++) {
    assert.equal(GAUGE_BANDS[gaugeQuarter(s)], getBand(s), `score ${s}`)
  }
})

test('band boundaries land on the lower band (<= thresholds, like the server)', () => {
  assert.equal(GAUGE_BANDS[gaugeQuarter(25)], 'reactive')   // 25 is reactive, not aware
  assert.equal(GAUGE_BANDS[gaugeQuarter(50)], 'aware')
  assert.equal(GAUGE_BANDS[gaugeQuarter(75)], 'developing')
})
