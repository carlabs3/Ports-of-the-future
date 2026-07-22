import { Schema, model } from 'mongoose'

const teamActionsSchema = new Schema({
  sessionCode:    { type: String,  required: true },
  group:          { type: String,  required: true },
  actions:        [String],
  totalReduction: { type: Number,  default: 0 },   // kg CO2
  newCarbonTons:  { type: Number,  default: null }, // tons after reduction
  confirmed:      { type: Boolean, default: false },
}, { timestamps: true })

teamActionsSchema.index({ sessionCode: 1, group: 1 }, { unique: true })

export default model('TeamActions', teamActionsSchema)
