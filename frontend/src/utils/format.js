// Shared display formatters for the v5 post-spin / debrief results (E1–E3).
// All computation elsewhere stays on UNROUNDED values; these round only for
// display. Money is the single place €bn is produced (E2: 1 impact coin = €1bn).

const round1 = v => Math.round((Number(v) || 0) * 10) / 10

// Money, always one decimal: 2 → "€2.0bn", 1.78 → "€1.8bn". `value` is an impact
// quantity (coins); 1 coin = €1bn, so the number passes straight through.
export function formatEurBn(value) {
  return `€${round1(value).toFixed(1)}bn`
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
