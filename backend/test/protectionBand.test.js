// Protection colour band (G3). Applied to the shown, rounded %. Boundaries:
// ≥70 Strong, 40–69 Partial, <40 Weak.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getProtectionBand } from '../../frontend/src/utils/protectionBand.js'

test('boundaries: 69 → Partial, 70 → Strong, 39 → Weak, 40 → Partial', () => {
  assert.equal(getProtectionBand(69).label, 'Partial protection')
  assert.equal(getProtectionBand(70).label, 'Strong protection')
  assert.equal(getProtectionBand(39).label, 'Weak protection')
  assert.equal(getProtectionBand(40).label, 'Partial protection')
})

test('icon and colour match each band', () => {
  assert.deepEqual(
    { icon: getProtectionBand(85).icon, color: getProtectionBand(85).color, bg: getProtectionBand(85).bg },
    { icon: '●', color: '#157347', bg: '#E3F4EA' })
  assert.deepEqual(
    { icon: getProtectionBand(42).icon, color: getProtectionBand(42).color, bg: getProtectionBand(42).bg },
    { icon: '◐', color: '#8A5A00', bg: '#FDF1D6' })
  assert.deepEqual(
    { icon: getProtectionBand(11).icon, color: getProtectionBand(11).color, bg: getProtectionBand(11).bg },
    { icon: '○', color: '#B42318', bg: '#FDE4E1' })
})
