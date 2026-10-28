// Event roulette (v5): drawEvent reads the port's SECRET per-ROUND wheel
// likelihoods (percent, sum 100). Draws are deterministic under an injected rng.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawEvent, topExposureEvents } from '../src/services/wheelService.js'
import { PORTS, PORTS_BY_ID } from '../src/config/ports/index.js'
import { EVENT_CODES } from '../src/config/events.js'

// The CDF walk uses `rng() * total`. A constant rng pins the draw to one slice.
const rngConst = (v) => () => v

test('drawEvent uses the requested round\'s wheel, not another round\'s', () => {
  // Boreal R1 SI=40 is the first/largest-at-the-tail slice; the wheels differ by
  // round, so a draw at the very top of the CDF (rng≈1) resolves to the last
  // non-zero event of THAT round's wheel. More directly: an event with 0
  // likelihood in a round can never be drawn in that round.
  for (const p of PORTS) {
    for (const round of [1, 2, 3]) {
      const likelihoods = p.wheels[round].likelihoods
      const zeros = EVENT_CODES.filter(c => !(likelihoods[c] > 0))
      // Sweep the whole CDF; every drawn code must have positive likelihood.
      for (let i = 0; i < 100; i++) {
        const code = drawEvent(p.id, round, rngConst(i / 100))
        assert.ok(likelihoods[code] > 0, `${p.id} r${round}: drew ${code} with 0 likelihood`)
        assert.ok(!zeros.includes(code), `${p.id} r${round}: drew zero-likelihood ${code}`)
      }
    }
  }
})

test('drawEvent: rng=0 → first non-zero event in EVENT_CODES order; rng→1 → last', () => {
  const nm = PORTS_BY_ID['nord-maris']
  for (const round of [1, 2, 3]) {
    const likelihoods = nm.wheels[round].likelihoods
    const nonZero = EVENT_CODES.filter(c => likelihoods[c] > 0)
    assert.equal(drawEvent('nord-maris', round, rngConst(0)), nonZero[0])
    assert.equal(drawEvent('nord-maris', round, rngConst(0.999999)), nonZero[nonZero.length - 1])
  }
})

test('drawEvent is proportional to the round likelihoods (large-sample frequencies)', () => {
  // Deterministic pseudo-stream (no Math.random) so the test is reproducible.
  let seed = 12345
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const p = PORTS_BY_ID['meridia']
  const likelihoods = p.wheels[1].likelihoods
  const N = 20000
  const counts = {}
  for (let i = 0; i < N; i++) { const c = drawEvent('meridia', 1, rng); counts[c] = (counts[c] || 0) + 1 }
  for (const code of EVENT_CODES) {
    const expected = (likelihoods[code] || 0) / 100
    const got = (counts[code] || 0) / N
    assert.ok(Math.abs(got - expected) < 0.03, `${code}: freq ${got.toFixed(3)} vs likelihood ${expected}`)
  }
})

test('drawEvent returns null when the round has no likelihoods', () => {
  assert.equal(drawEvent('nowhere', 1, rngConst(0.5)), null)
})

test('topExposureEvents ranks a round\'s likelihoods, ties by EVENT_CODES order', () => {
  const p = PORTS_BY_ID['nord-maris'] // R1 {SS40, RF10, HW10, WS30, SI10}
  const top2 = topExposureEvents(p.wheels[1].likelihoods, 2)
  assert.deepEqual(top2, ['SS', 'WS']) // 40 then 30
})
