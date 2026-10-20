import { useEffect, useRef, useState } from 'react'
import { COLOR_HEX } from '../styles/tokens.js'

// Cosmetic event-roulette wheel. The SERVER decides the event; this only
// animates a spin that decelerates onto `resultCode`. Slice sizes are
// proportional to the port's exposure weights (weight/10 of the circle),
// revealed only in the wheel phase. Words — not codes — sit on the slices.
// Purely visual: the caller shows the real result regardless. Honours
// prefers-reduced-motion.

// Event code → the word shown on the wheel.
export const EVENT_WORDS = {
  SS: 'SURGE', RF: 'FLOOD', HW: 'HEAT', WS: 'WIND',
  DR: 'DROUGHT', WF: 'WILDFIRE', SI: 'SNOW & ICE',
}

const TURNS = 5

const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)] // 0° at top, clockwise
}

function arcPath(start, sweep, r = 48, cx = 50, cy = 50) {
  if (sweep >= 359.999) {
    return `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r} Z`
  }
  const [x1, y1] = polar(cx, cy, r, start)
  const [x2, y2] = polar(cx, cy, r, start + sweep)
  const large = sweep > 180 ? 1 : 0
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`
}

export default function EventWheel({ slices = [], resultCode, size = 420 }) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Build geometry: cumulative angles from the top, clockwise. Only non-zero
  // weights get a slice; weights sum to 10.
  const live = slices.filter(s => (s.weight || 0) > 0)
  const total = live.reduce((s, x) => s + (x.weight || 0), 0) || 1
  let acc = 0
  const geom = live.map((s) => {
    const sweep = ((s.weight || 0) / total) * 360
    const g = { ...s, start: acc, sweep, mid: acc + sweep / 2 }
    acc += sweep
    return g
  })

  const target = geom.find(g => g.code === resultCode)
  const finalRotation = target ? (360 * TURNS - target.mid) : 0

  const [rotation, setRotation] = useState(reducedMotion ? -(target?.mid || 0) : 0)
  const started = useRef(false)

  useEffect(() => {
    if (reducedMotion || started.current || !target) return
    started.current = true
    const id = requestAnimationFrame(() => setRotation(finalRotation))
    return () => cancelAnimationFrame(id)
  }, [finalRotation, reducedMotion, target])

  // Before the spin (no resultCode): alternate sky/ice, ink words. After: the
  // drawn slice is ink with a white word; the rest dim to ice.
  const sliceFill = (g, i) => {
    if (resultCode) return g.code === resultCode ? COLOR_HEX.ink : COLOR_HEX.ice
    return i % 2 === 0 ? COLOR_HEX.sky : COLOR_HEX.ice
  }
  const wordFill = (g) => (resultCode && g.code === resultCode) ? COLOR_HEX.paper : COLOR_HEX.ink

  return (
    <div style={{ width: size, maxWidth: '100%' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
        {/* pointer (fixed at top, pointing down into the wheel) */}
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
          <polygon points="50,7 45,0 55,0" fill={COLOR_HEX.ink} />
        </svg>
        {/* wheel */}
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          <circle cx="50" cy="50" r="48.5" fill="none" stroke={COLOR_HEX.ink} strokeWidth="0.6" />
          <g style={{
            transformOrigin: '50px 50px',
            transform: `rotate(${rotation}deg)`,
            transition: reducedMotion ? 'none' : 'transform 4.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {geom.map((g, i) => (
              <path key={g.code} d={arcPath(g.start, g.sweep)} fill={sliceFill(g, i)} stroke={COLOR_HEX.ink} strokeWidth={0.5} />
            ))}
            {geom.map(g => {
              const [lx, ly] = polar(50, 50, 30, g.mid)
              const word = EVENT_WORDS[g.code] || g.code
              const parts = word.split(' & ')
              return (
                <text key={g.code} x={lx} y={ly} fontSize={parts.length > 1 ? 3.4 : 4}
                  fontWeight="800" fill={wordFill(g)} textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${g.mid} ${lx} ${ly})`} style={{ letterSpacing: '-0.02em' }}>
                  {parts.length > 1
                    ? parts.map((p, k) => <tspan key={k} x={lx} dy={k === 0 ? -1.8 : 3.6}>{p}{k === 0 ? ' &' : ''}</tspan>)
                    : word}
                </text>
              )
            })}
            <circle cx="50" cy="50" r="5" fill={COLOR_HEX.ink} />
          </g>
        </svg>
      </div>
    </div>
  )
}
