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

test('portSize options carry a non-empty description', () => {
  const q = getPublicQuestionnaire()
  for (const opt of q.demographics.portSize.options) {
    assert.equal(typeof opt.description, 'string')
    assert.ok(opt.description.length > 0, `${opt.optionId} missing description`)
  }
})

test('world zone is removed from the demographics (v4)', () => {
  const q = getPublicQuestionnaire()
  assert.equal(q.demographics.worldZone, undefined)
})

test('v4 profile fields: governance, climate zone, coastal setting', () => {
  const q = getPublicQuestionnaire()
  // Governance: 5 options incl. Landlord/Public/Private/Tool/Other, each with an
  // optionId; the first four carry descriptions, "Other" needs none.
  const gov = q.demographics.governance.options
  assert.deepEqual(gov.map(o => o.label), ['Landlord port', 'Public port', 'Private port', 'Tool port', 'Other'])
  for (const o of gov) assert.ok(o.optionId?.length > 0, 'empty governance optionId')
  assert.ok(gov.find(o => o.optionId === 'landlord').description.length > 0)
  assert.equal(gov.find(o => o.optionId === 'other').description, undefined)

  // Climate zone: 5 options, labels only.
  const cz = q.demographics.climateZone.options
  assert.deepEqual(cz.map(o => o.label), [
    'Tropical / subtropical', 'Arid / desert', 'Mediterranean', 'Temperate', 'Cold / polar / sub-arctic',
  ])
  for (const o of cz) assert.ok(o.optionId?.length > 0, 'empty climateZone optionId')

  // Coastal setting: 4 options, labels only.
  const cs = q.demographics.coastalSetting.options
  assert.deepEqual(cs.map(o => o.label), [
    'Open coast', 'Estuary or river', 'Bay or lagoon', 'Artificial / engineered coastline',
  ])
  for (const o of cs) assert.ok(o.optionId?.length > 0, 'empty coastalSetting optionId')
})
