import { Schema, model } from 'mongoose'

// Per-team game record (workshop v4). Three rounds, one spin each.
//   portfolio    = the cards the team currently holds (cumulative across rounds)
//   coins        = coins available to spend right now
//   startingBand = the game-start culture level (from PARI mean, or chosen by the
//                  facilitator if the team has no PARI). Fixed for the game; the
//                  strategy-score denominator uses it. The EFFECTIVE level each
//                  round is startingBand + one step per enabler in the portfolio.
//   rounds[]     = one snapshot per spin (see fields below).
const roundSchema = new Schema({
  round:             Number,
  bought:            { type: [Number], default: [] },
  returned:          { type: Number, default: null },
  coinsStart:        Number,
  coinsSpent:        Number,
  refund:            Number,
  coinsLeft:         Number,
  drawnEvent:        { type: String, default: null },  // event code, e.g. 'SS'
  rawLossesAvoidedPct: Number,                         // full precision
  lossesAvoidedPct:  Number,                           // displayed (0–100, 1 dp)
  damageBill:        Number,                            // full precision damage (€M for eurM entries)
  potentialLossM:    Number,                            // J1: drawn event's potential loss, € millions
  moneyUnit:         { type: String, default: null },   // 'eurM' = money fields are already € millions
  impact:            Number,                            // legacy (coin-era): drawn event's impact 1–5
  expectedProtection: Number,                          // %
  strategyScore:     Number,                           // whole % (round(raw×100))
  strategyScoreRaw:  Number,                           // v5: unrounded exp÷best (ranking + /10)
  coinsThatHelped:   Number,
  heldCost:          Number,                           // total cost of cards held this round
  lossValue:         Number,                           // v4 (old sessions only): the drawn event's loss value
  cultureLevel:      String,                           // effective band that applied
}, { _id: false })

const teamStrategySchema = new Schema({
  sessionCode:     { type: String, required: true },
  group:           { type: String, required: true },
  portId:          { type: String, required: true }, // string slug (e.g. 'nord-maris')

  startingBand:    { type: String, enum: ['reactive', 'aware', 'developing', 'proactive', null], default: null },
  portfolio:       { type: [Number], default: [] },
  coins:           { type: Number, default: 3 },  // round-1 grant (config roundGrants[0])
  roundStartCoins: { type: Number, default: 3 },
  currentRound:    { type: Number, default: 1 },
  roundLocked:     { type: Boolean, default: false },
  roundBought:     { type: [Number], default: [] },
  roundReturned:   { type: Number, default: null },  // legacy (v5 single return)
  roundRefund:     { type: Number, default: 0 },     // G1: coins refunded from returns this round

  rounds:          { type: [roundSchema], default: [] },
}, { timestamps: true })

teamStrategySchema.index({ sessionCode: 1, group: 1 }, { unique: true })

export default model('TeamStrategy', teamStrategySchema)
