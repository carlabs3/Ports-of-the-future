import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateConfig } from '../src/config/validateConfig.js'
import { MEASURES_BY_ID } from '../src/config/measures.js'
import { MEASURES } from '../src/config/measures.js'
import { PORTS_BY_ID } from '../src/config/ports/index.js'
import { PORTS } from '../src/config/ports/index.js'

test('validateConfig does not throw on the real data', () => {
  assert.doesNotThrow(() => validateConfig())
})

test('spot-check measure transcription (v4, 26 measures)', () => {
  assert.equal(MEASURES.length, 26)
  assert.equal(MEASURES_BY_ID[1].protection.SS, 8)
  assert.equal(MEASURES_BY_ID[1].cost, 5)
  assert.equal(MEASURES_BY_ID[15].protection.RF, 7)
  assert.equal(MEASURES_BY_ID[16].protection.DR, 6) // new: Alternative water supply & reuse
  assert.equal(MEASURES_BY_ID[24].protection.SI, 7)
  assert.equal(MEASURES_BY_ID[26].protection.HW, 5) // new: Cool surfaces & shaded yards
  assert.equal(MEASURES_BY_ID[19].raisesCultureLevel, true)
  assert.equal(MEASURES_BY_ID[20].raisesCultureLevel, true)
  const raisers = MEASURES.filter(m => m.raisesCultureLevel).map(m => m.id).sort((a, b) => a - b)
  assert.deepEqual(raisers, [19, 20])
})

test('spot-check port transcription (v4, 6 ports, string ids)', () => {
  assert.equal(PORTS.length, 6)
  assert.equal(PORTS_BY_ID['boreal'].exposureWeights.SI, 4)
  assert.equal(PORTS_BY_ID['riu-verd'].exposureWeights.DR, 4)
  for (const p of PORTS) {
    assert.equal(Object.values(p.exposureWeights).reduce((s, v) => s + v, 0), 10, `${p.name} weights`)
  }
})

test('negative: a port whose weights sum to 9 fails validation', () => {
  const broken = PORTS.map(p => ({ ...p, exposureWeights: { ...p.exposureWeights } }))
  const firstNonZero = Object.keys(broken[0].exposureWeights).find(c => broken[0].exposureWeights[c] > 0)
  broken[0].exposureWeights[firstNonZero] -= 1
  assert.throws(() => validateConfig({ ports: broken }), /sum to exactly 10/)
})

test('negative: a deck missing a shared card fails validation', () => {
  const broken = PORTS.map(p => ({ ...p, deck: [...p.deck] }))
  broken[0].deck = broken[0].deck.filter(id => id !== 8) // drop shared #8
  assert.throws(() => validateConfig({ ports: broken }), /missing shared card #8/)
})

test('negative: a deck with a non-existent card fails validation', () => {
  const broken = PORTS.map(p => ({ ...p, deck: [...p.deck] }))
  broken[0].deck.push(999)
  assert.throws(() => validateConfig({ ports: broken }), /does not exist/)
})

test('negative: a deck outside 13–15 cards fails validation', () => {
  const broken = PORTS.map(p => ({ ...p, deck: [...p.deck] }))
  broken[0].deck = broken[0].deck.slice(0, 10)
  assert.throws(() => validateConfig({ ports: broken }), /13–15 cards/)
})

test('negative: a cost above 5 fails validation', () => {
  const broken = MEASURES.map(m => ({ ...m, protection: { ...m.protection } }))
  broken[0].cost = 6
  assert.throws(() => validateConfig({ measures: broken }), /cost must be an integer 1–5/)
})
