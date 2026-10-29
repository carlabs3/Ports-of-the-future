// Pure helpers for the post-spin panel (E6 card order/status, E7 culture line).
// No React/DOM deps, so they run in the backend node:test runner (like
// areaExtremes). `getMeasure(id)` returns { protection, raisesCultureLevel }.

// E6 · status of one held card against the drawn event.
//   HELPED         — protection > 0 for the drawn event
//   RAISED CULTURE — an enabler that raised the level (not already at Proactive)
//   MAX CULTURE    — an enabler held while already at Proactive (no raise)
//   NOT THIS TIME  — everything else
export function cardStatus(id, { drawnEvent, startingBand, getMeasure }) {
  const m = getMeasure(id) || {}
  if ((m.protection?.[drawnEvent] || 0) > 0) return 'HELPED'
  if (m.raisesCultureLevel) return startingBand === 'proactive' ? 'MAX CULTURE' : 'RAISED CULTURE'
  return 'NOT THIS TIME'
}

const GROUP = { HELPED: 0, 'RAISED CULTURE': 1, 'MAX CULTURE': 2, 'NOT THIS TIME': 2 }

// E6 · order ids: HELPED, then RAISED CULTURE, then the rest (MAX CULTURE and
// NOT THIS TIME), each group sorted by card number.
export function orderCards(ids = [], opts) {
  return [...ids].sort((a, b) => (GROUP[cardStatus(a, opts)] - GROUP[cardStatus(b, opts)]) || (a - b))
}

// E7 · the line stating where the multiplier came from. `enablerIds` are the
// enabler cards (#19/#20) actually held; `raisedLevels` is how many levels the
// starting band gained (1 or 2; a cap collapses it to the levels actually gained).
export function cultureLine({ startingBand, startLabel, startMult, raisedLevels, enablerIds = [] }) {
  if (enablerIds.length === 0) return 'Starting level. No enabler held.'
  if (startingBand === 'proactive') return 'Started Proactive (×1.1). Already at the maximum level.'
  const cards = enablerIds.length === 1
    ? `Card ${enablerIds[0]}`
    : `Cards ${[...enablerIds].sort((a, b) => a - b).join(' and ')}`
  const levels = raisedLevels >= 2 ? 'two levels' : 'one level'
  return `Started ${startLabel} (×${startMult}). ${cards} raised it ${levels}.`
}
