// v5 migration: this v4 suite is skipped in Commit 1 and rewritten in Commit 2/3
import { test } from 'node:test'
import assert from 'node:assert/strict'
// Pure wheel maths live with the frontend component but have no React/DOM deps,
// so they run here in the backend's node:test suite against the REAL port
// exposure weights — the geometry participants actually see.
import { buildGeometry, spinTo, pointerAngle, segmentAtPointer, WHEEL_TURNS } from '../../frontend/src/utils/wheelMath.js'
import { PORTS } from '../src/config/ports/index.js'
import { EVENT_CODES } from '../src/config/events.js'

const slicesFor = (p) => EVENT_CODES.map(c => ({ code: c, weight: p.exposureWeights[c] || 0 }))

test.skip('every port wheel: spinning to each segment lands the pointer inside that segment', () => {
  for (const p of PORTS) {
    const geom = buildGeometry(slicesFor(p))
    assert.ok(geom.length >= 2, `${p.name} should have at least 2 slices`)
    for (const g of geom) {
      const R = spinTo(0, g.mid)
      // Always forward, at least the full-turn minimum.
      assert.ok(R >= WHEEL_TURNS * 360, `${p.name}/${g.code}: not enough turns (${R})`)
      // The pointer sits exactly at the segment mid, strictly inside its arc
      // (never on a border between two slices).
      const a = pointerAngle(R)
      assert.ok(Math.abs(a - g.mid) < 1e-6, `${p.name}/${g.code}: pointer ${a} ≠ mid ${g.mid}`)
      assert.ok(a > g.start + 1e-9 && a < g.start + g.sweep - 1e-9, `${p.name}/${g.code}: landed on a border`)
      // And resolving the pointer back to a segment gives the drawn one.
      assert.equal(segmentAtPointer(geom, R)?.code, g.code, `${p.name}/${g.code}: resolved to the wrong segment`)
    }
  }
})

test.skip('consecutive spins are always forward — rotation strictly increases, never reverses or snaps back', () => {
  const geom = buildGeometry(slicesFor(PORTS[0]))
  let cur = 0
  for (let i = 0; i < 12; i++) {
    const g = geom[i % geom.length]
    const next = spinTo(cur, g.mid)
    assert.ok(next > cur, `spin ${i}: did not advance (${next} ≤ ${cur})`)
    assert.equal(segmentAtPointer(geom, next)?.code, g.code, `spin ${i}: wrong segment`)
    cur = next
  }
})

test.skip('reduced-motion align (0 extra turns) still lands inside the segment and never reverses', () => {
  for (const p of PORTS) {
    const geom = buildGeometry(slicesFor(p))
    let cur = 97.3 // arbitrary non-zero starting angle
    for (const g of geom) {
      const next = spinTo(cur, g.mid, 0)
      assert.ok(next >= cur, `${p.name}/${g.code}: reversed`)
      assert.equal(segmentAtPointer(geom, next)?.code, g.code, `${p.name}/${g.code}: wrong segment (0 turns)`)
      cur = next
    }
  }
})
