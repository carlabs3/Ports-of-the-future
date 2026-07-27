import { useEffect, useRef, useState } from 'react'

// Cosmetic event-roulette wheel. The SERVER decides the event; this only
// animates a spin that decelerates onto `resultCode`. Slice sizes are
// proportional to the port's exposure weights (weight/10 of the circle),
// revealed only in the wheel phase. Purely visual: the caller shows the real
// result regardless of whether this animates. Honours prefers-reduced-motion.

const SLICE_COLORS = ['#38bdf8', '#f59e0b', '#4ade80', '#a855f7', '#f472b6', '#22d3ee', '#fb7185']
const TURNS = 5

const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)] // 0° at top, clockwise
}

function arcPath(start, sweep, r = 48, cx = 50, cy = 50) {
  if (sweep >= 359.999) {
    // full circle fallback (shouldn't happen with 7 slices summing to 10)
    return `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r} Z`
  }
  const [x1, y1] = polar(cx, cy, r, start)
  const [x2, y2] = polar(cx, cy, r, start + sweep)
  const large = sweep > 180 ? 1 : 0
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`
}

export default function EventWheel({ slices = [], resultCode, size = 260 }) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Build geometry: cumulative angles from the top, clockwise. weights sum 10.
  const total = slices.reduce((s, x) => s + (x.weight || 0), 0) || 1
  let acc = 0
  const geom = slices.map((s, i) => {
    const sweep = ((s.weight || 0) / total) * 360
    const g = { ...s, start: acc, sweep, mid: acc + sweep / 2, color: SLICE_COLORS[i % SLICE_COLORS.length] }
    acc += sweep
    return g
  })

  // Target rotation so the result slice's centre lands under the top pointer.
  const target = geom.find(g => g.code === resultCode)
  const finalRotation = target ? (360 * TURNS - target.mid) : 0

  const [rotation, setRotation] = useState(reducedMotion ? -(target?.mid || 0) : 0)
  const started = useRef(false)

  useEffect(() => {
    if (reducedMotion || started.current || !target) return
    started.current = true
    // next frame so the transition animates from 0 → finalRotation
    const id = requestAnimationFrame(() => setRotation(finalRotation))
    return () => cancelAnimationFrame(id)
  }, [finalRotation, reducedMotion, target])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* pointer (fixed at top, pointing down into the wheel) */}
        <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
          <polygon points="50,6 45,-2 55,-2" fill="#0a0a0a" transform="translate(0,2)" />
        </svg>
        {/* wheel */}
        <svg width={size} height={size} viewBox="0 0 100 100">
          <g
            style={{
              transformOrigin: '50px 50px',
              transform: `rotate(${rotation}deg)`,
              transition: reducedMotion ? 'none' : 'transform 4.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {geom.map(g => (
              <path key={g.code} d={arcPath(g.start, g.sweep)} fill={g.color} stroke="#fff" strokeWidth={0.6} />
            ))}
            {geom.map(g => {
              const [lx, ly] = polar(50, 50, 32, g.mid)
              return (
                <text key={g.code} x={lx} y={ly} fontSize={5.5} fontWeight="700"
                  fill="rgba(0,0,0,0.75)" textAnchor="middle" dominantBaseline="middle">
                  {g.code}
                </text>
              )
            })}
            <circle cx="50" cy="50" r="6" fill="#0a0a0a" />
          </g>
        </svg>
      </div>

      {/* legend: code · name · probability (weight×10%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px', fontSize: 11, width: '100%', maxWidth: 340 }}>
        {geom.map(g => (
          <div key={g.code} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: g.weight ? 1 : 0.4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: g.color, flexShrink: 0 }} />
            <span style={{ color: g.code === resultCode ? '#0a0a0a' : '#666', fontWeight: g.code === resultCode ? 700 : 400 }}>
              {g.name} · {g.weight * 10}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
