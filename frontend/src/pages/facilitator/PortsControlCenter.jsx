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
  governance:   'Governance',
  organisation: 'Organisation',
  budget:       'Budget',
  measures:     'Measures',
  preparedness: 'Preparedness',
}

const BAND_ORDER = ['reactive', 'aware', 'developing', 'proactive']
const BAND_CONFIG = {
  reactive:   { label: 'Reactive',   color: '#f472b6' },
  aware:      { label: 'Aware',      color: '#f59e0b' },
  developing: { label: 'Developing', color: '#38bdf8' },
  proactive:  { label: 'Proactive',  color: '#4ade80' },
}

const PORT_SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large' }
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

  // Phase 7 — measures / strategy entry (facilitator)
  const [measuresCatalog, setMeasuresCatalog] = useState([]) // [{ id, name, cost }]
  const [budget, setBudget]                   = useState(6)
  const [strategyByGroup, setStrategyByGroup] = useState({})  // group -> { measures, coinsSpent, cultureBand, portId }
  const [editingGroup, setEditingGroup]       = useState(null)
  const [draftMeasures, setDraftMeasures]     = useState([])  // ids being edited
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState('')

  // Phase 8 — roulette outcomes
  const [outcomes, setOutcomes] = useState([]) // sorted desc by lossesAvoidedPct
  const [spinning, setSpinning] = useState(null) // group being spun (cosmetic)

  // Phase 9 — session close
  const [closed, setClosed]   = useState(false)
  const [closing, setClosing] = useState(false)
  const [draft, setDraft]     = useState(false)
  const [starting, setStarting] = useState(false)

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

  // Fetch per-group strategy state (measures, coins, effective culture band).
  const fetchStrategies = useCallback(() => {
    api.get(`/api/par/${code}/strategies`)
      .then(res => {
        setBudget(res.data.budget ?? 6)
        setStrategyByGroup(Object.fromEntries((res.data.strategies || []).map(s => [s.group, s])))
      })
      .catch(() => {})
  }, [code])

  // Fetch roulette outcomes (ranking), sorted desc by the backend.
  const fetchOutcomes = useCallback(() => {
    api.get(`/api/par/${code}/outcomes`)
      .then(res => setOutcomes(res.data.outcomes || []))
      .catch(() => {})
  }, [code])

  // Initial populate + session groups + port catalogue (repopulates on reload).
  useEffect(() => {
    fetchResults()
    fetchStrategies()
    fetchOutcomes()
    api.get(`/api/sessions/${code}/info`)
      .then(res => {
        setGroups(res.data.groups || [])
        setPortAssignments(res.data.portAssignments || [])
        setClosed(res.data.status === 'closed')
        setDraft(res.data.status === 'draft')
      })
      .catch(() => {})
    api.get('/api/par/ports')
      .then(res => setPortNameById(Object.fromEntries((res.data || []).map(p => [p.id, p.name]))))
      .catch(() => {})
    api.get('/api/par/measures')
      .then(res => setMeasuresCatalog(res.data || []))
      .catch(() => {})
  }, [code, fetchResults, fetchStrategies, fetchOutcomes])

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
      // New PARs can change the base band → refresh effective culture bands.
      fetchStrategies()
    }
    function onStrategyUpdate(payload) {
      if (payload?.group) setStrategyByGroup(prev => ({ ...prev, [payload.group]: payload }))
    }
    function onOutcomeUpdate() { fetchOutcomes() }
    socket.on('par:update', onParUpdate)
    socket.on('strategy:update', onStrategyUpdate)
    socket.on('outcome:update', onOutcomeUpdate)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('par:update', onParUpdate)
      socket.off('strategy:update', onStrategyUpdate)
      socket.off('outcome:update', onOutcomeUpdate)
    }
  }, [code, fetchResults, fetchStrategies, fetchOutcomes])

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
      const strat = strategyByGroup[g]
      const count = agg?.count ?? 0
      const status = count === 0 ? 'empty' : count === 1 ? 'receiving' : 'ready'
      const portId = portByGroup.get(g)
      return {
        group: g,
        count,
        avg: agg?.avgScore ?? null,
        // Effective culture band (base + measure bonus) comes from the backend
        // strategies endpoint — never derived here.
        cultureBand: strat?.cultureBand ?? null,
        coinsSpent: strat?.coinsSpent ?? 0,
        measuresCount: strat?.measures?.length ?? 0,
        portName: portId != null ? (portNameById[portId] || `Port ${portId}`) : null,
        status,
      }
    })
  }, [groups, groupAgg, portAssignments, portNameById, strategyByGroup])

  // ── Measure-entry helpers ───────────────────────────────────────────────────
  function openEditor(group) {
    setSaveError('')
    setDraftMeasures(strategyByGroup[group]?.measures || [])
    setEditingGroup(group)
  }
  function toggleDraftMeasure(id) {
    setDraftMeasures(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const draftCost = useMemo(
    () => draftMeasures.reduce((s, id) => s + (measuresCatalog.find(m => m.id === id)?.cost || 0), 0),
    [draftMeasures, measuresCatalog]
  )
  async function saveMeasures(group) {
    setSaving(true)
    setSaveError('')
    try {
      const res = await api.put(`/api/par/${code}/strategy/${encodeURIComponent(group)}`, { measures: draftMeasures })
      setStrategyByGroup(prev => ({ ...prev, [group]: res.data.strategy }))
      setEditingGroup(null)
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  // Close the session: persists the aggregate PARI summary and notifies participants.
  async function closeSession() {
    if (closing || closed) return
    if (!window.confirm('Close this session? Participants will be notified and the PARI summary will be saved. Results stay visible here.')) return
    setClosing(true)
    try {
      await api.patch(`/api/sessions/${code}/close`)
      setClosed(true)
    } catch {
      window.alert('Could not close the session. Try again.')
    } finally {
      setClosing(false)
    }
  }

  // Start the session (draft → active) so participants can join. Reuses the
  // existing activate endpoint; no new backend.
  async function startSession() {
    if (starting || !draft) return
    setStarting(true)
    try {
      await api.patch(`/api/sessions/${code}/activate`)
      setDraft(false)
    } catch {
      window.alert('Could not start the session. Try again.')
    } finally {
      setStarting(false)
    }
  }

  // Spin the roulette for a table. The backend decides the event; the spin is
  // purely cosmetic here.
  async function drawWheel(group) {
    if (spinning) return
    setSpinning(group)
    try {
      await api.post(`/api/par/${code}/strategy/${encodeURIComponent(group)}/draw`)
      fetchOutcomes()
    } catch {
      // leave prior outcome in place on error
    } finally {
      // brief cosmetic delay so the "spinning" state is visible
      setTimeout(() => setSpinning(null), 1000)
    }
  }

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
    empty:     { dot: '#d4d4d4', label: 'No data',   color: '#999' },
    receiving: { dot: '#f59e0b', label: 'Receiving', color: '#b07a30' },
    ready:     { dot: '#4ade80', label: 'Ready',     color: '#16a34a' },
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 52px)', padding: '2rem 1.5rem', fontFamily: "'Instrument Sans', sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Session lifecycle bar: draft → start · active → close · closed → banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: draft ? 'space-between' : 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          {draft && (
            <span style={{ fontSize: 13, color: '#b07a30' }}>
              Not started yet — participants can't join until you start the session.
            </span>
          )}
          {closed ? (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', background: '#eaf7ee', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 999, padding: '6px 14px' }}>
              ✓ Session closed · results are final
            </span>
          ) : draft ? (
            <button onClick={startSession} disabled={starting}
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', background: starting ? '#9ab' : '#1B4B7A', border: 'none', borderRadius: 999, padding: '9px 22px', cursor: starting ? 'default' : 'pointer' }}>
              {starting ? 'Starting...' : '▶ Start session'}
            </button>
          ) : (
            <button onClick={closeSession} disabled={closing}
              style={{ fontSize: 13, fontWeight: 600, color: closing ? '#bbb' : '#0a0a0a', background: 'transparent', border: '1px solid #0a0a0a', borderRadius: 999, padding: '6px 16px', cursor: closing ? 'default' : 'pointer' }}>
              {closing ? 'Closing...' : 'Close session'}
            </button>
          )}
        </div>

        {/* 1 · HEADER */}
        <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 8, flexShrink: 0 }}>
            <QRCodeSVG value={joinUrl} size={96} />
          </div>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#999', margin: '0 0 4px' }}>
              Control centre · PAR Index
            </p>
            <div style={{ fontWeight: 900, fontSize: '2rem', letterSpacing: '0.05em', color: '#0a0a0a', lineHeight: 1 }}>{code}</div>
            <p style={{ fontSize: '0.8rem', color: '#666', margin: '6px 0 0' }}>{joinUrl}</p>
          </div>
          <div style={{ textAlign: 'center', padding: '0 1rem' }}>
            <div style={{ fontWeight: 900, fontSize: '2.4rem', color: '#0a0a0a', lineHeight: 1 }}>{submitted}</div>
            <div style={{ fontSize: '0.72rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>PAR submitted</div>
          </div>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Groups</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(groups.length ? groups : ['—']).map(g => (
                <span key={g} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#f5f5f5', color: '#0a0a0a', border: '1px solid #e5e5e5' }}>{g}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 2 · GROUP STATUS */}
        <div style={card}>
          <div style={cardTitle}>Group status</div>
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
                    🏙 {gs.portName || '— no port —'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#0a0a0a' }}>{gs.avg != null ? gs.avg : '—'}</span>
                    {gs.avg != null && <span style={{ fontSize: 12, color: '#999' }}>/100 avg</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    {gs.count} PAR{gs.count !== 1 ? 's' : ''}
                    {gs.cultureBand && <> · Culture: <span style={{ color: BAND_CONFIG[gs.cultureBand].color, fontWeight: 700 }}>{BAND_CONFIG[gs.cultureBand].label}</span></>}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🪙 {gs.coinsSpent}/{budget} · {gs.measuresCount} measure{gs.measuresCount !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => openEditor(gs.group)}
                      style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#0a0a0a', background: 'transparent', border: '1px solid #0a0a0a', borderRadius: 999, padding: '2px 10px', cursor: 'pointer' }}
                    >
                      Edit measures
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Measure-entry editor (facilitator) */}
          {editingGroup && (
            <div style={{ marginTop: '1rem', border: '1px solid #0a0a0a', borderRadius: 12, padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0a0a0a' }}>Measures · {editingGroup}</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: draftCost > budget ? '#cc4444' : '#16a34a' }}>
                  🪙 {draftCost}/{budget}
                </span>
                <button onClick={() => setEditingGroup(null)} style={{ fontSize: 12, color: '#999', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕ Close</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                {measuresCatalog.map(m => {
                  const sel = draftMeasures.includes(m.id)
                  return (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `1px solid ${sel ? '#0a0a0a' : '#e5e5e5'}`, background: sel ? '#f5f5f5' : '#fff', cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleDraftMeasure(m.id)} />
                      <span style={{ flex: 1, color: '#0a0a0a' }}>{m.id}. {m.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#666' }}>🪙{m.cost}</span>
                    </label>
                  )
                })}
              </div>

              {draftCost > budget && (
                <p style={{ fontSize: 12, color: '#cc4444', margin: '10px 0 0' }}>
                  Over budget ({draftCost} &gt; {budget}). Remove a measure.
                </p>
              )}
              {saveError && <p style={{ fontSize: 12, color: '#cc4444', margin: '10px 0 0' }}>{saveError}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => saveMeasures(editingGroup)}
                  disabled={saving || draftCost > budget}
                  style={{ background: (saving || draftCost > budget) ? '#e5e5e5' : '#0a0a0a', color: (saving || draftCost > budget) ? '#bbb' : '#fff', border: 'none', borderRadius: 999, padding: '0.5rem 1.25rem', fontSize: 13, fontWeight: 600, cursor: (saving || draftCost > budget) ? 'default' : 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Save measures'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2.5 · RULETA DE EVENTOS + RANKING */}
        <div style={card}>
          <div style={cardTitle}>Event roulette &amp; ranking</div>
          {outcomes.length === 0 ? (
            <p style={{ fontSize: 14, color: '#999', margin: 0 }}>No tables yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#999', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ padding: '6px 8px' }}>#</th>
                    <th style={{ padding: '6px 8px' }}>Table</th>
                    <th style={{ padding: '6px 8px' }}>Port</th>
                    <th style={{ padding: '6px 8px' }}>Drawn event</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Preparedness</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>% avoided</th>
                    <th style={{ padding: '6px 8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((o, i) => {
                    const isTop = i === 0 && o.drawn
                    const isSpin = spinning === o.group
                    return (
                      <tr key={o.group} style={{ borderTop: '1px solid #eee', background: isTop ? '#f0f7ee' : 'transparent' }}>
                        <td style={{ padding: '8px', fontWeight: 700, color: isTop ? '#16a34a' : '#999' }}>{o.drawn ? i + 1 : '—'}</td>
                        <td style={{ padding: '8px', fontWeight: 700, color: '#0a0a0a' }}>{o.group}{isTop ? ' 🏅' : ''}</td>
                        <td style={{ padding: '8px', color: '#666' }}>{o.portName || '—'}</td>
                        <td style={{ padding: '8px', color: '#0a0a0a' }}>
                          {isSpin ? <span style={{ color: '#999' }}>Spinning…</span> : (o.drawnEvent || '—')}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#0a0a0a' }}>{o.preparedness != null ? o.preparedness.toFixed(1) : '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 900, color: isTop ? '#16a34a' : '#0a0a0a' }}>{o.lossesAvoidedPct != null ? `${o.lossesAvoidedPct.toFixed(0)}%` : '—'}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <button
                            onClick={() => drawWheel(o.group)}
                            disabled={!!spinning}
                            style={{ fontSize: 12, fontWeight: 600, color: spinning ? '#bbb' : '#fff', background: spinning ? '#e5e5e5' : '#0a0a0a', border: 'none', borderRadius: 999, padding: '4px 12px', cursor: spinning ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {isSpin ? '🎡' : o.drawn ? 'Spin again' : 'Spin the wheel'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Debrief: per-measure breakdown for the top table (event already drawn). */}
              {outcomes[0]?.drawn && outcomes[0].breakdown?.length > 0 && (
                <div style={{ marginTop: '1rem', fontSize: 12, color: '#666' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: '#0a0a0a' }}>
                    Debrief · {outcomes[0].group} vs {outcomes[0].drawnEvent} (protection per measure, original → adjusted)
                  </div>
                  {outcomes[0].breakdown.map(b => (
                    <div key={b.measureId} style={{ display: 'flex', gap: 8, padding: '3px 0', borderTop: '0.5px solid #f0f0f0' }}>
                      <span style={{ flex: 1 }}>{b.measureId}. {b.name}</span>
                      <span style={{ color: '#999' }}>{b.sOriginal} → <strong style={{ color: '#0a0a0a' }}>{b.sAdjusted}</strong></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3 · RESULTADOS PARI (agregado) */}
        <div style={card}>
          <div style={cardTitle}>PARI results · whole room</div>

          {submitted === 0 ? (
            <p style={{ fontSize: 14, color: '#999', margin: 0 }}>No results yet. Waiting for submissions...</p>
          ) : (
            <>
              {/* Headline */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.5rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: '3rem', color: '#0a0a0a', lineHeight: 1 }}>{globalMean}</span>
                  <span style={{ fontSize: '0.9rem', color: '#999', fontWeight: 700 }}>/100 room average</span>
                </div>
                <span style={{ fontSize: '0.9rem', color: '#666' }}>Range {minScore}–{maxScore}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {/* Area radar */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>Average by area (0–20)</div>
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
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>Distribution of individual scores</div>
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

              {/* Band distribution */}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 10 }}>Band distribution</div>
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

        {/* 4 · BREAKDOWN BY PORT SIZE (Q0) */}
        {portSizeStats && (
          <div style={card}>
            <div style={cardTitle}>Average by port size</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {portSizeStats.map(ps => (
                <div key={ps.size} style={{ border: '1px solid #e5e5e5', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a', marginBottom: 6 }}>{ps.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#0a0a0a' }}>{ps.avg}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>/100 avg</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{ps.count} port{ps.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
