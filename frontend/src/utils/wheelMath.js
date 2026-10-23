// Pure geometry + spin maths for the event wheel. No React, no DOM — so it is
// unit-testable on its own. Angles are in degrees, measured CLOCKWISE from the
// top (12 o'clock), where the fixed pointer sits. The wheel <g> is rotated by a
// positive (clockwise) CSS rotation; a feature at wheel-angle θ therefore ends up
// at screen-angle (θ + rotation). The pointer is at screen-angle 0, so the
// wheel-angle sitting under it is (−rotation) mod 360.

export const WHEEL_TURNS = 5

const mod360 = (x) => ((x % 360) + 360) % 360

// Proportional segments from weighted slices (weight > 0 only), laid out
// clockwise from the top. Returns [{ code, weight, start, sweep, mid }]. Weights
// are normalised, so they need not sum to any particular total.
export function buildGeometry(slices = []) {
  const live = slices.filter(s => (s.weight || 0) > 0)
  const total = live.reduce((sum, s) => sum + (s.weight || 0), 0) || 1
  let acc = 0
  return live.map(s => {
    const sweep = ((s.weight || 0) / total) * 360
    const g = { code: s.code, weight: s.weight || 0, start: acc, sweep, mid: acc + sweep / 2 }
    acc += sweep
    return g
  })
}

// The wheel rotation (mod 360) that brings wheel-angle `mid` under the pointer.
export function landingAngle(mid) {
  return mod360(-mid)
}

// An absolute rotation that lands `mid` under the pointer, spinning FORWARD from
// `current` by at least `turns` full turns. The result is always > `current`
// (for turns >= 1), so consecutive spins never snap back or reverse.
export function spinTo(current, mid, turns = WHEEL_TURNS) {
  const forward = mod360(landingAngle(mid) - current) // 0..360 to the landing point
  return current + forward + turns * 360
}

// Wheel-angle currently under the fixed top pointer for a given rotation.
export function pointerAngle(rotation) {
  return mod360(-rotation)
}

// The segment under the pointer at `rotation`, or null. Uses a tiny epsilon so a
// pointer that lands exactly on a shared border resolves deterministically.
export function segmentAtPointer(geom, rotation) {
  const a = pointerAngle(rotation)
  return geom.find(g => a >= g.start - 1e-9 && a < g.start + g.sweep - 1e-9) || null
}
