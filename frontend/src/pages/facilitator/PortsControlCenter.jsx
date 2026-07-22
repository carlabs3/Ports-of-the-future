import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip,
} from 'recharts'
import api from '../../utils/api.js'
import { socket } from '../../utils/socket.js'

// Read-only PARI observation board. It only reads and displays live PAR data;
// it never triggers reveals, confirms actions, or writes anything.

const AREA_ORDER = ['governance', 'organisation', 'budget', 'measures', 'preparedness']
const AREA_LABELS = {
  governance:   'Gobernanza',
  organisation: 'Organización',
  budget:       'Presupuesto',
  measures:     'Medidas',
  preparedness: 'Preparación',
}

const BAND_ORDER = ['reactive', 'aware', 'developing', 'proactive']
const BAND_CONFIG = {
  reactive:   { label: 'Reactivo',      color: '#f472b6' },
  aware:      { label: 'Consciente',    color: '#f59e0b' },
  developing: { label: 'En desarrollo', color: '#38bdf8' },
  proactive:  { label: 'Proactivo',     color: '#4ade80' },
}

const PORT_SIZE_LABELS = { small: 'Pequeño', medium: 'Mediano', large: 'Grande' }
const PORT_SIZE_ORDER = ['small', 'medium', 'large']

// NOTE: band boundaries live ONLY in the backend (scoringService.getBand).
// This screen never derives a band from a score — it displays the band the
// backend sends (per-group in `groups`, per-submission in `individual.band`).

const mean = arr => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0)

const card = {
  background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: '1.25rem 1.5rem',
}
const cardTitle = {
  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.12em', color: '#999', marginBottom: '1rem',
}

