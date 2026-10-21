import { Schema, model } from 'mongoose'

// PAR Index submission result. Separate collection from FootprintResult —
// this is the "Ports of the Future" questionnaire, not the carbon footprint.
const parIndexResultSchema = new Schema({
  sessionCode:   { type: String, required: true },
  submissionId:  { type: String, unique: true, sparse: true }, // idempotent upsert key
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
  group:         { type: String, required: true },

  // Q0 demographics — not scored (v4: world zone replaced by governance,
  // climate zone and coastal setting). Values are option ids from the
  // questionnaire config. Legacy docs may still carry `worldZone`; nothing reads
  // it now.
  portSize:       { type: String, default: '' },
  governance:     { type: String, default: '' },
  climateZone:    { type: String, default: '' },
  coastalSetting: { type: String, default: '' },

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

  // MIGRATION NOTE: `age`/`gender` were removed (B2). They were never populated
  // on this collection (persistParSubmission ignored them), so any legacy doc
  // that carries them can be left as-is; nothing reads them.
}, { timestamps: true })

export default model('ParIndexResult', parIndexResultSchema)
