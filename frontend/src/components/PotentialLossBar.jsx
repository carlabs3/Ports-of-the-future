// The one potential-losses bar used everywhere (F8). Full width = potential
// losses; damage sustained first, from the left, in blue; losses avoided after
// it in light blue. Blue width = damage / potential. `damage` and `potential`
// are the raw amounts (the bar width is raw; the € figures around it are shown).
export const DAMAGE_BLUE = '#3A62AE'
export const AVOIDED_LIGHT = '#CFE0F7'

export default function PotentialLossBar({ damage = 0, potential = 0, height = 14, style }) {
  const frac = potential > 0 ? Math.max(0, Math.min(1, (Number(damage) || 0) / potential)) : 0
  return (
    <div style={{ width: '100%', height, border: '1px solid #0B1B33', background: AVOIDED_LIGHT, overflow: 'hidden', ...style }}>
      <div style={{ width: `${frac * 100}%`, height: '100%', background: DAMAGE_BLUE }} />
    </div>
  )
}
