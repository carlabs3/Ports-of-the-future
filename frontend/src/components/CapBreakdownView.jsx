import { COLOR, FONT, FS, FW, LS, HAIRLINE } from '../styles/tokens.js'

// CAP results "By <dimension>" view (three visuals), driven entirely by the
// server payload. All groups are shown side by side; the server already dropped
// any group under 3 people (privacy).
const BANDS = [
  { name: 'REACTIVE', lo: 0, hi: 25, shade: '#F3F4F6' },
  { name: 'AWARE', lo: 26, hi: 50, shade: '#E4E8EF' },
  { name: 'DEVELOPING', lo: 51, hi: 75, shade: '#D3DCEB' },
  { name: 'PROACTIVE', lo: 76, hi: 100, shade: '#BFCDE6' },
]
const AREA_NAMES = ['Governance & Strategy', 'Organisation & People', 'Budget & Finance', 'Implemented Measures', 'Preparedness & Monitoring']
const round1 = x => Math.round(x * 10) / 10
const clampPct = v => Math.max(0, Math.min(100, v))

export default function CapBreakdownView({ breakdown }) {
  if (!breakdown) return null
  const { title, byLabel, groups = [], roomMean = 0, hiddenCount = 0, biggestGapArea = null } = breakdown
  const shownPeople = groups.reduce((s, g) => s + g.n, 0)
  const totalBars = shownPeople
  const barGap = totalBars > 30 ? 3 : 5

  if (groups.length === 0) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.display, margin: 0 }}>{title}</h2>
        <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>No group has 3 or more people yet.</p>
        <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: 0 }}>Groups with fewer than 3 people are not shown, so no one’s answers can be identified.{hiddenCount > 0 ? ` ${hiddenCount} people not shown: groups under 3 people or no answer.` : ''}</p>
      </div>
    )
  }

  const mono = { fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase' }
  // Visual 1: stagger chips over 3 heights, sorted by mean so close means don't overlap.
  const byMean = [...groups].sort((a, b) => a.mean - b.mean)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '16px 24px 24px', gap: 16 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...mono, color: COLOR.ink60 }}>CAP index · {shownPeople} people</div>
          <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.display, margin: '2px 0 0' }}>{title}</h2>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {groups.map(g => (
            <span key={g.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, background: g.color, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.semibold }}>{g.label}</span>
              <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60 }}>{g.n} people</span>
            </span>
          ))}
        </div>
      </div>

      {/* Visual 1 · average by dimension */}
      <div style={{ border: HAIRLINE, padding: '14px 18px', flexShrink: 0 }}>
        <div style={{ ...mono, color: COLOR.ink, marginBottom: 10 }}>CAP index · average by {byLabel}</div>
        <div style={{ position: 'relative', height: 92, margin: '0 0 2px' }}>
          {byMean.map((g, i) => {
            const level = i % 3
            const lineH = 8 + level * 24
            return (
              <div key={g.key} style={{ position: 'absolute', left: `${clampPct(g.mean)}%`, bottom: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ background: g.color, color: '#fff', fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: 700, padding: '3px 7px', whiteSpace: 'nowrap' }}>{g.label} {g.mean}</span>
                <div style={{ width: 2, height: lineH, background: g.color }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', border: `2px solid ${COLOR.ink}` }}>
          {BANDS.map((b, i) => (
            <div key={b.name} style={{ flex: 1, background: b.shade, borderLeft: i ? `1px solid ${COLOR.ink}` : 'none', padding: '8px 4px', textAlign: 'center' }}>
              <span style={{ ...mono, color: COLOR.ink }}>{b.name}</span>
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', height: 22, marginTop: 2 }}>
          <div style={{ position: 'absolute', left: `${clampPct(roomMean)}%`, transform: 'translateX(-50%)', fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: 700 }}>▲ ROOM {roomMean}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60 }}>
          {[0, 25, 50, 75, 100].map(t => <span key={t}>{t}</span>)}
        </div>
      </div>

      {/* Visuals 2 + 3 side by side (stack under 1100 px) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Visual 2 · every participant */}
        <div style={{ border: HAIRLINE, padding: '14px 18px', display: 'flex', flexDirection: 'column', minHeight: 320 }}>
          <div style={{ ...mono, color: COLOR.ink }}>Every participant</div>
          <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: '2px 0 10px' }}>Grouped by {byLabel}, highest to lowest within each group</p>
          <div style={{ position: 'relative', flex: 1, minHeight: 200, border: HAIRLINE }}>
            {BANDS.map((b, i) => (
              <div key={b.name} style={{ position: 'absolute', left: 0, right: 0, bottom: `${i * 25}%`, height: '25%', background: b.shade, borderTop: i ? `1px solid ${COLOR.ink}` : 'none', display: 'flex', alignItems: 'center' }}>
                <span style={{ padding: '0 6px', fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60, lineHeight: 1.2 }}>{b.name}<br />{b.lo}–{b.hi}</span>
              </div>
            ))}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 18, padding: '0 8px 0 92px' }}>
              {groups.map(g => (
                <div key={g.key} style={{ flex: `${g.n} 1 0`, minWidth: 0, height: '100%', display: 'flex', alignItems: 'flex-end', gap: barGap }}>
                  {g.scores.map((s, i) => <div key={i} style={{ flex: '1 1 0', minWidth: 4, height: `${clampPct(s)}%`, background: g.color }} />)}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, padding: '6px 8px 0 92px' }}>
            {groups.map(g => (
              <div key={g.key} style={{ flex: `${g.n} 1 0`, minWidth: 0 }}>
                <div style={{ height: 4, background: g.color }} />
                <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: 700, marginTop: 3, lineHeight: 1.25, overflowWrap: 'break-word' }}>{g.label.toUpperCase()} · {g.n} · AVG {g.mean}</div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: FONT.sans, fontSize: FS.micro, color: COLOR.ink60, margin: '8px 0 0' }}>Background: CAP bands, same shades as the scale above</p>
        </div>

        {/* Visual 3 · the five areas */}
        <div style={{ border: HAIRLINE, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 320 }}>
          <div style={{ ...mono, color: COLOR.ink }}>The five areas · average by {byLabel}</div>
          {AREA_NAMES.map((name, ai) => {
            const vals = groups.map(g => g.areaMeans[ai] ?? 0)
            const gap = round1(Math.max(...vals) - Math.min(...vals))
            const isBig = biggestGapArea && biggestGapArea.area === ai
            return (
              <div key={name} style={{ border: isBig ? `2px solid ${COLOR.ink}` : 'none', padding: isBig ? '6px 8px' : '0', background: isBig ? '#F6F8FB' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: 700 }}>{name}</span>
                  <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60, whiteSpace: 'nowrap' }}>{isBig ? 'BIGGEST GAP' : 'GAP'} · max − min = {gap}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                  {groups.map(g => (
                    <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 10, background: COLOR.ice, position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: '0 auto 0 0', height: '100%', width: `${clampPct((g.areaMeans[ai] ?? 0) / 20 * 100)}%`, background: g.color }} />
                      </div>
                      <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: 700, width: 30, textAlign: 'right' }}>{round1(g.areaMeans[ai] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontFamily: FONT.sans, fontSize: FS.micro, color: COLOR.ink60 }}>Bars per area, top to bottom:</span>
            {groups.map(g => (
              <span key={g.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 12, background: g.color }} />
                <span style={{ fontFamily: FONT.sans, fontSize: FS.micro }}>{g.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* footer privacy line */}
      <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: 0, flexShrink: 0 }}>
        Groups with fewer than 3 people are not shown, so no one’s answers can be identified.{hiddenCount > 0 ? ` ${hiddenCount} people not shown: groups under 3 people or no answer.` : ''}
      </p>
    </div>
  )
}
