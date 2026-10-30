// CAP breakdown by a profile dimension (every non-empty group, means, areaMeans, gaps).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCapBreakdown } from '../src/services/parSubmissionService.js'

// Build a participant with a port size + a score + the five area values.
const areas = (g, o, b, m, p) => ({ governance: g, organisation: o, budget: b, measures: m, preparedness: p })
const P = (portSize, score, ar) => ({ portSize, score, areas: ar })

function many(portSize, scores) {
  // Give everyone the same flat area profile unless overridden; areaMeans then
  // equal the per-area value.
  return scores.map(s => P(portSize, s, areas(s / 5, s / 5, s / 5, s / 5, s / 5)))
}

test('three groups (6/10/8): means, areaMeans and high→low scores', () => {
  const results = [
    ...many('small', [40, 50, 60, 30, 55, 45]),   // n=6, mean 46.67 → 47
    ...many('medium', [50, 52, 48, 60, 40, 55, 45, 58, 42, 50]), // n=10, mean 50
    ...many('large', [70, 80, 60, 90, 75, 65, 85, 55]), // n=8, mean 72.5 → 73
  ]
  const b = computeCapBreakdown(results, 'portSize')
  const byKey = Object.fromEntries(b.groups.map(g => [g.key, g]))
  assert.equal(byKey.small.n, 6);  assert.equal(byKey.small.mean, 47)
  assert.equal(byKey.medium.n, 10); assert.equal(byKey.medium.mean, 50)
  assert.equal(byKey.large.n, 8);  assert.equal(byKey.large.mean, 73)
  // scores sorted high→low
  for (const g of b.groups) {
    const sorted = [...g.scores].sort((x, y) => y - x)
    assert.deepEqual(g.scores, sorted)
  }
  // areaMeans: flat profile → each = mean/5, round 1 dp. small mean 46.67 → 9.3
  assert.deepEqual(byKey.small.areaMeans, [9.3, 9.3, 9.3, 9.3, 9.3])
  // group colours by config order
  assert.equal(byKey.small.color, '#1F8A84')
  assert.equal(byKey.medium.color, '#4E77C2')
  assert.equal(byKey.large.color, '#13245E')
})

test('a 1-person group is present with n = 1 (no minimum size); empty groups omitted', () => {
  const results = [
    ...many('small', [40, 50, 60]),  // n=3
    ...many('medium', [100]),        // n=1 — still shown
  ]
  const b = computeCapBreakdown(results, 'portSize')
  const byKey = Object.fromEntries(b.groups.map(g => [g.key, g]))
  assert.equal(byKey.medium.n, 1)
  assert.equal(byKey.medium.mean, 100)
  assert.equal(b.noAnswerCount, 0)
  // only the two non-empty groups appear (large etc. are absent)
  assert.deepEqual(b.groups.map(g => g.key).sort(), ['medium', 'small'])
  // roomMean over all 4 scores: (40+50+60+100)/4 = 62.5 → 63
  assert.equal(b.roomMean, 63)
})

test('participants with no answer for the field count in noAnswerCount, stay in roomMean', () => {
  const results = [
    ...many('small', [40, 50, 60]), // shown
    P('', 70, areas(14, 14, 14, 14, 14)),  // no port size
    P('', 30, areas(6, 6, 6, 6, 6)),
  ]
  const b = computeCapBreakdown(results, 'portSize')
  assert.equal(b.noAnswerCount, 2)
  assert.equal(b.groups.length, 1)
  // roomMean includes the two no-answer people: (40+50+60+70+30)/5 = 50
  assert.equal(b.roomMean, 50)
})

test('biggestGapArea = largest max−min across shown group means', () => {
  // Small flat at 10; large with budget area much higher.
  const small = Array.from({ length: 3 }, () => P('small', 50, areas(10, 10, 10, 10, 10)))
  const large = Array.from({ length: 3 }, () => P('large', 80, areas(10, 10, 18, 10, 12)))
  const b = computeCapBreakdown([...small, ...large], 'portSize')
  // budget (index 2): |10 − 18| = 8 is the largest gap.
  assert.equal(b.biggestGapArea.area, 2)
  assert.equal(b.biggestGapArea.gap, 8)
})

test('biggestGapArea is null with a single shown group', () => {
  const b = computeCapBreakdown(many('small', [40, 50, 60]), 'portSize')
  assert.equal(b.biggestGapArea, null)
})

test('payload carries no ids, names or teams — only bare scores', () => {
  const results = [...many('small', [40, 50, 60]), ...many('large', [70, 80, 90])]
  const b = computeCapBreakdown(results, 'portSize')
  const json = JSON.stringify(b)
  // No participant-identifying data: no team names, participant/submission ids.
  assert.equal(/Team |participantId|submissionId|"_id"/i.test(json), false)
  // Each group item exposes only the aggregate fields — never a team/group id.
  for (const g of b.groups) {
    assert.deepEqual(Object.keys(g).sort(), ['areaMeans', 'color', 'key', 'label', 'mean', 'n', 'scores'].sort())
    for (const s of g.scores) assert.equal(typeof s, 'number')
  }
})
