import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPublicMeasures, costOfMeasures, validateMeasureSelection, MEASURE_BUDGET } from '../src/services/measuresService.js'

// v4 card picker: protection is now exposed (it is printed on the physical cards)
// so the Strategy tab can render hazard chips. This REPLACES the earlier rule
// that protection stayed secret — the real secret, a port's exposure weights, is
// never in the measure catalogue to begin with. The payload must carry exactly
// the card-facing fields and nothing else (no description, no stray data).
test('getPublicMeasures exposes id/name/cost/raisesCultureLevel/protection — and only those', () => {
  const pub = getPublicMeasures()
  const EVENT_CODES = ['SS', 'RF', 'HW', 'WS', 'DR', 'WF', 'SI']
  assert.equal(pub.length, 26)
  for (const m of pub) {
    assert.deepEqual(Object.keys(m).sort(), ['cost', 'id', 'name', 'protection', 'raisesCultureLevel'])
    assert.equal(typeof m.id, 'number')
    assert.equal(typeof m.name, 'string')
    assert.equal(typeof m.cost, 'number')
    assert.equal(typeof m.raisesCultureLevel, 'boolean')
    // protection: exactly the 7 event codes, each an integer 0–10.
    assert.deepEqual(Object.keys(m.protection).sort(), [...EVENT_CODES].sort())
    for (const c of EVENT_CODES) {
      assert.ok(Number.isInteger(m.protection[c]) && m.protection[c] >= 0 && m.protection[c] <= 10, `measure ${m.id} bad ${c}`)
    }
  }
  // Enablers (#19/#20) protect against nothing — all zeros.
  for (const id of [19, 20]) {
    const m = pub.find(x => x.id === id)
    assert.ok(EVENT_CODES.every(c => m.protection[c] === 0), `enabler ${id} should have zero protection`)
  }
})

test('only #19 and #20 raise the culture level in the public payload', () => {
  const raising = getPublicMeasures().filter(m => m.raisesCultureLevel).map(m => m.id).sort((a, b) => a - b)
  assert.deepEqual(raising, [19, 20])
})

test('costOfMeasures / validateMeasureSelection unchanged', () => {
  assert.equal(costOfMeasures([1, 19]), 6) // 5 + 1
  assert.equal(validateMeasureSelection([1, 19]).ok, true)
  assert.equal(validateMeasureSelection([1, 2, 3]).ok, false) // 5+4+3 = 12 > 6
  assert.equal(validateMeasureSelection([999]).ok, false)
  assert.equal(MEASURE_BUDGET, 6)
})
