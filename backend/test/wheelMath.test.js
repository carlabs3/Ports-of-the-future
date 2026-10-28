import { test } from 'node:test'
import assert from 'node:assert/strict'
// Pure wheel maths live with the frontend component but have no React/DOM deps,
// so they run here in the backend's node:test suite against the REAL per-round
// wheel likelihoods (v5) — the geometry participants actually see. Each port now
// has three wheels (rounds = years 2026/2031/2036); the geometry is exercised for
// all of them.
import { buildGeometry, spinTo, pointerAngle, segmentAtPointer, WHEEL_TURNS } from '../../frontend/src/utils/wheelMath.js'
import { PORTS } from '../src/config/ports/index.js'
import { EVENT_CODES } from '../src/config/events.js'

const ROUNDS = [1, 2, 3]
const slicesFor = (p, round) => EVENT_CODES.map(c => ({ code: c, weight: p.wheels[round].likelihoods[c] || 0 }))

test('every port/round wheel: spinning to each segment lands the pointer inside that segment', () => {
  for (const p of PORTS) {
    for (const round of ROUNDS) {
      const geom = buildGeometry(slicesFor(p, round))
      assert.ok(geom.length >= 2, `${p.name} r${round} should have at least 2 slices`)
      for (const g of geom) {
        const R = spinTo(0, g.mid)
        // Always forward, at least the full-turn minimum.
        assert.ok(R >= WHEEL_TURNS * 360, `${p.name}/r${round}/${g.code}: not enough turns (${R})`)
        // The pointer sits exactly at the segment mid, strictly inside its arc
        // (never on a border between two slices).
        const a = pointerAngle(R)
        assert.ok(Math.abs(a - g.mid) < 1e-6, `${p.name}/r${round}/${g.code}: pointer ${a} ≠ mid ${g.mid}`)
        assert.ok(a > g.start + 1e-9 && a < g.start + g.sweep - 1e-9, `${p.name}/r${round}/${g.code}: landed on a border`)
        // And resolving the pointer back to a segment gives the drawn one.
        assert.equal(segmentAtPointer(geom, R)?.code, g.code, `${p.name}/r${round}/${g.code}: resolved to the wrong segment`)
      }
    }
  }
})

test('consecutive spins are always forward — rotation strictly increases, never reverses or snaps back', () => {
  const geom = buildGeometry(slicesFor(PORTS[0], 1))
  let cur = 0
  for (let i = 0; i < 12; i++) {
    const g = geom[i % geom.length]
    const next = spinTo(cur, g.mid)
    assert.ok(next > cur, `spin ${i}: did not advance (${next} ≤ ${cur})`)
    assert.equal(segmentAtPointer(geom, next)?.code, g.code, `spin ${i}: wrong segment`)
    cur = next
  }
})

test('reduced-motion align (0 extra turns) still lands inside the segment and never reverses', () => {
  for (const p of PORTS) {
    for (const round of ROUNDS) {
      const geom = buildGeometry(slicesFor(p, round))
      let cur = 97.3 // arbitrary non-zero starting angle
      for (const g of geom) {
        const next = spinTo(cur, g.mid, 0)
        assert.ok(next >= cur, `${p.name}/r${round}/${g.code}: reversed`)
        assert.equal(segmentAtPointer(geom, next)?.code, g.code, `${p.name}/r${round}/${g.code}: wrong segment (0 turns)`)
        cur = next
      }
    }
  }
})
