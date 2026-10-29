// G3 · Protection colour band. The single source of these thresholds and
// colours — nothing else may hardcode them. Apply it to the SHOWN, ROUNDED % so
// the colour always matches the number on screen. Always render the icon and the
// label with the colour, never the colour alone.
export function getProtectionBand(pct) {
  const p = Number(pct) || 0
  if (p >= 70) return { key: 'strong',  label: 'Strong protection',  icon: '●', color: '#157347', bg: '#E3F4EA' }
  if (p >= 40) return { key: 'partial', label: 'Partial protection', icon: '◐', color: '#8A5A00', bg: '#FDF1D6' }
  return { key: 'weak', label: 'Weak protection', icon: '○', color: '#B42318', bg: '#FDE4E1' }
}
