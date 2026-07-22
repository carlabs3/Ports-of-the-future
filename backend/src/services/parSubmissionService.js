import ParIndexResult from '../models/ParIndexResult.js'
import { computeParIndex } from './scoringService.js'

// Persistence layer for PAR Index submissions. Depends only on models/ and
// scoringService — never on routes/ — so both the HTTP router and the socket
// layer can reuse it without the sockets depending on the routes.

// Persist a submission idempotently and return the computed result.
export async function persistParSubmission({ submissionId, sessionCode, group, portSize, worldZone, answers, participantId }) {
  const result = computeParIndex(answers)

  const resolvedId = submissionId || `${sessionCode}_${group}`
  const filter = { submissionId: resolvedId }
  const updateDoc = {
    submissionId: resolvedId,
    sessionCode,
    group,
    portSize: portSize || '',
    worldZone: worldZone || '',
    answers: answers || {},
    score: result.score,
    band: result.band,
    areas: result.areas,
    ...(participantId ? { participantId } : {}),
  }

  try {
    await ParIndexResult.findOneAndUpdate(filter, updateDoc, { upsert: true, new: true })
  } catch (err) {
    if (err.code === 11000) {
      // Race between HTTP and socket submission — document exists, just update.
      await ParIndexResult.findOneAndUpdate(filter, updateDoc, { new: true })
    } else {
      throw err
    }
  }

  return result
}

// Build the 'par:update' payload: every result in the session, scores/bands
// only — no answers, no demographics, no raw data.
export async function buildParRanking(sessionCode) {
  const all = await ParIndexResult.find({ sessionCode })
    .select('group score band areas -_id')
    .sort({ score: -1 })
  return {
    individual: all.map(r => ({
      group: r.group,
      score: r.score,
      band:  r.band,
      areas: r.areas,
    })),
  }
}
