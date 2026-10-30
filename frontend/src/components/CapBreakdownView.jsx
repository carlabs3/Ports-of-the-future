import { COLOR, FONT, FS, FW, LS, HAIRLINE } from '../styles/tokens.js'

// CAP results "By <dimension>" view (three visuals), driven entirely by the
// server payload. Every non-empty group is shown side by side; participants with
// no answer for this field are not grouped but still count in the room mean.
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
  const { title, byLabel, groups = [], roomMean = 0, noAnswerCount = 0, biggestGapArea = null } = breakdown
  const shownPeople = groups.reduce((s, g) => s + g.n, 0)

  if (groups.length === 0) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.display, margin: 0 }}>{title}</h2>
        <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>No one has answered this question yet.</p>
        {noAnswerCount > 0 && (
          <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: 0 }}>{noAnswerCount} {noAnswerCount === 1 ? 'person' : 'people'} did not answer this question.</p>
        )}
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

      {/* Visual 2 · the five areas (full width; scrolls inside its box if needed) */}
      <div style={{ border: HAIRLINE, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflow: 'auto' }}>
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

      {/* footer: no-answer count, only when some did not answer */}
      {noAnswerCount > 0 && (
        <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: 0, flexShrink: 0 }}>
          {noAnswerCount} {noAnswerCount === 1 ? 'person' : 'people'} did not answer this question.
        </p>
      )}
    </div>
  )
}
