// Shared display formatters for the v5 post-spin / debrief results (E1–E3).
// All computation elsewhere stays on UNROUNDED values; these round only for
// display. Money is the single place €bn is produced (E2: 1 impact coin = €1bn).

const round1 = v => Math.round((Number(v) || 0) * 10) / 10

// Money, always one decimal: 2 → "€2.0bn", 1.78 → "€1.8bn". `value` is an impact
// quantity (coins); 1 coin = €1bn, so the number passes straight through.
export function formatEurBn(value) {
  return `€${round1(value).toFixed(1)}bn`
}

// Whole-number €bn, for the debrief "Impact by port" table where the values are
// integer impacts (E8): formatEurBnInt(2) → "€2bn". The only place €bn is shown
// without a decimal.
export function formatEurBnInt(value) {
  return `€${Math.round(Number(value) || 0)}bn`
}

// Protection as a whole-number percent, rounded half up. Input is P (0–10
// preparedness); protection % = P × 10 (v5). formatPercent(4.24) → "42%".
export function formatPercent(p) {
  return `${Math.round((Number(p) || 0) * 10)}%`
}

// Strategy as "X.X / 10", one decimal. Input is the raw ratio expected ÷ best
// (0..1); score = ratio × 10. formatScore10(0.8270588) → "8.3 / 10".
export function formatScore10(ratio) {
  return `${round1((Number(ratio) || 0) * 10).toFixed(1)} / 10`
}

// F3: a team's debrief totals from its per-round raw `damageBill` + `impact`.
// Total damage SHOWN = Σ round1(damageBill) (so it equals the three shown round
// figures); potential = Σ impact (integers); avoided = potential − totalDamageShown;
// avoidedPct = round(avoided / potential × 100), half up. Ranking/awards use raw
// values, never these.
export function debriefTotals(rounds = []) {
  const totalDamageShown = round1(rounds.reduce((s, r) => s + round1(r.damageBill), 0))
  const totalPotential = rounds.reduce((s, r) => s + (Number(r.impact) || 0), 0)
  const avoidedShown = round1(totalPotential - totalDamageShown)
  const avoidedPct = totalPotential > 0 ? Math.round((avoidedShown / totalPotential) * 100) : 0
  return { totalDamageShown, totalPotential, avoidedShown, avoidedPct }
}

// E3: the three money figures that must add up on screen. `damage` and `impact`
// are UNROUNDED; round damage and potential to 1 dp, then derive avoided by
// subtraction (not a separate rounding) so damageShown + avoidedShown always
// equals potentialShown. Returns numbers; format each with formatEurBn.
export function damageBreakdown(damage, impact) {
  const damageShown = round1(damage)
  const potentialShown = round1(impact)
  const avoidedShown = round1(potentialShown - damageShown)
  return { damageShown, potentialShown, avoidedShown }
}
