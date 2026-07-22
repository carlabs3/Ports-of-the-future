import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyCultureMeasureBonus } from '../src/services/cultureService.js'
import { validateMeasureSelection, costOfMeasures } from '../src/services/measuresService.js'
import { MEASURES_BY_ID } from '../src/config/measures.js'

// Measures #19 and #20 are the culture-raising ones (cost 1 each in config).
const M19 = 19
const M20 = 20

test('base aware, no culture measure → aware', () => {
  assert.equal(applyCultureMeasureBonus('aware', [8, 15]), 'aware')
})

test('base aware + #19 → developing', () => {
  assert.equal(applyCultureMeasureBonus('aware', [M19]), 'developing')
})

test('base aware + #20 → developing', () => {
  assert.equal(applyCultureMeasureBonus('aware', [M20]), 'developing')
})

test('base aware + BOTH #19 and #20 → developing (single step, not proactive)', () => {
  assert.equal(applyCultureMeasureBonus('aware', [M19, M20]), 'developing')
})

test('base developing + #19 → proactive', () => {
  assert.equal(applyCultureMeasureBonus('developing', [M19]), 'proactive')
})

test('base proactive + #19 → proactive (cap, no further rise)', () => {
  assert.equal(applyCultureMeasureBonus('proactive', [M19]), 'proactive')
})

test('base reactive, nothing → reactive', () => {
  assert.equal(applyCultureMeasureBonus('reactive', []), 'reactive')
})

test('base null → null', () => {
  assert.equal(applyCultureMeasureBonus(null, [M19]), null)
})

// ── budget ───────────────────────────────────────────────────────────────────
test('a selection costing <= 6 is valid', () => {
  // #19 (1) + #20 (1) + #8 (2) + #11 (1) = 5
  assert.equal(costOfMeasures([19, 20, 8, 11]), 5)
  const res = validateMeasureSelection([19, 20, 8, 11])
  assert.equal(res.ok, true)
  assert.equal(res.cost, 5)
})

test('a selection costing 7+ is rejected', () => {
  // #1 (5) + #8 (2) = 7 > 6
  assert.equal(MEASURES_BY_ID[1].cost, 5)
  assert.equal(MEASURES_BY_ID[8].cost, 2)
  const res = validateMeasureSelection([1, 8])
  assert.equal(res.ok, false)
  assert.equal(res.cost, 7)
  assert.match(res.error, /presupuesto|6/)
})

test('an unknown measure id is rejected', () => {
  const res = validateMeasureSelection([1, 999])
  assert.equal(res.ok, false)
  assert.match(res.error, /inexistente|999/)
})
