// Adaptation measures — the 26 buyable cards (workshop v4, Appendix B).
// Source of truth for scoring. Transcribe EXACTLY.
//
// protection: tokens of protection per event code (SS RF HW WS DR WF SI).
//   A "–" in the source document means 0 (no protection).
// cost: coins to buy the card (1–5).
// raisesCultureLevel: true ONLY for the two enablers #19 and #20 (no protection).
//
// NOTE: descriptive card texts come from docs/workshop-v4.md (the v4 handbook),
// which is not yet in the repo — descriptions are therefore omitted here and
// will be added once the handbook lands. Scores/costs/names are authoritative
// (Appendix B).

export const MEASURES = [
  { id: 1,  name: 'Coastal defence structures',                cost: 5, raisesCultureLevel: false, protection: { SS: 8, RF: 0, HW: 0, WS: 3, DR: 0, WF: 0, SI: 0 } },
  { id: 2,  name: 'Elevated critical infrastructure',          cost: 4, raisesCultureLevel: false, protection: { SS: 7, RF: 4, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 3,  name: 'Deployable flood barriers',                 cost: 3, raisesCultureLevel: false, protection: { SS: 5, RF: 5, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 4,  name: 'Green infrastructure & permeable surfaces', cost: 2, raisesCultureLevel: false, protection: { SS: 0, RF: 5, HW: 2, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 5,  name: 'Nature-based coastal & riverbank protection', cost: 2, raisesCultureLevel: false, protection: { SS: 4, RF: 3, HW: 0, WS: 2, DR: 0, WF: 0, SI: 0 } },
  { id: 6,  name: 'Structural health monitoring',              cost: 3, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 2, WS: 3, DR: 0, WF: 0, SI: 3 } },
  { id: 7,  name: 'Digital twin & predictive maintenance',     cost: 4, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 2, WS: 2, DR: 3, WF: 0, SI: 3 } },
  { id: 8,  name: 'Early warning & forecasting system',        cost: 2, raisesCultureLevel: false, protection: { SS: 2, RF: 2, HW: 2, WS: 2, DR: 2, WF: 2, SI: 2 } },
  { id: 9,  name: 'Real-time operations platform',             cost: 3, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 0, WS: 3, DR: 3, WF: 0, SI: 3 } },
  { id: 10, name: 'Emergency response plan & drills',          cost: 2, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 3, WS: 3, DR: 0, WF: 2, SI: 3 } },
  { id: 11, name: 'Worker heat-protection protocol',           cost: 1, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 7, WS: 0, DR: 0, WF: 2, SI: 0 } },
  { id: 12, name: 'Climate-resilient materials & retrofits',   cost: 4, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 3, WS: 5, DR: 0, WF: 2, SI: 3 } },
  { id: 13, name: 'Wind-resistant mooring & crane reinforcement', cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 0, WS: 7, DR: 0, WF: 0, SI: 2 } },
  { id: 14, name: 'Backup power & microgrid',                  cost: 3, raisesCultureLevel: false, protection: { SS: 1, RF: 1, HW: 4, WS: 2, DR: 0, WF: 1, SI: 3 } },
  { id: 15, name: 'Drainage system upgrade',                   cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 7, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 16, name: 'Alternative water supply & reuse',          cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 1, WS: 0, DR: 6, WF: 2, SI: 0 } },
  { id: 17, name: 'Multimodal shift platform',                 cost: 2, raisesCultureLevel: false, protection: { SS: 2, RF: 3, HW: 0, WS: 3, DR: 2, WF: 2, SI: 2 } },
  { id: 18, name: 'Artificial reefs & wave dissipation',       cost: 3, raisesCultureLevel: false, protection: { SS: 4, RF: 0, HW: 0, WS: 2, DR: 0, WF: 0, SI: 0 } },
  { id: 19, name: 'Governance & institutional protocols',      cost: 1, raisesCultureLevel: true,  protection: { SS: 0, RF: 0, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 20, name: 'Capacity building & training programme',    cost: 1, raisesCultureLevel: true,  protection: { SS: 0, RF: 0, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 } },
  { id: 21, name: 'Adaptive dredging & sediment management',   cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 3, HW: 0, WS: 0, DR: 6, WF: 0, SI: 0 } },
  { id: 22, name: 'Stormwater retention & storage basins',     cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 6, HW: 0, WS: 0, DR: 3, WF: 1, SI: 0 } },
  { id: 23, name: 'Parametric climate insurance',             cost: 1, raisesCultureLevel: false, protection: { SS: 1, RF: 1, HW: 1, WS: 1, DR: 1, WF: 1, SI: 1 } },
  { id: 24, name: 'Winterisation package',                    cost: 2, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 0, WS: 0, DR: 0, WF: 0, SI: 7 } },
  { id: 25, name: 'Firebreaks & vegetation management',       cost: 2, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 1, WS: 0, DR: 0, WF: 6, SI: 0 } },
  { id: 26, name: 'Cool surfaces & shaded yards',             cost: 2, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 5, WS: 0, DR: 0, WF: 0, SI: 0 } },
]

// Shared cards that must be in every port's deck (v4 Appendix A).
export const SHARED_MEASURE_IDS = [8, 10, 14, 19, 20, 23]

// Indexable by id.
export const MEASURES_BY_ID = Object.fromEntries(MEASURES.map(m => [m.id, m]))
