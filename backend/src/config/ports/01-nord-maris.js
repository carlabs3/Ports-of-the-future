// Port catalogue entry (workshop v4, Appendix A). One file per port.
// PUBLIC fields: id, name, colour, climateZone, coastalSetting, size,
// governance, deck. SECRET: exposureWeights (10 slices) — MUST sum to 10 and
// must NEVER be served to any client before that table's round-1 spin.
// `colour` is a placeholder hex, defined here only so it can be swapped in one
// place. `deck` = the measure ids this port may buy (6 shared + port-specific).
export default {
  id: 'nord-maris',
  name: 'Nord-Maris',
  colour: '#2F5D8A',
  climateZone: 'Temperate',
  coastalSetting: 'Artificial / engineered coastline',
  size: 'Large',
  governance: 'Landlord port',
  deck: [8, 10, 14, 19, 20, 23, 1, 2, 3, 6, 9, 13, 18, 24],
  // SECRET — sum = 10.
  exposureWeights: { SS: 4, RF: 1, HW: 1, WS: 3, DR: 0, WF: 0, SI: 1 },
}
