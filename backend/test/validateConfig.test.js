import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateConfig } from '../src/config/validateConfig.js'
import { EVENTS } from '../src/config/events.js'
import { MEASURES, MEASURES_BY_ID } from '../src/config/measures.js'
import { PORTS, PORTS_BY_ID } from '../src/config/ports/index.js'

// Deep clone the real ports so a fixture can break one field without touching the
// live config (ports are plain data — JSON clone is safe).
const clonePorts = () => JSON.parse(JSON.stringify(PORTS))
const cloneMeasures = () => JSON.parse(JSON.stringify(MEASURES))

test('validateConfig does not throw on the real v5 data', () => {
  const r = validateConfig()
  assert.deepEqual(r, { events: 7, measures: 28, ports: 6, cards: 85 })
})

test('spot-check measures (v5, 28, with new costs and #27/#28)', () => {
  assert.equal(MEASURES.length, 28)
  assert.equal(MEASURES_BY_ID[6].cost, 2)   // was 3
  assert.equal(MEASURES_BY_ID[9].cost, 4)   // was 3
  assert.equal(MEASURES_BY_ID[24].cost, 3)  // was 2
  assert.equal(MEASURES_BY_ID[26].cost, 1)  // was 2
  assert.equal(MEASURES_BY_ID[27].name, 'Snow & ice clearance fleet')
  assert.equal(MEASURES_BY_ID[27].cost, 2)
  assert.equal(MEASURES_BY_ID[27].protection.SI, 4)
  assert.equal(MEASURES_BY_ID[28].name, 'Harbour ice management')
  assert.equal(MEASURES_BY_ID[28].cost, 3)
  assert.equal(MEASURES_BY_ID[28].protection.SI, 5)
  const raisers = MEASURES.filter(m => m.raisesCultureLevel).map(m => m.id).sort((a, b) => a - b)
  assert.deepEqual(raisers, [19, 20])
})

test('spot-check ports (v5, decks + wheels, no impact table)', () => {
  assert.equal(PORTS.length, 6)
  // Deck changes: Nord-Maris loses #24, gains #27; Boreal gains #27 and #28.
  assert.ok(PORTS_BY_ID['nord-maris'].deck.includes(27))
  assert.ok(!PORTS_BY_ID['nord-maris'].deck.includes(24))
  assert.ok(PORTS_BY_ID['boreal'].deck.includes(27))
  assert.ok(PORTS_BY_ID['boreal'].deck.includes(28))
  // Three wheels per port, each summing to 100, with a year.
  for (const p of PORTS) {
    for (const round of [1, 2, 3]) {
      const w = p.wheels[round]
      assert.ok(typeof w.year === 'number', `${p.name} round ${round} year`)
      assert.equal(Object.values(w.likelihoods).reduce((s, v) => s + v, 0), 100, `${p.name} round ${round} sum`)
    }
  }
  // Appendix E/F spot values.
  assert.equal(PORTS_BY_ID['boreal'].wheels[1].likelihoods.SI, 40)
  assert.equal(PORTS_BY_ID['boreal'].wheels[1].year, 2026)
  // J1/J2/J6: ports no longer carry a per-port impact table or a round-3 override.
  assert.equal(PORTS_BY_ID['nord-maris'].impacts, undefined)
  assert.equal(PORTS_BY_ID['boreal'].impactRound3Plus, undefined)
})

// ── negatives: one broken fixture per validator rule ────────────────────────

test('negative: a likelihood that is not a multiple of 5 fails', () => {
  const ports = clonePorts()
  ports[0].wheels[1].likelihoods[Object.keys(ports[0].wheels[1].likelihoods)[0]] = 7
  assert.throws(() => validateConfig({ ports }), /multiple of 5/)
})

test('negative: a wheel whose likelihoods do not sum to 100 fails', () => {
  const ports = clonePorts()
  const codes = Object.keys(ports[0].wheels[2].likelihoods)
  ports[0].wheels[2].likelihoods[codes[0]] -= 5 // now sums to 95, still multiples of 5
  assert.throws(() => validateConfig({ ports }), /sum to 100/)
})

test('negative: an event with no potentialLossM fails (J2)', () => {
  const events = JSON.parse(JSON.stringify(EVENTS))
  delete events[0].potentialLossM
  assert.throws(() => validateConfig({ events }), /potentialLossM must be > 0/)
})

test('negative: an event with potentialLossM = 0 fails (J2)', () => {
  const events = JSON.parse(JSON.stringify(EVENTS))
  events[0].potentialLossM = 0
  assert.throws(() => validateConfig({ events }), /potentialLossM must be > 0/)
})

test('negative: a deck missing a shared card fails', () => {
  const ports = clonePorts()
  ports[0].deck = ports[0].deck.filter(id => id !== 8)
  assert.throws(() => validateConfig({ ports }), /missing shared card #8/)
})

test('negative: a deck with a non-existent card fails', () => {
  const ports = clonePorts()
  ports[0].deck.push(999)
  assert.throws(() => validateConfig({ ports }), /does not exist/)
})

test('negative: a total card count other than 85 fails', () => {
  const ports = clonePorts()
  ports[0].deck.pop() // 84 total (but keep shared cards intact)
  // dropping a non-shared card keeps the deck valid except for the total
  assert.throws(() => validateConfig({ ports }), /total card count must be 85/)
})

test('negative: a measure cost above 5 fails', () => {
  const measures = cloneMeasures()
  measures[0].cost = 6
  assert.throws(() => validateConfig({ measures }), /cost must be an integer 1–5/)
})

test('negative: a measure count other than 28 fails', () => {
  const measures = cloneMeasures().slice(0, 27)
  assert.throws(() => validateConfig({ measures }), /expected 28/)
})
