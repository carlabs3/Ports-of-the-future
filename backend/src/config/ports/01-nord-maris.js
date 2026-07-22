// Port catalogue entry. One file per port so adding a port is trivial.
// PUBLIC fields: id, name, meta, contextSheet (safe to serve to clients).
// SECRET field: exposureWeights (roulette weights) — MUST sum to 10 and must
// NEVER be served to the team client.
//
// NOTE: meta.zone / meta.size are indicative descriptors, not scoring inputs
// (scoring uses exposureWeights + measures + events only).
export default {
  id: 1,
  name: 'Nord-Maris',
  meta: { zone: 'North Sea coast', size: 'large', description: 'Northern coastal port' },
  // PUBLIC — context sheet shown to teams (hints at exposure, no weights).
  contextSheet: 'Nord-Maris is a large deep-water port on an open, low-lying stretch of the northern coast, fully exposed to the sea with little natural shelter. Winter brings powerful gales sweeping in off the water, and the highest tides drive seawater up over the quays and hinterland.',
  // SECRET — roulette exposure weights (sum = 10). Never serve to clients.
  exposureWeights: { SS: 4, RF: 1, HW: 0, WS: 3, DR: 1, WF: 0, SI: 1 },
}
