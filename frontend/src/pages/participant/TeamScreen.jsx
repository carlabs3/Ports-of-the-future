import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell } from 'recharts'
import { socket } from '../../utils/socket.js'
import api from '../../utils/api.js'
import { ACTIONS, AREA_ICON_URL } from '../../utils/actions.js'
import WaitingForFacilitator from '../../components/WaitingForFacilitator.jsx'
import { fmtTons } from '../../utils/format.js'

// Normalize group name for comparison: "Equipo A" === "equipo-a"
function normalizeGroup(g) {
  return (g || '').toLowerCase().replace(/\s+/g, '-')
}
function groupMatches(recordGroup, urlGroup) {
  if (!recordGroup || !urlGroup) return false
  if (recordGroup === urlGroup) return true
  return normalizeGroup(recordGroup) === normalizeGroup(urlGroup)
}

const AREA_META = [
  { key: 'transport',      label: 'Transporte',        color: '#38bdf8' },
  { key: 'energy',         label: 'Vivienda',          color: '#f59e0b' },
  { key: 'food',           label: 'Alimentación',      color: '#4ade80' },
  { key: 'consumption',    label: 'Compras y hábitos', color: '#a855f7' },
  { key: 'waste',          label: 'Vida digital',      color: '#f472b6' },
  { key: 'publicServices', label: 'Servicios públicos', color: '#94a3b8' },
]

const SPAIN_AVG = 8.1

const CATEGORY_CONFIG = {
  bajo:       { label: 'Huella reducida 🌿' },
  medio:      { label: 'Huella moderada 🌱' },
  alto:       { label: 'Huella elevada 🌍' },
  'muy alto': { label: 'Huella muy elevada 🔥' },
}

