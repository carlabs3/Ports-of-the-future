import ParIndexResult from '../models/ParIndexResult.js'
import { computeParIndex, getBand } from './scoringService.js'

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

// Per-group aggregate: count, average score, and the band of that average.
// The band is derived with getBand — the SINGLE source of truth for band
// boundaries — so no threshold logic ever lives outside scoringService.
export function computeParGroups(individual) {
  const byGroup = new Map()
  for (const r of individual) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, [])
    byGroup.get(r.group).push(r.score)
  }
  return [...byGroup.entries()].map(([group, scores]) => {
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    return { group, count: scores.length, avgScore, band: getBand(avgScore) }
  })
}

// Build the 'par:update' payload: every result in the session (scores/bands/
// areas, no raw data) plus per-group aggregates with a server-computed band.
export async function buildParRanking(sessionCode) {
  const all = await ParIndexResult.find({ sessionCode })
    .select('group score band areas -_id')
    .sort({ score: -1 })
  const individual = all.map(r => ({
    group: r.group,
    score: r.score,
    band:  r.band,
    areas: r.areas,
  }))
  return { individual, groups: computeParGroups(individual) }
}
