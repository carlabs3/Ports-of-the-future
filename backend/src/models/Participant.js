import { Schema, model } from 'mongoose'

const participantSchema = new Schema({
  sessionCode: { type: String, required: true },
  group: { type: String, required: true },
  age:    { type: String, default: '' },
  gender: { type: String, default: '' },
  socketId: { type: String, default: null },
}, { timestamps: true })

export default model('Participant', participantSchema)
