// Shared display formatters for the v5 post-spin / debrief results (E1–E3).
// All computation elsewhere stays on UNROUNDED values; these round only for
// display. Money is always shown in whole € millions (J4): potential losses and
// damage come from the backend already normalised to €M (J3). Coins stay on
// screen only for budgets and card costs — never as money here.

// Money, whole € millions with a thousands separator (J4/J5): 267 → "€267M",
// 1350 → "€1,350M". The value is already in € millions; never shown as €bn.
export function formatEurM(value) {
  return `€${Math.round(Number(value) || 0).toLocaleString('en-US')}M`
}

// Protection as a whole-number percent, rounded half up. Input is P (0–10
// preparedness); protection % = P × 10 (v5). formatPercent(4.24) → "42%".
export function formatPercent(p) {
  return `${Math.round((Number(p) || 0) * 10)}%`
}

// Strategy as "X.X / 10", one decimal. Input is the raw ratio expected ÷ best
// (0..1); score = ratio × 10. formatScore10(0.8270588) → "8.3 / 10".
export function formatScore10(ratio) {
  return `${(Math.round((Number(ratio) || 0) * 10 * 10) / 10).toFixed(1)} / 10`
}

// F3/J5: a team's debrief totals from its per-round `damageBill` + `potentialLossM`
// (both in €M). Money SHOWN is whole €M and adds up: totalDamageShown =
// Σ round(damageBill); potential = Σ potentialLossM; avoidedShown = potential −
// totalDamageShown. The % shown is ALWAYS from the raw values — avoidedPct =
// round(avoidedPctRaw × 100), half up — so the same figure never shows two
// different percentages on two screens.
export function debriefTotals(rounds = []) {
  const totalDamageShown = rounds.reduce((s, r) => s + Math.round(Number(r.damageBill) || 0), 0)
  const totalDamageRaw = rounds.reduce((s, r) => s + (Number(r.damageBill) || 0), 0)
  const totalPotential = rounds.reduce((s, r) => s + (Number(r.potentialLossM) || 0), 0)
  const avoidedShown = totalPotential - totalDamageShown
  const avoidedPctRaw = totalPotential > 0 ? 1 - totalDamageRaw / totalPotential : 0
  const avoidedPct = Math.round(avoidedPctRaw * 100) // F3: shown % always from raw
  return { totalDamageShown, totalDamageRaw, totalPotential, avoidedShown, avoidedPctRaw, avoidedPct }
}

// E3/J5: the three money figures that must add up on screen, in whole €M.
// `damage` and `potentialLossM` are UNROUNDED €M; round damage, then derive
// avoided by subtraction (not a separate rounding) so damageShown + avoidedShown
// always equals potentialShown. Returns numbers; format each with formatEurM.
export function damageBreakdown(damage, potentialLossM) {
  const damageShown = Math.round(Number(damage) || 0)
  const potentialShown = Math.round(Number(potentialLossM) || 0)
  const avoidedShown = potentialShown - damageShown
  return { damageShown, potentialShown, avoidedShown }
}
