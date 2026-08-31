import { Schema, model } from 'mongoose'

const sessionSchema = new Schema({
  code: { type: String, required: true, unique: true },
  facilitatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: '' },
  groups: [String],
  // Phase 6 (Ports of the Future): which port each group defends. Additive —
  // legacy sessions simply have an empty array.
  portAssignments: [{ group: String, portId: Number }],
  status: { type: String, enum: ['draft', 'waiting', 'active', 'actions', 'closed'], default: 'draft' },
  // Facilitator-driven control-centre phase (Ports of the Future). Manual only —
  // never derived from data. Independent of `currentStep`/STEP_MAP (legacy).
  phase: { type: String, enum: ['join', 'par', 'strategy', 'wheel', 'debrief'], default: 'join' },
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
