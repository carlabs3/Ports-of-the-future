import { COLOR, FONT, FS, FW, LS, HAIRLINE } from '../styles/tokens.js'
import { formatEurM, formatScore10 } from '../utils/format.js'
import { getProtectionBand } from '../utils/protectionBand.js'
import PotentialLossBar from './PotentialLossBar.jsx'

// G5 · Standings after rounds 1 and 2. Two boards: left = strategy (your
// decisions), right = losses avoided (the wheel). `portImage(portId)` returns a
// port photo URL or null; `year(n)` returns the round's year.
function Move({ m }) {
  if (m == null) return null
  if (m === 0) return <span style={{ color: '#6B7684', fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: 700 }}>=</span>
  const up = m > 0
  return <span style={{ color: up ? '#157347' : '#B42318', fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: 700 }}>{up ? '▲' : '▼'}{Math.abs(m)}</span>
}

function Thumb({ src, alt }) {
  return (
    <div style={{ width: 112, height: 64, flexShrink: 0, background: COLOR.ice, border: HAIRLINE, overflow: 'hidden' }}>
      {src && <img src={src} alt={alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </div>
  )
}

export default function StandingsScreen({ standings, year, portImage }) {
  const teams = standings?.teams || []
  const through = standings?.throughRound || 1
  const strategyLine = through >= 2 ? 'Average of 2 rounds' : 'Round 1 score'
  const byStrategy = [...teams].sort((a, b) => a.strategyRank - b.strategyRank)
  const byAvoided = [...teams].sort((a, b) => a.avoidedRank - b.avoidedRank)

  const rowBase = { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderTop: HAIRLINE }
  const rankCell = { fontFamily: FONT.mono, fontSize: FS.h3, fontWeight: 800, width: 28, textAlign: 'right', flexShrink: 0 }
  const nameCell = { minWidth: 0, flex: 1 }
  const boardHead = (bg, fg, left, right) => (
    <div style={{ background: bg, color: fg, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', fontWeight: 700 }}>{left}</span>
      <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', opacity: 0.75 }}>{right}</span>
    </div>
  )
  const nameBlock = (t) => (
    <div style={nameCell}>
      <div style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.group}</div>
      <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.portName || '—'}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div>
        <p style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60, margin: '0 0 4px' }}>Round {through} · {year(through)} complete</p>
        <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.display, margin: 0 }}>Standings after round {through}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* LEFT · strategy */}
        <div style={{ border: HAIRLINE }}>
          {boardHead(COLOR.harbour, COLOR.onHarbour, 'Strategy so far · Best plans', 'Your decisions')}
          {byStrategy.map(t => (
            <div key={t.group} style={rowBase}>
              <span style={rankCell}>{t.strategyRank}</span>
              <Move m={t.strategyMove} />
              <Thumb src={portImage(t.portId)} alt={`Illustration of the port of ${t.portName || 'this port'}`} />
              {nameBlock(t)}
              <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 120 }}>
                <div style={{ fontFamily: FONT.mono, fontSize: FS.h3, fontWeight: 800 }}>{formatScore10((t.finalScore || 0) / 100)}</div>
                <div style={{ height: 10, background: COLOR.ice, border: HAIRLINE, marginTop: 4 }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, t.finalScore || 0))}%`, height: '100%', background: COLOR.harbour }} />
                </div>
                <div style={{ fontFamily: FONT.sans, fontSize: FS.micro, color: COLOR.ink60, marginTop: 3 }}>{strategyLine}</div>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT · losses avoided */}
        <div style={{ border: HAIRLINE }}>
          {boardHead(COLOR.ice, COLOR.ink, 'Losses avoided so far · Best protected', 'Depends on the wheel')}
          {byAvoided.map(t => {
            const band = getProtectionBand(t.avoidedPct)
            const noMoney = t.missingPotential || !(t.totalPotential > 0)
            return (
              <div key={t.group} style={rowBase}>
                <span style={rankCell}>{t.avoidedRank}</span>
                <Move m={t.avoidedMove} />
                <Thumb src={portImage(t.portId)} alt={`Illustration of the port of ${t.portName || 'this port'}`} />
                {nameBlock(t)}
                <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 150 }}>
                  <div style={{ fontFamily: FONT.mono, fontSize: FS.h3, fontWeight: 800, color: band.color }}>{noMoney ? '—' : `${band.icon} ${t.avoidedPct}%`}</div>
                  {!noMoney && <PotentialLossBar damage={t.totalDamageRaw} potential={t.totalPotential} height={10} style={{ marginTop: 4 }} />}
                  <div style={{ fontFamily: FONT.sans, fontSize: FS.micro, color: COLOR.ink60, marginTop: 3 }}>{noMoney ? 'Losses not available' : `${formatEurM(t.avoidedShown)} of ${formatEurM(t.totalPotential)} avoided`}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
