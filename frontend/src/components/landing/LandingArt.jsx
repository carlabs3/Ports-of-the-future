import { COLOR_HEX as C } from '../../styles/tokens.js'

// Flat SVG illustrations for the landing, generated from path data (no external
// assets). Hex values from the generator are mapped to the brand tokens:
//   #FFFFFF→paper  #0B1B33→ink  #4177C0→harbour  #E3BF40→signal  #C5E4FF→ice
const P = C.paper, I = C.ink, H = C.harbour, S = C.signal, ICE = C.ice

const F = (d, fill) => ({ d, fill, stroke: 'none', sw: '0' })
const L = (d, color, w) => ({ d, fill: 'none', stroke: color, sw: String(w) })

function panoramaPaths() {
  const out = []
  const cloud = (x, y, s) => 'M' + x + ' ' + y + 'a' + (22 * s) + ' ' + (22 * s) + ' 0 0 1 ' + (12 * s) + ' ' + (-40 * s) + 'a' + (30 * s) + ' ' + (30 * s) + ' 0 0 1 ' + (56 * s) + ' ' + (-4 * s) + 'a' + (24 * s) + ' ' + (24 * s) + ' 0 0 1 ' + (40 * s) + ' ' + (22 * s) + 'a' + (20 * s) + ' ' + (20 * s) + ' 0 0 1 ' + (4 * s) + ' ' + (22 * s) + 'z'
  out.push(F(cloud(180, 120, 1), P), F(cloud(520, 80, 0.7), P))
  out.push(F(cloud(1180, 150, 1.9), I))
  let rain = ''
  for (let i = 0; i < 9; i++) { const x = 1210 + i * 24; rain += 'M' + x + ' 170l-14 40' }
  out.push(L(rain, I, 4))
  out.push(F('M0 286H1440V360H0Z', H))
  out.push(F('M600 256H1440V286H600Z', I))
  ;[660, 860, 1060].forEach(x => {
    out.push(L('M' + x + ' 256V116M' + (x + 30) + ' 256V116M' + (x - 50) + ' 116H' + (x + 210) + 'M' + x + ' 116L' + (x + 70) + ' 76L' + (x + 210) + ' 116M' + (x + 160) + ' 116V170', I, 10))
  })
  const cols = [S, P, ICE, H, P, S]
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const x = 1240 + c * 48 + (r % 2) * 12, y = 228 - r * 26
    if (r === 2 && c > 2) continue
    out.push(F('M' + x + ' ' + y + 'h44v24h-44z', cols[(r * 4 + c) % cols.length]))
  }
  out.push(F('M60 266H540L506 312H96Z', I))
  out.push(F('M86 200H134V266H86Z', P), F('M92 210H128V222H92Z', H))
  for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) {
    const x = 160 + c * 44, y = 240 - r * 26
    out.push(F('M' + x + ' ' + y + 'h40v24h-40z', cols[(r * 3 + c) % cols.length]))
  }
  out.push(L('M0 318q30-14 60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0', P, 5))
  out.push(L('M30 342q30-12 60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0t60 0', ICE, 4))
  return out
}

const PANORAMA = panoramaPaths()

function renderPaths(paths) {
  return paths.map((p, i) => (
    <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw}
      strokeLinecap="round" strokeLinejoin="round" />
  ))
}

export function PortPanorama({ alt = '' }) {
  return (
    <svg viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice" role="img" aria-label={alt}
      style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '4 / 1' }}>
      {renderPaths(PANORAMA)}
    </svg>
  )
}

// Step pictograms in step order (Assess, Decide, Face it, Learn).
const STEP_ICONS = [
  [L('M18 68A42 42 0 0 1 102 68', I, 8), L('M60 68L84 36', H, 7), F('M54 68a6 6 0 1 0 12 0a6 6 0 1 0-12 0z', I)],
  [F('M18 40h22v32H18z', P), F('M49 22h22v50H49z', S), F('M80 50h22v22H80z', P), L('M10 72H110', I, 4)],
  [F('M24 46a16 16 0 0 1 8-30a22 22 0 0 1 40-2a18 18 0 0 1 22 32z', I), F('M60 44l-12 20h12l-6 16l20-26H62l8-10z', S)],
  [L('M14 66L42 50L66 56L104 18', I, 7), F('M98 14h12v12H98z', S), L('M14 74H106', I, 3)],
]

export function StepIcon({ index }) {
  const paths = STEP_ICONS[index] || []
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true" style={{ display: 'block', width: '62%', height: 'auto' }}>
      {renderPaths(paths)}
    </svg>
  )
}
