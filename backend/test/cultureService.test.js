import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCultureBandFromScores } from '../src/services/cultureService.js'

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

// NOTE: the old manual validatePortAssignments tests were removed with the
// function in B4 (ports are now assigned randomly server-side). The replacement
// (generateTeamNames / assignRandomPorts) is covered in
// portAssignmentService.test.js.
