// Pure helper for the "Strongest" / "Weakest" area labels. Shared by the
// facilitator Results screen and the participant result page so the tie rule
// lives in ONE place and can be unit-tested (via the backend node:test runner,
// like wheelMath.js).
//
// Rule:
//   - Strongest = every area whose score equals the max; Weakest = every area
//     whose score equals the min (so ties label all tied areas).
//   - If every area has the same score, label NONE (neither set gets anything).
//   - An area can never be in both sets (guaranteed: if all equal → both empty;
//     otherwise min < max, so no area is in both).
//
// `scoresById` is an object { areaId: number }. Returns { strongest, weakest }
// as two Sets of area ids. Missing/undefined scores count as 0.
export function pickExtremes(scoresById = {}) {
  const ids = Object.keys(scoresById)
  if (ids.length === 0) return { strongest: new Set(), weakest: new Set() }

  const value = id => Number(scoresById[id]) || 0
  let min = Infinity
  let max = -Infinity
  for (const id of ids) {
    const v = value(id)
    if (v < min) min = v
    if (v > max) max = v
  }
  if (min === max) return { strongest: new Set(), weakest: new Set() }

  const strongest = new Set(ids.filter(id => value(id) === max))
  const weakest = new Set(ids.filter(id => value(id) === min))
  return { strongest, weakest }
}
