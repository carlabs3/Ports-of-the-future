// Ports of the Future — design tokens for inline-style consumers.
// Mirrors tokens.css. The app styles mostly with inline `style={{}}` objects,
// so screens import these constants instead of re-typing hex values. tokens.css
// stays the source of truth for the CSS custom properties + base component
// classes; this file is the JS twin for the same values.

// ── Brand palette ───────────────────────────────────────────────────────────
// Values reference the CSS custom properties in tokens.css — that file is THE
// source of truth for every literal. These `var(--…)` strings resolve wherever
// a browser applies the style (inline style objects, SVG attributes, etc.).
// The ONLY exception is a library that cannot resolve a CSS variable (recharts,
// canvas): pass a literal hex there and comment it back to this file.
export const COLOR = {
  paper:   'var(--paper)',   // page ground
  ice:     'var(--ice)',     // panels, empty bar tracks
  sky:     'var(--sky)',     // large flat hero blocks only
  harbour: 'var(--harbour)', // selected state, active tab, links, data bars
  ink:     'var(--ink)',     // text, rules, primary buttons
  signal:  'var(--signal)',  // one highlight per screen (weakest area)
  onInk:     'var(--on-ink)',
  onHarbour: 'var(--on-harbour)',
  ink60:   'var(--ink-60)',
  ink40:   'var(--ink-40)',
}

// Raw hex literals — for libraries that cannot resolve a CSS variable (recharts
// fills, canvas, offscreen SVG rasterisation). Prefer COLOR.* everywhere else.
// Keep these in sync with tokens.css by hand; they are the same six values.
export const COLOR_HEX = {
  paper:   '#FFFFFF',
  ice:     '#C5E4FF',
  sky:     '#77AEF1',
  harbour: '#4177C0',
  ink:     '#0B1B33',
  signal:  '#E3BF40',
}

// 1px ink hairline — the only rule style in the system.
export const HAIRLINE = `1px solid ${COLOR.ink}`

// ── Type ────────────────────────────────────────────────────────────────────
export const FONT = {
  sans: 'var(--font-sans)', // Inter Tight stack — see tokens.css
  mono: 'var(--font-mono)', // JetBrains Mono stack — see tokens.css
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

// One colour per PAR area (the ONLY place these are defined). Values reference
// the CSS variables, like COLOR above.
export const AREA_COLOR = {
  governance:   COLOR.ink,
  organisation: COLOR.harbour,
  budget:       COLOR.sky,
  measures:     COLOR.signal,
  preparedness: COLOR.ice,
}

// Readable text colour on each AREA_COLOR, per the design rule (tokens.css:8):
// white only on the dark grounds (ink, harbour); ink on the light ones (sky,
// signal, ice). Kept beside AREA_COLOR so a colour change updates both here.
export const AREA_TEXT = {
  governance:   COLOR.onInk,     // on ink
  organisation: COLOR.onHarbour, // on harbour
  budget:       COLOR.ink,       // on sky
  measures:     COLOR.ink,       // on signal
  preparedness: COLOR.ink,       // on ice
}
