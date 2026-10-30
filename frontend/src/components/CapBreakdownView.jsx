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

      {/* Visual 2 · the five areas as grouped vertical columns (areas on the x
          axis, one column per group). Column height = the area mean on the 0–100
          scale (mean ÷ 20), the same scale for every area. Height-agnostic: more
          groups add width, not height, so it fits any viewport without scrolling. */}
      <div style={{ border: HAIRLINE, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
          {/* title + one shared group legend */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...mono, color: COLOR.ink }}>The five areas · average by {byLabel}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {groups.map(g => (
                <span key={g.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 12, background: g.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: FONT.sans, fontSize: FS.micro }}>{g.label}</span>
                </span>
              ))}
            </div>
          </div>
          {/* plot: five area column-groups across the x axis */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, alignItems: 'stretch' }}>
            {AREA_NAMES.map((name, ai) => {
              const vals = groups.map(g => g.areaMeans[ai] ?? 0)
              const gap = round1(Math.max(...vals) - Math.min(...vals))
              const isBig = biggestGapArea && biggestGapArea.area === ai
              return (
                <div key={name} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  {/* columns grow from the baseline; paddingTop reserves room for the
                      value labels so a near-100% column never overflows the top */}
                  <div style={{ flex: 1, minHeight: 0, paddingTop: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, borderBottom: `2px solid ${COLOR.ink}` }}>
                    {groups.map(g => {
                      const v = g.areaMeans[ai] ?? 0
                      const h = clampPct(v / 20 * 100)
                      return (
                        <div key={g.key} title={`${g.label}: ${round1(v)}`} style={{ flex: '1 1 0', minWidth: 0, maxWidth: 44, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: 700, lineHeight: 1, marginBottom: 2 }}>{round1(v)}</span>
                          <div style={{ width: '100%', height: `${h}%`, minHeight: 2, background: g.color }} />
                        </div>
                      )
                    })}
                  </div>
                  {/* x-axis area label (+ gap; biggest gap highlighted) */}
                  <div style={{ flexShrink: 0, textAlign: 'center', marginTop: 4, padding: '2px 4px', background: isBig ? '#F6F8FB' : 'transparent', border: isBig ? `1px solid ${COLOR.ink}` : '1px solid transparent' }}>
                    <div style={{ fontFamily: FONT.sans, fontSize: FS.micro, fontWeight: 700, lineHeight: 1.15 }}>{name}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60 }}>{isBig ? 'BIGGEST GAP' : 'Δ'} {gap}</div>
                  </div>
                </div>
              )
            })}
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
