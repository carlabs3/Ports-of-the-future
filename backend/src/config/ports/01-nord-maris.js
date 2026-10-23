// Port catalogue entry (workshop v4, Appendix A). One file per port.
// PUBLIC fields: id, name, climateZone, coastalSetting, size, governance, colour,
// deck. SECRET: exposureWeights (10 slices) — MUST sum to 10 and must NEVER be
// served to any client before that table's round-1 spin.
// `colour` identifies the port on screen and on the printed materials. This
// SUPERSEDES the earlier D17 ("ports have no colour"): the printed kit now uses
// one colour per port, so the app matches it.
// `deck` = the measure ids this port may buy (6 shared + port-specific).
export default {
  id: 'nord-maris',
  name: 'Nord-Maris',
  climateZone: 'Temperate',
  coastalSetting: 'Artificial / engineered coastline',
  size: 'Large',
  governance: 'Landlord port',
  colour: '#062D69',
  deck: [8, 10, 14, 19, 20, 23, 1, 2, 3, 6, 9, 13, 18, 24],
  // SECRET — sum = 10.
  exposureWeights: { SS: 4, RF: 1, HW: 1, WS: 3, DR: 0, WF: 0, SI: 1 },
}
