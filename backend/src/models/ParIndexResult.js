import { Schema, model } from 'mongoose'

// PAR Index submission result. Separate collection from FootprintResult —
// this is the "Ports of the Future" questionnaire, not the carbon footprint.
const parIndexResultSchema = new Schema({
  sessionCode:   { type: String, required: true },
  submissionId:  { type: String, unique: true, sparse: true }, // idempotent upsert key
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
  group:         { type: String, required: true },

  // Q0 demographics — not scored
  portSize:      { type: String, default: '' },
  worldZone:     { type: String, default: '' },

  // Computed server-side by computeParIndex
  score:         { type: Number, required: true }, // 0–100
  band:          { type: String, enum: ['reactive', 'aware', 'developing', 'proactive'] },
  areas: {
    governance:   Number,
    organisation: Number,
    budget:       Number,
    measures:     Number,
    preparedness: Number,
  },

  // Chosen optionIds, e.g. { q1: 'q1c', ... }
  answers: { type: Schema.Types.Mixed },

  // Optional, carried from JoinSession if present
  age:    { type: String, default: '' },
  gender: { type: String, default: '' },
}, { timestamps: true })

export default model('ParIndexResult', parIndexResultSchema)
