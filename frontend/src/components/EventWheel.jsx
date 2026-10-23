import { useEffect, useRef, useState } from 'react'
import { COLOR_HEX } from '../styles/tokens.js'
import { buildGeometry, spinTo, landingAngle, WHEEL_TURNS } from '../utils/wheelMath.js'
import { HazardIconPaths } from './HazardIcons.jsx'

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
              // Icon + code, always horizontal (no rotation), at ~60% of the radius.
              const [cx, cy] = polar(50, 50, 30, g.mid)
              const s = 10 / 24 // scale the 24×24 icon down into the 100-unit wheel
              return (
                <g key={g.code} opacity={faded ? 0.35 : 1} style={{ transition: 'opacity 0.4s ease' }}>
                  <path d={arcPath(g.start, g.sweep)} fill={EVENT_COLOR[g.code] || COLOR_HEX.ice}
                    stroke={COLOR_HEX.ink} strokeWidth={isDrawn ? 1.8 : 0.5} />
                  <g transform={`translate(${cx - 12 * s} ${cy - 2 - 12 * s}) scale(${s})`}
                    fill="none" stroke={labelColor} strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter">
                    <HazardIconPaths code={g.code} />
                  </g>
                  <text x={cx} y={cy + 6} fontSize={5} fontWeight="800" fill={labelColor}
                    textAnchor="middle" dominantBaseline="middle" style={{ letterSpacing: '0.04em' }}>
                    {g.code}
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
