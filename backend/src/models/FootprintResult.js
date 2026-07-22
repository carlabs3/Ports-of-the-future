import { Schema, model } from 'mongoose'

const footprintResultSchema = new Schema({
  sessionCode:   { type: String, required: true },
  submissionId:  { type: String, unique: true, sparse: true },
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant' },
  group:         { type: String, required: true },
  age:           { type: String, default: '' },
  gender:        { type: String, default: '' },
  carbonTons:    { type: Number, required: true },
  areas: {
    transport:      Number,
    energy:         Number,
    food:           Number,
    consumption:    Number,
    waste:          Number,
    publicServices: Number,
  },
  category: { type: String, enum: ['bajo', 'medio', 'alto', 'muy alto'] },
  answers:  { type: Schema.Types.Mixed },
}, { timestamps: true })

export default model('FootprintResult', footprintResultSchema)
