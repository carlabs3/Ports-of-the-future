// Money readers (J1/J3): units are decided by an explicit marker, never by
// guessing which fields are present. These pin the three entry shapes the readers
// must tell apart — the bug was a new €M entry being read as coins ×1000.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roundPotentialM, roundDamageM } from '../src/services/roundMoney.js'

test('current €M entry (moneyUnit=eurM): read as-is, no ×1000', () => {
  const r = { moneyUnit: 'eurM', potentialLossM: 300, damageBill: 267, drawnEvent: 'SI' }
  assert.equal(roundPotentialM(r), 300)
  assert.equal(roundDamageM(r), 267)
})

test('€M entry with potentialLossM stripped on save: recovered from the drawn event', () => {
  // This is the production bug: Mongoose dropped potentialLossM; damageBill is €M.
  // No `impact`, so it is NOT a coin entry — must not be ×1000.
  const r = { moneyUnit: 'eurM', damageBill: 544.32, drawnEvent: 'SS' }
  assert.equal(roundPotentialM(r), 600) // SS canonical loss (J1), not 0
  assert.equal(roundDamageM(r), 544.32) // not 544320
})

test('pre-marker €M entry (no moneyUnit, no impact): still treated as €M', () => {
  const r = { damageBill: 173, drawnEvent: 'WF' }
  assert.equal(roundPotentialM(r), 300) // WF canonical
  assert.equal(roundDamageM(r), 173)
})

test('legacy coin entry (impact set, no moneyUnit): converts ×1000', () => {
  const r = { impact: 5, damageBill: 2.5, drawnEvent: 'SS' }
  assert.equal(roundPotentialM(r), 5000)  // 5 coins × €1000M
  assert.equal(roundDamageM(r), 2500)     // 2.5 coins × €1000M
})

test('legacy v4 entry (lossValue set): treated as coins ×1000', () => {
  const r = { lossValue: 4, impact: 4, damageBill: 1.2 }
  assert.equal(roundDamageM(r), 1200)
})

test('unreadable entry (no potential, no event): potential 0, damage 0', () => {
  const r = { moneyUnit: 'eurM', damageBill: 0 }
  assert.equal(roundPotentialM(r), 0) // caller must render "—"
  assert.equal(roundDamageM(r), 0)
})
