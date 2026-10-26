import { useEffect, useRef, useState } from 'react'
import { COLOR_HEX } from '../styles/tokens.js'
import { buildGeometry, spinTo, landingAngle, WHEEL_TURNS } from '../utils/wheelMath.js'
import { HazardIconPaths } from './HazardIcons.jsx'

// Game-show event wheel. The SERVER decides the event; this animates a spin that
// decelerates onto `resultCode`. The spin is driven by requestAnimationFrame
// (ease-out, same total duration as before) so the current angle is known each
// frame — that drives the flapper kick and the optional click sound.
//
// Static layers (never rotate): hard offset shadow, thick ink rim with a white
// gap ring, the flapper pointer, the hub. Rotating layer: the slices (colour +
// icon + code), the rim pegs and the 12° studs. The result is REVEALED only once
// the wheel stops — other slices fade to 40%, the drawn slice takes a thick ink
// outline — and onReveal() fires then. Honours prefers-reduced-motion.

export const EVENT_WORDS = {
  SS: 'SURGE', RF: 'FLOOD', HW: 'HEAT', WS: 'WIND',
  DR: 'DROUGHT', WF: 'WILDFIRE', SI: 'SNOW & ICE',
}

const EVENT_COLOR = { SS: '#77AEF1', RF: '#4177C0', HW: '#E3BF40', WS: '#5C6B7A', DR: '#C5E4FF', WF: '#0B1B33', SI: '#7B6FE0' }
const LABEL_INK = new Set(['SS', 'HW', 'DR'])

const SPIN_MS = 4200
// Radii in the 100-unit viewBox.
const R_SLICE = 42, R_GAP = 44, R_RIM = 48, R_PEG = 46, R_ICON = 25, HUB_R = 10.5, SHADOW = 3

const polar = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)] // 0° at top, clockwise
}

