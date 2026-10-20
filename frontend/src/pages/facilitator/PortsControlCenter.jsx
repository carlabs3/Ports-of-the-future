import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../utils/api.js'
import EventWheel, { EVENT_WORDS } from '../../components/EventWheel.jsx'
import { socket } from '../../utils/socket.js'
import { COLOR, FONT, FS, FW, LS, HAIRLINE, BAND_RAMP } from '../../styles/tokens.js'

// Culture multiplier by band (display only — the backend applies it in scoring).
const CULTURE_FACTOR = { reactive: 0.8, aware: 0.9, developing: 1.0, proactive: 1.1 }

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

// Read-aloud helpers (Strategy tab).
const COIN_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']
const andList = (arr) => arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`

// Mono section label (tokens). Shared by the rebuilt tabs.
const uiLabel = {
  fontFamily: FONT.mono, fontSize: FS.label, fontWeight: FW.medium, letterSpacing: LS.mono,
  textTransform: 'uppercase', color: COLOR.ink60, margin: 0,
}

// Single-select filter chip for the PAR tab. Active (a value chosen) reads
// harbour; empty reads neutral.
function FilterSelect({ value, onChange, placeholder, options }) {
  const active = !!value
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: active ? FW.bold : FW.regular,
        border: `1px solid ${active ? COLOR.harbour : COLOR.ink}`, borderRadius: 0,
        padding: '9px 12px', background: COLOR.paper, color: active ? COLOR.harbour : COLOR.ink,
        cursor: 'pointer',
      }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
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
  const [editingGroup, setEditingGroup]       = useState(null) // the team now dictating
  const [draftMeasures, setDraftMeasures]     = useState([])  // ids being entered
  const [numInput, setNumInput]               = useState('')  // the measure number being added
  const [addError, setAddError]               = useState('')  // inline validation for Add
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState('')

  // Phase 8 — roulette outcomes
  const [outcomes, setOutcomes] = useState([]) // sorted desc by lossesAvoidedPct
  const [spinning, setSpinning] = useState(null) // group being spun (cosmetic)
  // Roulette: one team at a time, full screen.
  const [wheelTeam, setWheelTeam]       = useState(null) // group on the roulette screen
  const [wheelComp, setWheelComp]       = useState(null) // { portName, exposure, measures, cultureBand }
  const [wheelOutcome, setWheelOutcome] = useState(null) // draw result once spun

  // Debrief: luck vs strategy (expected results, only in the debrief phase).
  const [debrief, setDebrief] = useState(null) // { budget, teams: [...] }

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

  // PAR tab: combinable filters + world-zone labels (for the filter dropdown).
  const [filters, setFilters] = useState({ portSize: '', worldZone: '', team: '', band: '' })
  const [worldZoneOptions, setWorldZoneOptions] = useState([]) // [{ optionId, label }]

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

  // Fetch the debrief (expected results) — only succeeds in the debrief phase.
  const fetchDebrief = useCallback(() => {
    api.get(`/api/par/${code}/debrief`)
      .then(res => setDebrief(res.data))
      .catch(() => setDebrief(null))
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
    // World-zone labels for the PAR filter dropdown (ids live in the data).
    api.get('/api/par/questionnaire')
      .then(res => setWorldZoneOptions(res.data?.demographics?.worldZone?.options || []))
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

  // On entering the Roulette phase (all locked), auto-open the first team that
  // still needs to spin so the screen shows one team at a time.
  useEffect(() => {
    if (phase === 'wheel' && allConfirmed && !wheelTeam) {
      const first = groupStats.find(g => !drawnGroups.has(g.group))?.group || groupStats[0]?.group
      if (first) openWheel(first)
    }
  }, [phase, allConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load the debrief (expected results) when the facilitator enters that phase.
  useEffect(() => {
    if (phase === 'debrief') fetchDebrief()
  }, [phase, fetchDebrief])

  // ── PAR tab: combinable filters + filtered aggregates (all client-side) ─────
  const anyFilter = !!(filters.portSize || filters.worldZone || filters.team || filters.band)

  const filteredRows = useMemo(() => rows.filter(r =>
    (!filters.portSize  || r.portSize  === filters.portSize) &&
    (!filters.worldZone || r.worldZone === filters.worldZone) &&
    (!filters.team      || r.group     === filters.team) &&
    (!filters.band      || r.band      === filters.band)
  ), [rows, filters])

  const totalAnswers = rows.length         // all submissions this session
  const shownCount   = filteredRows.length // after filters
  // Anonymity floor: never show numbers/charts for fewer than 3 answers, so a
  // Team + size + zone combination can't isolate one person on the projector.
  const enoughToShow = shownCount >= 3

  const fScores  = filteredRows.map(r => r.score)
  const fAverage = fScores.length ? Math.round(mean(fScores)) : 0
  const fMin     = fScores.length ? Math.min(...fScores) : 0
  const fMax     = fScores.length ? Math.max(...fScores) : 0

  // Average per area (0–20) over the filtered set, and the weakest area.
  const areaMeans = AREA_ORDER.map(id => ({
    id, label: AREA_LABELS[id],
    value: filteredRows.length ? Math.round(mean(filteredRows.map(r => r.areas?.[id] ?? 0)) * 10) / 10 : 0,
  }))
  const weakestAreaId = areaMeans.reduce((min, a) => (a.value < min.value ? a : min), areaMeans[0]).id

  // Histogram: 10-point bins (0–9 … 90–100) over the filtered set.
  const histBins = Array.from({ length: 10 }, (_, i) => ({ label: `${i * 10}–${i * 10 + 9}`, count: 0 }))
  for (const sc of fScores) histBins[Math.min(9, Math.floor(sc / 10))].count += 1
  const histMax = Math.max(1, ...histBins.map(b => b.count))

  // Band counts over the filtered set (ramp colours from tokens).
  const bandCounts = BAND_ORDER.map(b => ({ band: b, count: filteredRows.filter(r => r.band === b).length }))

  // By port size: avg score per size over the filtered set.
  const sizeSummary = PORT_SIZE_ORDER
    .map(size => {
      const ss = filteredRows.filter(r => r.portSize === size).map(r => r.score)
      return { size, label: PORT_SIZE_LABELS[size], count: ss.length, avg: ss.length ? Math.round(mean(ss)) : null }
    })
    .filter(s => s.count > 0)

  // "N of M answered": people who answered out of people in the room.
  const answeredDenom = Math.max(joinedCount, totalAnswers, 1)

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
  const measureById = useMemo(() => new Map(measuresCatalog.map(m => [m.id, m])), [measuresCatalog])
  const draftCost = useMemo(
    () => draftMeasures.reduce((s, id) => s + (measureById.get(id)?.cost || 0), 0),
    [draftMeasures, measureById]
  )
  // Any entered measure that raises the culture band (#19 / #20 in config).
  const draftRaisesCulture = draftMeasures.some(id => measureById.get(id)?.raisesCultureBand)

  // Read-aloud sentence for the dictating team, e.g.
  // "Team D: measures 8, 15 and 19. Six coins. Correct?"
  const readAloud = editingGroup
    ? `${editingGroup}: ${draftMeasures.length ? `measure${draftMeasures.length !== 1 ? 's' : ''} ${andList(draftMeasures)}` : 'no measures'}. ${COIN_WORDS[draftCost] ?? draftCost} coin${draftCost !== 1 ? 's' : ''}. Correct?`
    : ''

  // Start dictating a team: load its current measures into the draft.
  function openEditor(group) {
    setSaveError('')
    setAddError('')
    setNumInput('')
    setDraftMeasures(strategyByGroup[group]?.measures || [])
    setEditingGroup(group)
  }
  // Add one measure number (1–25). Inline validation: range, exists, duplicate,
  // budget. The teams call numbers out one at a time, so this is the entry.
  function addMeasure() {
    const n = parseInt(numInput, 10)
    setAddError('')
    if (!Number.isInteger(n) || n < 1 || n > 25) { setAddError('Enter a measure number from 1 to 25.'); return }
    const m = measureById.get(n)
    if (!m) { setAddError(`Measure ${n} doesn't exist.`); return }
    if (draftMeasures.includes(n)) { setAddError(`Measure ${n} is already added.`); return }
    if (draftCost + m.cost > budget) { setAddError(`Over budget: measure ${n} costs ${m.cost}, only ${budget - draftCost} left.`); return }
    setDraftMeasures(prev => [...prev, n])
    setNumInput('')
  }
  function removeMeasure(id) {
    setAddError('')
    setDraftMeasures(prev => prev.filter(x => x !== id))
  }
  function clearDraft() {
    setAddError('')
    setNumInput('')
    setDraftMeasures([])
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

  // Open a team's wheel: fetch its composition (exposure + measures), revealed
  // only after every team is locked. If the team already drew, also load its
  // stored outcome so re-selecting it shows the result.
  async function openWheel(group) {
    setWheelTeam(group)
    setWheelComp(null)
    setWheelOutcome(null)
    try {
      const res = await api.get(`/api/par/${code}/strategy/${encodeURIComponent(group)}/wheel`)
      setWheelComp(res.data)
      if (res.data.drawn) {
        const o = outcomes.find(x => x.group === group)
        if (o) setWheelOutcome(o)
      }
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not open the wheel.')
      setWheelTeam(null)
    }
  }

  // Spin: the backend decides the event (gated on all teams confirmed) and
  // returns the outcome; the wheel animation is purely cosmetic.
  async function spinWheel() {
    if (spinning || !wheelTeam) return
    setSpinning(wheelTeam)
    try {
      const res = await api.post(`/api/par/${code}/strategy/${encodeURIComponent(wheelTeam)}/draw`)
      setWheelOutcome(res.data.outcome)
      fetchOutcomes()
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not spin the wheel.')
    } finally {
      setTimeout(() => setSpinning(null), 1200)
    }
  }

  // The next team that still needs to spin (after the current one), or null.
  function nextTeamToDraw() {
    const order = groupStats.map(g => g.group)
    const start = order.indexOf(wheelTeam)
    for (let k = 1; k <= order.length; k++) {
      const g = order[(start + k) % order.length]
      if (!drawnGroups.has(g)) return g
    }
    return null
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

        {/* 2 · STRATEGY — phase: strategy. One team dictates at a time. Other
            teams' port / score / culture / measures stay hidden. */}
        {phase === 'strategy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 20, alignItems: 'start' }}>

            {/* LEFT: team list — one status chip each, nothing else */}
            <div style={{ border: HAIRLINE, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <p style={uiLabel}>Teams</p>
                <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold }}>
                  {groupStats.filter(g => g.confirmed).length} of {groupStats.length} locked
                </span>
              </div>
              {groupStats.map(gs => {
                const dictating = editingGroup === gs.group
                return (
                  <div key={gs.group} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: HAIRLINE }}>
                    <span style={{ flex: 1, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold }}>{gs.group}</span>
                    {gs.confirmed ? (
                      <>
                        <span style={{ ...uiLabel, color: COLOR.onInk, background: COLOR.ink, border: HAIRLINE, padding: '4px 10px' }}>Locked ✓</span>
                        {!drawnGroups.has(gs.group) && (
                          <button onClick={() => unlockMeasures(gs.group)}
                            style={{ fontFamily: FONT.sans, fontSize: FS.micro, fontWeight: FW.semibold, color: COLOR.ink, background: COLOR.paper, border: HAIRLINE, borderRadius: 0, padding: '4px 8px', cursor: 'pointer' }}>
                            Unlock
                          </button>
                        )}
                      </>
                    ) : dictating ? (
                      <span style={{ ...uiLabel, color: COLOR.ink, background: COLOR.signal, border: HAIRLINE, padding: '4px 10px' }}>Dictating</span>
                    ) : (
                      <>
                        <span style={{ ...uiLabel, color: COLOR.ink, background: COLOR.paper, border: HAIRLINE, padding: '4px 10px' }}>Waiting</span>
                        <button onClick={() => openEditor(gs.group)}
                          style={{ fontFamily: FONT.sans, fontSize: FS.micro, fontWeight: FW.semibold, color: COLOR.onInk, background: COLOR.ink, border: HAIRLINE, borderRadius: 0, padding: '4px 8px', cursor: 'pointer' }}>
                          Dictate →
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* RIGHT: dictation panel for the team now dictating */}
            <div style={{ border: HAIRLINE, padding: 28, minHeight: 220 }}>
              {!editingGroup ? (
                <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>
                  Pick a team on the left to start dictating its measures.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                    <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display, margin: 0 }}>{editingGroup}</h2>
                    <span style={uiLabel}>Now dictating</span>
                  </div>

                  {/* 6-cell coin meter */}
                  <p style={uiLabel}>{draftCost} of {budget} coins spent</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 24 }}>
                    {Array.from({ length: budget }).map((_, i) => (
                      <div key={i} style={{ flex: 1, height: 28, border: HAIRLINE, background: i < draftCost ? COLOR.ink : COLOR.ice }} />
                    ))}
                  </div>

                  {/* Number input + Add */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="number" min={1} max={25} inputMode="numeric"
                      value={numInput}
                      onChange={e => { setNumInput(e.target.value); setAddError('') }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMeasure() } }}
                      placeholder="Measure # (1–25)"
                      style={{ flex: 1, border: HAIRLINE, borderRadius: 0, padding: '14px 16px', fontFamily: FONT.mono, fontSize: FS.body, fontWeight: FW.bold, color: COLOR.ink, background: COLOR.paper, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button onClick={addMeasure}
                      style={{ height: 'auto', padding: '0 24px', border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: 'pointer' }}>
                      + Add
                    </button>
                  </div>
                  {addError && <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: '#c0392b', margin: '10px 0 0' }}>{addError}</p>}

                  {/* Entered measures as rows */}
                  <div style={{ marginTop: 20 }}>
                    {draftMeasures.length === 0 ? (
                      <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>No measures yet.</p>
                    ) : draftMeasures.map(id => {
                      const m = measureById.get(id)
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: HAIRLINE }}>
                          <span style={{ fontFamily: FONT.mono, fontSize: FS.body, fontWeight: FW.bold, minWidth: 28 }}>{id}</span>
                          <span style={{ flex: 1, fontFamily: FONT.sans, fontSize: FS.body }}>{m?.name || `Measure ${id}`}</span>
                          <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, color: COLOR.ink60 }}>🪙 {m?.cost ?? '—'}</span>
                          <button onClick={() => removeMeasure(id)} title="Remove"
                            style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink, background: COLOR.paper, border: HAIRLINE, borderRadius: 0, width: 32, height: 32, cursor: 'pointer' }}>×</button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Culture-band note for #19 / #20 */}
                  {draftRaisesCulture && (
                    <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink, background: COLOR.ice, border: HAIRLINE, padding: '10px 14px', margin: '20px 0 0' }}>
                      This raises the team's culture band by one level (measure #19 / #20).
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* BOTTOM ink bar: read-aloud sentence + lock */}
          {editingGroup && (
            <div style={{ background: COLOR.ink, color: COLOR.onInk, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <p style={{ flex: '1 1 320px', fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h3, letterSpacing: LS.tight, lineHeight: 1.3, margin: 0 }}>
                {readAloud}
              </p>
              {saveError && <span style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.signal }}>{saveError}</span>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={clearDraft}
                  style={{ height: 48, padding: '0 20px', border: `1px solid ${COLOR.onInk}`, borderRadius: 0, background: 'transparent', color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: 'pointer' }}>
                  Clear
                </button>
                <button onClick={() => saveAndConfirm(editingGroup)} disabled={saving || draftCost > budget}
                  style={{ height: 48, padding: '0 24px', border: HAIRLINE, borderRadius: 0, background: COLOR.paper, color: COLOR.ink, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.bold, cursor: (saving || draftCost > budget) ? 'default' : 'pointer', opacity: (saving || draftCost > budget) ? 0.5 : 1 }}>
                  {saving ? 'Locking…' : `Yes — lock ${editingGroup} →`}
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* 4 · ROULETTE — phase: wheel. One team at a time, full screen. */}
        {phase === 'wheel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {!allConfirmed ? (
            <div style={{ border: HAIRLINE, padding: '48px 28px', textAlign: 'center' }}>
              <p style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.tight, margin: '0 0 8px' }}>The roulette opens once every team is locked.</p>
              {pendingConfirm.length > 0 && <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>Waiting on: {pendingConfirm.join(', ')}.</p>}
            </div>
          ) : !wheelTeam || !wheelComp ? (
            <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>Select a team below to open its wheel.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display, margin: 0 }}>{wheelTeam}</h2>
                <span style={uiLabel}>{wheelComp.portName}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 460px) 1fr', gap: 32, alignItems: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <EventWheel slices={wheelComp.exposure} resultCode={wheelOutcome?.eventCode} size={440} />
                </div>

                <div>
                  {!wheelOutcome ? (
                    <>
                      <p style={uiLabel}>What this wheel holds · 10 slots</p>
                      <div style={{ marginTop: 14, marginBottom: 24 }}>
                        {wheelComp.exposure.filter(e => e.weight > 0).map(e => (
                          <div key={e.code} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderTop: HAIRLINE }}>
                            <span style={{ flex: '0 0 110px', fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.bold }}>{EVENT_WORDS[e.code] || e.name}</span>
                            <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                              {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} style={{ flex: 1, height: 14, border: HAIRLINE, background: i < e.weight ? COLOR.harbour : COLOR.ice }} />
                              ))}
                            </div>
                            <span style={{ flex: '0 0 42px', textAlign: 'right', fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold }}>{e.weight}/10</span>
                          </div>
                        ))}
                      </div>

                      <p style={uiLabel}>Measures bought</p>
                      <div style={{ marginTop: 10, marginBottom: 24 }}>
                        {wheelComp.measures.length === 0 ? (
                          <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>None.</p>
                        ) : wheelComp.measures.map(id => {
                          const m = measureById.get(id)
                          return (
                            <div key={id} style={{ display: 'flex', gap: 12, padding: '7px 0', borderTop: HAIRLINE }}>
                              <span style={{ fontFamily: FONT.mono, fontWeight: FW.bold, minWidth: 28 }}>{id}</span>
                              <span style={{ flex: 1, fontFamily: FONT.sans, fontSize: FS.body }}>{m?.name || `Measure ${id}`}</span>
                              <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, color: COLOR.ink60 }}>🪙 {m?.cost ?? '—'}</span>
                            </div>
                          )
                        })}
                      </div>

                      <button onClick={spinWheel} disabled={!!spinning}
                        style={{ width: '100%', height: 56, border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: spinning ? 'default' : 'pointer', opacity: spinning ? 0.6 : 1 }}>
                        {spinning ? 'Spinning…' : 'Spin the wheel →'}
                      </button>
                    </>
                  ) : (() => {
                    const cb = wheelComp.cultureBand
                    const coinsHelped = (wheelOutcome.breakdown || []).filter(b => b.sOriginal > 0)
                      .reduce((s, b) => s + (measureById.get(b.measureId)?.cost || 0), 0)
                    return (
                      <>
                        <p style={uiLabel}>The wheel drew</p>
                        <h3 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display, margin: '6px 0 2px' }}>{EVENT_WORDS[wheelOutcome.eventCode] || wheelOutcome.eventCode}</h3>
                        <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: '0 0 20px' }}>{wheelOutcome.eventName || wheelOutcome.drawnEvent}</p>

                        <div style={{ background: COLOR.harbour, color: COLOR.onHarbour, border: HAIRLINE, padding: '20px 24px', marginBottom: 24 }}>
                          <span style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.mega, letterSpacing: LS.display, lineHeight: 0.9 }}>{Math.round(wheelOutcome.lossesAvoidedPct)}%</span>
                          <span style={{ fontSize: FS.h3, fontWeight: FW.bold, marginLeft: 10 }}>of losses avoided</span>
                        </div>

                        {/* Measure · Protection · With culture */}
                        <div style={{ border: HAIRLINE, marginBottom: 16 }}>
                          <div style={{ display: 'flex', ...uiLabel, padding: '8px 12px', background: COLOR.ice }}>
                            <span style={{ flex: 1 }}>Measure</span>
                            <span style={{ flex: '0 0 90px', textAlign: 'right' }}>Protection</span>
                            <span style={{ flex: '0 0 110px', textAlign: 'right' }}>With culture</span>
                          </div>
                          {(wheelOutcome.breakdown || []).length === 0 ? (
                            <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, padding: '10px 12px', margin: 0 }}>No measures bought.</p>
                          ) : wheelOutcome.breakdown.map(b => (
                            <div key={b.measureId} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderTop: HAIRLINE, fontFamily: FONT.sans, fontSize: FS.sm }}>
                              <span style={{ flex: 1 }}><span style={{ fontFamily: FONT.mono, fontWeight: FW.bold, marginRight: 8 }}>{b.measureId}</span>{b.name}</span>
                              <span style={{ flex: '0 0 90px', textAlign: 'right', fontFamily: FONT.mono }}>{b.sOriginal}</span>
                              <span style={{ flex: '0 0 110px', textAlign: 'right', fontFamily: FONT.mono, fontWeight: FW.bold }}>{b.sAdjusted}</span>
                            </div>
                          ))}
                        </div>

                        <p style={{ fontFamily: FONT.sans, fontSize: FS.body, margin: '0 0 6px' }}>
                          Culture: <strong>{BAND_RAMP[cb]?.label || '—'}</strong> · scores ×{(CULTURE_FACTOR[cb] ?? 1).toFixed(1)}
                        </p>
                        <p style={{ fontFamily: FONT.sans, fontSize: FS.body, margin: '0 0 24px' }}>
                          Coins that helped: <strong>{coinsHelped}</strong> of {budget}
                        </p>

                        {nextTeamToDraw() && (
                          <button onClick={() => openWheel(nextTeamToDraw())}
                            style={{ width: '100%', height: 56, border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: 'pointer' }}>
                            Next: {nextTeamToDraw()} →
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </>
          )}

          {/* Queue strip — one cell per team */}
          {allConfirmed && groupStats.length > 0 && (
            <div style={{ display: 'flex', gap: 8, borderTop: HAIRLINE, paddingTop: 16, flexWrap: 'wrap' }}>
              {groupStats.map(g => {
                const o = outcomes.find(x => x.group === g.group)
                const isNow = g.group === wheelTeam
                const done = drawnGroups.has(g.group)
                const bg = isNow ? COLOR.signal : done ? COLOR.ink : COLOR.paper
                const fg = isNow ? COLOR.ink : done ? COLOR.onInk : COLOR.ink
                return (
                  <button key={g.group} onClick={() => openWheel(g.group)}
                    style={{ flex: '1 1 90px', border: HAIRLINE, borderRadius: 0, background: bg, color: fg, padding: '10px 8px', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.bold }}>{g.group}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, marginTop: 2 }}>
                      {done && o?.lossesAvoidedPct != null ? `${Math.round(o.lossesAvoidedPct)}%` : isNow ? 'now' : 'waiting'}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* 5 · DEBRIEF — phase: debrief. Luck vs strategy. */}
        {phase === 'debrief' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {(() => {
            const teams = debrief?.teams || []
            const bud = debrief?.budget ?? 6
            if (teams.length === 0) {
              return <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>No debrief data yet. Draw the wheel for every team first.</p>
            }
            const rint = v => Math.round(v)
            const drawn = teams.filter(t => t.drawn && t.result != null)
            const roomAvg = drawn.length ? Math.round(drawn.reduce((s, t) => s + t.result, 0) / drawn.length) : 0
            let bestPlan = null
            for (const t of teams) if (!bestPlan || t.expected > bestPlan.expected) bestPlan = t
            let hardest = null, hardestDiff = Infinity
            for (const t of drawn) { const d = rint(t.result) - rint(t.expected); if (d < hardestDiff) { hardestDiff = d; hardest = t } }
            const coinsWasted = drawn.reduce((s, t) => s + Math.max(0, t.coinsSpent - t.coinsThatHelped), 0)

            const fact = (label, value, sub) => (
              <div style={{ border: HAIRLINE, padding: 18 }}>
                <p style={uiLabel}>{label}</p>
                <div style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.display, marginTop: 6 }}>{value}</div>
                {sub && <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: '2px 0 0' }}>{sub}</p>}
              </div>
            )

            return (
              <>
                {/* Legend */}
                <div style={{ border: HAIRLINE, background: COLOR.ice, padding: '14px 18px' }}>
                  <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink, margin: 0, lineHeight: 1.5 }}>
                    The <strong style={{ color: COLOR.harbour }}>bar</strong> is the result — losses avoided when the wheel hit.
                    The <strong>▏marker</strong> is the expected result from the plan. Past the marker = luckier than the plan; short of it = unluckier.
                  </p>
                </div>

                {/* One row per team, sorted by result (backend) */}
                <div style={{ border: HAIRLINE }}>
                  {teams.map(t => {
                    const resInt = t.result != null ? rint(t.result) : null
                    const expInt = rint(t.expected)
                    const diff = resInt != null ? resInt - expInt : null
                    const luck = diff == null ? '—'
                      : Math.abs(diff) <= 5 ? '≈ as expected'
                        : diff > 0 ? `▲ ${diff} lucky` : `▼ ${-diff} unlucky`
                    return (
                      <div key={t.group} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 18px', borderTop: HAIRLINE }}>
                        <div style={{ flex: '0 0 200px' }}>
                          <div style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.bold }}>{t.group} · {t.portName || '—'}</div>
                          <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60 }}>{t.eventName || 'not drawn'}</div>
                        </div>
                        <div style={{ flex: 1, position: 'relative', height: 24, background: COLOR.ice, border: HAIRLINE }}>
                          {resInt != null && <div style={{ position: 'absolute', inset: '0 auto 0 0', height: '100%', width: `${resInt}%`, background: COLOR.harbour }} />}
                          <div title={`Expected ${expInt}%`} style={{ position: 'absolute', top: -3, bottom: -3, left: `${expInt}%`, width: 2, background: COLOR.ink }} />
                        </div>
                        <div style={{ flex: '0 0 180px', textAlign: 'right' }}>
                          <div style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.display, lineHeight: 1 }}>{resInt != null ? `${resInt}%` : '—'}</div>
                          <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.semibold, marginTop: 2 }}>{luck}</div>
                          <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60, marginTop: 2 }}>Coins that helped {t.coinsThatHelped} / {bud}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Four facts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {fact('Room average', `${roomAvg}%`, 'results across the room')}
                  {fact('Best plan on average', bestPlan?.group || '—', bestPlan ? `expected ${rint(bestPlan.expected)}%` : '')}
                  {fact('Hardest luck', hardest?.group || '—', hardest ? `${hardestDiff > 0 ? '+' : ''}${hardestDiff} vs expected` : '')}
                  {fact("Coins that didn't help", coinsWasted, 'across the room')}
                </div>
              </>
            )
          })()}
        </div>
        )}

        {/* 3 · RESULTADOS PARI (agregado) — phase: par / debrief */}
        {phase === 'par' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Filter bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderBottom: HAIRLINE, paddingBottom: 16 }}>
            <span style={uiLabel}>Filter</span>
            <FilterSelect value={filters.portSize}  onChange={v => setFilters(f => ({ ...f, portSize: v }))}  placeholder="All sizes" options={PORT_SIZE_ORDER.map(s => ({ value: s, label: PORT_SIZE_LABELS[s] }))} />
            <FilterSelect value={filters.worldZone} onChange={v => setFilters(f => ({ ...f, worldZone: v }))} placeholder="All zones" options={worldZoneOptions.map(z => ({ value: z.optionId, label: z.label }))} />
            <FilterSelect value={filters.team}      onChange={v => setFilters(f => ({ ...f, team: v }))}      placeholder="All teams" options={groups.map(g => ({ value: g, label: g }))} />
            <FilterSelect value={filters.band}      onChange={v => setFilters(f => ({ ...f, band: v }))}      placeholder="All bands" options={BAND_ORDER.map(b => ({ value: b, label: BAND_RAMP[b].label }))} />
            {anyFilter && (
              <>
                <span style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60 }}>Showing {shownCount} of {totalAnswers} answers</span>
                <button onClick={() => setFilters({ portSize: '', worldZone: '', team: '', band: '' })}
                  style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.semibold, color: COLOR.ink, background: COLOR.paper, border: HAIRLINE, borderRadius: 0, padding: '8px 14px', cursor: 'pointer' }}>
                  Clear filters
                </button>
              </>
            )}
          </div>

          {totalAnswers === 0 ? (
            <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>No results yet. Waiting for submissions…</p>
          ) : !enoughToShow ? (
            <div style={{ border: HAIRLINE, padding: '40px 28px', textAlign: 'center' }}>
              <p style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h3, letterSpacing: LS.tight, color: COLOR.ink, margin: '0 0 8px' }}>
                Too few answers to show (minimum 3)
              </p>
              <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>
                {anyFilter ? 'This filter combination could identify individuals.' : 'Waiting for more submissions.'}
              </p>
            </div>
          ) : (
            <>
              {/* Top: room average (sky) + area bars */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                {/* Left sky block */}
                <div style={{ background: COLOR.sky, color: COLOR.ink, border: HAIRLINE, padding: 28 }}>
                  <p style={uiLabel}>Room average</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                    <span style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.mega, letterSpacing: LS.display, lineHeight: 0.9 }}>{fAverage}</span>
                    <span style={{ fontSize: FS.h3, fontWeight: FW.bold }}>/100</span>
                  </div>
                  <p style={{ fontFamily: FONT.sans, fontSize: FS.body, margin: '14px 0 0' }}>Lowest {fMin} · Highest {fMax}</p>
                  <p style={{ ...uiLabel, marginTop: 24 }}>{shownCount} of {answeredDenom} answered</p>
                  <div style={{ height: 10, background: COLOR.paper, border: HAIRLINE, marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (shownCount / answeredDenom) * 100)}%`, background: COLOR.ink }} />
                  </div>
                </div>

                {/* Right: area bars /20, weakest in signal */}
                <div style={{ border: HAIRLINE, padding: 28 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                    <p style={uiLabel}>Average by area (out of 20)</p>
                    <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink, background: COLOR.signal, border: HAIRLINE, padding: '2px 8px' }}>
                      Weakest: {AREA_LABELS[weakestAreaId]}
                    </span>
                  </div>
                  {areaMeans.map(a => {
                    const weak = a.id === weakestAreaId
                    return (
                      <div key={a.id} style={{ padding: '8px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: weak ? FW.bold : FW.regular }}>{a.label}</span>
                          <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold }}>{a.value}/20</span>
                        </div>
                        <div style={{ height: 14, background: COLOR.ice, border: HAIRLINE, position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: '0 auto 0 0', height: '100%', width: `${(a.value / 20) * 100}%`, background: weak ? COLOR.signal : COLOR.harbour }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Histogram — 10-point bins, upright labels */}
              <div style={{ border: HAIRLINE, padding: 28 }}>
                <p style={uiLabel}>Distribution of individual scores</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, marginTop: 20 }}>
                  {histBins.map(b => (
                    <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%' }}>
                      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${(b.count / histMax) * 100}%`, background: COLOR.harbour, border: b.count ? HAIRLINE : 'none' }} />
                      </div>
                      <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold }}>{b.count}</span>
                      <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60 }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Band distribution — one stacked bar, band ramp */}
              <div style={{ border: HAIRLINE, padding: 28 }}>
                <p style={uiLabel}>Band distribution</p>
                <div style={{ display: 'flex', border: HAIRLINE, marginTop: 16, minHeight: 56 }}>
                  {bandCounts.filter(b => b.count > 0).map((b, i) => {
                    const ramp = BAND_RAMP[b.band]
                    return (
                      <div key={b.band} title={`${ramp.label}: ${b.count}`}
                        style={{ flex: b.count, borderLeft: i === 0 ? 'none' : HAIRLINE, background: ramp.bg, color: ramp.text, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '8px 6px' }}>
                        <span style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.bold }}>{b.count}</span>
                        <span style={{ fontFamily: FONT.sans, fontSize: FS.micro }}>{ramp.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* By port size summary line */}
              {sizeSummary.length > 0 && (
                <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink, margin: 0 }}>
                  <span style={{ ...uiLabel, marginRight: 12 }}>By port size</span>
                  {sizeSummary.map((ps, i) => (
                    <span key={ps.size}>{i > 0 ? '    ·    ' : ''}{ps.label} {ps.avg}/100 ({ps.count})</span>
                  ))}
                </p>
              )}
            </>
          )}
        </div>
        )}

      </div>
    </div>
  )
}
