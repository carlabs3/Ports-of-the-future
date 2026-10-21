import ParIndexResult from '../models/ParIndexResult.js'
import { computeParIndex, getBand } from './scoringService.js'

// Persistence layer for PAR Index submissions. Depends only on models/ and
// scoringService — never on routes/ — so both the HTTP router and the socket
// layer can reuse it without the sockets depending on the routes.

// Persist a submission idempotently and return the computed result.
export async function persistParSubmission({ submissionId, sessionCode, group, portSize, governance, climateZone, coastalSetting, answers, participantId }) {
  const result = computeParIndex(answers)

  const resolvedId = submissionId || `${sessionCode}_${group}`
  const filter = { submissionId: resolvedId }
  const updateDoc = {
    submissionId: resolvedId,
    sessionCode,
    group,
    portSize: portSize || '',
    governance: governance || '',
    climateZone: climateZone || '',
    coastalSetting: coastalSetting || '',
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
    const band = getBand(avgScore)
    // `band` = band of the mean PARI (phase-4 display). `cultureBand` = the
    // phase-2 base culture band; identical now, but phase 7 will bump it +1 if
    // the table buys measure 19/20, so it is exposed as its own field.
    return { group, count: scores.length, avgScore, band, cultureBand: band }
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

const SUMMARY_AREA_KEYS = ['governance', 'organisation', 'budget', 'measures', 'preparedness']
const SUMMARY_BANDS = ['reactive', 'aware', 'developing', 'proactive']

// Pure, testable: build the aggregate PARI summary from the session's results.
// Returns null when there are no results. Bands are derived with getBand
// (single source of truth) — no thresholds duplicated here.
export function computeSessionSummary(individual) {
  if (!Array.isArray(individual) || individual.length === 0) return null

  const scores = individual.map(r => r.score).sort((a, b) => a - b)
  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length
  const round1 = x => Math.round(x * 10) / 10

  const byArea = {}
  for (const key of SUMMARY_AREA_KEYS) {
    byArea[key] = round1(mean(individual.map(r => r.areas?.[key] ?? 0)))
  }

  const bandDistribution = Object.fromEntries(SUMMARY_BANDS.map(b => [b, 0]))
  for (const r of individual) bandDistribution[getBand(r.score)] += 1

  const byGroup = computeParGroups(individual).map(g => ({
    group: g.group, avgScore: g.avgScore, cultureBand: g.cultureBand,
  }))

  return {
    totalParticipants: individual.length,
    averageScore: round1(mean(scores)),
    medianScore:  scores[Math.floor(scores.length / 2)],
    minScore:     scores[0],
    maxScore:     scores[scores.length - 1],
    byArea,
    bandDistribution,
    byGroup,
    calculatedAt: new Date(),
  }
}

// Thin DB wrapper: read the session's results and build the summary.
export async function buildSessionSummary(sessionCode) {
  const all = await ParIndexResult.find({ sessionCode }).select('group score areas -_id')
  return computeSessionSummary(all.map(r => ({ group: r.group, score: r.score, areas: r.areas })))
}
