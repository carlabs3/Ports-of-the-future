import { EVENT_CODES, EVENTS_BY_CODE } from '../config/events.js'
import { MEASURES_BY_ID } from '../config/measures.js'
import { applyCultureMeasureBonus } from './cultureService.js'
import { topExposureEvents } from './wheelService.js'
import { impactsForRound } from './preparednessService.js'

// Pure builders for the facilitator-facing round payloads. Extracted from the
// routes so the secrecy rules can be unit-tested without a DB/HTTP harness:
//   • D3 — a round's wheel may be revealed only once every team has locked it.
//   • D4 — the full per-event impact table is revealed ONLY at the debrief; every
//          other payload exposes at most the DRAWN event's single impact.
// None of these ever expose the best-strategy combinations or a port's secret
// impact table (outside the debrief builder).

// A port's per-round wheel likelihoods (percent, sum 100). Secret during play.
export function roundLikelihoods(port, round) {
  return port?.wheels?.[round]?.likelihoods || {}
}

// Wheel slices for the renderer: [{ code, name, weight }] where weight is the
// round's likelihood (percent). The impact table is NEVER included here.
export function exposureSlices(port, round) {
  const L = roundLikelihoods(port, round)
  return EVENT_CODES.map(c => ({ code: c, name: EVENTS_BY_CODE[c]?.name || c, weight: L[c] || 0 }))
}

const portfolioCards = (ids = []) =>
  ids.map(id => ({ id, name: MEASURES_BY_ID[id]?.name || `Measure ${id}`, cost: MEASURES_BY_ID[id]?.cost ?? null }))

const plainRound = (r) => (r && r.toObject ? r.toObject() : r)

// D3: round r's wheel may be revealed only once EVERY team has LOCKED round r.
// A team has "locked round r" if it has already spun that round, or it is on
// round r with the round locked. With no teams, nothing may be revealed.
export function canRevealWheel(strategies, round) {
  return Array.isArray(strategies) && strategies.length > 0 && strategies.every(s =>
    (s.rounds || []).some(r => r.round === round) || (s.currentRound === round && s.roundLocked))
}

// /wheel — pre-spin wheel composition for ONE team. Caller MUST gate on
// canRevealWheel first; this builder assumes the reveal is allowed. Exposes the
// round's likelihoods only — never the impact table.
export function buildWheelPayload({ port, doc, round }) {
  const L = roundLikelihoods(port, round)
  const spun = (doc.rounds || []).find(r => r.round === round)
  return {
    group:              doc.group,
    portName:           port?.name || null,
    exposure:           exposureSlices(port, round), // [{code,name,weight}] — weights sum 100
    portfolio:          [...(doc.portfolio || [])],
    cultureLevel:       applyCultureMeasureBonus(doc.startingBand, doc.portfolio),
    illustrationMotifs: topExposureEvents(L),
    currentRound:       round,
    drawnThisRound:     !!spun,
    eventCode:          spun?.drawnEvent || null,
  }
}

// /draw — post-spin outcome for ONE team. Carries the round's likelihoods and,
// inside `entry`, ONLY the drawn event's impact/damage (D4) — never the table.
export function buildDrawPayload({ port, group, round, eventCode, entry }) {
  const L = roundLikelihoods(port, round)
  return {
    group,
    portName:           port?.name || null,
    round,
    eventCode,
    eventName:          EVENTS_BY_CODE[eventCode]?.name || eventCode,
    exposure:           exposureSlices(port, round),
    illustrationMotifs: topExposureEvents(L),
    entry,
  }
}

// /outcomes — round snapshots for ONE team (ranking/debrief source). Each round
// entry carries only the drawn event's impact, never the full table.
export function buildOutcomesTeam(team, port) {
  return {
    group:    team.group,
    portName: port?.name || null,
    rounds:   (team.rounds || []).map(plainRound),
  }
}

// Debrief — the ONLY payload that reveals a port's full per-round impact table
// ("Impact by port"). Round snapshots (with event names) + ranking + the impact
// table per round. The game is over, so the previously-secret impacts are shown.
export function buildDebriefTeam({ team, port, rankRow = {} }) {
  const rounds = (team.rounds || []).map(r => {
    const o = plainRound(r)
    return { ...o, eventName: o.drawnEvent ? (EVENTS_BY_CODE[o.drawnEvent]?.name || o.drawnEvent) : null }
  })
  const impactsByRound = {}
  for (const round of [1, 2, 3]) impactsByRound[round] = impactsForRound(port, round)
  return {
    group:              team.group,
    portName:           port?.name || null,
    portDesc:           port?.description || '', // location line (view B header)
    startingBand:       team.startingBand ?? null, // "started <Level>" (view B header)
    rank:               rankRow.rank ?? null,
    finalScore:         rankRow.finalScore ?? 0,     // mean of the 3 strategy scores (skill)
    totalDamage:        rankRow.totalDamage ?? 0,    // sum of the 3 damages (luck)
    totalPotential:     rankRow.totalPotential ?? 0, // Σ impact (F2)
    avoidedPctRaw:      rankRow.avoidedPctRaw ?? 0,   // raw avoided ratio (F2 — ranking/awards)
    portfolio:          portfolioCards(team.portfolio),
    rounds,
    impactsByRound,                                 // full impact table — DEBRIEF ONLY
    illustrationMotifs: topExposureEvents(roundLikelihoods(port, 1)),
  }
}
