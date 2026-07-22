import ParIndexResult from '../models/ParIndexResult.js'
import { getBand } from './scoringService.js'

// Culture band for a table (phase 2). Phase 6 computes the BASE band from the
// table's mean PARI only. getBand is the single source of truth for band
// boundaries — no thresholds are written here.
//
// TODO Fase 7: ajuste +1 nivel si la mesa compra measure 19 o 20.

// Pure, testable: mean of the given scores → band. Returns null when empty.
export function computeCultureBandFromScores(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return null
  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
  return getBand(avg)
}

// Thin DB wrapper: read the table's PARI scores and derive the base band.
export async function computeCultureBand(sessionCode, group) {
  const docs = await ParIndexResult.find({ sessionCode, group }).select('score -_id')
  return computeCultureBandFromScores(docs.map(d => d.score))
}
