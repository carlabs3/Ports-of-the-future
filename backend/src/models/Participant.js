import { Schema, model } from 'mongoose'

// Participants identify only by team (group). Age/gender were removed (B2).
// MIGRATION NOTE: existing documents may still carry `age`/`gender` strings —
// they are simply ignored (not in the schema, never read or written). No
// backfill or drop is required; they age out whenever a session is deleted.
const participantSchema = new Schema({
  sessionCode: { type: String, required: true },
  group: { type: String, required: true },
  socketId: { type: String, default: null },
}, { timestamps: true })

export default model('Participant', participantSchema)
