import { useEffect, useRef, useState } from 'react'
import { COLOR_HEX } from '../styles/tokens.js'
import { buildGeometry, spinTo, landingAngle, WHEEL_TURNS } from '../utils/wheelMath.js'

// Cosmetic event-roulette wheel. The SERVER decides the event; this only animates
// a spin that decelerates onto `resultCode`. Slice sizes are proportional to the
// port's exposure weights (weight/10 of the circle). Words — not codes — sit on
// the slices.
//
// The result is RECEIVED (resultCode) as soon as the server answers, but it is
// only REVEALED — the drawn slice goes ink, the others dim, and onReveal() fires
// — when the spin animation actually ends (transitionend, with a timer fallback).
// Honours prefers-reduced-motion (no long spin; reveal straight away).

// Event code → the word shown on the wheel.
export const EVENT_WORDS = {
  SS: 'SURGE', RF: 'FLOOD', HW: 'HEAT', WS: 'WIND',
  DR: 'DROUGHT', WF: 'WILDFIRE', SI: 'SNOW & ICE',
}

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

  // When a result is already known at mount AND we're not animating (reshowing a
  // previously-drawn team, or reduced motion), start already landed + revealed.
  const preLanded = !!target && !doAnimate
  const [rotation, setRotation] = useState(() => (preLanded ? landingAngle(target.mid) : 0))
  const [revealed, setRevealed] = useState(() => preLanded)
  const rotationRef = useRef(rotation)
  const spunFor = useRef(preLanded ? resultCode : null) // the resultCode we've already launched for
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
    // Wheel cleared (new team / pre-spin): reset so the next result spins fresh.
    if (!target) {
      if (resultCode == null) { spunFor.current = null; setRevealed(false) }
      return
    }
    // Already handling this exact result — never restart on an unrelated re-render
    // (e.g. a socket update repainting the parent mid-spin).
    if (spunFor.current === resultCode) return
    spunFor.current = resultCode

    if (!doAnimate) {
      // Reduced motion / reshow: land immediately (minimal forward nudge) + reveal.
      const next = spinTo(rotationRef.current, target.mid, 0)
      rotationRef.current = next
      setRotation(next)
      reveal()
      return
    }

    setRevealed(false)
    const next = spinTo(rotationRef.current, target.mid, WHEEL_TURNS)
    rotationRef.current = next
    // Kick the transition on the next frame so it animates from the current angle.
    const raf = requestAnimationFrame(() => setRotation(next))
    // Fallback in case transitionend doesn't fire (SVG transform quirks).
    timerRef.current = setTimeout(reveal, SPIN_MS + 150)
    return () => { cancelAnimationFrame(raf); clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultCode, doAnimate])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function handleTransitionEnd(e) {
    if (e.propertyName === 'transform') reveal()
  }

  // Highlight only AFTER the reveal. Before then (spinning, or pre-spin), the
  // wheel just shows its alternating idle colours — never the answer.
  const sliceFill = (g, i) => {
    if (resultCode && revealed) return g.code === resultCode ? COLOR_HEX.ink : COLOR_HEX.ice
    return i % 2 === 0 ? COLOR_HEX.sky : COLOR_HEX.ice
  }
  const wordFill = (g) => (resultCode && revealed && g.code === resultCode) ? COLOR_HEX.paper : COLOR_HEX.ink

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
