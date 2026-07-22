// PAR Index scoring engine — pure, server-side, no DB access.
import { AREAS, QUESTIONS } from '../config/parQuestionnaire.js'

// Maturity bands. THE single source of truth for band boundaries.
// `score` is always an integer 0–100. Boundaries use <= so there is no
// ambiguity at the edges. Do not duplicate these thresholds anywhere else.
export function getBand(score) {
  if (score <= 25) return 'reactive'
  if (score <= 50) return 'aware'
  if (score <= 75) return 'developing'
  return 'proactive'
}

// Resolve a single question's optionId to its score using the config.
// Returns null when the question or the chosen option is unknown/missing,
// so the caller can flag it as `missing` and score it as 0.
function resolveScore(questionId, optionId) {
  const question = QUESTIONS[questionId]
  if (!question) return null
  const option = question.options[optionId]
  if (!option) return null
  return option.score
}

// Compute the PAR Index from a map of { questionId: optionId }.
//
//   returns { score, band, areas, complete, missing }
//     - areas:    { areaId: sum-of-its-2-questions (0–20) }
//     - score:    total 0–100 (integer)
//     - band:     getBand(score)
//     - complete: true when nothing is missing
//     - missing:  questionIds that were absent or had an unknown optionId
//
// Defensive: a missing answer or an unknown optionId scores 0 and is added to
// `missing` — it never throws. Pure function: no side effects, no DB.
export function computeParIndex(answers) {
  const safeAnswers = answers || {}
  const areas = {}
  const missing = []
  let score = 0

  for (const area of AREAS) {
    let areaScore = 0
    for (const questionId of area.questions) {
      const resolved = resolveScore(questionId, safeAnswers[questionId])
      if (resolved === null) {
        missing.push(questionId)
      } else {
        areaScore += resolved
      }
    }
    areas[area.id] = areaScore
    score += areaScore
  }

  return {
    score,
    band: getBand(score),
    areas,
    complete: missing.length === 0,
    missing,
  }
}
