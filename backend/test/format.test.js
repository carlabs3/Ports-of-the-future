// Display formatters (E1–E3). They live with the frontend but are pure, so they
// run here in the backend node:test runner (like wheelMath / areaExtremes).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatEurBn, formatPercent, formatScore10, damageBreakdown } from '../../frontend/src/utils/format.js'

test('formatEurBn: always one decimal, half up', () => {
  assert.equal(formatEurBn(2), '€2.0bn')
  assert.equal(formatEurBn(1.78), '€1.8bn')
  assert.equal(formatEurBn(0.2), '€0.2bn')
  assert.equal(formatEurBn(1.65), '€1.7bn') // .65 rounds up
  assert.equal(formatEurBn(0), '€0.0bn')
})

test('formatPercent: P (0–10) → whole-number %, half up', () => {
  assert.equal(formatPercent(4.24), '42%')
  assert.equal(formatPercent(1.1), '11%')
  assert.equal(formatPercent(4.25), '43%') // 42.5 rounds up
})

test('formatScore10: raw ratio → "X.X / 10"', () => {
  assert.equal(formatScore10(0.8270588), '8.3 / 10')
  assert.equal(formatScore10(0.8953), '9.0 / 10')
  assert.equal(formatScore10(1), '10.0 / 10')
  assert.equal(formatScore10(0), '0.0 / 10')
})

test('E3 damageBreakdown: shown values always add up', () => {
  const a = damageBreakdown(2.35, 4)
  assert.deepEqual(a, { damageShown: 2.4, potentialShown: 4.0, avoidedShown: 1.6 })
  assert.equal(a.damageShown + a.avoidedShown, a.potentialShown)

  const b = damageBreakdown(1.65, 4)
  assert.deepEqual(b, { damageShown: 1.7, potentialShown: 4.0, avoidedShown: 2.3 })
  assert.equal(b.damageShown + b.avoidedShown, b.potentialShown)

  // A few more: shown damage + shown avoided == shown potential, always.
  for (const [dmg, imp] of [[0, 2], [2, 2], [3.65, 5], [1.78, 2], [2.32, 4]]) {
    const r = damageBreakdown(dmg, imp)
    assert.equal(Math.round((r.damageShown + r.avoidedShown) * 10) / 10, r.potentialShown, `${dmg}/${imp}`)
  }
})
