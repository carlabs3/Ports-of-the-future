// Adaptation measures — the 25 buyable measures.
// Source of truth for phase-2 scoring. Transcribe EXACTLY.
//
// protection: tokens of protection per event code (columns SS RF HW WS DR WF SI).
//   A "–" in the source document means 0 (no protection).
// cost: tokens to buy the measure.
// raisesCultureBand: true ONLY for #19 and #20.

export const MEASURES = [
  { id: 1,  name: 'Coastal defences',              cost: 5, raisesCultureBand: false, protection: { SS: 8, RF: 0, HW: 0, WS: 3, DR: 0, WF: 0, SI: 0 } },
  { id: 2,  name: 'Elevated infrastructure',       cost: 4, raisesCultureBand: false, protection: { SS: 7, RF: 4, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 3,  name: 'Deployable flood barriers',     cost: 3, raisesCultureBand: false, protection: { SS: 5, RF: 5, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 4,  name: 'Green infrastructure',          cost: 2, raisesCultureBand: false, protection: { SS: 0, RF: 5, HW: 2, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 5,  name: 'NbS bank stabilisation',        cost: 2, raisesCultureBand: false, protection: { SS: 4, RF: 3, HW: 0, WS: 2, DR: 0, WF: 0, SI: 0 } },
  { id: 6,  name: 'Structural health monitoring',  cost: 3, raisesCultureBand: false, protection: { SS: 3, RF: 3, HW: 2, WS: 3, DR: 0, WF: 0, SI: 3 } },
  { id: 7,  name: 'Digital twin',                  cost: 4, raisesCultureBand: false, protection: { SS: 3, RF: 3, HW: 2, WS: 2, DR: 3, WF: 0, SI: 3 } },
  { id: 8,  name: 'Early warning system',          cost: 2, raisesCultureBand: false, protection: { SS: 3, RF: 3, HW: 3, WS: 3, DR: 3, WF: 3, SI: 3 } },
  { id: 9,  name: 'Operations platform',           cost: 3, raisesCultureBand: false, protection: { SS: 3, RF: 3, HW: 0, WS: 3, DR: 3, WF: 0, SI: 3 } },
  { id: 10, name: 'Emergency plan & drills',       cost: 2, raisesCultureBand: false, protection: { SS: 4, RF: 4, HW: 4, WS: 4, DR: 0, WF: 3, SI: 4 } },
  { id: 11, name: 'Heat-protection protocol',      cost: 1, raisesCultureBand: false, protection: { SS: 0, RF: 0, HW: 7, WS: 0, DR: 0, WF: 2, SI: 0 } },
  { id: 12, name: 'Resilient materials/retrofits', cost: 4, raisesCultureBand: false, protection: { SS: 3, RF: 3, HW: 3, WS: 5, DR: 0, WF: 2, SI: 3 } },
  { id: 13, name: 'Mooring & crane reinforcement', cost: 3, raisesCultureBand: false, protection: { SS: 0, RF: 0, HW: 0, WS: 7, DR: 0, WF: 0, SI: 2 } },
  { id: 14, name: 'Backup power',                  cost: 3, raisesCultureBand: false, protection: { SS: 2, RF: 2, HW: 4, WS: 3, DR: 0, WF: 2, SI: 3 } },
  { id: 15, name: 'Drainage upgrade',              cost: 3, raisesCultureBand: false, protection: { SS: 0, RF: 7, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 16, name: 'Biodiversity monitoring',       cost: 2, raisesCultureBand: false, protection: { SS: 0, RF: 0, HW: 0, WS: 0, DR: 2, WF: 1, SI: 0 } },
  { id: 17, name: 'Multimodal shift',              cost: 2, raisesCultureBand: false, protection: { SS: 2, RF: 3, HW: 0, WS: 3, DR: 2, WF: 2, SI: 2 } },
  { id: 18, name: 'Artificial reefs',              cost: 2, raisesCultureBand: false, protection: { SS: 4, RF: 0, HW: 0, WS: 2, DR: 0, WF: 0, SI: 0 } },
  { id: 19, name: 'Governance protocols',          cost: 1, raisesCultureBand: true,  protection: { SS: 2, RF: 2, HW: 2, WS: 2, DR: 2, WF: 2, SI: 2 } },
  { id: 20, name: 'Training programme',            cost: 1, raisesCultureBand: true,  protection: { SS: 2, RF: 2, HW: 2, WS: 2, DR: 1, WF: 2, SI: 2 } },
  { id: 21, name: 'Adaptive dredging',             cost: 3, raisesCultureBand: false, protection: { SS: 0, RF: 3, HW: 0, WS: 0, DR: 6, WF: 0, SI: 0 } },
  { id: 22, name: 'Retention basins',              cost: 3, raisesCultureBand: false, protection: { SS: 0, RF: 6, HW: 0, WS: 0, DR: 3, WF: 1, SI: 0 } },
  { id: 23, name: 'Parametric insurance',          cost: 2, raisesCultureBand: false, protection: { SS: 2, RF: 2, HW: 2, WS: 2, DR: 2, WF: 2, SI: 2 } },
  { id: 24, name: 'Winterisation package',         cost: 2, raisesCultureBand: false, protection: { SS: 0, RF: 0, HW: 0, WS: 0, DR: 0, WF: 0, SI: 7 } },
  { id: 25, name: 'Firebreaks & vegetation mgmt',  cost: 2, raisesCultureBand: false, protection: { SS: 0, RF: 0, HW: 1, WS: 0, DR: 0, WF: 6, SI: 0 } },
]

// Indexable by id.
export const MEASURES_BY_ID = Object.fromEntries(MEASURES.map(m => [m.id, m]))
