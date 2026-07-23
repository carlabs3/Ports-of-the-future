import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeSessionSummary } from '../src/services/parSubmissionService.js'

const mk = (group, score, areas) => ({ group, score, areas })

test('computeSessionSummary returns null for no results', () => {
  assert.equal(computeSessionSummary([]), null)
  assert.equal(computeSessionSummary(undefined), null)
})

test('computeSessionSummary aggregates scores, areas, bands and groups', () => {
  const individual = [
    mk('A', 0,   { governance: 0,  organisation: 0,  budget: 0,  measures: 0,  preparedness: 0 }),   // reactive
    mk('A', 100, { governance: 20, organisation: 20, budget: 20, measures: 20, preparedness: 20 }),   // proactive
    mk('B', 50,  { governance: 10, organisation: 10, budget: 10, measures: 10, preparedness: 10 }),   // aware
  ]
  const s = computeSessionSummary(individual)

  assert.equal(s.totalParticipants, 3)
  assert.equal(s.averageScore, 50)     // (0+100+50)/3 = 50
  assert.equal(s.medianScore, 50)      // sorted [0,50,100] → middle 50
  assert.equal(s.minScore, 0)
  assert.equal(s.maxScore, 100)

  // byArea: mean per area, e.g. governance (0+20+10)/3 = 10
  assert.equal(s.byArea.governance, 10)
  assert.equal(s.byArea.preparedness, 10)

  // band distribution via getBand(score): 0→reactive, 50→aware, 100→proactive
  assert.deepEqual(s.bandDistribution, { reactive: 1, aware: 1, developing: 0, proactive: 1 })

  // byGroup: A avg (0+100)/2=50 → aware; B avg 50 → aware
  const gA = s.byGroup.find(g => g.group === 'A')
  const gB = s.byGroup.find(g => g.group === 'B')
  assert.equal(gA.avgScore, 50)
  assert.equal(gA.cultureBand, 'aware')
  assert.equal(gB.avgScore, 50)
  assert.equal(gB.cultureBand, 'aware')
})
