import { MEASURES, MEASURES_BY_ID } from '../config/measures.js'

// Legacy flat budget constant. The live round flow uses the cumulative budgets
// (3 / 6 / 9 via config/game.js roundGrants); this constant is used only by this
// service's own validation helpers, which are exercised in tests and not wired
// into the round routes. Left at 6 on purpose — it is not the live budget.
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

// Public catalogue: id, name, cost, the raisesCultureLevel flag (enablers #19/#20),
// and protection-per-event. The protection values are PRINTED ON THE PHYSICAL
// CARDS every table holds, so sending them reveals nothing the room can't already
// read — the card picker shows them as hazard chips. The secret the gate protects
// is the port's EXPOSURE WEIGHTS (which hazards THIS port is likely to draw); a
// card's protection says nothing about that. Exposure weights are NEVER returned
// here — only by the gated /wheel endpoint. Explicit field copy, never a spread.
export function getPublicMeasures() {
  return MEASURES.map(m => ({
    id: m.id,
    name: m.name,
    cost: m.cost,
    raisesCultureLevel: !!m.raisesCultureLevel,
    protection: { ...m.protection },
  }))
}
