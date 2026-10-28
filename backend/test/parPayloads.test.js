// Secrecy rules for the facilitator round payloads (D3 + D4), tested on the pure
// builders — no DB/HTTP harness needed.
//   D3: a round's wheel is revealed only once every team has locked that round.
//   D4: the full per-event impact table appears ONLY in the debrief payload; every
//       other payload exposes at most the DRAWN event's single impact, and only
//       the current round's likelihoods.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PORTS_BY_ID } from '../src/config/ports/index.js'
import { EVENT_CODES } from '../src/config/events.js'
import { impactsForRound } from '../src/services/preparednessService.js'
import {
  canRevealWheel, buildWheelPayload, buildDrawPayload, buildOutcomesTeam, buildDebriefTeam,
} from '../src/services/parPayloads.js'

const PORT = PORTS_BY_ID['nord-maris'] // R1 and R2 differ (HW 10 vs 15)

// An object shaped like a raw event-keyed numeric map (an impact table OR a raw
// likelihoods map) — exactly what must not leak outside the debrief.
const isEventMap = (o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false
  const keys = Object.keys(o)
  return keys.length >= 2 && keys.every(k => EVENT_CODES.includes(k) && typeof o[k] === 'number')
}
const allObjects = (o, acc = []) => {
  if (o && typeof o === 'object') { acc.push(o); for (const v of Object.values(o)) allObjects(v, acc) }
  return acc
}
const leaksEventMap = (payload) => allObjects(payload).some(isEventMap)
const exposureMap = (payload) => Object.fromEntries((payload.exposure || []).map(s => [s.code, s.weight]))
const asLikelihoodMap = (likelihoods) => Object.fromEntries(EVENT_CODES.map(c => [c, likelihoods[c] || 0]))

const team = (over = {}) => ({
  group: 'Table 1', portId: 'nord-maris', startingBand: 'aware',
  portfolio: [8, 10, 19], currentRound: 1, roundLocked: false, rounds: [], ...over,
})

// ── D3 · canRevealWheel ──────────────────────────────────────────────────────
test('canRevealWheel: no teams never reveals', () => {
  assert.equal(canRevealWheel([], 1), false)
  assert.equal(canRevealWheel(null, 1), false)
})

test('canRevealWheel round 1: true only when every team has locked round 1', () => {
  const locked = team({ roundLocked: true })
  const spun = team({ group: 'T2', rounds: [{ round: 1 }], roundLocked: true })
  const open = team({ group: 'T3', roundLocked: false })
  assert.equal(canRevealWheel([locked, spun], 1), true)
  assert.equal(canRevealWheel([locked, spun, open], 1), false) // T3 not locked
})

test('canRevealWheel round 2: a team still on round 1 blocks the round-2 reveal', () => {
  const onR2Locked = team({ currentRound: 2, roundLocked: true, rounds: [{ round: 1 }] })
  const spunR2 = team({ group: 'T2', currentRound: 2, roundLocked: true, rounds: [{ round: 1 }, { round: 2 }] })
  const stillR1 = team({ group: 'T3', currentRound: 1, roundLocked: true, rounds: [] })
  assert.equal(canRevealWheel([onR2Locked, spunR2], 2), true)
  assert.equal(canRevealWheel([onR2Locked, spunR2, stillR1], 2), false)
})

// ── D4 · the impact table never leaks outside the debrief ────────────────────
test('wheel / draw / outcomes payloads never contain a raw event map (impacts or likelihoods)', () => {
  const doc = team({ roundLocked: true })
  const wheel = buildWheelPayload({ port: PORT, doc, round: 1 })
  const entry = { round: 1, drawnEvent: 'SS', impact: 5, damageBill: 2.5, strategyScore: 70 }
  const draw = buildDrawPayload({ port: PORT, group: doc.group, round: 1, eventCode: 'SS', entry })
  const outcomes = buildOutcomesTeam(team({ rounds: [entry] }), PORT)

  assert.equal(leaksEventMap(wheel), false, 'wheel leaks an event map')
  assert.equal(leaksEventMap(draw), false, 'draw leaks an event map')
  assert.equal(leaksEventMap(outcomes), false, 'outcomes leaks an event map')
  // The only impact present in the draw payload is the drawn event's single value.
  assert.equal(draw.entry.impact, 5)
  assert.equal('impactsByRound' in draw, false)
  assert.equal('impactsByRound' in outcomes, false)
})

test('the debrief payload IS the one place the full per-round impact table appears', () => {
  const t = team({ rounds: [{ round: 1, drawnEvent: 'SS', impact: 5, damageBill: 2.5, strategyScore: 70 }] })
  const debrief = buildDebriefTeam({ team: t, port: PORT, rankRow: { rank: 1, finalScore: 70, totalDamage: 2.5 } })
  assert.ok(debrief.impactsByRound, 'debrief must expose impactsByRound')
  for (const round of [1, 2, 3]) {
    assert.deepEqual(debrief.impactsByRound[round], impactsForRound(PORT, round), `round ${round} impacts`)
  }
  // Round 3 reveals the +1 bump (nord-maris: RF, HW) that was hidden in play.
  assert.equal(debrief.impactsByRound[3].RF, impactsForRound(PORT, 1).RF + 1)
})

// ── D4 · only the current round's likelihoods are exposed ────────────────────
test('a round-1 payload exposes round-1 likelihoods only, not later rounds', () => {
  const doc = team({ roundLocked: true })
  const wheel = buildWheelPayload({ port: PORT, doc, round: 1 })
  const got = exposureMap(wheel)
  assert.deepEqual(got, asLikelihoodMap(PORT.wheels[1].likelihoods))
  assert.notDeepEqual(got, asLikelihoodMap(PORT.wheels[2].likelihoods)) // R1 ≠ R2 (HW)
  assert.notDeepEqual(got, asLikelihoodMap(PORT.wheels[3].likelihoods))
})

test('outcomes carries round snapshots only — no wheel/likelihoods at all', () => {
  const outcomes = buildOutcomesTeam(team({ rounds: [{ round: 1, drawnEvent: 'SS', impact: 5 }] }), PORT)
  assert.equal('exposure' in outcomes, false)
  assert.deepEqual(Object.keys(outcomes).sort(), ['group', 'portName', 'rounds'])
})
