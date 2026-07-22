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
  currentStep: { type: Number, default: 2 },
  resultsRevealed: { type: Boolean, default: false },
  step3Revealed:   { type: Boolean, default: false },
  winnersRevealed: { type: Boolean, default: false },
  summary: {
    totalParticipants: Number,
    averageCarbonTons: Number,
    medianCarbonTons:  Number,
    minCarbonTons:     Number,
    maxCarbonTons:     Number,
    byArea: {
      transport:   Number,
      energy:      Number,
      food:        Number,
      consumption: Number,
      waste:       Number,
    },
    byGroup: [{ group: String, average: Number, count: Number }],
    calculatedAt: Date,
  },
}, { timestamps: true })

export default model('Session', sessionSchema)
