// Hazard icons from the printed Ports of the Future materials. One shared module
// so the roulette wheel, the result square and the Strategy cards all render the
// same marks. Drawn on a 24×24 grid, fill none, stroke-width 2, square caps,
// miter joins; the caller supplies the stroke colour.

export const HAZARD_ICON_PATHS = {
  SS: [
    'M2 16c2 0 2-1.5 4-1.5S8 16 10 16s2-1.5 4-1.5S16 16 18 16s2-1.5 4-1.5',
    'M2 20.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5',
    'M12 11V3',
    'M8.5 6.5 12 3l3.5 3.5',
  ],
  RF: [
    'M6.5 14.5H17a3.5 3.5 0 0 0 .4-6.98A5.5 5.5 0 0 0 6.6 8.6a3 3 0 0 0-.1 5.9z',
    'M8.5 17.5 7.5 21',
    'M12.5 17.5 11.5 21',
    'M16.5 17.5 15.5 21',
  ],
  HW: [
    'M13 14.76V4.5a2 2 0 0 0-4 0v10.26a4 4 0 1 0 4 0z',
    'M11 10v7',
    'M17 5h4',
    'M17 9h3',
    'M17 13h4',
  ],
  WS: [
    'M3 8h10a3 3 0 1 0-3-3',
    'M3 12h15a3 3 0 1 1-3 3',
    'M3 16h7',
  ],
  DR: [
    'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
    'M4 4l16 16',
  ],
  WF: [
    'M12 21.5c3.9 0 6.5-2.6 6.5-6.4 0-3.4-2.4-5.9-4.1-7.7-.4 2-1.4 3.3-2.7 3.9C11.9 8 10.7 5.2 8.5 2.8 8.7 6 5.5 8.5 5.5 13.1c0 4.7 2.9 8.4 6.5 8.4z',
    'M12 21.5c-1.7 0-3-1.3-3-3.1 0-1.9 1.5-3 3-4.9 1.5 1.9 3 3 3 4.9 0 1.8-1.3 3.1-3 3.1z',
  ],
  SI: [
    'M12 2v20',
    'M3.3 7l17.4 10',
    'M3.3 17 20.7 7',
    'M9 3.5l3 2 3-2',
    'M9 20.5l3-2 3 2',
  ],
}

// Bare <path> set, for embedding inside another SVG (e.g. the wheel). The caller
// supplies positioning/scale and the stroke presentation via a wrapping <g>.
export function HazardIconPaths({ code }) {
  const paths = HAZARD_ICON_PATHS[code]
  if (!paths) return null
  return <>{paths.map((d, i) => <path key={i} d={d} />)}</>
}

// Standalone icon as its own <svg> (result square, Strategy cards, …).
export function HazardIcon({ code, color = 'currentColor', size = 24, style }) {
  const paths = HAZARD_ICON_PATHS[code]
  if (!paths) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter"
      style={style} aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}
