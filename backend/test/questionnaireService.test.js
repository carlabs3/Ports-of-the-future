import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPublicQuestionnaire } from '../src/services/questionnaireService.js'

test('returns exactly 5 areas and 10 questions total', () => {
  const q = getPublicQuestionnaire()
  assert.equal(q.areas.length, 5)
  const totalQuestions = q.areas.reduce((sum, a) => sum + a.questions.length, 0)
  assert.equal(totalQuestions, 10)
})

test('SECURITY: no object anywhere in the output contains a "score" key', () => {
  const q = getPublicQuestionnaire()

  // Deep walk: fail if any object exposes a `score` key.
  function assertNoScore(node, path) {
    if (Array.isArray(node)) {
      node.forEach((item, i) => assertNoScore(item, `${path}[${i}]`))
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        assert.ok(key !== 'score', `Leaked score at ${path}.${key}`)
        assertNoScore(value, `${path}.${key}`)
      }
    }
  }

  assertNoScore(q, 'questionnaire')
})

test('every scored-question option has non-empty optionId and label', () => {
  const q = getPublicQuestionnaire()
  for (const area of q.areas) {
    for (const question of area.questions) {
      assert.ok(question.options.length > 0, `${question.questionId} has no options`)
      for (const opt of question.options) {
        assert.equal(typeof opt.optionId, 'string')
        assert.ok(opt.optionId.length > 0, 'empty optionId')
        assert.equal(typeof opt.label, 'string')
        assert.ok(opt.label.length > 0, 'empty label')
      }
    }
  }
})

test('portSize is present in the demographic output', () => {
  const q = getPublicQuestionnaire()
  assert.ok(q.demographics.portSize)
  assert.ok(Array.isArray(q.demographics.portSize.options))
  assert.ok(q.demographics.portSize.options.length > 0)
})
