import { Schema, model } from 'mongoose'

const sessionSchema = new Schema({
  code: { type: String, required: true, unique: true },
  facilitatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: '' },
  groups: [String],
  // Which port each group defends. portId is a string slug (v4, e.g.
  // 'nord-maris'). Legacy v3 sessions stored a numeric portId.
  portAssignments: [{ group: String, portId: String }],
  // Workshop content version this session was created with. v4 sessions set
  // 'v4'; older (test) sessions have it undefined and are flagged as legacy.
  configVersion: { type: String, default: null },
  status: { type: String, enum: ['draft', 'waiting', 'active', 'actions', 'closed'], default: 'draft' },
  // Facilitator-driven control-centre phase (Ports of the Future). Manual only —
  // never derived from data. Independent of `currentStep`/STEP_MAP (legacy).
  phase: { type: String, enum: ['join', 'par', 'teams', 'strategy', 'wheel', 'debrief'], default: 'join' },
  currentStep: { type: Number, default: 2 },
  resultsRevealed: { type: Boolean, default: false },
  step3Revealed:   { type: Boolean, default: false },
  winnersRevealed: { type: Boolean, default: false },
  // Aggregate PARI summary, computed and stored on session close.
  summary: {
    totalParticipants: Number,
    averageScore: Number,
    medianScore:  Number,
    minScore:     Number,
    maxScore:     Number,
    byArea: {
      governance:   Number,
      organisation: Number,
      budget:       Number,
      measures:     Number,
      preparedness: Number,
    },
    bandDistribution: {
      reactive:   Number,
      aware:      Number,
      developing: Number,
      proactive:  Number,
    },
    byGroup: [{ group: String, avgScore: Number, cultureBand: String }],
    calculatedAt: Date,
  },
}, { timestamps: true })

export default model('Session', sessionSchema)
