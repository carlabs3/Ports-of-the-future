import { PORTS } from '../config/ports/index.js'

// Team / port assignment for session creation. Pure and testable (no DB).
//
// Teams are named Team A … Team H (max 8). Each team gets a RANDOM port from the
// catalogue with no repeats between teams. Ports are assigned server-side (the
// client never picks them) and stay hidden on the projected screen until the
// Roulette tab.

export const MIN_TEAMS = 2
export const MAX_TEAMS = 6 // D13: at most 6 tables, one per port, no repeats

// Team A, Team B, … for a count in [MIN_TEAMS, MAX_TEAMS]. Letters A–H.
export function generateTeamNames(count) {
  return Array.from({ length: count }, (_, i) => `Team ${String.fromCharCode(65 + i)}`)
}

// Validate a requested team count. Returns { ok, error }.
export function validateTeamCount(count) {
  if (!Number.isInteger(count)) return { ok: false, error: 'teamCount must be an integer' }
  if (count < MIN_TEAMS || count > MAX_TEAMS) {
    return { ok: false, error: `The number of teams must be between ${MIN_TEAMS} and ${MAX_TEAMS}` }
  }
  return { ok: true }
}

// Fisher–Yates shuffle using an injectable rng (defaults to Math.random), so
// tests can make assignment deterministic. Returns a new array.
function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Assign each group a distinct random port. rng is injectable for tests.
// Throws if there are more groups than ports (can't guarantee no repeats).
// Returns [{ group, portId }] aligned with `groups`.
export function assignRandomPorts(groups = [], rng = Math.random) {
  const portIds = PORTS.map(p => p.id)
  if (groups.length > portIds.length) {
    throw new Error(`Not enough ports: ${groups.length} teams, ${portIds.length} ports`)
  }
  const picked = shuffle(portIds, rng).slice(0, groups.length)
  return groups.map((group, i) => ({ group, portId: picked[i] }))
}
