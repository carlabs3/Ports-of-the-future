// Game-wide round configuration (workshop v5).
//
// roundGrants = coins granted at the START of each round (not cumulative).
// Every round gives 3 → cumulative budgets 3 / 6 / 9. The round-1 grant is also
// the team's starting balance (set at team creation from roundGrants[0]), so this
// is the single source of the budget — change it here to revert in one line.
export const roundGrants = [3, 3, 3]

// Cumulative budget available by the end of each round: [3, 6, 9].
export const cumulativeBudgets = roundGrants.map((_, i) =>
  roundGrants.slice(0, i + 1).reduce((a, b) => a + b, 0)
)

// The year shown for each round on the control centre. (The authoritative year
// also lives next to each port's per-round wheel; this is the plain list.)
export const roundYears = [2026, 2031, 2036]

// Card-return policy per round (G1). Round 1 has nothing to return (absent here).
// Rounds 2 and 3: 'full' — any number of held cards may be returned, each for
// its FULL cost. Read from here; routes must not hard-code round numbers.
export const returnPolicy = { 2: 'full', 3: 'full' }
