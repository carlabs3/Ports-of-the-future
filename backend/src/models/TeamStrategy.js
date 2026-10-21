import { Schema, model } from 'mongoose'

// Per-table strategy record for the "Ports of the Future" phase-2 dynamic.
// SEPARATE from the legacy TeamActions (footprint pipeline) — do not conflate.
// In phase 6 it is created with portId (and cultureBand computed from PARI);
// measures / coinsSpent are filled in phase 7.
const teamStrategySchema = new Schema({
  sessionCode: { type: String, required: true },
  group:       { type: String, required: true },
  portId:      { type: String, required: true }, // string slug (v4, e.g. 'nord-maris')
  // Base culture band derived from the table's mean PARI (see cultureService).
  cultureBand: { type: String, enum: ['reactive', 'aware', 'developing', 'proactive', null], default: null },
  measures:    { type: [Number], default: [] }, // phase 7
  coinsSpent:  { type: Number, default: 0 },     // phase 7
  // Locks the table's measures. Once true, measures can't be edited and the
  // table counts toward the "all tables confirmed" gate before the wheel.
  confirmed:   { type: Boolean, default: false },
  // Phase 8 — roulette outcome (snapshot at the moment the wheel was spun).
  drawnEvent:       { type: String, default: null }, // event code, e.g. 'SS'
  preparedness:     { type: Number, default: null }, // 0–10
  lossesAvoidedPct: { type: Number, default: null }, // 0–100
}, { timestamps: true })

teamStrategySchema.index({ sessionCode: 1, group: 1 }, { unique: true })

export default model('TeamStrategy', teamStrategySchema)
