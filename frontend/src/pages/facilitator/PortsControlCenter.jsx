import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip,
} from 'recharts'
import api from '../../utils/api.js'
import EventWheel from '../../components/EventWheel.jsx'
import { socket } from '../../utils/socket.js'
import { COLOR, FONT, FS, FW, LS, HAIRLINE } from '../../styles/tokens.js'

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

// Facilitator-driven phases. Manual only — the tab you pick is the phase; it is
// never derived from the data. Persisted server-side (Session.phase) so a reload
// or a different laptop resumes on the same phase.
const PHASES = [
  { id: 'join',     label: 'Join' },
  { id: 'par',      label: 'PAR Index' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'wheel',    label: 'Roulette' },
  { id: 'debrief',  label: 'Debrief' },
]

// "NOW" strip: one sentence telling the room what to do in the current phase.
const NOW_COPY = {
  join:     'Everyone joins on their phone. It takes 30 seconds.',
  par:      'Answer the 10 questions on your phone. Results update live.',
  strategy: "Each team reads out its measure numbers. Other teams' choices stay hidden.",
  wheel:    'One team at a time. Each port has its own wheel.',
  debrief:  'Which team had the best plan — and which just had the best luck?',
}

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
  const [draftText, setDraftText]             = useState('')  // raw "11 8 25" typed by the facilitator
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState('')

  // Phase 8 — roulette outcomes
  const [outcomes, setOutcomes] = useState([]) // sorted desc by lossesAvoidedPct
  const [spinning, setSpinning] = useState(null) // group being spun (cosmetic)
  const [wheel, setWheel]       = useState(null) // { group, slices, resultCode, eventName, preparedness, lossesAvoidedPct }

  // Phase 9 — session close
  const [closed, setClosed]   = useState(false)
  const [closing, setClosing] = useState(false)
  const [draft, setDraft]     = useState(false)
  const [starting, setStarting] = useState(false)
  const [endDialogOpen, setEndDialogOpen] = useState(false) // "End session…" confirmation

  // Control-centre phase (facilitator-driven, persisted in Session.phase).
  const [phase, setPhase] = useState('join')

  // Join tab: live participant count + port shuffle.
  const [joinedCount, setJoinedCount] = useState(0)
  const [shuffling, setShuffling]     = useState(false)
  const [shuffleMsg, setShuffleMsg]   = useState('')

  const joinUrl  = `${window.location.origin}/?code=${code}`
  const shortUrl = window.location.host // shown without the ?code= query string

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
        setPhase(res.data.phase || 'join')
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
    function onPhaseChange({ phase: p }) { if (p) setPhase(p) }
    function onJoined(p) { if (typeof p?.total === 'number') setJoinedCount(p.total) }
    socket.on('par:update', onParUpdate)
    socket.on('strategy:update', onStrategyUpdate)
    socket.on('outcome:update', onOutcomeUpdate)
    socket.on('phase:change', onPhaseChange)
    socket.on('participant:joined', onJoined)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('par:update', onParUpdate)
      socket.off('strategy:update', onStrategyUpdate)
      socket.off('outcome:update', onOutcomeUpdate)
      socket.off('phase:change', onPhaseChange)
      socket.off('participant:joined', onJoined)
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
        confirmed: !!strat?.confirmed,
        hasStrategy: !!strat,
        portName: portId != null ? (portNameById[portId] || `Port ${portId}`) : null,
        status,
      }
    })
  }, [groups, groupAgg, portAssignments, portNameById, strategyByGroup])

  // Wheel gate: every table with a strategy must be confirmed before drawing.
  const strategyList = Object.values(strategyByGroup)
  const allConfirmed = strategyList.length > 0 && strategyList.every(s => s.confirmed)
  const pendingConfirm = strategyList.filter(s => !s.confirmed).map(s => s.group)
  // Tables that have already spun — their measures can't be unlocked.
  const drawnGroups = new Set(outcomes.filter(o => o.drawn).map(o => o.group))

  // ── Measure-entry helpers ───────────────────────────────────────────────────
  // Parse free-typed numbers ("11 8 25", commas/spaces/newlines) into measure
  // ids: dedupe, split known (exist in the catalogue) from unknown (flagged).
  const knownMeasureIds = useMemo(() => new Set(measuresCatalog.map(m => m.id)), [measuresCatalog])
  const parseMeasureText = useCallback((text) => {
    const nums = (String(text).match(/\d+/g) || []).map(Number)
    const seen = new Set(), valid = [], unknown = []
    for (const n of nums) {
      if (seen.has(n)) continue
      seen.add(n)
      if (knownMeasureIds.has(n)) valid.push(n)
      else unknown.push(n)
    }
    return { valid, unknown }
  }, [knownMeasureIds])

  function openEditor(group) {
    setSaveError('')
    const ms = strategyByGroup[group]?.measures || []
    setDraftMeasures(ms)
    setDraftText(ms.join(' '))
    setEditingGroup(group)
  }
  // Typing numbers is the primary entry; it drives the selection (and the boxes).
  function onDraftTextChange(raw) {
    setDraftText(raw)
    setDraftMeasures(parseMeasureText(raw).valid)
  }
  // Toggling a box keeps the typed text in sync so both stay consistent.
  function toggleDraftMeasure(id) {
    const next = draftMeasures.includes(id) ? draftMeasures.filter(x => x !== id) : [...draftMeasures, id]
    setDraftMeasures(next)
    setDraftText(next.join(' '))
  }
  const draftUnknown = useMemo(() => parseMeasureText(draftText).unknown, [draftText, parseMeasureText])
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
  // Confirm from within the editor: persist the current draft first, THEN lock.
  // The big read-aloud line above this button is the review step — no browser
  // confirm() dialog. Locking is reversible via Unlock (unless already drawn).
  async function saveAndConfirm(group) {
    setSaving(true)
    setSaveError('')
    try {
      await api.put(`/api/par/${code}/strategy/${encodeURIComponent(group)}`, { measures: draftMeasures })
      const res = await api.patch(`/api/par/${code}/strategy/${encodeURIComponent(group)}/confirm`)
      setStrategyByGroup(prev => ({ ...prev, [group]: res.data.strategy }))
      setEditingGroup(null)
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Error confirming')
    } finally {
      setSaving(false)
    }
  }

  // Unlock (re-open) a table's measures. Backend refuses if it already drew.
  async function unlockMeasures(group) {
    try {
      const res = await api.patch(`/api/par/${code}/strategy/${encodeURIComponent(group)}/unlock`)
      setStrategyByGroup(prev => ({ ...prev, [group]: res.data.strategy }))
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not unlock the measures.')
    }
  }

  // End the session: persists the aggregate PARI summary and notifies
  // participants. Confirmed via the in-UI dialog (not window.confirm).
  async function closeSession() {
    if (closing || closed) return
    setClosing(true)
    try {
      await api.patch(`/api/sessions/${code}/close`)
      setClosed(true)
      setEndDialogOpen(false)
    } catch {
      window.alert('Could not end the session. Try again.')
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

  // Re-roll the random port assignment. Allowed only before the Strategy phase
  // (the backend returns 409 otherwise). Ports stay hidden; this just confirms.
  async function shufflePorts() {
    if (shuffling) return
    setShuffling(true)
    setShuffleMsg('')
    try {
      await api.post(`/api/sessions/${code}/shuffle-ports`)
      setShuffleMsg('Ports shuffled ✓')
    } catch (err) {
      setShuffleMsg(err.response?.data?.error || 'Could not shuffle the ports.')
    } finally {
      setShuffling(false)
    }
  }

  // Switch the control-centre phase. Optimistic (updates the tab immediately);
  // the server persists it and echoes phase:change back to confirm. Manual only.
  async function changePhase(next) {
    if (next === phase) return
    const prev = phase
    setPhase(next)
    try {
      await api.patch(`/api/sessions/${code}/phase`, { phase: next })
    } catch {
      setPhase(prev)
      window.alert('Could not change the phase. Try again.')
    }
  }

  // Spin the roulette for a table. The backend decides the event (gated on all
  // tables confirmed) and returns the outcome incl. exposure weights; the wheel
  // animation is purely cosmetic and opens in an overlay.
  async function drawWheel(group) {
    if (spinning) return
    if (!allConfirmed) {
      window.alert(`All tables must confirm their measures first. Pending: ${pendingConfirm.join(', ') || '—'}`)
      return
    }
    setSpinning(group)
    try {
      const res = await api.post(`/api/par/${code}/strategy/${encodeURIComponent(group)}/draw`)
      const o = res.data.outcome
      // Open the wheel overlay with the server-resolved event + exposure slices.
      setWheel({
        group,
        portName: o.portName,
        slices: o.exposure || [],
        resultCode: o.eventCode,
        eventName: o.eventName,
        preparedness: o.preparedness,
        lossesAvoidedPct: o.lossesAvoidedPct,
      })
      fetchOutcomes()
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not spin the wheel.')
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

  const currentIndex = Math.max(0, PHASES.findIndex(p => p.id === phase))
  const nextPhase = PHASES[currentIndex + 1]

  return (
    <div style={{ background: COLOR.paper, minHeight: 'calc(100vh - 52px)', fontFamily: FONT.sans, color: COLOR.ink }}>

      {/* ═══ HEADER — title · phase tabs · code · End session ═══ */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '16px 24px', borderBottom: HAIRLINE }}>
        <h1 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h3, letterSpacing: LS.display, margin: 0, whiteSpace: 'nowrap' }}>
          Ports of the Future
        </h1>

        <nav style={{ display: 'flex', gap: 0, flex: '1 1 auto', flexWrap: 'wrap' }}>
          {PHASES.map((p, i) => {
            const active = phase === p.id
            const done = i < currentIndex
            return (
              <button key={p.id} onClick={() => changePhase(p.id)}
                style={{
                  padding: '10px 16px', border: HAIRLINE, borderLeft: i === 0 ? HAIRLINE : 'none',
                  borderRadius: 0, cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: active ? FW.bold : FW.medium,
                  letterSpacing: LS.tight,
                  background: active ? COLOR.harbour : COLOR.paper,
                  color: active ? COLOR.onHarbour : (done ? COLOR.ink60 : COLOR.ink),
                }}>
                <span style={{ fontFamily: FONT.mono, opacity: 0.7, marginRight: 6 }}>{i + 1}</span>
                {p.label}{done ? ' ✓' : ''}
              </button>
            )
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
          <span style={{ fontFamily: FONT.mono, fontSize: FS.body, fontWeight: FW.bold, letterSpacing: '0.1em' }}>{code}</span>
          {closed ? (
            <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink, background: COLOR.ice, border: HAIRLINE, padding: '6px 12px' }}>
              Session ended
            </span>
          ) : (
            <button onClick={() => setEndDialogOpen(true)}
              style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.semibold, color: COLOR.ink, background: COLOR.paper, border: HAIRLINE, borderRadius: 0, padding: '10px 18px', cursor: 'pointer' }}>
              End session…
            </button>
          )}
        </div>
      </header>

      {/* ═══ NOW strip ═══ */}
      <div style={{ background: COLOR.ice, color: COLOR.ink, borderBottom: HAIRLINE, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60 }}>Now</span>
          <span style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.medium }}>{NOW_COPY[phase]}</span>
        </div>
        {nextPhase && (
          <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, letterSpacing: LS.mono, color: COLOR.ink60, whiteSpace: 'nowrap' }}>
            Next: {nextPhase.label}
          </span>
        )}
      </div>

      {/* ═══ END SESSION dialog ═══ */}
      {endDialogOpen && (
        <div onClick={() => setEndDialogOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(11,27,51,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: COLOR.paper, border: HAIRLINE, maxWidth: 440, width: '100%', padding: 28 }}>
            <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h3, letterSpacing: LS.tight, margin: '0 0 12px' }}>End this session?</h2>
            <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, lineHeight: 1.5, margin: '0 0 24px' }}>
              Participants will be notified and the PAR Index summary will be saved. Results stay visible here. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEndDialogOpen(false)}
                style={{ flex: 1, height: 48, border: HAIRLINE, borderRadius: 0, background: COLOR.paper, color: COLOR.ink, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={closeSession} disabled={closing}
                style={{ flex: 1, height: 48, border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: closing ? 'default' : 'pointer' }}>
                {closing ? 'Ending…' : 'End session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BODY (full width) — tab panels rebuilt in B6–B10 ═══ */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* 1 · JOIN — phase: join. Big QR + code in a sky block, live counter,
            "Start PAR Index →". No team list. */}
        {phase === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Sky block: QR + short URL + very large code */}
          <div style={{ background: COLOR.sky, color: COLOR.ink, border: HAIRLINE, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 40, padding: 40 }}>
            <div style={{ background: COLOR.paper, border: HAIRLINE, padding: 20, flexShrink: 0 }}>
              <QRCodeSVG value={joinUrl} size={300} fgColor="#0B1B33" bgColor="#FFFFFF" />
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 280 }}>
              <p style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', margin: '0 0 8px' }}>
                Scan or go to
              </p>
              <p style={{ fontFamily: FONT.mono, fontSize: FS.h3, fontWeight: FW.medium, margin: '0 0 28px', wordBreak: 'break-all' }}>
                {shortUrl}
              </p>
              <p style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', margin: '0 0 8px' }}>
                Session code
              </p>
              <div style={{ fontFamily: FONT.mono, fontWeight: FW.bold, fontSize: FS.mega, letterSpacing: '0.06em', lineHeight: 1 }}>{code}</div>
            </div>
          </div>

          {/* Actions: live counter · shuffle · start */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, borderTop: HAIRLINE, paddingTop: 20 }}>
            <div style={{ flex: '1 1 auto' }}>
              <span style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display }}>{joinedCount}</span>
              <span style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, marginLeft: 10 }}>
                {joinedCount === 1 ? 'person has joined' : 'people have joined'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {shuffleMsg && (
                <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, color: COLOR.ink60 }}>{shuffleMsg}</span>
              )}
              <button onClick={shufflePorts} disabled={shuffling}
                style={{ height: 56, padding: '0 22px', border: HAIRLINE, borderRadius: 0, background: COLOR.paper, color: COLOR.ink, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: shuffling ? 'default' : 'pointer' }}>
                {shuffling ? 'Shuffling…' : '↻ Shuffle ports'}
              </button>
              {draft ? (
                <button onClick={startSession} disabled={starting}
                  style={{ height: 56, padding: '0 28px', border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: starting ? 'default' : 'pointer' }}>
                  {starting ? 'Starting…' : 'Start session →'}
                </button>
              ) : (
                <button onClick={() => changePhase('par')}
                  style={{ height: 56, padding: '0 28px', border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: 'pointer' }}>
                  Start PAR Index →
                </button>
              )}
            </div>
          </div>
        </div>
        )}

        {/* 2 · GROUP STATUS — phase: strategy */}
        {phase === 'strategy' && (
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
                  {/* Hide other tables' assigned port while dictating, so the
                      tables that dictate last don't see the earlier ones' ports.
                      Only the table currently open in the editor shows its port. */}
                  <div style={{ fontSize: 11, color: editingGroup === gs.group ? '#666' : '#bbb', marginBottom: 8 }}>
                    🏙 {editingGroup === gs.group ? (gs.portName || '— no port —') : '••• hidden •••'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#0a0a0a' }}>{gs.avg != null ? gs.avg : '—'}</span>
                    {gs.avg != null && <span style={{ fontSize: 12, color: '#999' }}>/100 avg</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    {gs.count} PAR{gs.count !== 1 ? 's' : ''}
                    {gs.cultureBand && <> · Culture: <span style={{ color: BAND_CONFIG[gs.cultureBand].color, fontWeight: 700 }}>{BAND_CONFIG[gs.cultureBand].label}</span></>}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>🪙 {gs.coinsSpent}/{budget} · {gs.measuresCount} measure{gs.measuresCount !== 1 ? 's' : ''}</span>
                    {gs.confirmed ? (
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>🔒 Confirmed</span>
                        {drawnGroups.has(gs.group) ? (
                          <span title="already drawn" style={{ fontSize: 11, color: '#bbb' }}>Unlock</span>
                        ) : (
                          <button
                            onClick={() => unlockMeasures(gs.group)}
                            style={{ fontSize: 11, fontWeight: 600, color: '#0a0a0a', background: 'transparent', border: '1px solid #e5e5e5', borderRadius: 999, padding: '2px 10px', cursor: 'pointer' }}
                          >
                            Unlock
                          </button>
                        )}
                      </span>
                    ) : (
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                        <button
                          onClick={() => openEditor(gs.group)}
                          style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#1B4B7A', border: 'none', borderRadius: 999, padding: '2px 10px', cursor: 'pointer' }}
                        >
                          Dictate measures
                        </button>
                      </span>
                    )}
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

              {/* Primary entry: type the measure numbers as the tables call them
                  out (e.g. "11 8 25"). Drives the selection; the boxes mirror it. */}
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: 6 }}>
                Type the measure numbers
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={draftText}
                onChange={e => onDraftTextChange(e.target.value)}
                placeholder="e.g. 11 8 25"
                style={{ width: '100%', border: '1.5px solid #0a0a0a', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', color: '#0a0a0a', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
              />
              {draftUnknown.length > 0 && (
                <p style={{ fontSize: 12, color: '#cc4444', margin: '0 0 8px' }}>
                  Unknown measure{draftUnknown.length !== 1 ? 's' : ''}: {draftUnknown.join(', ')} — ignored.
                </p>
              )}

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

              {/* Read-aloud line — read this to the table before locking it in.
                  Part of the confirm step (the button sits right below it). */}
              <div style={{ marginTop: 14, padding: '0.85rem 1rem', background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 10 }}>
                <div style={{ fontSize: 'clamp(1.1rem, 3.5vw, 1.5rem)', fontWeight: 900, color: '#0a0a0a', lineHeight: 1.3 }}>
                  Mesa {editingGroup} → {draftMeasures.length ? draftMeasures.join(', ') : 'sin medidas'}
                  {' · '}
                  <span style={{ color: draftCost > budget ? '#cc4444' : '#16a34a' }}>{draftCost} de {budget} fichas</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => saveMeasures(editingGroup)}
                  disabled={saving || draftCost > budget}
                  style={{ background: 'transparent', color: (saving || draftCost > budget) ? '#bbb' : '#0a0a0a', border: `1px solid ${(saving || draftCost > budget) ? '#e5e5e5' : '#0a0a0a'}`, borderRadius: 999, padding: '0.5rem 1.25rem', fontSize: 13, fontWeight: 600, cursor: (saving || draftCost > budget) ? 'default' : 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Save (keep open)'}
                </button>
                <button
                  onClick={() => saveAndConfirm(editingGroup)}
                  disabled={saving || draftCost > budget}
                  style={{ background: (saving || draftCost > budget) ? '#e5e5e5' : '#1B4B7A', color: (saving || draftCost > budget) ? '#bbb' : '#fff', border: 'none', borderRadius: 999, padding: '0.5rem 1.25rem', fontSize: 13, fontWeight: 700, cursor: (saving || draftCost > budget) ? 'default' : 'pointer' }}
                >
                  {saving ? 'Confirming...' : '🔒 Confirm & lock'}
                </button>
              </div>
            </div>
          )}
        </div>

        )}

        {/* 2.5 · RULETA DE EVENTOS + RANKING — phase: wheel / debrief */}
        {(phase === 'wheel' || phase === 'debrief') && (
        <div style={card}>
          <div style={cardTitle}>Event roulette &amp; ranking</div>
          {!allConfirmed && (
            <p style={{ fontSize: 12, color: '#b07a30', margin: '0 0 0.75rem' }}>
              🔒 The wheel is locked until every table confirms its measures.
              {pendingConfirm.length > 0 && <> Pending: <strong>{pendingConfirm.join(', ')}</strong>.</>}
            </p>
          )}
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
                          {(() => {
                            const disabled = !!spinning || !allConfirmed
                            return (
                              <button
                                onClick={() => drawWheel(o.group)}
                                disabled={disabled}
                                title={!allConfirmed ? 'All tables must confirm their measures first' : undefined}
                                style={{ fontSize: 12, fontWeight: 600, color: disabled ? '#bbb' : '#fff', background: disabled ? '#e5e5e5' : '#0a0a0a', border: 'none', borderRadius: 999, padding: '4px 12px', cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {isSpin ? '🎡' : o.drawn ? 'Spin again' : 'Spin the wheel'}
                              </button>
                            )
                          })()}
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

        )}

        {/* 3 · RESULTADOS PARI (agregado) — phase: par / debrief */}
        {(phase === 'par' || phase === 'debrief') && (
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

        )}

        {/* 4 · BREAKDOWN BY PORT SIZE (Q0) — phase: par / debrief */}
        {(phase === 'par' || phase === 'debrief') && portSizeStats && (
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

      {/* Event wheel overlay (cosmetic spin; result shown regardless) */}
      {wheel && (
        <div
          onClick={() => setWheel(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}
        >
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#999', marginBottom: '0.5rem' }}>
              {wheel.group} · {wheel.portName || ''}
            </div>
            <EventWheel slices={wheel.slices} resultCode={wheel.resultCode} />
            <div style={{ marginTop: 16, fontSize: 15 }}>
              <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#0a0a0a' }}>{wheel.eventName}</div>
              <div style={{ color: '#666', marginTop: 4 }}>
                Preparedness <strong style={{ color: '#0a0a0a' }}>{wheel.preparedness?.toFixed(1)}</strong>
                {' · '}<strong style={{ color: '#16a34a' }}>{wheel.lossesAvoidedPct?.toFixed(0)}%</strong> losses avoided
              </div>
            </div>
            <button onClick={() => setWheel(null)}
              style={{ marginTop: 18, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
