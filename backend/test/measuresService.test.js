import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPublicMeasures, costOfMeasures, validateMeasureSelection, MEASURE_BUDGET } from '../src/services/measuresService.js'

test('getPublicMeasures exposes id/name/cost/raisesCultureBand only — never protection', () => {
  const pub = getPublicMeasures()
  assert.equal(pub.length, 25)
  for (const m of pub) {
    assert.equal(typeof m.id, 'number')
    assert.equal(typeof m.name, 'string')
    assert.equal(typeof m.cost, 'number')
    assert.equal(typeof m.raisesCultureBand, 'boolean')
    // SECURITY: protection scores must never be in the public payload.
    assert.ok(!('protection' in m), `measure ${m.id} leaked protection`)
  }
})

test('only #19 and #20 raise the culture band in the public payload', () => {
  const raising = getPublicMeasures().filter(m => m.raisesCultureBand).map(m => m.id).sort((a, b) => a - b)
  assert.deepEqual(raising, [19, 20])
})

test('costOfMeasures / validateMeasureSelection unchanged', () => {
  assert.equal(costOfMeasures([1, 19]), 6) // 5 + 1
  assert.equal(validateMeasureSelection([1, 19]).ok, true)
  assert.equal(validateMeasureSelection([1, 2, 3]).ok, false) // 5+4+3 = 12 > 6
  assert.equal(validateMeasureSelection([999]).ok, false)
  assert.equal(MEASURE_BUDGET, 6)
})