function mean(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

function getCategory(tons) {
  if (tons < 4)  return 'bajo'
  if (tons < 7)  return 'medio'
  if (tons < 10) return 'alto'
  return 'muy alto'
}

function DotsLoader({ color = '#0a0a0a' }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%', background: color,
          animation: `tmdot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes tmdot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

function Navbar({ group }) {
  return (
    <div style={{ background: '#0a0a0a', padding: '0.85rem 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
      {group && (
        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '0.3rem 0.9rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
          {group}
        </span>
      )}
    </div>
  )
}

// ── Phase 1: Waiting ─────────────────────────────────────────────────────────
function WaitingPhase({ group }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <Navbar group={null} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '5rem', marginBottom: '1.5rem', lineHeight: 1 }}>🌿</div>
        <h1 style={{
          fontWeight: 900,
          fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          letterSpacing: '-0.02em', color: '#0a0a0a',
          marginBottom: '0.5rem', textTransform: 'uppercase',
        }}>
          {group}
        </h1>
        <p style={{ fontSize: '1.05rem', color: '#666', maxWidth: 400, lineHeight: 1.65, marginBottom: '3rem' }}>
          El taller comenzará en breve.<br />Mantened esta pantalla abierta.
        </p>
        <DotsLoader />
      </div>
    </div>
  )
}

// ── Phase 2: Calculating ──────────────────────────────────────────────────────
function CalculatingPhase({ group, teamResults }) {
  const teamAvg = teamResults.length ? mean(teamResults.map(r => r.tons)) : null

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <Navbar group={group} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', textAlign: 'center' }}>
        {teamAvg === null ? (
          <>
            <p style={{ fontSize: '1rem', color: '#888', marginBottom: '2rem', maxWidth: 360, lineHeight: 1.6 }}>
              Esperando a que los miembros del equipo calculen su huella
            </p>
            <DotsLoader />
          </>
        ) : (
          <>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#bbb', marginBottom: '1.25rem' }}>
              Huella media del equipo · en curso
            </p>
            <div style={{ fontWeight: 900, fontSize: 'clamp(5rem, 16vw, 10rem)', lineHeight: 1, color: '#0a0a0a', letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
              {fmtTons(teamAvg)}
            </div>
            <p style={{ fontSize: '1rem', color: '#aaa', marginBottom: '2.5rem' }}>t CO₂/año</p>
            <DotsLoader />
          </>
        )}
      </div>
    </div>
  )
}

// ── Phase 3: Results ──────────────────────────────────────────────────────────
function ResultsPhase({ group, teamResults, sessionResults }) {
  if (teamResults.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
        <Navbar group={group} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <p style={{ color: '#aaa', fontSize: '0.95rem' }}>Sin resultados para este equipo.</p>
        </div>
      </div>
    )
  }

  const teamAvg    = mean(teamResults.map(r => r.tons))
  const sessionAvg = sessionResults.length ? mean(sessionResults.map(r => r.tons)) : null
  const category   = getCategory(teamAvg)
  const catCfg     = CATEGORY_CONFIG[category]

  const vsSesion = sessionAvg != null ? Math.round(((teamAvg - sessionAvg) / sessionAvg) * 100) : null
  const vsSpain  = Math.round(((teamAvg - SPAIN_AVG) / SPAIN_AVG) * 100)

  // Donut data
  const areaAvgMap = {}
  AREA_META.forEach(a => {
    areaAvgMap[a.key] = a.key === 'publicServices'
      ? 1.5
      : mean(teamResults.map(r => r.areas?.[a.key] || 0))
  })
  const pieData = AREA_META
    .map(a => ({ name: a.label, value: areaAvgMap[a.key], color: a.color }))
    .filter(d => d.value > 0.001)

  // Horizontal bars (dynamic scale)
  const BAR_MAX    = Math.max(12, Math.ceil(Math.max(teamAvg, SPAIN_AVG, sessionAvg ?? 0) * 1.3 / 2) * 2)
  const pct        = v => `${Math.min((v / BAR_MAX) * 100, 100).toFixed(1)}%`
  const TARGET_PCT = `${(2 / BAR_MAX) * 100}%`

  const bars = [
    { label: group,          value: teamAvg,    color: '#0a0a0a', bold: true },
    ...(sessionAvg != null ? [{ label: 'Media sesión', value: sessionAvg, color: '#38bdf8', bold: false }] : []),
    { label: 'Media España',  value: SPAIN_AVG,  color: '#4ade80', bold: false },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', animation: 'tmReveal 0.5s ease both' }}>
      <style>{`@keyframes tmReveal { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <Navbar group={group} />

      {/* Hero */}
      <div style={{ background: '#0a0a0a', color: '#fff', padding: '2.5rem 2rem 3rem' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.18em', opacity: 0.5, margin: '0 0 0.6rem' }}>
            Huella media · {group}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: 'clamp(3.5rem, 10vw, 5.5rem)', lineHeight: 1 }}>
              {fmtTons(teamAvg)}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase' }}>t CO₂/año</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: '0.9rem', background: 'rgba(255,255,255,0.18)', padding: '0.35rem 0.9rem', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700 }}>
            {catCfg.label}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.5rem' }}>
            {teamResults.length} miembro{teamResults.length !== 1 ? 's' : ''} han completado
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.75rem 1.5rem 3rem', display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>

        {/* Donut */}
        <div style={{ flex: '1 1 340px', background: '#fff', borderRadius: 14, border: '1px solid #e5e5e5', padding: '1.75rem', minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#aaa', marginBottom: '1.5rem' }}>
            Desglose por áreas — media del equipo
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <PieChart width={200} height={200}>
                <Pie
                  data={pieData}
                  cx={100} cy={100}
                  innerRadius={58} outerRadius={90}
                  dataKey="value"
                  paddingAngle={2}
                  startAngle={90} endAngle={-270}
                >
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontWeight: 900, fontSize: '1.6rem', lineHeight: 1, color: '#0a0a0a' }}>{fmtTons(teamAvg)}</span>
                <span style={{ fontSize: '0.62rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>t CO₂</span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {AREA_META.map(a => {
                const val = areaAvgMap[a.key]
                const totalForPct = pieData.reduce((s, d) => s + d.value, 0)
                const pctArea = totalForPct > 0 ? Math.round((val / totalForPct) * 100) : 0
                return (
                  <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, background: a.color, borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: '#555', flex: 1 }}>{a.label}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0a0a0a', minWidth: 36, textAlign: 'right' }}>{fmtTons(val)} t</span>
                    <span style={{ fontSize: '0.68rem', color: '#bbb', minWidth: 32, textAlign: 'right' }}>{pctArea}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Horizontal bar comparison */}
        <div style={{ flex: '1 1 280px', background: '#fff', borderRadius: 14, border: '1px solid #e5e5e5', padding: '1.75rem', minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#aaa', marginBottom: '1.75rem' }}>
            Comparativa
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {bars.map(({ label, value, color, bold }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', color: bold ? '#0a0a0a' : '#888', fontWeight: bold ? 700 : 500 }}>{label}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0a0a0a' }}>{fmtTons(value)} t</span>
                </div>
                <div style={{ height: 40, background: '#f5f5f5', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(value), background: color, borderRadius: 6, transition: 'width 0.7s ease' }} />
                  {/* 2t objective marker */}
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: TARGET_PCT, width: 2, background: '#e05555', opacity: 0.6 }} />
                </div>
              </div>
            ))}
          </div>

          {/* X axis */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.6rem', paddingTop: '0.4rem', borderTop: '1px solid #e5e5e5' }}>
            {Array.from({ length: BAR_MAX / 2 + 1 }, (_, i) => i * 2).map(v => (
              <span key={v} style={{ fontSize: '0.62rem', color: '#ccc' }}>{v}t</span>
            ))}
          </div>

          <div style={{ fontSize: '0.65rem', color: '#e05555', marginTop: '0.75rem', fontStyle: 'italic' }}>
            ─ Objetivo climático: 2 t/año por persona
          </div>

          {vsSesion != null && vsSesion < 0 && (
            <div style={{ marginTop: '1.25rem', background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 8, padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1rem' }}>🏆</span>
              <span style={{ fontSize: '0.78rem', color: '#0a0a0a', fontWeight: 700 }}>
                Por debajo de la media de la sesión
              </span>
            </div>
          )}
        </div>

        {/* Action list */}
        <div style={{ width: '100%' }}>
          {/* action items shown here if needed */}
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Display (receiver only) ──────────────────────────────────────────
function Step3DisplayPhase({ group, teamAvg, teamResults, confirmedData, showValues }) {
  const { actions = [], newCarbonTons = 0, totalReduction = 0 } = confirmedData || {}

  const AREA_ORDER = ['transport', 'energy', 'food', 'consumption', 'waste', 'publicServices']
  const COLORS = { transport: '#38bdf8', energy: '#f59e0b', food: '#4ade80', consumption: '#a855f7', waste: '#f472b6', publicServices: '#94a3b8' }
  const SHORT   = { transport: 'Trans.', energy: 'Viv.', food: 'Alim.', consumption: 'Cons.', waste: 'Dig.', publicServices: 'Serv.' }

  const areaAvgBefore = {}
  AREA_ORDER.forEach(area => {
    areaAvgBefore[area] = area === 'publicServices'
      ? 1.5
      : teamResults.length
        ? teamResults.reduce((s, r) => s + (r.areas?.[area] || 0), 0) / teamResults.length
        : 0
  })

  const areaRed = { transport: 0, energy: 0, food: 0, consumption: 0, waste: 0, publicServices: 0 }
  actions.forEach(id => {
    const a = ACTIONS.find(x => x.id === id)
    if (a) areaRed[a.area] = (areaRed[a.area] || 0) + a.co2Reduction / 1000
  })

  const areaAvgAfter = {}
  AREA_ORDER.forEach(area => {
    areaAvgAfter[area] = Math.max(0, areaAvgBefore[area] - (areaRed[area] || 0))
  })

  const sortedActions = [...actions]
    .map(id => ACTIONS.find(a => a.id === id))
    .filter(Boolean)
    .sort((a, b) => b.co2Reduction - a.co2Reduction)

  const StackedBar = ({ areaAvg, total, maxVal, label, color = '#0a0a0a', showLegend = false }) => (
    <div style={{ marginBottom: showLegend ? 12 : 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.85rem', color: '#888' }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{fmtTons(total)} t</span>
      </div>
      <div style={{ height: 28, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: showLegend ? 8 : 6 }}>
        {AREA_ORDER.map(area => {
          const pct = maxVal > 0 ? (areaAvg[area] / maxVal) * 100 : 0
          if (pct < 0.1) return null
          return <div key={area} style={{ width: `${pct}%`, background: COLORS[area] }} />
        })}
      </div>
      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 4 }}>
          {AREA_META.filter(a => (areaAvg[a.key] || 0) > 0.001).map(a => {
            const areaPct = total > 0 ? Math.round((areaAvg[a.key] / total) * 100) : 0
            return (
              <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: a.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: '#555' }}>{a.label}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#333' }}>{fmtTons(areaAvg[a.key] || 0)}t</span>
                <span style={{ fontSize: '0.82rem', color: '#aaa' }}>{areaPct}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <Navbar group={group} />

      {/* Header oscuro */}
      {showValues ? (
        <div style={{ background: '#0a0a0a', color: '#fff', padding: 'clamp(1.25rem, 4vw, 2.5rem) clamp(1rem, 4vw, 3rem)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.18em', opacity: 0.45, margin: '0 0 1.25rem' }}>
            Huella media · {group}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(1.5rem, 5vw, 4rem)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Antes */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 900, fontSize: 'clamp(2.8rem, 8vw, 5rem)', lineHeight: 1 }}>
                {fmtTons(teamAvg)}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)' }}>t CO₂/año</span>
              <div style={{ background: 'rgba(255,255,255,0.18)', padding: '0.25rem 0.75rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                {CATEGORY_CONFIG[getCategory(teamAvg)].label}
              </div>
            </div>
            {/* Centro — reducción + flecha */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 'clamp(0.85rem, 2vw, 1rem)', fontWeight: 700, color: '#4ade80' }}>
                −{fmtTons(totalReduction / 1000)} t
              </span>
              <span style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>→</span>
            </div>
            {/* Después */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 900, fontSize: 'clamp(2.8rem, 8vw, 5rem)', lineHeight: 1, color: '#4ade80' }}>
                {fmtTons(newCarbonTons)}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)' }}>t CO₂/año</span>
              <div style={{ background: 'rgba(255,255,255,0.18)', padding: '0.25rem 0.75rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                {CATEGORY_CONFIG[getCategory(newCarbonTons)].label}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '1rem' }}>
            {teamResults.length} miembro{teamResults.length !== 1 ? 's' : ''} han completado
          </div>
        </div>
      ) : (
        <div style={{ background: '#000000', padding: '2.5rem 2rem 3rem', textAlign: 'center', color: '#fff' }}>
          <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.18em', opacity: 0.5, margin: '0 0 0.6rem' }}>
            Huella actual del equipo
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: 'clamp(3.5rem, 10vw, 5.5rem)', lineHeight: 1 }}>
              {fmtTons(teamAvg)}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase' }}>t CO₂/año</span>
          </div>
        </div>
      )}

      {/* Body */}
      {showValues ? (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 'clamp(0.5rem, 2vw, 1.25rem)', maxWidth: 1200, margin: '0 auto', padding: 'clamp(0.75rem, 2vw, 1.25rem)', alignItems: 'start', width: '100%', boxSizing: 'border-box' }}>

          {/* Columna izquierda — desglose antes/después */}
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 14, padding: '1.25rem' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#aaa', margin: '0 0 1rem' }}>
              Desglose por áreas
            </p>
            <StackedBar areaAvg={areaAvgBefore} total={teamAvg}       maxVal={teamAvg} label="Antes"   color="#1a1a1a" showLegend />
            <StackedBar areaAvg={areaAvgAfter}  total={newCarbonTons} maxVal={teamAvg} label="Después" color="#4ade80" showLegend />
          </div>

          {/* Columna derecha — acciones con reducción */}
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#aaa', margin: '0 0 0.75rem' }}>
              Acciones del equipo
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
            {sortedActions.map(action => (
              <div key={action.id} style={{ display: 'flex', flexDirection: 'column', borderRadius: 10, border: '1px solid #e5e5e5', background: '#fff', overflow: 'hidden' }}>
                <img
                  src={action.image}
                  alt=""
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '10px 10px 0 0', display: 'block' }}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <div style={{ padding: '0.6rem 0.75rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3, marginBottom: '0.3rem' }}>{action.label}</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                    −{fmtTons(action.co2Reduction / 1000)} t
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, padding: '2.5rem 3rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#aaa', marginBottom: '1.25rem' }}>
            Acciones confirmadas para vuestro equipo
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', maxWidth: 900, margin: '0 auto' }}>
            {sortedActions.map(action => (
              <div key={action.id} style={{ display: 'flex', flexDirection: 'column', borderRadius: 14, border: '1px solid #e5e5e5', background: '#fff', overflow: 'hidden' }}>
                <img
                  src={action.image}
                  alt=""
                  style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '14px 14px 0 0', display: 'block' }}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.85rem 1rem' }}>
                  <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3, textAlign: 'left' }}>{action.label}</span>
                  <span style={{ fontSize: '0.85rem', color: '#ccc', flexShrink: 0 }}>···</span>
                </div>
              </div>
            ))}
          </div>
          {sortedActions.length > 0 && (
            <p style={{ fontSize: '0.82rem', color: '#aaa', marginTop: '1.5rem', fontStyle: 'italic' }}>
              El facilitador revelará los valores en breve
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TeamScreen() {
  const { code, group } = useParams()
  const navigate = useNavigate()

  const [phase,            setPhase]            = useState('waiting')
  const [teamResults,      setTeamResults]      = useState([])
  const [sessionResults,   setSessionResults]   = useState([])
  const [teamJoined,       setTeamJoined]       = useState(0)
  const [confirmedActions, setConfirmedActions] = useState(null)  // { actions, newCarbonTons, totalReduction }
  const [step3ShowValues,  setStep3ShowValues]  = useState(false)

  useEffect(() => {
    socket.connect()
    socket.emit('team:join', { code, group })

    function onStepChange({ step }) {
      if (step >= 3) {
        setPhase('step3')
      } else if (step >= 2) {
        setPhase(p => p === 'results' ? p : 'calculating')
      }
    }

    function onRankingUpdate({ individual }) {
      if (individual) {
        console.log('[TeamScreen] ranking:update groups:', [...new Set(individual.map(r => r.group))], '| url group:', group)
        setSessionResults(individual)
        const myTeam = individual.filter(r => groupMatches(r.group, group))
        setTeamResults(myTeam)
        setTeamJoined(prev => Math.max(prev, myTeam.length))
      }
    }

    function onParticipantJoined({ group: joinedGroup }) {
      if (groupMatches(joinedGroup, group)) setTeamJoined(prev => prev + 1)
    }

    function onResultsRevealed() { setPhase('results') }
    function onSessionClosed()   { navigate('/') }

    function onTeamActionsConfirmed({ group: g, actions, newCarbonTons, totalReduction, showValues }) {
      if (!groupMatches(g, group)) return
      setConfirmedActions({ actions, newCarbonTons, totalReduction })
      if (showValues) setStep3ShowValues(true)
      setPhase(p => p === 'step3' || p === 'results' ? 'step3' : p)
    }

    function onStep3Revealed({ allActions } = {}) {
      setStep3ShowValues(true)
      if (allActions) {
        const myTA = allActions.find(ta => groupMatches(ta.group, group))
        if (myTA) {
          setConfirmedActions({
            actions: myTA.actions,
            newCarbonTons: myTA.newCarbonTons,
            totalReduction: myTA.totalReduction,
          })
        }
      }
      setPhase(p => p === 'step3' || p === 'results' ? 'step3' : p)
    }

    socket.on('step:change',           onStepChange)
    socket.on('ranking:update',        onRankingUpdate)
    socket.on('participant:joined',    onParticipantJoined)
    socket.on('results:revealed',      onResultsRevealed)
    socket.on('session:closed',        onSessionClosed)
    socket.on('team:actionsConfirmed', onTeamActionsConfirmed)
    socket.on('step3:revealed',        onStep3Revealed)

    api.get(`/api/sessions/${code}/info`)
      .then(res => {
        if (res.data.step3Revealed || res.data.currentStep >= 3) setPhase('step3')
        else if (res.data.resultsRevealed) setPhase('results')
        else if (res.data.status === 'active') setPhase('calculating')
      })
      .catch(() => {})

    // Fetch confirmed team actions for late joiners (fallback if socket missed)
    api.get(`/api/sessions/${code}/team-actions`)
      .then(res => {
        const myTeam = res.data.find(ta => groupMatches(ta.group, group))
        if (myTeam?.confirmed) {
          setConfirmedActions({
            actions: myTeam.actions,
            newCarbonTons: myTeam.newCarbonTons,
            totalReduction: myTeam.totalReduction,
          })
        }
      })
      .catch(() => {})

    return () => {
      socket.off('step:change',           onStepChange)
      socket.off('ranking:update',        onRankingUpdate)
      socket.off('participant:joined',    onParticipantJoined)
      socket.off('results:revealed',      onResultsRevealed)
      socket.off('session:closed',        onSessionClosed)
      socket.off('team:actionsConfirmed', onTeamActionsConfirmed)
      socket.off('step3:revealed',        onStep3Revealed)
    }
  }, [code, group, navigate])

  if (phase === 'waiting')     return <WaitingPhase group={group} />
  if (phase === 'calculating') return <CalculatingPhase group={group} teamResults={teamResults} teamJoined={teamJoined} />
  if (phase === 'results')     return <ResultsPhase group={group} teamResults={teamResults} sessionResults={sessionResults} />

  // Step 3
  if (phase === 'step3') {
    const tAvg = teamResults.length ? mean(teamResults.map(r => r.tons)) : 0
    if (!confirmedActions) {
      const cat    = tAvg > 0 ? getCategory(tAvg) : null
      const catCfg = cat ? CATEGORY_CONFIG[cat] : null
      return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
          <Navbar group={group} />

          {/* Hero negro */}
          <div style={{ background: '#0a0a0a', color: '#fff', padding: '2.5rem 2rem 3rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.18em', opacity: 0.5, margin: '0 0 0.6rem' }}>
              Huella media · {group}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontWeight: 900, fontSize: 'clamp(3.5rem, 10vw, 5.5rem)', lineHeight: 1 }}>
                {tAvg > 0 ? fmtTons(tAvg) : '–'}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase' }}>t CO₂/año</span>
            </div>
            {catCfg && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: '0.9rem', background: 'rgba(255,255,255,0.18)', padding: '0.35rem 0.9rem', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700 }}>
                {catCfg.label}
              </div>
            )}
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.5rem' }}>
              {teamResults.length} miembro{teamResults.length !== 1 ? 's' : ''} han completado
            </div>
          </div>

          {/* Body — espera */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 2rem' }}>
            <p style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 900, color: '#0a0a0a', maxWidth: 500, margin: '0 auto', textAlign: 'center', lineHeight: 1.3 }}>
              Elige las acciones que reducirán la huella de vuestro equipo
            </p>
            <div style={{ marginTop: '2rem' }}>
              <DotsLoader />
            </div>
          </div>
        </div>
      )
    }
    return (
      <Step3DisplayPhase
        group={group}
        teamAvg={tAvg}
        teamResults={teamResults}
        confirmedData={confirmedActions}
        showValues={step3ShowValues}
      />
    )
  }

  return <WaitingPhase group={group} />
}
