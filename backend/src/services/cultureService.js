import ParIndexResult from '../models/ParIndexResult.js'
import { getBand } from './scoringService.js'
import { MEASURES } from '../config/measures.js'

// Culture band for a table (phase 2). The BASE band comes from the table's mean
// PARI (getBand — the single source of truth for band boundaries). The EFFECTIVE
// band applies the culture-measure bonus on top. applyCultureMeasureBonus works
// on band NAMES only, never on numeric thresholds.

// Band order, lowest → highest.
export const BAND_ORDER = ['reactive', 'aware', 'developing', 'proactive']

// Pure, testable: mean of the given scores → band. Returns null when empty.
export function computeCultureBandFromScores(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return null
  const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
  return getBand(avg)
}

// Pure, testable: raise the base band ONE level if the table bought any
// culture-raising measure. Buying #19 AND #20 is still a SINGLE step up — not
// two. Capped at 'proactive'. null base → null. Which measures raise the band
// is read from config (raisesCultureLevel flag), not hardcoded ids.
export function applyCultureMeasureBonus(baseBand, measureIds = []) {
  if (baseBand == null) return null
  const idx = BAND_ORDER.indexOf(baseBand)
  if (idx === -1) return baseBand // unknown band → pass through unchanged

  const raisingIds = new Set(MEASURES.filter(m => m.raisesCultureLevel).map(m => m.id))
  const raises = (measureIds || []).some(id => raisingIds.has(id))
  if (!raises) return baseBand

  // Single step up, capped at the top band.
  return BAND_ORDER[Math.min(idx + 1, BAND_ORDER.length - 1)]
}

// Thin DB wrapper: read the table's PARI scores and derive the BASE band.
export async function computeCultureBand(sessionCode, group) {
  const docs = await ParIndexResult.find({ sessionCode, group }).select('score -_id')
  return computeCultureBandFromScores(docs.map(d => d.score))
}

// EFFECTIVE band: base (live PARI) + measure bonus. Recomputes fresh so it stays
// correct regardless of whether measures were entered before or after PARs.
export async function computeEffectiveCultureBand(sessionCode, group, measureIds = []) {
  const base = await computeCultureBand(sessionCode, group)
  return applyCultureMeasureBonus(base, measureIds)
}
