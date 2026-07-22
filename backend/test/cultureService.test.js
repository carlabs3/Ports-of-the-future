import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCultureBandFromScores } from '../src/services/cultureService.js'
import { validatePortAssignments } from '../src/services/portAssignmentService.js'

// ── cultureService: mean → band (pure) ───────────────────────────────────────
test('computeCultureBandFromScores maps a table mean to the right band', () => {
  assert.equal(computeCultureBandFromScores([40, 60]), 'aware')      // mean 50 → aware
  assert.equal(computeCultureBandFromScores([80, 80]), 'proactive')  // mean 80 → proactive
  assert.equal(computeCultureBandFromScores([10, 20]), 'reactive')   // mean 15 → reactive
  assert.equal(computeCultureBandFromScores([70, 60]), 'developing') // mean 65 → developing
})

test('computeCultureBandFromScores returns null for an empty table', () => {
  assert.equal(computeCultureBandFromScores([]), null)
  assert.equal(computeCultureBandFromScores(undefined), null)
})

// ── port assignment validation ───────────────────────────────────────────────
test('valid one-distinct-port-per-group passes', () => {
  const res = validatePortAssignments(
    ['Equipo A', 'Equipo B'],
    [{ group: 'Equipo A', portId: 1 }, { group: 'Equipo B', portId: 2 }]
  )
  assert.equal(res.ok, true)
})

test('two groups on the same port is rejected', () => {
  const res = validatePortAssignments(
    ['Equipo A', 'Equipo B'],
    [{ group: 'Equipo A', portId: 3 }, { group: 'Equipo B', portId: 3 }]
  )
  assert.equal(res.ok, false)
  assert.match(res.error, /mismo puerto|compartir/i)
})

test('a non-existent portId is rejected', () => {
  const res = validatePortAssignments(
    ['Equipo A', 'Equipo B'],
    [{ group: 'Equipo A', portId: 1 }, { group: 'Equipo B', portId: 999 }]
  )
  assert.equal(res.ok, false)
  assert.match(res.error, /inexistente|999/)
})

test('a group without a port is rejected', () => {
  const res = validatePortAssignments(
    ['Equipo A', 'Equipo B'],
    [{ group: 'Equipo A', portId: 1 }]
  )
  assert.equal(res.ok, false)
})
