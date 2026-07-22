import { AREAS, QUESTIONS, DEMOGRAPHICS } from '../config/parQuestionnaire.js'

// SECURITY: the frontend must NEVER receive option scores. The PAR Index is
// computed exclusively server-side (see computeParIndex). This service builds
// the public questionnaire shape the UI renders, copying ONLY {optionId, label}
// for every option — never spreading the whole option object, so a `score`
// field cannot leak into the output even if the config gains new fields.

// Normalise an option collection to [{ optionId, label }].
// Handles both config shapes:
//   - object keyed by id:  { small: { label }, ... }  (e.g. portSize)
//   - array of entries:    [ { id, label }, ... ]      (e.g. worldZone)
// Only optionId and label are ever copied — nothing else.
function toPublicOptions(options) {
  if (!options) return []
  if (Array.isArray(options)) {
    return options.map(opt => ({ optionId: opt.id, label: opt.label }))
  }
  return Object.entries(options).map(([optionId, opt]) => ({
    optionId,
    label: opt.label,
  }))
}

export function getPublicQuestionnaire() {
  const areas = AREAS.map(area => ({
    id: area.id,
    label: area.label,
    questions: area.questions.map(questionId => {
      const question = QUESTIONS[questionId]
      return {
        questionId,
        text: question.text,
        options: toPublicOptions(question.options),
      }
    }),
  }))

  // Q0 demographics — not scored, returned as-is (worldZone may be empty).
  const demographics = {
    portSize: {
      text: DEMOGRAPHICS.portSize.text,
      options: toPublicOptions(DEMOGRAPHICS.portSize.options),
    },
    worldZone: {
      text: DEMOGRAPHICS.worldZone.text,
      options: toPublicOptions(DEMOGRAPHICS.worldZone.options),
    },
  }

  return { areas, demographics }
}
