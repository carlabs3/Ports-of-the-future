// Game-wide round configuration (workshop v5).
//
// roundGrants = coins granted at the START of each round (not cumulative).
// Round 1 gives 6, rounds 2 and 3 give +3 each → cumulative budgets 6 / 9 / 12.
// D2: the handbook says the +3 may be reverted, so changing it must be a one-line
// edit here — nothing else hard-codes the grant.
export const roundGrants = [6, 3, 3]

// Cumulative budget available by the end of each round: [6, 9, 12].
export const cumulativeBudgets = roundGrants.map((_, i) =>
  roundGrants.slice(0, i + 1).reduce((a, b) => a + b, 0)
)

// The year shown for each round on the control centre. (The authoritative year
// also lives next to each port's per-round wheel; this is the plain list.)
export const roundYears = [2026, 2031, 2036]
