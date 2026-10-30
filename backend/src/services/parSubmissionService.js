import ParIndexResult from '../models/ParIndexResult.js'
import { computeParIndex, getBand } from './scoringService.js'
import { CAP_DIMENSIONS, CAP_GROUP_COLORS } from '../config/capBreakdown.js'

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
    .select('group score band areas portSize governance climateZone coastalSetting -_id')
    .sort({ score: -1 })
  const individual = all.map(r => ({
    group: r.group,
    score: r.score,
    band:  r.band,
    areas: r.areas,
  }))
  return { individual, groups: computeParGroups(individual), breakdowns: computeCapBreakdowns(all) }
}

const SUMMARY_AREA_KEYS = ['governance', 'organisation', 'budget', 'measures', 'preparedness']

// ── CAP breakdown by a profile dimension (port size / governance / …) ────────
// Pure + testable. `results` are per-participant records with a `score`, an
// `areas` map and the dimension's field. Returns every non-empty group (n ≥ 1);
// participants with no answer for this field are not in any group but are counted
// in `noAnswerCount` and still folded into `roomMean`. Each group returns only
// AGGREGATES (n, mean, areaMeans) — no per-participant scores, ids, names or teams.
const round1cap = x => Math.round(x * 10) / 10

export function computeCapBreakdown(results = [], dimensionKey) {
  const dim = CAP_DIMENSIONS[dimensionKey]
  if (!dim) return null
  const all = results.filter(r => r && typeof r.score === 'number')
  const roomMean = all.length ? Math.round(all.reduce((s, r) => s + r.score, 0) / all.length) : 0

  const buckets = new Map(dim.groups.map(g => [g.key, []]))
  for (const r of all) {
    const v = r[dim.field]
    if (buckets.has(v)) buckets.get(v).push(r)
  }

  const groups = []
  dim.groups.forEach((g, i) => {
    const recs = buckets.get(g.key) || []
    if (recs.length === 0) return // leave out empty groups only
    // Aggregates only — no per-participant scores leave the server (the only
    // consumer, the "every participant" chart, was removed).
    const mean = Math.round(recs.reduce((s, r) => s + r.score, 0) / recs.length)
    const areaMeans = SUMMARY_AREA_KEYS.map(k => round1cap(recs.reduce((s, r) => s + (r.areas?.[k] ?? 0), 0) / recs.length))
    groups.push({ key: g.key, label: g.label, color: CAP_GROUP_COLORS[i], n: recs.length, mean, areaMeans })
  })

  // Participants with no answer for this field: not in any group, still in roomMean.
  const noAnswerCount = all.filter(r => !buckets.has(r[dim.field])).length

  let biggestGapArea = null
  if (groups.length >= 2) {
    for (let a = 0; a < SUMMARY_AREA_KEYS.length; a++) {
      const vals = groups.map(g => g.areaMeans[a])
      const gap = round1cap(Math.max(...vals) - Math.min(...vals))
      if (!biggestGapArea || gap > biggestGapArea.gap) biggestGapArea = { area: a, gap }
    }
  }

  return { dimension: dimensionKey, field: dim.field, title: dim.title, byLabel: dim.byLabel, prompt: dim.prompt, groups, roomMean, noAnswerCount, biggestGapArea }
}

// All four dimensions at once, for the results payload.
export function computeCapBreakdowns(results = []) {
  return Object.fromEntries(Object.keys(CAP_DIMENSIONS).map(k => [k, computeCapBreakdown(results, k)]))
}

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
