import { useEffect, useRef, useState } from 'react'
import { COLOR_HEX } from '../styles/tokens.js'
import { buildGeometry, spinTo, landingAngle, WHEEL_TURNS } from '../utils/wheelMath.js'

// Cosmetic event-roulette wheel. The SERVER decides the event; this only animates
// a spin that decelerates onto `resultCode`. Slice sizes are proportional to the
// port's exposure weights (weight/10 of the circle); each slice carries its
// hazard's colour, icon and word.
//
// The result is RECEIVED (resultCode) as soon as the server answers, but it is
// only REVEALED when the spin animation ends (transitionend, timer fallback):
// every other slice fades to 35% and the drawn slice gets a thick ink outline —
// the drawn slice is NEVER re-filled (its own colour stays). onReveal() fires
// then. Honours prefers-reduced-motion (no long spin; reveal straight away).

// Event code → the word shown on the wheel.
export const EVENT_WORDS = {
  SS: 'SURGE', RF: 'FLOOD', HW: 'HEAT', WS: 'WIND',
  DR: 'DROUGHT', WF: 'WILDFIRE', SI: 'SNOW & ICE',
}

// Hazard colours (match the printed cards / events sheet).
const EVENT_COLOR = { SS: '#77AEF1', RF: '#4177C0', HW: '#E3BF40', WS: '#5C6B7A', DR: '#C5E4FF', WF: '#0B1B33', SI: '#7B6FE0' }
// Slices whose colour is light enough to take ink text/icons; the rest take white.
const LABEL_INK = new Set(['SS', 'HW', 'DR'])

const SPIN_MS = 4200

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

// Simple stroke icon per hazard, drawn in a ~6-unit box centred on (0,0). Kept
// deliberately minimal and upright; the repo has no hazard icon set to reuse.
function EventIcon({ code, color }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 0.55, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (code) {
    case 'SS': return <g {...p}><path d="M-3,1.4 q1.5,-1.6 3,0 q1.5,1.6 3,0" /><path d="M0,-0.2 L0,-2.8" /><path d="M-1,-1.6 L0,-2.9 L1,-1.6" /></g>
    case 'RF': return <g {...p}><path d="M-2.6,0.1 a1.4,1.4 0 0 1 0.4,-2.75 a1.9,1.9 0 0 1 3.7,0.15 a1.3,1.3 0 0 1 -0.2,2.6 Z" /><path d="M-1.6,1 L-2.1,2.5 M0.1,1 L-0.4,2.5 M1.8,1 L1.3,2.5" /></g>
    case 'HW': return <g {...p}><path d="M0,-2.6 L0,1.3" /><circle cx="0" cy="2.1" r="1.1" /><path d="M-1,-1.8 L-0.2,-1.8 M-1,-0.4 L-0.2,-0.4 M-1,1 L-0.2,1" /></g>
    case 'WS': return <g {...p}><path d="M-3,-1.4 q3.2,-0.9 4,0.5 q0.3,1 -0.9,1" /><path d="M-3,0.3 q4,-0.9 4.9,0.7 q0.3,1.1 -1,1" /><path d="M-2.4,1.9 q2.6,-0.6 3.2,0.5" /></g>
    case 'DR': return <g {...p}><path d="M0,-2.6 q1.9,2.2 1.9,3.5 a1.9,1.9 0 1 1 -3.8,0 q0,-1.3 1.9,-3.5 Z" /><path d="M-2.8,2.8 L2.8,-2.8" /></g>
    case 'WF': return <g {...p}><path d="M0,2.8 a2.3,2.3 0 0 1 -1.7,-3.8 q0.3,1.1 1,1.3 q-0.9,-2.1 1,-3.6 q-0.3,2.1 1.3,3 a2.3,2.3 0 0 1 -1.6,3.1 Z" /></g>
    case 'SI': return <g {...p}><path d="M0,-3 L0,3 M-2.6,-1.5 L2.6,1.5 M-2.6,1.5 L2.6,-1.5" /></g>
    default: return null
  }
}

