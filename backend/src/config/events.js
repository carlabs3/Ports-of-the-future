// Extreme weather events (EWE) — the 7 "roulette" events (workshop v5).
// Source of truth: this prompt's Appendix D (names) and docs/workshop-v5.md
// section 4 ("What happens"). Chronic hazards (sea-level rise, erosion) are NOT
// roulette events and are intentionally absent.
//
// J1/J2: one potential loss per event (`potentialLossM`, in € millions), the
// SAME for every port and every round. Coins are only the budget and card costs.
// Damage = potentialLossM × (1 − P/10); strategy weights = likelihood ×
// potentialLossM. Ports no longer carry a per-port impact table.

// Canonical event-code order, reused as the column order for measure protection
// and the per-port wheels.
export const EVENT_CODES = ['SS', 'RF', 'HW', 'WS', 'DR', 'WF', 'SI']

export const EVENTS = [
  { code: 'SS', name: 'Storm surge',    potentialLossM: 600, description: 'Low pressure and strong onshore winds push the sea above its normal level and over quays and dikes.' },
  { code: 'RF', name: 'River flooding', potentialLossM: 400, description: 'Long or intense rain makes rivers, canals and torrents overflow onto port land.' },
  { code: 'HW', name: 'Heatwave',       potentialLossM: 200, description: 'Several days of very high temperatures, often with warm nights and high humidity.' },
  { code: 'WS', name: 'Windstorm',      potentialLossM: 500, description: 'Sustained high winds and violent gusts, from winter storms, tropical cyclones or local winds.' },
  { code: 'DR', name: 'Drought',        potentialLossM: 300, description: 'A long dry spell lowers rivers and puts pressure on the water supply.' },
  { code: 'WF', name: 'Wildfire',       potentialLossM: 300, description: 'Fire in the vegetation around the port or along its access roads and railways.' },
  { code: 'SI', name: 'Snow & ice',     potentialLossM: 300, description: 'Heavy snow, freezing rain or days of deep frost that stop surface operations.' },
]

// Indexable by code.
export const EVENTS_BY_CODE = Object.fromEntries(EVENTS.map(e => [e.code, e]))
