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
  damageBill:        Number,                            // D14
  expectedProtection: Number,                          // %
  strategyScore:     Number,                           // whole %
  coinsThatHelped:   Number,
  heldCost:          Number,                           // total cost of cards held this round
  cultureLevel:      String,                           // effective band that applied
}, { _id: false })

const teamStrategySchema = new Schema({
  sessionCode:     { type: String, required: true },
  group:           { type: String, required: true },
  portId:          { type: String, required: true }, // string slug (e.g. 'nord-maris')

  startingBand:    { type: String, enum: ['reactive', 'aware', 'developing', 'proactive', null], default: null },
  portfolio:       { type: [Number], default: [] },
  coins:           { type: Number, default: 6 },
  roundStartCoins: { type: Number, default: 6 },
  currentRound:    { type: Number, default: 1 },
  roundLocked:     { type: Boolean, default: false },
  roundBought:     { type: [Number], default: [] },
  roundReturned:   { type: Number, default: null },

  rounds:          { type: [roundSchema], default: [] },
}, { timestamps: true })

teamStrategySchema.index({ sessionCode: 1, group: 1 }, { unique: true })

export default model('TeamStrategy', teamStrategySchema)