export default function EventWheel({ slices = [], resultCode, size = 420, animate = true, onReveal }) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const doAnimate = animate && !reducedMotion

  const geom = buildGeometry(slices)
  const target = geom.find(g => g.code === resultCode) || null

  // Result already known at mount AND not animating (reshowing a drawn team, or
  // reduced motion) → start already landed + revealed.
  const preLanded = !!target && !doAnimate
  const [rotation, setRotation] = useState(() => (preLanded ? landingAngle(target.mid) : 0))
  const [revealed, setRevealed] = useState(() => preLanded)
  const rotationRef = useRef(rotation)
  const spunFor = useRef(preLanded ? resultCode : null)
  const timerRef = useRef(null)
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  const reveal = () => {
    clearTimeout(timerRef.current)
    setRevealed(prev => {
      if (!prev) onRevealRef.current?.()
      return true
    })
  }

  useEffect(() => {
    if (!target) {
      if (resultCode == null) { spunFor.current = null; setRevealed(false) }
      return
    }
    if (spunFor.current === resultCode) return // never restart on an unrelated re-render
    spunFor.current = resultCode

    if (!doAnimate) {
      const next = spinTo(rotationRef.current, target.mid, 0)
      rotationRef.current = next
      setRotation(next)
      reveal()
      return
    }

    setRevealed(false)
    const next = spinTo(rotationRef.current, target.mid, WHEEL_TURNS)
    rotationRef.current = next
    const raf = requestAnimationFrame(() => setRotation(next))
    timerRef.current = setTimeout(reveal, SPIN_MS + 150)
    return () => { cancelAnimationFrame(raf); clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultCode, doAnimate])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function handleTransitionEnd(e) {
    // Only the wheel's own spin reveals — ignore the slices' opacity fades, which
    // bubble up here too.
    if (e.propertyName === 'transform') reveal()
  }

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
          <g onTransitionEnd={handleTransitionEnd} style={{
            transformOrigin: '50px 50px',
            transform: `rotate(${rotation}deg)`,
            transition: doAnimate ? `transform ${SPIN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)` : 'none',
          }}>
            {geom.map((g) => {
              const labelColor = LABEL_INK.has(g.code) ? COLOR_HEX.ink : COLOR_HEX.paper
              const isDrawn = !!resultCode && revealed && g.code === resultCode
              const faded = !!resultCode && revealed && g.code !== resultCode
              const [ix, iy] = polar(50, 50, 34, g.mid)
              const [wx, wy] = polar(50, 50, 21, g.mid)
              // Keep every word upright: flip the lower-half labels 180°.
              const labelRot = (g.mid > 90 && g.mid < 270) ? g.mid + 180 : g.mid
              const word = EVENT_WORDS[g.code] || g.code
              const parts = word.split(' & ')
              return (
                <g key={g.code} opacity={faded ? 0.35 : 1} style={{ transition: 'opacity 0.4s ease' }}>
                  <path d={arcPath(g.start, g.sweep)} fill={EVENT_COLOR[g.code] || COLOR_HEX.ice}
                    stroke={COLOR_HEX.ink} strokeWidth={isDrawn ? 1.8 : 0.5} />
                  <g transform={`translate(${ix} ${iy})`}><EventIcon code={g.code} color={labelColor} /></g>
                  <text x={wx} y={wy} fontSize={parts.length > 1 ? 3.3 : 4}
                    fontWeight="800" fill={labelColor} textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${labelRot} ${wx} ${wy})`} style={{ letterSpacing: '-0.02em' }}>
                    {parts.length > 1
                      ? parts.map((p, k) => <tspan key={k} x={wx} dy={k === 0 ? -1.7 : 3.4}>{p}{k === 0 ? ' &' : ''}</tspan>)
                      : word}
                  </text>
                </g>
              )
            })}
            <circle cx="50" cy="50" r="5" fill={COLOR_HEX.ink} />
          </g>
        </svg>
      </div>
    </div>
  )
}
