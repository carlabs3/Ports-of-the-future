import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateTeamNames, validateTeamCount, assignRandomPorts, MIN_TEAMS, MAX_TEAMS,
} from '../src/services/portAssignmentService.js'
import { PORTS } from '../src/config/ports/index.js'

test('generateTeamNames produces Team A … in order', () => {
  assert.deepEqual(generateTeamNames(2), ['Team A', 'Team B'])
  assert.deepEqual(generateTeamNames(MAX_TEAMS), [
    'Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F',
  ])
})

test('validateTeamCount enforces the 2–6 range and integers (D13)', () => {
  assert.equal(validateTeamCount(MIN_TEAMS).ok, true)
  assert.equal(validateTeamCount(MAX_TEAMS).ok, true)
  assert.equal(validateTeamCount(1).ok, false)
  assert.equal(validateTeamCount(7).ok, false)
  assert.equal(validateTeamCount(2.5).ok, false)
  assert.equal(validateTeamCount('3').ok, false)
})

test('assignRandomPorts gives every team a distinct existing port', () => {
  const groups = generateTeamNames(MAX_TEAMS)
  const out = assignRandomPorts(groups) // real Math.random
  assert.equal(out.length, groups.length)
  // aligned with groups, in order
  assert.deepEqual(out.map(o => o.group), groups)
  // all portIds exist in the catalogue
  const validIds = new Set(PORTS.map(p => p.id))
  for (const o of out) assert.ok(validIds.has(o.portId), `unknown portId ${o.portId}`)
  // no repeats
  assert.equal(new Set(out.map(o => o.portId)).size, out.length)
})

test('assignRandomPorts is deterministic with an injected rng', () => {
  const groups = generateTeamNames(3)
  // rng() = 0 → Fisher–Yates always swaps with index 0.
  const a = assignRandomPorts(groups, () => 0)
  const b = assignRandomPorts(groups, () => 0)
  assert.deepEqual(a, b)
  assert.equal(new Set(a.map(o => o.portId)).size, 3) // still distinct
})

test('assignRandomPorts never repeats across many random runs', () => {
  const groups = generateTeamNames(MAX_TEAMS)
  for (let i = 0; i < 200; i++) {
    const out = assignRandomPorts(groups)
    assert.equal(new Set(out.map(o => o.portId)).size, groups.length, 'repeat detected')
  }
})

test('assignRandomPorts throws when there are more teams than ports', () => {
  const tooMany = Array.from({ length: PORTS.length + 1 }, (_, i) => `Team ${i}`)
  assert.throws(() => assignRandomPorts(tooMany))
})
