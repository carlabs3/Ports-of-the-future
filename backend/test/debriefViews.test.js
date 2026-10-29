// Debrief view helpers (F4 rankTeams, F5 luckText).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankTeams, luckText, getLuckLabel, sortByTeamName } from '../../frontend/src/utils/debrief.js'

test('F4 · sort by strategy vs by losses avoided can differ', () => {
  const teams = [
    { group: 'A', finalScore: 90, avoidedPctRaw: 0.40 },
    { group: 'B', finalScore: 80, avoidedPctRaw: 0.70 },
  ]
  assert.deepEqual(rankTeams(teams, 'strategy').map(t => t.group), ['A', 'B'])
  assert.deepEqual(rankTeams(teams, 'avoided').map(t => t.group), ['B', 'A'])
  // Ranks follow the active sort.
  assert.deepEqual(rankTeams(teams, 'avoided').map(t => t.rank), [1, 2])
})

test('F4 · teams share a rank only on exactly-equal sort values', () => {
  const teams = [
    { group: 'A', finalScore: 80 },
    { group: 'B', finalScore: 80 },
    { group: 'C', finalScore: 79.9999 },
  ]
  const ranked = rankTeams(teams, 'strategy')
  const byGroup = Object.fromEntries(ranked.map(t => [t.group, t.rank]))
  assert.equal(byGroup.A, byGroup.B)        // exact tie → shared rank
  assert.ok(byGroup.C > byGroup.A)          // just below → next rank
})

test('F5 · luck text: lucky / unlucky / as planned', () => {
  assert.equal(luckText({ rawLossesAvoidedPct: 50, expectedProtection: 42 }), '▲ +8 pts · lucky')
  assert.equal(luckText({ rawLossesAvoidedPct: 26, expectedProtection: 42 }), '▼ −16 pts · unlucky')
  assert.equal(luckText({ rawLossesAvoidedPct: 44, expectedProtection: 42 }), '≈ As planned') // |2| ≤ 5
  assert.equal(luckText({ rawLossesAvoidedPct: 47, expectedProtection: 42 }), '≈ As planned') // |5| ≤ 5
  assert.equal(luckText({ rawLossesAvoidedPct: 48, expectedProtection: 42 }), '▲ +6 pts · lucky') // |6| > 5
})

test('H3 · getLuckLabel buckets (words, no points)', () => {
  assert.equal(getLuckLabel(15), '▲▲ Very lucky')
  assert.equal(getLuckLabel(14), '▲ Lucky')
  assert.equal(getLuckLabel(6), '▲ Lucky')
  assert.equal(getLuckLabel(5), '= As planned')
  assert.equal(getLuckLabel(0), '= As planned')
  assert.equal(getLuckLabel(-5), '= As planned')
  assert.equal(getLuckLabel(-6), '▼ Unlucky')
  assert.equal(getLuckLabel(-14), '▼ Unlucky')
  assert.equal(getLuckLabel(-15), '▼▼ Very unlucky')
})

test('H2 · other-rank column uses the raw rankings (B #1/#1, A #2/#2)', () => {
  // Debrief fixtures: B outscores A on both strategy and losses avoided.
  const teams = [
    { group: 'Team A', finalScore: 83, avoidedPctRaw: 0.41 },
    { group: 'Team B', finalScore: 90, avoidedPctRaw: 0.68 },
  ]
  const strat = Object.fromEntries(rankTeams(teams, 'strategy').map(t => [t.group, t.rank]))
  const avoid = Object.fromEntries(rankTeams(teams, 'avoided').map(t => [t.group, t.rank]))
  assert.deepEqual([strat['Team B'], avoid['Team B']], [1, 1])
  assert.deepEqual([strat['Team A'], avoid['Team A']], [2, 2])
})

test('H3 · team-by-team order follows team names, not rank', () => {
  const teams = [
    { group: 'Team C', rank: 1 },
    { group: 'Team A', rank: 3 },
    { group: 'Team B', rank: 2 },
  ]
  assert.deepEqual(sortByTeamName(teams).map(t => t.group), ['Team A', 'Team B', 'Team C'])
})