export default function PortsControlCenter() {
  const { code } = useParams()

  const [individual, setIndividual] = useState([]) // [{ group, score, band, areas }]
  const [rows, setRows]             = useState([])  // aligned w/ demographics: + portSize, worldZone
  const [groups, setGroups]         = useState([])  // declared session groups
  const [groupAgg, setGroupAgg]     = useState([])  // backend per-group: { group, count, avgScore, band, cultureBand }
  const [portAssignments, setPortAssignments] = useState([]) // [{ group, portId }]
  const [portNameById, setPortNameById]        = useState({}) // portId -> name

  const joinUrl = `${window.location.origin}/?code=${code}`

  // Fetch the full listing (aligned individual + demographics) and rebuild rows.
  const fetchResults = useCallback(() => {
    api.get(`/api/par/${code}/results`)
      .then(res => {
        const ind = res.data.individual || []
        const dem = res.data.demographics || []
        setIndividual(ind)
        setGroupAgg(res.data.groups || [])
        setRows(ind.map((r, i) => ({
          ...r,
          portSize:  dem[i]?.portSize  || '',
          worldZone: dem[i]?.worldZone || '',
        })))
      })
      .catch(() => {})
  }, [code])

  // Initial populate + session groups + port catalogue (repopulates on reload).
  useEffect(() => {
    fetchResults()
    api.get(`/api/sessions/${code}/info`)
      .then(res => {
        setGroups(res.data.groups || [])
        setPortAssignments(res.data.portAssignments || [])
      })
      .catch(() => {})
    api.get('/api/par/ports')
      .then(res => setPortNameById(Object.fromEntries((res.data || []).map(p => [p.id, p.name]))))
      .catch(() => {})
  }, [code, fetchResults])

  // Live updates: join the room and listen for 'par:update'.
  useEffect(() => {
    const joinRoom = () => socket.emit('facilitator:join', { code })
    if (!socket.connected) socket.connect()
    joinRoom()
    socket.on('connect', joinRoom)

    function onParUpdate({ individual: ind, groups: grp }) {
      // par:update carries the full listing → replace, don't accumulate.
      if (ind) setIndividual(ind)
      if (grp) setGroupAgg(grp)
      // Refresh rows/demographics too (payload has no portSize).
      fetchResults()
    }
    socket.on('par:update', onParUpdate)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('par:update', onParUpdate)
    }
  }, [code, fetchResults])

  // ── Aggregates (all client-side) ───────────────────────────────────────────
  const submitted = individual.length
  const scores = individual.map(r => r.score)

  const globalMean = Math.round(mean(scores))
  const minScore = scores.length ? Math.min(...scores) : 0
  const maxScore = scores.length ? Math.max(...scores) : 0

  const radarData = useMemo(() => AREA_ORDER.map(id => ({
    area: AREA_LABELS[id],
    value: Math.round(mean(individual.map(r => r.areas?.[id] ?? 0)) * 10) / 10,
  })), [individual])

  // Histogram: 10-wide score buckets (0–9, 10–19, ..., 100).
  const histData = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${i * 10}–${i * 10 + 9}`, count: 0,
    }))
    for (const s of scores) {
      const idx = Math.min(9, Math.floor(s / 10))
      buckets[idx].count += 1
    }
    return buckets
  }, [scores])

  const bandDist = useMemo(() => BAND_ORDER.map(b => ({
    band: b,
    label: BAND_CONFIG[b].label,
    color: BAND_CONFIG[b].color,
    count: individual.filter(r => r.band === b).length,
  })), [individual])

  // Per-group stats — count/avg/band come from the backend aggregate; the
  // frontend only chooses the traffic-light status from the count.
  const groupStats = useMemo(() => {
    const aggByGroup = new Map(groupAgg.map(a => [a.group, a]))
    const portByGroup = new Map(portAssignments.map(pa => [pa.group, pa.portId]))
    // Union of declared session groups and any group present in the data.
    const list = [...new Set([...groups, ...groupAgg.map(a => a.group)])]
    return list.map(g => {
      const agg = aggByGroup.get(g)
      const count = agg?.count ?? 0
      const status = count === 0 ? 'empty' : count === 1 ? 'receiving' : 'ready'
      const portId = portByGroup.get(g)
      return {
        group: g,
        count,
        avg: agg?.avgScore ?? null,
        // cultureBand comes from the backend — never derived here.
        cultureBand: agg?.cultureBand ?? null,
        portName: portId != null ? (portNameById[portId] || `Puerto ${portId}`) : null,
        status,
      }
    })
  }, [groups, groupAgg, portAssignments, portNameById])

  // Port size breakdown (Q0) — only if there is portSize data.
  const portSizeStats = useMemo(() => {
    const present = rows.some(r => r.portSize)
    if (!present) return null
    return PORT_SIZE_ORDER
      .map(size => {
        const ss = rows.filter(r => r.portSize === size).map(r => r.score)
        return { size, label: PORT_SIZE_LABELS[size], count: ss.length, avg: ss.length ? Math.round(mean(ss)) : null }
      })
      .filter(s => s.count > 0)
  }, [rows])

  const STATUS_STYLE = {
    empty:     { dot: '#d4d4d4', label: 'Sin datos',  color: '#999' },
    receiving: { dot: '#f59e0b', label: 'Recibiendo', color: '#b07a30' },
    ready:     { dot: '#4ade80', label: 'Con datos',  color: '#16a34a' },
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 52px)', padding: '2rem 1.5rem', fontFamily: "'Instrument Sans', sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* 1 · HEADER */}
        <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 8, flexShrink: 0 }}>
            <QRCodeSVG value={joinUrl} size={96} />
          </div>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#999', margin: '0 0 4px' }}>
              Centro de control · PAR Index
            </p>
            <div style={{ fontWeight: 900, fontSize: '2rem', letterSpacing: '0.05em', color: '#0a0a0a', lineHeight: 1 }}>{code}</div>
            <p style={{ fontSize: '0.8rem', color: '#666', margin: '6px 0 0' }}>{joinUrl}</p>
          </div>
          <div style={{ textAlign: 'center', padding: '0 1rem' }}>
            <div style={{ fontWeight: 900, fontSize: '2.4rem', color: '#0a0a0a', lineHeight: 1 }}>{submitted}</div>
            <div style={{ fontSize: '0.72rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>PAR enviados</div>
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Grupos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(groups.length ? groups : ['—']).map(g => (
                <span key={g} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#f5f5f5', color: '#0a0a0a', border: '1px solid #e5e5e5' }}>{g}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 2 · ESTADO DE GRUPOS */}
        <div style={card}>
          <div style={cardTitle}>Estado de grupos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {groupStats.map(gs => {
              const st = STATUS_STYLE[gs.status]
              return (
                <div key={gs.group} style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>{gs.group}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                    🏙 {gs.portName || '— sin puerto —'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#0a0a0a' }}>{gs.avg != null ? gs.avg : '—'}</span>
                    {gs.avg != null && <span style={{ fontSize: 12, color: '#999' }}>/100 medio</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    {gs.count} PAR{gs.count !== 1 ? 's' : ''}
                    {gs.cultureBand && <> · Cultura: <span style={{ color: BAND_CONFIG[gs.cultureBand].color, fontWeight: 700 }}>{BAND_CONFIG[gs.cultureBand].label}</span></>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3 · RESULTADOS PARI (agregado) */}
        <div style={card}>
          <div style={cardTitle}>Resultados PARI · toda la sala</div>

          {submitted === 0 ? (
            <p style={{ fontSize: 14, color: '#999', margin: 0 }}>Aún no hay resultados. Esperando envíos...</p>
          ) : (
            <>
              {/* Titular */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.5rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: '3rem', color: '#0a0a0a', lineHeight: 1 }}>{globalMean}</span>
                  <span style={{ fontSize: '0.9rem', color: '#999', fontWeight: 700 }}>/100 media global</span>
                </div>
                <span style={{ fontSize: '0.9rem', color: '#666' }}>Rango {minScore}–{maxScore}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {/* Radar por áreas */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>Media por área (0–20)</div>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="72%">
                        <PolarGrid />
                        <PolarAngleAxis dataKey="area" tick={{ fontSize: 11, fill: '#555' }} />
                        <Radar dataKey="value" stroke="#0a0a0a" fill="#0a0a0a" fillOpacity={0.35} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Histograma de scores */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>Distribución de scores individuales</div>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={histData} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#888' }} interval={0} angle={-35} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#888' }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0a0a0a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Distribución de bandas */}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 10 }}>Distribución de bandas</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  {bandDist.map(b => (
                    <div key={b.band} style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: b.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a' }}>{b.label}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>
                          {b.count} · {submitted ? Math.round((b.count / submitted) * 100) : 0}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4 · DESGLOSE POR TAMAÑO DE PUERTO (Q0) */}
        {portSizeStats && (
          <div style={card}>
            <div style={cardTitle}>Media por tamaño de puerto</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {portSizeStats.map(ps => (
                <div key={ps.size} style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a', marginBottom: 6 }}>{ps.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#0a0a0a' }}>{ps.avg}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>/100 medio</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{ps.count} puerto{ps.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
