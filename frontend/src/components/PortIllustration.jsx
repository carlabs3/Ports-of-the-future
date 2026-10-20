import { COLOR_HEX as C } from '../styles/tokens.js'

// Flat, brand-coloured port scene (sea, ship, cranes, containers) with the
// port's two highest-exposure events drawn as motifs. The motifs are passed in
// as event codes (server-derived from the secret exposure weights), so this one
// component covers every port — no hand-coded per-port SVGs. Rendered ONLY in
// the Roulette and Debrief tabs (it reveals exposure).

// One motif per event code. Each returns SVG elements drawn over the scene.
const MOTIFS = {
  // SURGE — big waves rolling in
  SS: (
    <g key="SS" fill="none" stroke={C.harbour} strokeWidth="3" strokeLinecap="round">
      <path d="M8 54 q10 -9 20 0 q10 9 20 0 q10 -9 20 0" />
      <path d="M8 64 q10 -9 20 0 q10 9 20 0 q10 -9 20 0" opacity="0.6" />
    </g>
  ),
  // FLOOD — rain
  RF: (
    <g key="RF" stroke={C.harbour} strokeWidth="2.4" strokeLinecap="round">
      {[14, 28, 42, 56, 70].map((x, i) => <line key={i} x1={x} y1={16} x2={x - 5} y2={30} />)}
      {[21, 35, 49, 63].map((x, i) => <line key={'b' + i} x1={x} y1={34} x2={x - 5} y2={48} opacity="0.6" />)}
    </g>
  ),
  // HEAT — sun
  HW: (
    <g key="HW" stroke={C.signal} strokeWidth="2.6" strokeLinecap="round">
      <circle cx="188" cy="30" r="12" fill={C.signal} stroke="none" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4
        return <line key={i} x1={188 + Math.cos(a) * 17} y1={30 + Math.sin(a) * 17} x2={188 + Math.cos(a) * 23} y2={30 + Math.sin(a) * 23} />
      })}
    </g>
  ),
  // WIND — gust lines
  WS: (
    <g key="WS" fill="none" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 26 h40 a7 7 0 1 0 -7 -7" />
      <path d="M12 40 h58 a7 7 0 1 1 -7 7" />
      <path d="M12 54 h30" opacity="0.6" />
    </g>
  ),
  // DROUGHT — low water line + cracks
  DR: (
    <g key="DR" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round">
      <line x1="8" y1="58" x2="96" y2="58" strokeDasharray="6 5" />
      <path d="M24 64 l4 6 l-3 5 M52 64 l-4 6 l4 5 M78 64 l3 6 l-4 5" fill="none" />
    </g>
  ),
  // WILDFIRE — flames on the hinterland
  WF: (
    <g key="WF">
      {[20, 38, 56].map((x, i) => (
        <path key={i} d={`M${x} 60 q-6 -10 0 -18 q4 6 6 2 q3 8 -2 16 z`} fill={i === 1 ? C.signal : C.ink} />
      ))}
    </g>
  ),
  // SNOW & ICE — snowflakes
  SI: (
    <g key="SI" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round">
      {[[20, 22], [44, 36], [68, 20], [32, 50], [60, 52]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} opacity={i % 2 ? 0.6 : 1}>
          <line x1="-5" y1="0" x2="5" y2="0" /><line x1="0" y1="-5" x2="0" y2="5" />
          <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" /><line x1="-3.5" y1="3.5" x2="3.5" y2="-3.5" />
        </g>
      ))}
    </g>
  ),
}

export default function PortIllustration({ motifs = [], size = 220, style }) {
  return (
    <svg viewBox="0 0 220 140" width={size} style={{ display: 'block', maxWidth: '100%', height: 'auto', border: `1px solid ${C.ink}`, ...style }}>
      {/* sky + sea */}
      <rect x="0" y="0" width="220" height="100" fill={C.ice} />
      <rect x="0" y="100" width="220" height="40" fill={C.harbour} />
      {/* quay */}
      <rect x="0" y="96" width="220" height="5" fill={C.ink} />

      {/* crane */}
      <g stroke={C.ink} strokeWidth="3" fill="none" strokeLinecap="square">
        <line x1="44" y1="96" x2="44" y2="38" />
        <line x1="44" y1="40" x2="92" y2="40" />
        <line x1="44" y1="44" x2="52" y2="52" />
        <line x1="84" y1="40" x2="84" y2="58" />
      </g>
      <rect x="77" y="58" width="14" height="10" fill={C.signal} stroke={C.ink} strokeWidth="1.5" />

      {/* ship hull + containers */}
      <path d="M108 100 l10 14 h74 l10 -14 z" fill={C.ink} />
      <g stroke={C.ink} strokeWidth="1.5">
        <rect x="116" y="86" width="20" height="14" fill={C.harbour} />
        <rect x="138" y="86" width="20" height="14" fill={C.signal} />
        <rect x="160" y="86" width="20" height="14" fill={C.ice} />
        <rect x="127" y="72" width="20" height="14" fill={C.ice} />
        <rect x="149" y="72" width="20" height="14" fill={C.harbour} />
      </g>

      {/* dockside containers */}
      <g stroke={C.ink} strokeWidth="1.5">
        <rect x="6" y="84" width="16" height="12" fill={C.harbour} />
        <rect x="22" y="84" width="16" height="12" fill={C.ice} />
      </g>

      {/* exposure motifs */}
      {motifs.map(code => MOTIFS[code]).filter(Boolean)}
    </svg>
  )
}
