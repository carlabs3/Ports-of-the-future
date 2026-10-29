import { MEASURES_BY_ID } from '../config/measures.js'
import { PORTS_BY_ID } from '../config/ports/index.js'
import { roundGrants, cumulativeBudgets, returnPolicy } from '../config/game.js'
import { applyCultureMeasureBonus } from './cultureService.js'
import {
  computePreparedness, computeCoinsThatHelped, expectedProtection, impactsForRound,
} from './preparednessService.js'
import { computeStrategyScoreRaw } from './strategyService.js'

// Round rules (workshop v5). Pure state transitions on a plain `state` object so
// the whole 3-round flow is testable without a DB. The endpoints map the Mongoose
// doc to/from this shape. Budgets and grants come from config/game.js — the
// strategy-score denominator uses the CUMULATIVE budget 6/9/12.
export const ROUND_BUDGET = cumulativeBudgets

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

// Return one held card (G1). Policy comes from config/game.js returnPolicy:
// round 1 has nothing to return; round 2 is 'none' (rejected); round 3 is 'full'
// — any number of held cards, each refunded its FULL cost. Only before the spin
// (409 once the round has been spun, as for unlock). `roundRefund` accumulates
// the coins refunded this round (for the coin meter and the spin record).
export function returnCard(state, measureId) {
  if (roundSpun(state)) return { ok: false, error: 'This round has already been spun.' }
  if (state.roundLocked) return { ok: false, error: 'This round is locked.' }
  const policy = returnPolicy[state.currentRound]
  if (policy === 'none') return { ok: false, error: `Returns are not allowed in round ${state.currentRound}.` }
  if (policy !== 'full') return { ok: false, error: `Cards cannot be returned in round ${state.currentRound}.` }
  if (!state.portfolio.includes(measureId)) return { ok: false, error: `The team does not hold measure ${measureId}.` }
  const refund = MEASURES_BY_ID[measureId]?.cost || 0 // full cost
  state.portfolio = state.portfolio.filter(id => id !== measureId)
  state.coins += refund
  state.roundRefund = (state.roundRefund || 0) + refund
  return { ok: true, refund }
}

// Undo a card bought THIS round, while the round is still open. This is undoing a
// draft purchase, NOT the game's "return": it gives a FULL refund and does NOT
// consume the one-return-per-round allowance. Rejected once the round is locked,
// and for any card not bought this round (e.g. carried over from an earlier
// round — those can only leave via returnCard, in rounds 2 & 3).
export function undoCard(state, measureId) {
  if (state.roundLocked) return { ok: false, error: 'This round is locked.' }
  if (!state.roundBought.includes(measureId)) {
    return { ok: false, error: `Measure ${measureId} was not bought this round and cannot be undone.` }
  }
  const refund = MEASURES_BY_ID[measureId]?.cost || 0
  state.portfolio = state.portfolio.filter(id => id !== measureId)
  state.coins += refund
  state.roundBought = state.roundBought.filter(id => id !== measureId)
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

// Record a spin for the current round (v5): compute P, losses avoided, damage (at
// full precision, using the port+round impact), expected protection (round wheel),
// strategy score, coins that helped, and append the snapshot. New spins store the
// drawn event's `impact`; `lossValue` is no longer written (kept readable for old
// sessions — D4).
export function recordSpin(state, event) {
  if (roundSpun(state)) return { ok: false, error: 'This round has already been spun.' }
  const port = PORTS_BY_ID[state.portId]
  const round = state.currentRound
  const effBand = applyCultureMeasureBonus(state.startingBand, state.portfolio)
  const prep = computePreparedness({ measureIds: state.portfolio, eventCode: event, cultureBand: effBand })

  const likelihoods = port?.wheels?.[round]?.likelihoods || {}
  const impacts = impactsForRound(port, round)
  const impact = impacts[event] ?? 0
  const damage = impact * (1 - prep.rawPreparedness / 10) // full precision (D1)
  const expected = expectedProtection({ measures: state.portfolio, effectiveBand: effBand, likelihoods, impacts })
  // Raw strategy ratio (exp ÷ best, unrounded); strategyScore is its rounded %.
  const strategyRaw = computeStrategyScoreRaw({ expectedProtection: expected, portId: state.portId, round, startingBand: state.startingBand })

  const coinsSpent = state.roundBought.reduce((s, id) => s + (MEASURES_BY_ID[id]?.cost || 0), 0)
  const refund = state.roundRefund || 0 // coins refunded from returns this round (G1)
  // Total coins invested in the cards held this round — the denominator for
  // "coins that helped N of M" and the debrief's "coins that didn't help".
  const heldCost = state.portfolio.reduce((s, id) => s + (MEASURES_BY_ID[id]?.cost || 0), 0)
  const entry = {
    round,
    bought:              [...state.roundBought],
    returned:            state.roundReturned,
    coinsStart:          state.roundStartCoins,
    coinsSpent,
    refund,
    coinsLeft:           state.coins,
    drawnEvent:          event,
    rawLossesAvoidedPct: prep.rawLossesAvoidedPct,
    lossesAvoidedPct:    prep.lossesAvoidedPct,
    damageBill:          damage,          // full precision (display rounds to 1 dp)
    impact,                               // the drawn event's impact this round (v5)
    expectedProtection:  expected,
    strategyScore:       Math.round(strategyRaw * 100), // rounded whole % (back-compat)
    strategyScoreRaw:    strategyRaw,                    // unrounded ratio (ranking + /10 display)
    coinsThatHelped:     computeCoinsThatHelped({ measures: state.portfolio, event }),
    heldCost,
    cultureLevel:        effBand,
  }
  state.rounds.push(entry)
  return { ok: true, entry }
}

// Advance to the next round: grant the round's coins (config roundGrants: +3 in
// rounds 2 and 3), reset the round's working state.
export function advanceRound(state) {
  if (state.currentRound >= 3) return { ok: false, error: 'All three rounds are complete.' }
  if (!roundSpun(state)) return { ok: false, error: 'The current round has not been spun yet.' }
  state.currentRound += 1
  state.coins += roundGrants[state.currentRound - 1] // grant for the new round
  state.roundStartCoins = state.coins
  state.roundLocked = false
  state.roundBought = []
  state.roundReturned = null
  state.roundRefund = 0
  return { ok: true }
}
