import { MEASURES_BY_ID } from '../config/measures.js'
import { PORTS_BY_ID } from '../config/ports/index.js'
import { EVENTS_BY_CODE } from '../config/events.js'
import { applyCultureMeasureBonus } from './cultureService.js'
import {
  computePreparedness, computeExpectedLossesAvoided, computeDamageBill, computeCoinsThatHelped,
} from './preparednessService.js'
import { computeStrategyScore } from './strategyService.js'

// Round rules (workshop v4). Pure state transitions on a plain `state` object so
// the whole 3-round flow is testable without a DB. The endpoints map the Mongoose
// doc to/from this shape. The strategy-score denominator uses the CUMULATIVE
// budget 6/8/10, independent of coins actually lost on returns.
export const ROUND_BUDGET = [6, 8, 10]

const roundSpun = (state) => state.rounds.some(r => r.round === state.currentRound)

// Buy one card into the portfolio this round.
export function buyCard(state, measureId) {
  if (state.roundLocked) return { ok: false, error: 'This round is locked.' }
  const m = MEASURES_BY_ID[measureId]
  if (!m) return { ok: false, error: `Measure ${measureId} does not exist.` }
  if (!(PORTS_BY_ID[state.portId]?.deck || []).includes(measureId)) {
    return { ok: false, error: `Measure ${measureId} is not in this port's deck.` }
  }
  if (state.portfolio.includes(measureId)) return { ok: false, error: `The team already holds measure ${measureId}.` }
  if (m.cost > state.coins) return { ok: false, error: `Not enough coins: measure ${measureId} costs ${m.cost}, ${state.coins} left.` }
  state.portfolio.push(measureId)
  state.coins -= m.cost
  state.roundBought.push(measureId)
  return { ok: true }
}

// Return one card (rounds 2 & 3 only, at most one per round). Refund = floor(cost/2).
export function returnCard(state, measureId) {
  if (state.roundLocked) return { ok: false, error: 'This round is locked.' }
  if (state.currentRound === 1) return { ok: false, error: 'Cards can only be returned in rounds 2 and 3.' }
  if (state.roundReturned != null) return { ok: false, error: 'Only one card may be returned per round.' }
  if (!state.portfolio.includes(measureId)) return { ok: false, error: `The team does not hold measure ${measureId}.` }
  const refund = Math.floor((MEASURES_BY_ID[measureId]?.cost || 0) / 2)
  state.portfolio = state.portfolio.filter(id => id !== measureId)
  state.coins += refund
  state.roundReturned = measureId
  return { ok: true, refund }
}

// Lock the current round. Needs a starting culture level (from PARI or chosen).
export function lockRound(state) {
  if (state.startingBand == null) return { ok: false, error: 'Set the team\'s starting culture level first.' }
  state.roundLocked = true
  return { ok: true }
}

// Unlock — allowed only before this round's spin.
export function unlockRound(state) {
  if (roundSpun(state)) return { ok: false, error: 'This round has already been spun and cannot be unlocked.' }
  state.roundLocked = false
  return { ok: true }
}

// Record a spin for the current round: compute P, losses avoided, damage bill,
// expected protection, strategy score, coins that helped, and append the snapshot.
export function recordSpin(state, event) {
  if (roundSpun(state)) return { ok: false, error: 'This round has already been spun.' }
  const port = PORTS_BY_ID[state.portId]
  const effBand = applyCultureMeasureBonus(state.startingBand, state.portfolio)
  const prep = computePreparedness({ measureIds: state.portfolio, eventCode: event, cultureBand: effBand })
  const lossValue = EVENTS_BY_CODE[event]?.lossValue ?? 0
  const expected = computeExpectedLossesAvoided({ measures: state.portfolio, cultureBand: state.startingBand, exposureWeights: port?.exposureWeights || {} })
  const budget = ROUND_BUDGET[state.currentRound - 1]
  const coinsSpent = state.roundBought.reduce((s, id) => s + (MEASURES_BY_ID[id]?.cost || 0), 0)
  const refund = state.roundReturned != null ? Math.floor((MEASURES_BY_ID[state.roundReturned]?.cost || 0) / 2) : 0
  const entry = {
    round:               state.currentRound,
    bought:              [...state.roundBought],
    returned:            state.roundReturned,
    coinsStart:          state.roundStartCoins,
    coinsSpent,
    refund,
    coinsLeft:           state.coins,
    drawnEvent:          event,
    rawLossesAvoidedPct: prep.rawLossesAvoidedPct,
    lossesAvoidedPct:    prep.lossesAvoidedPct,
    damageBill:          computeDamageBill(lossValue, prep.rawPreparedness),
    expectedProtection:  expected,
    strategyScore:       computeStrategyScore({ expectedProtection: expected, portId: state.portId, startingBand: state.startingBand, budget }),
    coinsThatHelped:     computeCoinsThatHelped({ measures: state.portfolio, event }),
    cultureLevel:        effBand,
  }
  state.rounds.push(entry)
  return { ok: true, entry }
}

// Advance to the next round: +2 coins, reset the round's working state.
export function advanceRound(state) {
  if (state.currentRound >= 3) return { ok: false, error: 'All three rounds are complete.' }
  if (!roundSpun(state)) return { ok: false, error: 'The current round has not been spun yet.' }
  state.currentRound += 1
  state.coins += 2
  state.roundStartCoins = state.coins
  state.roundLocked = false
  state.roundBought = []
  state.roundReturned = null
  return { ok: true }
}
