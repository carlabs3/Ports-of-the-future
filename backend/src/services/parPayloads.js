import { EVENT_CODES, EVENTS_BY_CODE } from '../config/events.js'
import { MEASURES_BY_ID } from '../config/measures.js'
import { applyCultureMeasureBonus } from './cultureService.js'
import { topExposureEvents } from './wheelService.js'
import { roundPotentialM, roundDamageM } from './roundMoney.js'

// Pure builders for the facilitator-facing round payloads. Extracted from the
// routes so the secrecy rules can be unit-tested without a DB/HTTP harness:
//   • D3 — a round's wheel may be revealed only once every team has locked it.
//   • D4 — a payload exposes at most the DRAWN event's own potential loss (€M)
//          and the current round's likelihoods (J1: losses are the same for every
//          port, so there is no secret per-port table to hide any more).
// None of these ever expose the best-strategy combinations.

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
// inside `entry`, ONLY the drawn event's potential loss/damage (D4).
export function buildDrawPayload({ port, group, round, eventCode, entry }) {
  const L = roundLikelihoods(port, round)
  // Normalise the entry's money to € millions through the shared helpers, so the
  // post-spin view reads the same figures as standings and the debrief.
  const o = plainRound(entry)
  const normEntry = o ? { ...o, damageBill: roundDamageM(o), potentialLossM: roundPotentialM(o) } : o
  return {
    group,
    portName:           port?.name || null,
    round,
    eventCode,
    eventName:          EVENTS_BY_CODE[eventCode]?.name || eventCode,
    exposure:           exposureSlices(port, round),
    illustrationMotifs: topExposureEvents(L),
    entry:              normEntry,
  }
}

// /outcomes — round snapshots for ONE team (ranking/debrief source). Each round
// entry carries only the drawn event's own potential loss, never a full table.
export function buildOutcomesTeam(team, port) {
  return {
    group:    team.group,
    portName: port?.name || null,
    rounds:   (team.rounds || []).map(plainRound),
  }
}

// Debrief — round snapshots (with event names) + ranking. Money per round is in
// € millions (J3): the drawn event's potential loss and the damage bill. With one
// loss per event (J1) there is no secret per-port impact table to reveal here.
export function buildDebriefTeam({ team, port, rankRow = {} }) {
  // J3: expose per-round money in € millions so the UI never sees coin-era units.
  const rounds = (team.rounds || []).map(r => {
    const o = plainRound(r)
    return {
      ...o,
      damageBill:     roundDamageM(o),
      potentialLossM: roundPotentialM(o),
      eventName:      o.drawnEvent ? (EVENTS_BY_CODE[o.drawnEvent]?.name || o.drawnEvent) : null,
    }
  })
  return {
    group:              team.group,
    portName:           port?.name || null,
    portDesc:           port?.description || '', // location line (view B header)
    portImage:          port?.image || null,     // port photo (debrief views)
    startingBand:       team.startingBand ?? null, // "started <Level>" (view B header)
    rank:               rankRow.rank ?? null,
    finalScore:         rankRow.finalScore ?? 0,     // mean of the 3 strategy scores (skill)
    totalDamage:        rankRow.totalDamage ?? 0,    // sum of the 3 damages (luck)
    totalPotential:     rankRow.totalPotential ?? 0, // Σ potential loss (F2)
    avoidedPctRaw:      rankRow.avoidedPctRaw ?? 0,   // raw avoided ratio (F2 — ranking/awards)
    portfolio:          portfolioCards(team.portfolio),
    rounds,
    illustrationMotifs: topExposureEvents(roundLikelihoods(port, 1)),
  }
}