function arcPath(start, sweep, r = R_SLICE, cx = 50, cy = 50) {
  if (sweep >= 359.999) return `M${cx},${cy - r} A${r},${r} 0 1 1 ${cx - 0.01},${cy - r} Z`
  const [x1, y1] = polar(cx, cy, r, start)
  const [x2, y2] = polar(cx, cy, r, start + sweep)
  const large = sweep > 180 ? 1 : 0
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`
}

const easeOut = p => 1 - Math.pow(1 - p, 3)
const inkOrWhite = (hex) => {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return COLOR_HEX.ink
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? COLOR_HEX.ink : '#FFFFFF'
}

export default function EventWheel({ slices = [], resultCode, size = 440, animate = true, onReveal, portColour = '#C5E4FF', onPeg }) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const doAnimate = animate && !reducedMotion

  const geom = buildGeometry(slices)
  const target = geom.find(g => g.code === resultCode) || null
  const preLanded = !!target && !doAnimate

  const [rotation, setRotation] = useState(() => (preLanded ? landingAngle(target.mid) : 0))
  const [revealed, setRevealed] = useState(() => preLanded)
  const [flapper, setFlapper] = useState(0)
  const rotationRef = useRef(rotation)
  const spunFor = useRef(preLanded ? resultCode : null)
  const rafRef = useRef(0)
  const studRef = useRef(Math.floor(rotation / 12))
  const flapperRef = useRef(0)
  const onRevealRef = useRef(onReveal); onRevealRef.current = onReveal
  const onPegRef = useRef(onPeg); onPegRef.current = onPeg

  const reveal = () => setRevealed(prev => { if (!prev) onRevealRef.current?.(); return true })

  useEffect(() => {
    if (!target) {
      if (resultCode == null) { spunFor.current = null; setRevealed(false) }
      return
    }
    if (spunFor.current === resultCode) return
    spunFor.current = resultCode

    if (!doAnimate) {
      const next = spinTo(rotationRef.current, target.mid, 0)
      rotationRef.current = next; studRef.current = Math.floor(next / 12)
      setRotation(next); reveal()
      return
    }

    setRevealed(false)
    const from = rotationRef.current
    const to = spinTo(from, target.mid, WHEEL_TURNS)
    const start = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - start) / SPIN_MS)
      const rot = from + (to - from) * easeOut(p)
      rotationRef.current = rot
      setRotation(rot)
      // Every 12° of travel, a peg/stud passes the flapper: kick it + tick.
      const studs = Math.floor(rot / 12)
      if (studs > studRef.current) {
        studRef.current = studs
        flapperRef.current = 20
        onPegRef.current?.()
      }
      flapperRef.current *= 0.75 // spring back
      setFlapper(flapperRef.current)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
      else { rotationRef.current = to; setRotation(to); flapperRef.current = 0; setFlapper(0); reveal() }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultCode, doAnimate])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // Rim pegs at every slice boundary; small studs every 12° between them.
  const pegAngles = geom.map(g => g.start)
  const studAngles = Array.from({ length: 30 }, (_, i) => i * 12)
  const hubText = inkOrWhite(portColour)

  return (
    <div style={{ width: size, maxWidth: '100%' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* static: hard offset shadow */}
          <circle cx={50 + SHADOW} cy={50 + SHADOW} r={R_RIM} fill="#4177C0" />
          {/* static: thick ink rim + white gap ring */}
          <circle cx="50" cy="50" r={R_RIM} fill={COLOR_HEX.ink} />
          <circle cx="50" cy="50" r={R_GAP} fill={COLOR_HEX.paper} />

          {/* rotating layer */}
          <g style={{ transformOrigin: '50px 50px', transform: `rotate(${rotation}deg)` }}>
            {geom.map((g) => {
              const labelColor = LABEL_INK.has(g.code) ? COLOR_HEX.ink : COLOR_HEX.paper
              const isDrawn = !!resultCode && revealed && g.code === resultCode
              const faded = !!resultCode && revealed && g.code !== resultCode
              const [cx, cy] = polar(50, 50, R_ICON, g.mid)
              const s = 10 / 24
              return (
                <g key={g.code} opacity={faded ? 0.4 : 1} style={{ transition: 'opacity 0.35s ease' }}>
                  <path d={arcPath(g.start, g.sweep)} fill={EVENT_COLOR[g.code] || COLOR_HEX.ice}
                    stroke={COLOR_HEX.ink} strokeWidth={isDrawn ? 1.8 : 0.5} />
                  <g transform={`translate(${cx - 12 * s} ${cy - 2 - 12 * s}) scale(${s})`}
                    fill="none" stroke={labelColor} strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter">
                    <HazardIconPaths code={g.code} />
                  </g>
                  <text x={cx} y={cy + 6} fontSize={5} fontWeight="800" fill={labelColor}
                    textAnchor="middle" dominantBaseline="middle" style={{ letterSpacing: '0.04em' }}>{g.code}</text>
                </g>
              )
            })}
            {studAngles.map(a => {
              const [x, y] = polar(50, 50, R_PEG, a)
              return <circle key={`s${a}`} cx={x} cy={y} r={0.7} fill={COLOR_HEX.paper} stroke={COLOR_HEX.ink} strokeWidth={0.3} />
            })}
            {pegAngles.map((a, i) => {
              const [x, y] = polar(50, 50, R_PEG, a)
              return <circle key={`p${i}`} cx={x} cy={y} r={1.5} fill={COLOR_HEX.paper} stroke={COLOR_HEX.ink} strokeWidth={0.5} />
            })}
          </g>

          {/* static: hub — white disc, port-colour inner, SPIN (never rotates) */}
          <circle cx="50" cy="50" r={HUB_R} fill={COLOR_HEX.paper} stroke={COLOR_HEX.ink} strokeWidth={1.1} />
          <circle cx="50" cy="50" r={HUB_R - 3.2} fill={portColour} />
          <text x="50" y="50" fontSize={4.6} fontWeight="800" fill={hubText}
            fontFamily="Inter Tight, sans-serif" textAnchor="middle" dominantBaseline="central" style={{ letterSpacing: '0.06em' }}>SPIN</text>

          {/* static: flapper pointer at the top — kicks when a peg passes */}
          <g style={{ transformOrigin: '50px 3px', transform: `rotate(${flapper}deg)` }}>
            <polygon points="50,13 46.3,2.5 53.7,2.5" fill="#E3BF40" stroke={COLOR_HEX.ink} strokeWidth={0.9} strokeLinejoin="miter" />
            <circle cx="50" cy="3" r={1.1} fill={COLOR_HEX.ink} />
          </g>
        </svg>
      </div>
    </div>
  )
}
