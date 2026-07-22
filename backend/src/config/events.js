// Extreme weather events (EWE) — the 7 "roulette" events.
// Source of truth for phase-2 scoring. Transcribe EXACTLY.
// Chronic hazards (sea-level rise, erosion) are NOT roulette events and are
// intentionally absent here.
//
// lossValue = damage tokens (1–5) inflicted when the event hits unprotected.

// Canonical event-code order, reused as the column order for measure
// protection and port exposure weights.
export const EVENT_CODES = ['SS', 'RF', 'HW', 'WS', 'DR', 'WF', 'SI']

export const EVENTS = [
  { code: 'SS', name: 'Storm surge / coastal flooding',   lossValue: 4 },
  { code: 'RF', name: 'Heavy rainfall / river flooding',  lossValue: 4 },
  { code: 'HW', name: 'Heatwave',                          lossValue: 3 },
  { code: 'WS', name: 'Wind storm',                        lossValue: 4 },
  { code: 'DR', name: 'Drought / low water',               lossValue: 3 },
  { code: 'WF', name: 'Wildfire — hinterland',             lossValue: 3 },
  { code: 'SI', name: 'Snow/ice storm & cold snap',        lossValue: 3 },
]

// Indexable by code.
export const EVENTS_BY_CODE = Object.fromEntries(EVENTS.map(e => [e.code, e]))
