// pickExtremes lives with the frontend but is a pure function with no React/DOM
// deps, so it runs here in the backend's node:test suite (like wheelMath).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickExtremes } from '../../frontend/src/utils/areaExtremes.js'

const AREAS = ['governance', 'organisation', 'budget', 'measures', 'preparedness']
const sorted = s => [...s].sort()

test('one clear strongest and one clear weakest', () => {
  const { strongest, weakest } = pickExtremes({
    governance: 18, organisation: 12, budget: 7, measures: 14, preparedness: 10,
  })
  assert.deepEqual(sorted(strongest), ['governance'])
  assert.deepEqual(sorted(weakest), ['budget'])
})

test('two-way tie at the top: both marked strongest', () => {
  const { strongest, weakest } = pickExtremes({
    governance: 18, organisation: 18, budget: 7, measures: 14, preparedness: 10,
  })
  assert.deepEqual(sorted(strongest), ['governance', 'organisation'])
  assert.deepEqual(sorted(weakest), ['budget'])
})

test('two-way tie at the bottom: both marked weakest', () => {
  const { strongest, weakest } = pickExtremes({
    governance: 18, organisation: 12, budget: 7, measures: 14, preparedness: 7,
  })
  assert.deepEqual(sorted(strongest), ['governance'])
  assert.deepEqual(sorted(weakest), ['budget', 'preparedness'])
})

test('all five equal: neither label', () => {
  const { strongest, weakest } = pickExtremes({
    governance: 10, organisation: 10, budget: 10, measures: 10, preparedness: 10,
  })
  assert.equal(strongest.size, 0)
  assert.equal(weakest.size, 0)
})

test('an area is never both strongest and weakest', () => {
  const { strongest, weakest } = pickExtremes({
    governance: 20, organisation: 0, budget: 10, measures: 10, preparedness: 10,
  })
  for (const id of AREAS) assert.equal(strongest.has(id) && weakest.has(id), false)
  assert.deepEqual(sorted(strongest), ['governance'])
  assert.deepEqual(sorted(weakest), ['organisation'])
})

test('empty input yields two empty sets', () => {
  const { strongest, weakest } = pickExtremes({})
  assert.equal(strongest.size, 0)
  assert.equal(weakest.size, 0)
})
