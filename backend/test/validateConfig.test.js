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

test('spot-check measure transcription', () => {
  assert.equal(MEASURES_BY_ID[1].protection.SS, 8)
  assert.equal(MEASURES_BY_ID[1].cost, 5)
  assert.equal(MEASURES_BY_ID[15].protection.RF, 7)
  assert.equal(MEASURES_BY_ID[24].protection.SI, 7)
  assert.equal(MEASURES_BY_ID[19].raisesCultureBand, true)
  assert.equal(MEASURES_BY_ID[20].raisesCultureBand, true)
  // No other measure raises the culture band.
  const raisers = MEASURES.filter(m => m.raisesCultureBand).map(m => m.id).sort((a, b) => a - b)
  assert.deepEqual(raisers, [19, 20])
})

test('spot-check port transcription', () => {
  assert.equal(PORTS_BY_ID[7].exposureWeights.SI, 4) // Boreal
  const meridiaSum = Object.values(PORTS_BY_ID[5].exposureWeights).reduce((s, v) => s + v, 0)
  assert.equal(meridiaSum, 10) // Meridia
  assert.equal(PORTS_BY_ID[3].exposureWeights.RF, 4) // Riu Verd
})

test('negative case: a port whose weights sum to 9 fails validation', () => {
  const broken = PORTS.map(p => ({ ...p, exposureWeights: { ...p.exposureWeights } }))
  // Drop one token from the first port so its weights sum to 9.
  const firstNonZero = Object.keys(broken[0].exposureWeights).find(c => broken[0].exposureWeights[c] > 0)
  broken[0].exposureWeights[firstNonZero] -= 1
  assert.throws(() => validateConfig({ ports: broken }), /sum to exactly 10/)
})
