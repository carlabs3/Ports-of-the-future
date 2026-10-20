// Ports of the Future — design tokens for inline-style consumers.
// Mirrors tokens.css. The app styles mostly with inline `style={{}}` objects,
// so screens import these constants instead of re-typing hex values. tokens.css
// stays the source of truth for the CSS custom properties + base component
// classes; this file is the JS twin for the same values.

// ── Brand palette ───────────────────────────────────────────────────────────
export const COLOR = {
  paper:   '#FFFFFF', // page ground
  ice:     '#C5E4FF', // panels, empty bar tracks
  sky:     '#77AEF1', // large flat hero blocks only
  harbour: '#4177C0', // selected state, active tab, links, data bars
  ink:     '#0B1B33', // text, rules, primary buttons
  signal:  '#E3BF40', // one highlight per screen (weakest area)
  onInk:     '#FFFFFF',
  onHarbour: '#FFFFFF',
  ink60:   'rgba(11, 27, 51, 0.60)',
  ink40:   'rgba(11, 27, 51, 0.40)',
}

// 1px ink hairline — the only rule style in the system.
export const HAIRLINE = `1px solid ${COLOR.ink}`

// ── Type ────────────────────────────────────────────────────────────────────
export const FONT = {
  sans: "'Inter Tight', 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
}

// Sizes read the shared --type-scale so a projector bump via CSS still applies
// to inline consumers. Change the default only in tokens.css (:root).
export const fs = (px) => `calc(${px}px * var(--type-scale))`
export const FS = {
  mega:    fs(96),
  display: fs(64),
  h1:      fs(40),
  h2:      fs(28),
  h3:      fs(20),
  lg:      fs(18),
  body:    fs(16),
  sm:      fs(14),
  label:   fs(12),
  micro:   fs(11),
}

export const FW = {
  regular: 400, medium: 500, semibold: 600, bold: 700, display: 800,
}
export const LS = { display: '-0.05em', tight: '-0.02em', mono: '0.02em' }

// ── Band ramp — lightness scale, NOT a traffic light ────────────────────────
// Reactive = white w/ ink border · Aware = ice · Developing = harbour (white
// text) · Proactive = ink (white text). THE single band-colour definition;
// replaces the old pink/amber/sky/green traffic-light scheme everywhere.
export const BAND_RAMP = {
  reactive:   { label: 'Reactive',   bg: COLOR.paper,   text: COLOR.ink,       border: HAIRLINE },
  aware:      { label: 'Aware',      bg: COLOR.ice,     text: COLOR.ink,       border: HAIRLINE },
  developing: { label: 'Developing', bg: COLOR.harbour, text: COLOR.onHarbour, border: `1px solid ${COLOR.harbour}` },
  proactive:  { label: 'Proactive',  bg: COLOR.ink,     text: COLOR.onInk,     border: `1px solid ${COLOR.ink}` },
}
export const BAND_ORDER = ['reactive', 'aware', 'developing', 'proactive']
