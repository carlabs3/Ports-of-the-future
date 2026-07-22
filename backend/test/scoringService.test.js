import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBand, computeParIndex } from '../src/services/scoringService.js'

const ALL_QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10']

// Build an answers object that picks the same option letter for every question,
// e.g. suffix 'a' -> { q1: 'q1a', q2: 'q2a', ... }.
function answersWithSuffix(suffix) {
  return Object.fromEntries(ALL_QUESTIONS.map(q => [q, `${q}${suffix}`]))
}

test('all zero-scoring options → score 0, band reactive, all areas 0, complete', () => {
  const result = computeParIndex(answersWithSuffix('a'))
  assert.equal(result.score, 0)
  assert.equal(result.band, 'reactive')
  assert.deepEqual(result.areas, {
    governance: 0, organisation: 0, budget: 0, measures: 0, preparedness: 0,
  })
  assert.equal(result.complete, true)
  assert.deepEqual(result.missing, [])
})

test('all 10-scoring options → score 100, band proactive, all areas 20, complete', () => {
  const result = computeParIndex(answersWithSuffix('d'))
  assert.equal(result.score, 100)
  assert.equal(result.band, 'proactive')
  assert.deepEqual(result.areas, {
    governance: 20, organisation: 20, budget: 20, measures: 20, preparedness: 20,
  })
  assert.equal(result.complete, true)
  assert.deepEqual(result.missing, [])
})

test('mixed case → exact per-area sums, score 28, band aware', () => {
  const answers = {
    q1: 'q1c', q2: 'q2b', q3: 'q3b', q4: 'q4a', q5: 'q5a',
    q6: 'q6a', q7: 'q7b', q8: 'q8b', q9: 'q9b', q10: 'q10b',
  }
  const result = computeParIndex(answers)
  assert.deepEqual(result.areas, {
    governance: 11, organisation: 3, budget: 0, measures: 7, preparedness: 7,
  })
  assert.equal(result.score, 28)
  assert.equal(result.band, 'aware')
  assert.equal(result.complete, true)
  assert.deepEqual(result.missing, [])
})

test('getBand boundaries', () => {
  assert.equal(getBand(0), 'reactive')
  assert.equal(getBand(25), 'reactive')
  assert.equal(getBand(26), 'aware')
  assert.equal(getBand(50), 'aware')
  assert.equal(getBand(51), 'developing')
  assert.equal(getBand(75), 'developing')
  assert.equal(getBand(76), 'proactive')
  assert.equal(getBand(100), 'proactive')
})

test('defensive: missing answer and unknown optionId score 0 and are flagged', () => {
  const answers = {
    q1: 'q1c', q2: 'q2b', q3: 'q3b', q4: 'q4a', /* q5 omitted */
    q6: 'q6a', q7: 'q7z', q8: 'q8b', q9: 'q9b', q10: 'q10b',
  }
  const result = computeParIndex(answers)
  assert.equal(result.complete, false)
  assert.ok(result.missing.includes('q5'))
  assert.ok(result.missing.includes('q7'))
  // budget lost q5 (0) but keeps q6a (0) → 0; measures lost q7 (0) but keeps q8b (3) → 3
  assert.equal(result.areas.budget, 0)
  assert.equal(result.areas.measures, 3)
  // No exception thrown, score stays a valid integer
  assert.equal(Number.isInteger(result.score), true)
})
