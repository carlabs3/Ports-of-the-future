// Extreme weather events (EWE) — the 7 "roulette" events (workshop v5).
// Source of truth: this prompt's Appendix D (names) and docs/workshop-v5.md
// section 4 ("What happens"). Chronic hazards (sea-level rise, erosion) are NOT
// roulette events and are intentionally absent.
//
// v5: there is NO global lossValue any more. Damage depends on the PORT and the
// ROUND — see each port's `impacts` / `impactRound3Plus` and the scoring service.

// Canonical event-code order, reused as the column order for measure protection
// and the per-port wheels and impacts.
export const EVENT_CODES = ['SS', 'RF', 'HW', 'WS', 'DR', 'WF', 'SI']

export const EVENTS = [
  { code: 'SS', name: 'Storm surge',    description: 'Low pressure and strong onshore winds push the sea above its normal level and over quays and dikes.' },
  { code: 'RF', name: 'River flooding', description: 'Long or intense rain makes rivers, canals and torrents overflow onto port land.' },
  { code: 'HW', name: 'Heatwave',       description: 'Several days of very high temperatures, often with warm nights and high humidity.' },
  { code: 'WS', name: 'Windstorm',      description: 'Sustained high winds and violent gusts, from winter storms, tropical cyclones or local winds.' },
  { code: 'DR', name: 'Drought',        description: 'A long dry spell lowers rivers and puts pressure on the water supply.' },
  { code: 'WF', name: 'Wildfire',       description: 'Fire in the vegetation around the port or along its access roads and railways.' },
  { code: 'SI', name: 'Snow & ice',     description: 'Heavy snow, freezing rain or days of deep frost that stop surface operations.' },
]

// Indexable by code.
export const EVENTS_BY_CODE = Object.fromEntries(EVENTS.map(e => [e.code, e]))
