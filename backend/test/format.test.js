// Display formatters (E1–E3 / J4–J5). They live with the frontend but are pure,
// so they run here in the backend node:test runner (like wheelMath / areaExtremes).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatEurM, formatPercent, formatScore10, damageBreakdown, debriefTotals } from '../../frontend/src/utils/format.js'

test('formatEurM: whole € millions with a thousands separator (J4/J5)', () => {
  assert.equal(formatEurM(267), '€267M')
  assert.equal(formatEurM(300), '€300M')
  assert.equal(formatEurM(1350), '€1,350M')
  assert.equal(formatEurM(172.8), '€173M') // rounds half up
  assert.equal(formatEurM(0), '€0M')
})

test('formatPercent: P (0–10) → whole-number %, half up', () => {
  assert.equal(formatPercent(4.24), '42%')
  assert.equal(formatPercent(1.1), '11%')
  assert.equal(formatPercent(4.25), '43%') // 42.5 rounds up
})

test('formatScore10: raw ratio → "X.X / 10"', () => {
  assert.equal(formatScore10(0.8270588), '8.3 / 10')
  assert.equal(formatScore10(0.8953), '9.0 / 10')
  assert.equal(formatScore10(1), '10.0 / 10')
  assert.equal(formatScore10(0), '0.0 / 10')
})

test('J5 damageBreakdown: whole €M, shown values always add up', () => {
  // Case A: damage €267M of €300M → €33M avoided.
  const a = damageBreakdown(267, 300)
  assert.deepEqual(a, { damageShown: 267, potentialShown: 300, avoidedShown: 33 })
  assert.equal(a.damageShown + a.avoidedShown, a.potentialShown)

  // Case B: damage €172.8M of €300M → shown €173M, €127M avoided.
  const b = damageBreakdown(172.8, 300)
  assert.deepEqual(b, { damageShown: 173, potentialShown: 300, avoidedShown: 127 })
  assert.equal(b.damageShown + b.avoidedShown, b.potentialShown)

  // Always: shown damage + shown avoided == shown potential (avoided by subtraction).
  for (const [dmg, pot] of [[0, 200], [438, 600], [230.4, 400], [63, 300], [56, 400]]) {
    const r = damageBreakdown(dmg, pot)
    assert.equal(r.damageShown + r.avoidedShown, r.potentialShown, `${dmg}/${pot}`)
  }
})

test('J5 debriefTotals: whole €M totals from potentialLossM + damageBill', () => {
  // Team B (prompt): damages [230.4, 63, 56], potentials [400, 300, 400].
  const teamB = debriefTotals([
    { damageBill: 230.4, potentialLossM: 400 },
    { damageBill: 63, potentialLossM: 300 },
    { damageBill: 56, potentialLossM: 400 },
  ])
  assert.equal(teamB.totalPotential, 1100)
  assert.equal(teamB.totalDamageShown, 349) // 230 + 63 + 56
  assert.equal(teamB.avoidedShown, 751)      // 1100 − 349
  assert.equal(teamB.avoidedPct, 68)         // from raw (1 − 349.4/1100)

  // Team A (prompt): damages [178, 106, 184], potentials [200, 200, 400].
  const teamA = debriefTotals([
    { damageBill: 178, potentialLossM: 200 },
    { damageBill: 106, potentialLossM: 200 },
    { damageBill: 184, potentialLossM: 400 },
  ])
  assert.equal(teamA.totalPotential, 800)
  assert.equal(teamA.totalDamageShown, 468) // 178 + 106 + 184
  assert.equal(teamA.avoidedShown, 332)      // 800 − 468
  assert.equal(teamA.avoidedPct, 42)         // from raw (1 − 468/800)
})
