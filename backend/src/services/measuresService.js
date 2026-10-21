import { MEASURES, MEASURES_BY_ID } from '../config/measures.js'

// Each table has a fixed budget of 6 coins.
export const MEASURE_BUDGET = 6

// Sum of costs of the given measure ids. Assumes ids are valid.
export function costOfMeasures(measureIds = []) {
  return (measureIds || []).reduce((sum, id) => sum + (MEASURES_BY_ID[id]?.cost || 0), 0)
}

// Validate a measure selection: all ids exist and total cost <= budget.
// Pure and testable. Returns { ok, cost, error }.
export function validateMeasureSelection(measureIds = []) {
  if (!Array.isArray(measureIds)) {
    return { ok: false, cost: 0, error: 'measures debe ser un array de ids' }
  }
  for (const id of measureIds) {
    if (!MEASURES_BY_ID[id]) return { ok: false, cost: 0, error: `Medida inexistente: ${id}` }
  }
  const cost = costOfMeasures(measureIds)
  if (cost > MEASURE_BUDGET) {
    return { ok: false, cost, error: `Coste total ${cost} supera el presupuesto de ${MEASURE_BUDGET} fichas` }
  }
  return { ok: true, cost }
}

// Public catalogue: id, name, cost, and the (non-secret) raisesCultureLevel flag
// so the strategy UI can flag the enablers (#19/#20). protection scores stay
// SECRET until scoring — explicit field copy, never spread the measure object.
export function getPublicMeasures() {
  return MEASURES.map(m => ({ id: m.id, name: m.name, cost: m.cost, raisesCultureLevel: !!m.raisesCultureLevel }))
}
