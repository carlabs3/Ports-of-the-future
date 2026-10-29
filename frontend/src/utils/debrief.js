// Pure helpers for the debrief views (F4 sort/rank, F5 luck text). No DOM deps,
// so they run in the backend node:test runner (like format.js).

// F4 · rank teams by the active sort key ('strategy' → finalScore, 'avoided' →
// avoidedPctRaw), highest first. Teams share a rank only when the sort value is
// exactly equal.
export function rankTeams(teams = [], sortKey = 'strategy') {
  const key = sortKey === 'avoided' ? 'avoidedPctRaw' : 'finalScore'
  const val = t => { const n = Number(t[key]); return Number.isFinite(n) ? n : -Infinity }
  const sorted = [...teams].sort((a, b) => val(b) - val(a))
  let rank = 0, prev = null
  return sorted.map((t, i) => {
    const v = val(t)
    if (prev === null || v !== prev) { rank = i + 1; prev = v }
    return { ...t, rank }
  })
}

// F5 · luck for one round, in points = round(rawLossesAvoidedPct) −
// round(expectedProtection). |luck| ≤ 5 reads "as planned" (the existing
// debrief threshold).
export function luckText({ rawLossesAvoidedPct, expectedProtection } = {}) {
  const luck = Math.round(Number(rawLossesAvoidedPct) || 0) - Math.round(Number(expectedProtection) || 0)
  if (Math.abs(luck) <= 5) return '≈ As planned'
  return luck > 0 ? `▲ +${luck} pts · lucky` : `▼ −${-luck} pts · unlucky`
}

// H3 · luck as words (no colour; the arrows carry the meaning). `points` is the
// F5 value: round(rawLossesAvoidedPct) − round(expectedProtection).
export function getLuckLabel(points) {
  const p = Number(points) || 0
  if (p >= 15) return '▲▲ Very lucky'
  if (p >= 6) return '▲ Lucky'
  if (p >= -5) return '= As planned'
  if (p >= -14) return '▼ Unlucky'
  return '▼▼ Very unlucky'
}

// H3 · debrief B walks teams in team-name order (Team A, Team B …), not by rank.
export function sortByTeamName(teams = []) {
  return [...teams].sort((a, b) => String(a.group).localeCompare(String(b.group), undefined, { numeric: true }))
}
