import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../utils/api.js'
import EventWheel from '../../components/EventWheel.jsx'
import { HazardIcon } from '../../components/HazardIcons.jsx'
import PortIllustration from '../../components/PortIllustration.jsx'
import { socket } from '../../utils/socket.js'
import { COLOR, FONT, FS, FW, LS, HAIRLINE, BAND_RAMP, AREA_COLOR } from '../../styles/tokens.js'

// Culture multiplier by band (display only — the backend applies it in scoring).
const CULTURE_FACTOR = { reactive: 0.8, aware: 0.9, developing: 1.0, proactive: 1.1 }

// Hazard colours (hex), for the roulette result square. Matches EventWheel.
const EVENT_HEX = { SS: '#77AEF1', RF: '#4177C0', HW: '#E3BF40', WS: '#5C6B7A', DR: '#C5E4FF', WF: '#0B1B33', SI: '#7B6FE0' }
// Ink or white text/icon for a given background hex, by perceived luminance.
function textOnColour(hex) {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return '#0B1B33'
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0B1B33' : '#FFFFFF'
}

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

// The three rounds are the years 2026 / 2031 / 2036 (workshop v5).
const ROUND_YEARS = [2026, 2031, 2036]
const roundYear = (round) => ROUND_YEARS[(round || 1) - 1] ?? ''

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
  { id: 'par',      label: 'Results' },
  { id: 'teams',    label: 'Teams' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'wheel',    label: 'Roulette' },
  { id: 'debrief',  label: 'Debrief' },
]

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
const COIN_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']
const andList = (arr) => arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`

// Hazard colours for the card chips — these match the printed cards. Only the
// chip's square carries the colour (for contrast); the text stays ink/white.
const EVENT_ORDER = ['SS', 'RF', 'HW', 'WS', 'DR', 'WF', 'SI']
const EVENT_COLOR = { SS: '#77AEF1', RF: '#4177C0', HW: '#E3BF40', WS: '#5C6B7A', DR: '#C5E4FF', WF: '#0B1B33', SI: '#7B6FE0' }

// The hazard chips for one measure. Enablers → one "+1 culture level" chip. A
// measure with the same value on all 7 hazards → one "All 7 events N" chip.
// Otherwise one chip per hazard it protects (value > 0), in canonical order.
function measureChips(m) {
  if (!m) return []
  if (m.raisesCultureLevel) return [{ kind: 'enabler' }]
  const vals = EVENT_ORDER.map(c => m.protection?.[c] ?? 0)
  if (vals[0] > 0 && vals.every(v => v === vals[0])) return [{ kind: 'all', value: vals[0] }]
  return EVENT_ORDER.filter(c => (m.protection?.[c] ?? 0) > 0).map(c => ({ kind: 'event', code: c, value: m.protection[c] }))
}

// One hazard chip. The colour lives only in the square; the text stays ink (or
// white on a selected/owned dark card) so it always reads.
function Chip({ chip, dark }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: FW.bold,
    padding: '2px 6px', whiteSpace: 'nowrap',
    border: `1px solid ${dark ? 'rgba(255,255,255,0.4)' : COLOR.ink}`,
    color: dark ? COLOR.onInk : COLOR.ink, background: 'transparent',
  }
  if (chip.kind === 'enabler') return <span style={base}>★ +1 culture level</span>
  if (chip.kind === 'all') return <span style={base}>All 7 events {chip.value}</span>
  return (
    <span style={base}>
      <span style={{ width: 9, height: 9, display: 'inline-block', background: EVENT_COLOR[chip.code] || COLOR.ink, border: `1px solid ${dark ? 'rgba(255,255,255,0.35)' : 'rgba(11,27,51,0.2)'}` }} />
      {chip.code} {chip.value}
    </span>
  )
}

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
  const [rows, setRows]             = useState([])  // aligned w/ demographics: + portSize, governance, climateZone, coastalSetting
  const [groups, setGroups]         = useState([])  // declared session groups
  const [groupAgg, setGroupAgg]     = useState([])  // backend per-group: { group, count, avgScore, band, cultureBand }
  const [portAssignments, setPortAssignments] = useState([]) // [{ group, portId }]
  const [portById, setPortById]                = useState({}) // portId -> { id, name, deck, ... }

  // Strategy / rounds (v4). strategyByGroup holds the full public round state per
  // team: { portId, portName, startingBand, cultureLevel, coins, roundStartCoins,
  // currentRound, roundLocked, roundBudget, portfolio:[{id,name,cost}],
  // roundBought, roundReturned, rounds:[...] }.
  const [measuresCatalog, setMeasuresCatalog] = useState([]) // [{ id, name, cost }]
  const [roundBudgets, setRoundBudgets]       = useState([6, 9, 12]) // cumulative, display only (v5)
  const [strategyByGroup, setStrategyByGroup] = useState({})
  const [editingGroup, setEditingGroup]       = useState(null) // the team now dictating
  const [addError, setAddError]               = useState('')  // inline error from buy/undo/return/lock
  const [busy, setBusy]                        = useState(false) // a buy/return/lock call in flight

  // Roulette: one team at a time, full screen. v4 draws spin the CURRENT round.
  const [spinning, setSpinning] = useState(null) // group being spun (cosmetic)
  const [wheelTeam, setWheelTeam]       = useState(null) // group on the roulette screen
  const [wheelComp, setWheelComp]       = useState(null) // { portName, exposure, portfolio, cultureLevel, illustrationMotifs, currentRound }
  const [wheelOutcome, setWheelOutcome] = useState(null) // { eventCode, eventName, exposure, entry:{...} } once drawn
  const [wheelRevealed, setWheelRevealed] = useState(false) // true only once the spin animation ends
  const [wheelAnimate, setWheelAnimate]   = useState(false) // true for a fresh spin; false when reshowing a drawn team
  const [advancing, setAdvancing]       = useState(false) // next-round call in flight
  const [soundOn, setSoundOn]           = useState(false) // wheel click sound, off by default
  const audioRef = useRef(null)
  // Create/resume the audio context on the Spin click (a user gesture).
  function ensureAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!audioRef.current && AC) audioRef.current = new AC()
      audioRef.current?.resume?.()
    } catch { /* audio unavailable */ }
  }
  // A short "tick" on each peg pass (only when sound is on).
  function playTick() {
    const ctx = audioRef.current
    if (!ctx || !soundOn) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.frequency.value = 1100; osc.type = 'square'
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.04)
  }

  // Debrief: luck vs strategy (expected results, only in the debrief phase).
  const [debrief, setDebrief] = useState(null) // { budget, teams: [...] }

  // Phase 9 — session close
  const [closed, setClosed]   = useState(false)
  const [closing, setClosing] = useState(false)
  const [draft, setDraft]     = useState(false)
  const [starting, setStarting] = useState(false)
  const [endDialogOpen, setEndDialogOpen] = useState(false) // "End session…" confirmation
  const [advanceDialog, setAdvanceDialog] = useState(null) // null | 'round' | 'debrief' — confirm before advancing

  // Control-centre phase (facilitator-driven, persisted in Session.phase).
  const [phase, setPhase] = useState('join')
  // Refs so the socket handler (set up once) reads the live phase and fires the
  // automatic Join → Results switch only once.
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const autoSwitchedRef = useRef(false)

  // Join tab: live participant count + port shuffle.
  const [joinedCount, setJoinedCount] = useState(0)
  const [memberCounts, setMemberCounts] = useState({}) // group -> people who joined that team
  const [shuffling, setShuffling]     = useState(false)
  const [shuffleMsg, setShuffleMsg]   = useState('')

  // PAR tab: combinable filters (v4 profile fields) + their labels for the
  // dropdowns. No minimum-group suppression (R1 removed it; it stays removed).
  const [filters, setFilters] = useState({ portSize: '', governance: '', climateZone: '', coastalSetting: '', team: '', band: '' })
  const [demoOptions, setDemoOptions] = useState({ portSize: [], governance: [], climateZone: [], coastalSetting: [] }) // each: [{ optionId, label }]

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
          portSize:       dem[i]?.portSize       || '',
          governance:     dem[i]?.governance     || '',
          climateZone:    dem[i]?.climateZone    || '',
          coastalSetting: dem[i]?.coastalSetting || '',
        })))
      })
      .catch(() => {})
  }, [code])

  // Fetch per-team round state (portfolio, coins, round, lock, round snapshots).
  const fetchStrategies = useCallback(() => {
    api.get(`/api/par/${code}/strategies`)
      .then(res => {
        if (Array.isArray(res.data.roundBudgets)) setRoundBudgets(res.data.roundBudgets)
        setStrategyByGroup(Object.fromEntries((res.data.strategies || []).map(s => [s.group, s])))
      })
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
    api.get(`/api/sessions/${code}/info`)
      .then(res => {
        setGroups(res.data.groups || [])
        setPortAssignments(res.data.portAssignments || [])
        setClosed(res.data.status === 'closed')
        setDraft(res.data.status === 'draft')
        setPhase(res.data.phase || 'join')
        setMemberCounts(res.data.memberCounts || {})
      })
      .catch(() => {})
    api.get('/api/par/ports')
      .then(res => setPortById(Object.fromEntries((res.data || []).map(p => [p.id, p]))))
      .catch(() => {})
    api.get('/api/par/measures')
      .then(res => setMeasuresCatalog(res.data || []))
      .catch(() => {})
    // World-zone labels for the PAR filter dropdown (ids live in the data).
    api.get('/api/par/questionnaire')
      .then(res => {
        const d = res.data?.demographics || {}
        setDemoOptions({
          portSize:       d.portSize?.options       || [],
          governance:     d.governance?.options     || [],
          climateZone:    d.climateZone?.options    || [],
          coastalSetting: d.coastalSetting?.options || [],
        })
      })
      .catch(() => {})
  }, [code, fetchResults, fetchStrategies])

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
      // Auto-advance Join → Results once the THIRD questionnaire is in — once
      // only, and only while still on Join (manual navigation always wins).
      if (!autoSwitchedRef.current && phaseRef.current === 'join' && (ind?.length || 0) >= 3) {
        autoSwitchedRef.current = true
        setPhase('par')
        api.patch(`/api/sessions/${code}/phase`, { phase: 'par' }).catch(() => {})
      }
    }
    function onStrategyUpdate(payload) {
      if (payload?.group) setStrategyByGroup(prev => ({ ...prev, [payload.group]: payload }))
    }
    // A spin changed coins + added a round snapshot; re-pull the team state.
    function onOutcomeUpdate() { fetchStrategies() }
    // Every team advanced to the next round (+3 coins): re-pull and reset the
    // roulette screen so it reopens on the first team of the new round.
    function onRoundsAdvanced() {
      fetchStrategies()
      setWheelTeam(null); setWheelComp(null); setWheelOutcome(null); setWheelRevealed(false); setWheelAnimate(false)
    }
    function onPhaseChange({ phase: p }) { if (p) setPhase(p) }
    function onJoined(p) {
      if (typeof p?.total === 'number') setJoinedCount(p.total)
      // Refresh per-team joined counts for the Teams screen (no phase change).
      api.get(`/api/sessions/${code}/info`).then(r => setMemberCounts(r.data.memberCounts || {})).catch(() => {})
    }
    socket.on('par:update', onParUpdate)
    socket.on('strategy:update', onStrategyUpdate)
    socket.on('outcome:update', onOutcomeUpdate)
    socket.on('rounds:advanced', onRoundsAdvanced)
    socket.on('phase:change', onPhaseChange)
    socket.on('participant:joined', onJoined)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('par:update', onParUpdate)
      socket.off('strategy:update', onStrategyUpdate)
      socket.off('outcome:update', onOutcomeUpdate)
      socket.off('rounds:advanced', onRoundsAdvanced)
      socket.off('phase:change', onPhaseChange)
      socket.off('participant:joined', onJoined)
    }
  }, [code, fetchResults, fetchStrategies])

  // ── PAR tab: combinable filters + filtered aggregates (all client-side) ─────
  const anyFilter = !!(filters.portSize || filters.governance || filters.climateZone || filters.coastalSetting || filters.team || filters.band)

  const filteredRows = useMemo(() => rows.filter(r =>
    (!filters.portSize       || r.portSize       === filters.portSize) &&
    (!filters.governance     || r.governance     === filters.governance) &&
    (!filters.climateZone    || r.climateZone    === filters.climateZone) &&
    (!filters.coastalSetting || r.coastalSetting === filters.coastalSetting) &&
    (!filters.team           || r.group          === filters.team) &&
    (!filters.band           || r.band           === filters.band)
  ), [rows, filters])

  const totalAnswers = rows.length         // all submissions this session
  const shownCount   = filteredRows.length // after filters
  const hasData      = shownCount > 0

  const fScores  = filteredRows.map(r => r.score)
  const fAverage = fScores.length ? Math.round(mean(fScores)) : 0
  const fMin     = fScores.length ? Math.min(...fScores) : 0
  const fMax     = fScores.length ? Math.max(...fScores) : 0

  // Average per area (0–20, one decimal) over the filtered set. Weakest and
  // strongest are decided from the DISPLAYED values; ties mark every area at the
  // low (or high); if all five are equal, mark none.
  const areaMeans = AREA_ORDER.map(id => ({
    id, label: AREA_LABELS[id],
    value: filteredRows.length ? Math.round(mean(filteredRows.map(r => r.areas?.[id] ?? 0)) * 10) / 10 : 0,
  }))
  const areaMin = Math.min(...areaMeans.map(a => a.value))
  const areaMax = Math.max(...areaMeans.map(a => a.value))
  const areaAllEqual = areaMin === areaMax
  const weakestIds   = new Set(areaAllEqual ? [] : areaMeans.filter(a => a.value === areaMin).map(a => a.id))
  const strongestIds = new Set(areaAllEqual ? [] : areaMeans.filter(a => a.value === areaMax).map(a => a.id))

  // Histogram: ten bins 0–9 … 90–99 (a score of 100 goes in the last bin).
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

  // Has team g spun its CURRENT round? (each team advances together, but read
  // the team's own currentRound to be safe.)
  const hasSpunCurrent = (strat) => !!strat && (strat.rounds || []).some(r => r.round === strat.currentRound)

  // Measure catalogue lookup (declared before groupStats, which reads it to find
  // enabler cards #19/#20 for the culture bump).
  const measureById = useMemo(() => new Map(measuresCatalog.map(m => [m.id, m])), [measuresCatalog])

  // Per-team stats — PARI count/avg from the backend aggregate; round state from
  // the strategy doc. Effective culture level is the backend's cultureLevel.
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
      // Culture level from the team's PAR answers, raised one step per enabler
      // card (#19/#20) it holds. The backend gives the effective level once a
      // starting band is fixed (at lock); before that we take the PARI aggregate
      // band and apply the enabler bump here so the list is live as cards change.
      const parBand = strat?.startingBand || agg?.cultureBand || null
      const enablerCount = (strat?.portfolio || []).filter(m => measureById.get(m.id)?.raisesCultureLevel).length
      let cultureBand = strat?.cultureLevel ?? null
      let cultureRaised = false
      if (cultureBand) {
        cultureRaised = !!(strat?.startingBand && cultureBand !== strat.startingBand)
      } else if (parBand) {
        cultureBand = BAND_ORDER[Math.min(BAND_ORDER.indexOf(parBand) + enablerCount, BAND_ORDER.length - 1)]
        cultureRaised = enablerCount > 0
      }
      return {
        group: g,
        count,
        avg: agg?.avgScore ?? null,
        cultureBand,                                    // effective band (PARI base + enablers)
        cultureRaised,                                  // true once an enabler raised it
        startingBand: strat?.startingBand ?? null,
        coins: strat?.coins ?? null,
        currentRound: strat?.currentRound ?? 1,
        roundLocked: !!strat?.roundLocked,
        portfolioCount: strat?.portfolio?.length ?? 0,
        hasStrategy: !!strat,
        spun: hasSpunCurrent(strat),
        portName: portId != null ? (portById[portId]?.name || `Port ${portId}`) : (strat?.portName ?? null),
        portColour: portId != null ? (portById[portId]?.colour || null) : null,
        portDesc: portId != null ? (portById[portId]?.description || '') : '',
        status,
      }
    })
  }, [groups, groupAgg, portAssignments, portById, strategyByGroup, measureById])

  // Roulette gate: every team must have LOCKED the current round before drawing.
  const strategyList = Object.values(strategyByGroup)
  const allConfirmed = strategyList.length > 0 && strategyList.every(s => s.roundLocked)
  const pendingConfirm = strategyList.filter(s => !s.roundLocked).map(s => s.group)
  // Teams that have already spun the current round (can't be unlocked now).
  const drawnGroups = new Set(strategyList.filter(hasSpunCurrent).map(s => s.group))
  // The round the whole room is on (teams advance together).
  const currentRound = strategyList[0]?.currentRound ?? 1
  // Everyone has spun this round → the round is complete.
  const roundComplete = strategyList.length > 0 && strategyList.every(hasSpunCurrent)

  // The port image for the team on the roulette screen (from the port config).
  const portImageFor = (group) => {
    const pid = portAssignments.find(pa => pa.group === group)?.portId
    return pid != null ? (portById[pid]?.image || null) : null
  }
  const wheelPort = wheelTeam ? (portById[portAssignments.find(pa => pa.group === wheelTeam)?.portId] || null) : null
  const wheelImage = wheelPort?.image || null
  const wheelPortColour = wheelPort?.colour || null
  const wheelPortDesc = wheelPort?.description || ''

  // NOTE: these two effects MUST stay below the declarations of `allConfirmed`,
  // `groupStats` and `drawnGroups` — the dep array reads `allConfirmed` during
  // render, so declaring them earlier put it in the temporal dead zone and
  // crashed the whole control centre (ReferenceError on every render).

  // On entering the Roulette phase (all locked), auto-open the first team that
  // still needs to spin so the screen shows one team at a time.
  useEffect(() => {
    if (phase === 'wheel' && allConfirmed && !wheelTeam) {
      const first = groupStats.find(g => !drawnGroups.has(g.group))?.group || groupStats[0]?.group
      if (first) openWheel(first)
    }
  }, [phase, allConfirmed, currentRound]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load the debrief (expected results) when the facilitator enters that phase.
  useEffect(() => {
    if (phase === 'debrief') fetchDebrief()
  }, [phase, fetchDebrief])

  // ── Strategy / round helpers (v4) ───────────────────────────────────────────
  // The team currently being dictated to.
  const editingStrat = editingGroup ? strategyByGroup[editingGroup] : null
  const portfolio = editingStrat?.portfolio || []            // [{ id, name, cost }]
  const portIds = portfolio.map(m => m.id)
  const roundBought = editingStrat?.roundBought || []        // ids bought THIS round
  // The dictating team's deck: the measures that apply to its port, as full
  // measure objects (name, cost, protection, enabler flag), ordered by number.
  const dictatingPort = editingStrat ? portById[editingStrat.portId] : null
  const deckCards = useMemo(
    () => (dictatingPort?.deck || []).map(id => measureById.get(id)).filter(Boolean).sort((a, b) => a.id - b.id),
    [dictatingPort, measureById]
  )
  // Coin meter: squares = coins available this round (round-start + any return
  // refund taken this round); filled = spent so far; "left" = coins now. This
  // keeps "spent" non-negative even after a mid-round return adds coins back.
  const returnRefund = editingStrat?.roundReturned != null ? Math.floor((measureById.get(editingStrat.roundReturned)?.cost || 0) / 2) : 0
  const coinCapacity = editingStrat ? editingStrat.roundStartCoins + returnRefund : 0
  const coinsSpent = editingStrat ? coinCapacity - editingStrat.coins : 0
  // Does this team still need a starting level chosen by hand? Only when it has
  // no questionnaire answers (count 0) and none is set yet. Teams WITH answers
  // get their starting level from the PARI mean automatically on lock.
  const editingCount = groupStats.find(g => g.group === editingGroup)?.count ?? 0
  const needsStartingLevel = !!editingStrat && editingStrat.startingBand == null && editingCount === 0
  const canReturn = !!editingStrat && editingStrat.currentRound >= 2 && editingStrat.roundReturned == null && !editingStrat.roundLocked

  // Readback for the dictating team, from the cards it holds and their total
  // cost, e.g. "Team D: cards 13 and 24. Five coins. Correct?"
  const heldCost = portfolio.reduce((s, m) => s + (m.cost || 0), 0)
  const readback = editingStrat
    ? `${editingGroup}: ${portIds.length ? `card${portIds.length !== 1 ? 's' : ''} ${andList([...portIds].sort((a, b) => a - b))}` : 'no cards'}. ${COIN_WORDS[heldCost] ?? heldCost} coin${heldCost !== 1 ? 's' : ''}. Correct?`
    : ''

  // Start dictating a team.
  function openEditor(group) {
    setAddError('')
    setEditingGroup(group)
  }

  // Apply a strategy mutation (buy/return/lock/unlock/starting-level) and fold the
  // returned public state back in. Server is authoritative on coins/deck/rounds.
  async function strategyCall(method, path, body) {
    setBusy(true)
    setAddError('')
    try {
      const res = await api[method](`/api/par/${code}/strategy/${encodeURIComponent(editingGroup)}${path}`, body)
      if (res.data?.strategy) setStrategyByGroup(prev => ({ ...prev, [editingGroup]: res.data.strategy }))
      return true
    } catch (err) {
      setAddError(err.response?.data?.error || 'Something went wrong.')
      return false
    } finally {
      setBusy(false)
    }
  }

  // Tap a card: buy it (if affordable and not held), or deselect it (undo, FULL
  // refund) if it was bought THIS round. A card owned from an earlier round does
  // nothing on tap — it can only leave via Return.
  function onCardTap(m) {
    if (!editingStrat || editingStrat.roundLocked || busy) return
    const held = portIds.includes(m.id)
    const thisRound = roundBought.includes(m.id)
    if (!held) {
      if (m.cost <= editingStrat.coins) strategyCall('post', '/buy', { measureId: m.id })
    } else if (thisRound) {
      strategyCall('post', '/undo', { measureId: m.id })
    }
  }
  // Return an owned (previous-round) card — the game's half-refund return, one per
  // round. Confirms first.
  function onReturnCard(m) {
    if (busy) return
    const refund = Math.floor((m.cost || 0) / 2)
    if (!window.confirm(`Return ${m.name} (#${m.id}) for ${refund} coin${refund !== 1 ? 's' : ''}? This uses this round's one return.`)) return
    strategyCall('post', '/return', { measureId: m.id })
  }
  // Clear: undo every current-round purchase (full refund each).
  async function clearRound() {
    if (busy) return
    for (const id of [...roundBought]) {
      // eslint-disable-next-line no-await-in-loop
      await strategyCall('post', '/undo', { measureId: id })
    }
  }
  function setStartingLevel(band) { strategyCall('patch', '/starting-level', { band }) }

  // Lock the current round. Derives the starting level from PARI if unset; if the
  // team has no answers and none is chosen, the server 409s and we show it.
  async function lockRoundFor() {
    const locked = editingGroup
    const ok = await strategyCall('patch', '/lock')
    if (ok) {
      // Move straight to the next team that still needs to lock.
      const nextU = groupStats.find(g => !g.roundLocked && g.group !== locked)?.group
      setEditingGroup(nextU || null)
    }
  }
  // Unlock the current round. Server refuses if it has already spun.
  async function unlockRoundFor(group) {
    const prev = editingGroup
    setEditingGroup(group)
    setBusy(true)
    setAddError('')
    try {
      const res = await api.patch(`/api/par/${code}/strategy/${encodeURIComponent(group)}/unlock`)
      if (res.data?.strategy) setStrategyByGroup(p => ({ ...p, [group]: res.data.strategy }))
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not unlock this round.')
      setEditingGroup(prev)
    } finally {
      setBusy(false)
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

  // Build the outcome view-model from a stored round snapshot (for re-selecting a
  // team that already spun this round) using the composition's exposure slices.
  function outcomeFromEntry(entry, comp) {
    if (!entry) return null
    return {
      eventCode: entry.drawnEvent,
      eventName: (comp?.exposure || []).find(e => e.code === entry.drawnEvent)?.name || entry.drawnEvent,
      exposure:  comp?.exposure || [],
      entry,
    }
  }

  // Open a team's wheel: fetch its composition (exposure + portfolio), revealed
  // only once every team has locked round 1. If the team already spun this round,
  // rebuild its result from the stored round snapshot.
  async function openWheel(group) {
    setWheelTeam(group)
    setWheelComp(null)
    setWheelOutcome(null)
    setWheelRevealed(false)
    setWheelAnimate(false)
    // Preload the port image so it is ready before the spin — never pops in.
    const img = portImageFor(group)
    if (img) { const pre = new Image(); pre.src = img }
    try {
      const res = await api.get(`/api/par/${code}/strategy/${encodeURIComponent(group)}/wheel`)
      setWheelComp(res.data)
      if (res.data.drawnThisRound) {
        // Reshow a team that already spun this round: show the result already
        // landed and revealed — no animation.
        const strat = strategyByGroup[group]
        const entry = (strat?.rounds || []).find(r => r.round === res.data.currentRound)
        setWheelOutcome(outcomeFromEntry(entry, res.data))
        setWheelAnimate(false)
        setWheelRevealed(true)
      }
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not open the wheel.')
      setWheelTeam(null)
    }
  }

  // Spin: the backend draws the event for the current round (gated on all teams
  // locked) and returns the outcome. The result is RECEIVED now (drives the
  // wheel's target), but the highlight / result panel / score are withheld until
  // the wheel finishes spinning — onReveal (from EventWheel) flips wheelRevealed
  // and only then refreshes the team state (coins, queue result).
  async function spinWheel() {
    if (spinning || !wheelTeam || wheelOutcome) return
    ensureAudio() // start the audio context on the user gesture (if sound is on later)
    setSpinning(wheelTeam)
    setWheelRevealed(false)
    setWheelAnimate(true)
    try {
      const res = await api.post(`/api/par/${code}/strategy/${encodeURIComponent(wheelTeam)}/draw`)
      setWheelOutcome(res.data.outcome)
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not spin the wheel.')
      setWheelAnimate(false)
    } finally {
      setTimeout(() => setSpinning(null), 1200)
    }
  }

  // Fired by EventWheel when the spin animation ends: reveal the result and pull
  // the fresh team state (coins spent, queue result) at the same moment.
  function onWheelRevealed() {
    setWheelRevealed(true)
    fetchStrategies()
  }

  // Advance every team to the next round (+3 coins). Gated server-side on all
  // teams having spun the current round.
  async function nextRound() {
    if (advancing) return
    setAdvancing(true)
    try {
      await api.post(`/api/par/${code}/next-round`)
      await fetchStrategies()
      setWheelTeam(null); setWheelComp(null); setWheelOutcome(null); setWheelRevealed(false); setWheelAnimate(false)
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not advance to the next round.')
    } finally {
      setAdvancing(false)
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

  // ── Conductor: the single instruction + primary action for the current step ──
  // One source of truth, read by the bottom bar and the presentation clicker.
  const conductor = (() => {
    if (phase === 'join') {
      // Two always-actionable steps: activate (so phones can answer), then move
      // to Results. Never a dead disabled button with no way forward.
      const shuffle = { label: shuffling ? 'Shuffling…' : '↻ Shuffle ports', onClick: shufflePorts, disabled: shuffling }
      if (draft) return { text: 'Activate the session so phones can scan and answer.', primary: { label: starting ? 'Starting…' : 'Start questionnaire →', onClick: startSession, disabled: starting }, secondaries: [shuffle] }
      return {
        text: 'Ask everyone to scan the QR and answer.',
        primary: { label: 'Show results →', onClick: () => changePhase('par'), disabled: false },
        secondaries: [shuffle],
      }
    }
    if (phase === 'par') {
      return { text: 'Talk through the room’s culture level.', primary: { label: 'Show teams →', onClick: () => changePhase('teams'), disabled: false } }
    }
    if (phase === 'teams') {
      return { text: 'Each team: this is your port and your CAP Index.', primary: { label: 'Start strategy →', onClick: () => changePhase('strategy'), disabled: false } }
    }
    if (phase === 'strategy') {
      if (allConfirmed) return { text: 'Every team is locked.', primary: { label: 'Start the roulette →', onClick: () => changePhase('wheel'), disabled: false } }
      if (editingStrat && !editingStrat.roundLocked) {
        return {
          text: readback,
          primary: { label: busy ? 'Locking…' : `Lock ${editingGroup} →`, onClick: lockRoundFor, disabled: busy },
          secondaries: [
            { label: 'Clear', onClick: clearRound, disabled: busy || roundBought.length === 0 },
            { label: 'Close', onClick: () => { setEditingGroup(null); setAddError('') }, disabled: false },
          ],
        }
      }
      const nextU = groupStats.find(g => !g.roundLocked)?.group
      return { text: 'Pick a team and read its cards aloud.', primary: nextU ? { label: `Dictate ${nextU} →`, onClick: () => openEditor(nextU), disabled: false } : { label: 'Start the roulette →', onClick: () => changePhase('wheel'), disabled: false } }
    }
    if (phase === 'wheel') {
      if (!allConfirmed) {
        return { text: 'Lock every team before the roulette.', primary: { label: `Waiting: ${pendingConfirm.length} ${pendingConfirm.length === 1 ? 'team' : 'teams'} not locked`, onClick: () => {}, disabled: true } }
      }
      if (!wheelTeam || !wheelComp) {
        const first = groupStats.find(g => !drawnGroups.has(g.group))?.group || groupStats[0]?.group
        return { text: 'Open a team’s wheel.', primary: first ? { label: `Open ${first} →`, onClick: () => openWheel(first), disabled: false } : null }
      }
      if (!wheelRevealed) {
        const isSpinning = !!wheelOutcome || !!spinning
        return {
          text: isSpinning ? 'The wheel is spinning…' : `${wheelTeam}, read your port and your cards aloud. Then press Spin.`,
          primary: { label: isSpinning ? 'Spinning…' : 'Spin the wheel', onClick: spinWheel, disabled: isSpinning },
        }
      }
      const next = nextTeamToDraw()
      if (next) return { text: 'Read the result aloud: luck first, then strategy.', primary: { label: `Next: ${next} →`, onClick: () => openWheel(next), disabled: false } }
      if (currentRound < 3) return { text: 'Every team has spun this round.', primary: { label: advancing ? 'Advancing…' : `Start round ${currentRound + 1} · ${roundYear(currentRound + 1)} →`, onClick: () => setAdvanceDialog('round'), disabled: advancing } }
      return { text: 'All three rounds are done.', primary: { label: 'Go to Debrief →', onClick: () => setAdvanceDialog('debrief'), disabled: false } }
    }
    if (phase === 'debrief') {
      return { text: closed ? 'Session ended.' : 'Review luck vs strategy, then wrap up.', primary: closed ? null : { label: 'Close the session…', onClick: () => setEndDialogOpen(true), disabled: false } }
    }
    return { text: '', primary: null }
  })()

  // Presentation clicker: Right arrow / PageDown fire the primary action — but
  // never while typing in a field or while a dialog is open (so it can't confirm
  // a dialog). Refs keep the once-registered listener reading live values.
  const primaryRef = useRef(null)
  primaryRef.current = conductor.primary
  const dialogOpenRef = useRef(false)
  dialogOpenRef.current = !!(endDialogOpen || advanceDialog)
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'ArrowRight' && e.key !== 'PageDown') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (dialogOpenRef.current) return
      const p = primaryRef.current
      if (p && !p.disabled && typeof p.onClick === 'function') { e.preventDefault(); p.onClick() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="cc-screen" style={{ background: COLOR.paper, fontFamily: FONT.sans, color: COLOR.ink }}>

      {/* ═══ HEADER — title · phase tabs · code · End session ═══ */}
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '16px 24px', borderBottom: HAIRLINE }}>
        <h1 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h3, letterSpacing: LS.display, margin: 0, whiteSpace: 'nowrap' }}>
          Ports of the Future
        </h1>

        <nav style={{ display: 'flex', gap: 0, flex: '1 1 auto', flexWrap: 'wrap' }}>
          {PHASES.map((p, i) => {
            const active = phase === p.id
            const done = i < currentIndex
            const future = i > currentIndex
            return (
              <button key={p.id} onClick={future ? undefined : () => changePhase(p.id)} disabled={future}
                style={{
                  padding: '10px 16px', border: HAIRLINE, borderLeft: i === 0 ? HAIRLINE : 'none',
                  borderRadius: 0, cursor: future ? 'default' : 'pointer', whiteSpace: 'nowrap',
                  fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: active ? FW.bold : FW.medium,
                  letterSpacing: LS.tight,
                  background: active ? COLOR.harbour : COLOR.paper,
                  color: active ? COLOR.onHarbour : (future ? COLOR.ink40 : COLOR.ink),
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


      {/* ═══ END SESSION dialog ═══ */}
      {endDialogOpen && (
        <div onClick={() => setEndDialogOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(11,27,51,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: COLOR.paper, border: HAIRLINE, maxWidth: 440, width: '100%', padding: 28 }}>
            <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h3, letterSpacing: LS.tight, margin: '0 0 12px' }}>End this session?</h2>
            <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, lineHeight: 1.5, margin: '0 0 24px' }}>
              Participants will be notified and the results summary will be saved. Results stay visible here. This cannot be undone.
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

      {/* ═══ ADVANCE dialog — confirm round advance (+3 coins each) / debrief ═══ */}
      {advanceDialog && (
        <div onClick={() => setAdvanceDialog(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(11,27,51,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: COLOR.paper, border: HAIRLINE, maxWidth: 440, width: '100%', padding: 28 }}>
            {advanceDialog === 'round' ? (
              <>
                <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h3, letterSpacing: LS.tight, margin: '0 0 12px' }}>Start round {currentRound + 1} · {roundYear(currentRound + 1)}?</h2>
                <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, lineHeight: 1.5, margin: '0 0 24px' }}>
                  All {groupStats.length} teams get +3 coins and move to Strategy. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setAdvanceDialog(null)}
                    style={{ flex: 1, height: 48, border: HAIRLINE, borderRadius: 0, background: COLOR.paper, color: COLOR.ink, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button disabled={advancing}
                    onClick={async () => { await nextRound(); setAdvanceDialog(null); changePhase('strategy') }}
                    style={{ flex: 1, height: 48, border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: advancing ? 'default' : 'pointer', opacity: advancing ? 0.6 : 1 }}>
                    {advancing ? 'Advancing…' : `Start round ${currentRound + 1} · ${roundYear(currentRound + 1)}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h3, letterSpacing: LS.tight, margin: '0 0 12px' }}>End the game and go to Debrief?</h2>
                <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, lineHeight: 1.5, margin: '0 0 24px' }}>
                  The three rounds are over; the scores are final.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setAdvanceDialog(null)}
                    style={{ flex: 1, height: 48, border: HAIRLINE, borderRadius: 0, background: COLOR.paper, color: COLOR.ink, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => { setAdvanceDialog(null); changePhase('debrief') }}
                    style={{ flex: 1, height: 48, border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: 'pointer' }}>
                    Go to Debrief
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ BODY — fills the remaining height. The Results tab lays itself out
          to fit exactly (overflow hidden); the other tabs scroll internally so
          the page itself never scrolls. ═══ */}
      <div style={{
        flex: 1, minHeight: 0,
        ...(phase === 'par'
          ? { overflow: 'hidden' }
          : { overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '1rem' }),
      }}>

        {/* 1 · JOIN — phase: join. Big QR + code in a sky block, live counter,
            "Start questionnaire →". No team list. */}
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

          {/* Live counter + shuffle feedback (the actions live in the bottom bar). */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, borderTop: HAIRLINE, paddingTop: 20 }}>
            <div style={{ flex: '1 1 auto' }}>
              <span style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display }}>{joinedCount}</span>
              <span style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, marginLeft: 10 }}>
                {joinedCount === 1 ? 'person has joined' : 'people have joined'}
              </span>
            </div>
            {shuffleMsg && (
              <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, color: COLOR.ink60 }}>{shuffleMsg}</span>
            )}
          </div>
        </div>
        )}

        {/* 3 · TEAMS — phase: teams. One card per team: port + CAP Index. */}
        {phase === 'teams' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, groupStats.length))}, 1fr)`, gridAutoRows: '1fr', gap: 16 }}>
            {groupStats.map(g => {
              const bg = g.portColour || '#C5E4FF'
              const fg = textOnColour(bg)
              const mult = (CULTURE_FACTOR[g.cultureBand] ?? 1).toFixed(1)
              const joined = memberCounts[g.group] ?? g.count
              return (
                <div key={g.group} style={{ display: 'flex', flexDirection: 'column', border: HAIRLINE, minWidth: 0, minHeight: 0 }}>
                  <div style={{ background: bg, color: fg, padding: '14px 16px', flexShrink: 0 }}>
                    <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 'clamp(22px, 2vw, 32px)', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.portName || '—'}</div>
                    {g.portDesc && <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, marginTop: 4, opacity: 0.9 }}>{g.portDesc}</div>}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.bold }}>{g.group}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60, marginTop: 4 }}>CAP Index</div>
                    <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 'clamp(44px, 6vh, 80px)', lineHeight: 1 }}>
                      {g.avg != null ? g.avg : '—'}<span style={{ fontSize: '0.32em', fontWeight: FW.semibold, color: COLOR.ink60 }}> /100</span>
                    </div>
                    <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, marginTop: 4 }}>{BAND_RAMP[g.cultureBand]?.label || '—'} · scores ×{mult}{g.cultureRaised ? ' ★' : ''}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60, marginTop: 'auto' }}>{g.count} of {joined} answered</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* 2 · STRATEGY — phase: strategy. One team dictates at a time, round by
            round. Other teams' port / score / culture / cards stay hidden. */}
        {phase === 'strategy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Round banner */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: COLOR.ice, border: HAIRLINE, padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.tight }}>Round {currentRound} · {roundYear(currentRound)}</span>
              <span style={uiLabel}>{roundBudgets[currentRound - 1]}-coin budget{currentRound >= 2 ? ' · one return allowed' : ''}</span>
            </div>
            <span style={{ fontFamily: FONT.mono, fontSize: FS.body, fontWeight: FW.bold }}>
              {groupStats.filter(g => g.roundLocked).length} of {groupStats.length} locked this round
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 20, alignItems: 'start' }}>

            {/* LEFT: team list — coins + lock status */}
            <div style={{ border: HAIRLINE, padding: 20 }}>
              <p style={{ ...uiLabel, marginBottom: 8 }}>Teams</p>
              {groupStats.map(gs => {
                const dictating = editingGroup === gs.group
                return (
                  <div key={gs.group} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: HAIRLINE }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold }}>{gs.group}</div>
                      {gs.portName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ width: 10, height: 10, flexShrink: 0, background: gs.portColour || COLOR.ice, border: HAIRLINE }} />
                          <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gs.portName}</span>
                        </div>
                      )}
                      {gs.cultureBand && (
                        <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60, marginTop: 2 }}>
                          {BAND_RAMP[gs.cultureBand]?.label || gs.cultureBand} ×{(CULTURE_FACTOR[gs.cultureBand] ?? 1).toFixed(1)}{gs.cultureRaised ? ' ★' : ''}
                        </div>
                      )}
                    </div>
                    <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, color: COLOR.ink60 }}>🪙 {gs.coins ?? '—'}</span>
                    {gs.roundLocked ? (
                      <>
                        <span style={{ ...uiLabel, color: COLOR.onInk, background: COLOR.ink, border: HAIRLINE, padding: '4px 10px' }}>Locked ✓</span>
                        {!gs.spun && (
                          <button onClick={() => unlockRoundFor(gs.group)}
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
              {!editingStrat ? (
                <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>
                  Pick a team on the left to start dictating its cards.
                </p>
              ) : (
                <>
                  {/* Header: NOW DICTATING · team · port tag + coin meter */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                    <div>
                      <p style={uiLabel}>Now dictating</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                        <h2 style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display, margin: 0 }}>{editingGroup}</h2>
                        <span style={{ ...uiLabel, color: COLOR.onInk, background: COLOR.ink, border: HAIRLINE, padding: '4px 10px' }}>
                          {(dictatingPort?.name || editingStrat.portName || 'Port')} · {deckCards.length} cards
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: 6, maxWidth: 260 }}>
                        {Array.from({ length: coinCapacity }).map((_, i) => (
                          <div key={i} style={{ width: 16, height: 16, border: `2px solid ${COLOR.ink}`, background: i < coinsSpent ? COLOR.ink : COLOR.paper }} />
                        ))}
                      </div>
                      <p style={{ fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold, margin: 0 }}>
                        {coinsSpent} of {coinCapacity} coins spent · {editingStrat.coins} left
                      </p>
                    </div>
                  </div>

                  {/* Starting culture level — only for teams with no questionnaire */}
                  {needsStartingLevel && (
                    <div style={{ border: HAIRLINE, background: COLOR.ice, padding: '14px 16px', marginBottom: 20 }}>
                      <p style={{ ...uiLabel, marginBottom: 10 }}>No questionnaire answers · set the starting level</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {BAND_ORDER.map(b => (
                          <button key={b} onClick={() => setStartingLevel(b)} disabled={busy}
                            style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.semibold, border: HAIRLINE, borderRadius: 0, padding: '8px 12px', cursor: busy ? 'default' : 'pointer', background: COLOR.paper, color: COLOR.ink }}>
                            {BAND_RAMP[b]?.label || b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {addError && <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: '#c0392b', margin: '0 0 14px' }}>{addError}</p>}

                  {/* Card grid — one card per measure in this port's deck */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(176px, 1fr))', gap: 12 }}>
                    {deckCards.map(m => {
                      const held = portIds.includes(m.id)
                      const thisRound = roundBought.includes(m.id)
                      const selected = held && thisRound       // bought this round → tap to remove (undo)
                      const owned = held && !thisRound          // from an earlier round → Return only
                      const affordable = m.cost <= editingStrat.coins
                      const unaffordable = !held && !affordable
                      const locked = editingStrat.roundLocked
                      const dark = selected || owned
                      const tapDisabled = locked || busy || unaffordable || owned
                      const bg = unaffordable ? '#F3F5F8' : dark ? COLOR.ink : COLOR.paper
                      const fg = dark ? COLOR.onInk : (unaffordable ? '#5C6B7A' : COLOR.ink)
                      const border = unaffordable ? '2px dashed #5C6B7A' : `2px solid ${COLOR.ink}`
                      const line = owned ? 'Owned'
                        : selected ? '✓ Selected · tap to remove'
                          : unaffordable ? `${m.cost} coins · not enough left`
                            : `${m.cost} coin${m.cost !== 1 ? 's' : ''}`
                      return (
                        <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
                          <button type="button" aria-pressed={held} onClick={() => onCardTap(m)} disabled={tapDisabled}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', border, borderRadius: 0, background: bg, color: fg, padding: '12px 14px', minHeight: 148, cursor: tapDisabled ? 'default' : 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontFamily: FONT.mono, fontWeight: FW.bold, fontSize: FS.body }}>#{m.id}</span>
                              <span style={{ display: 'flex', gap: 3 }} title={`${m.cost} coins`}>
                                {Array.from({ length: m.cost }).map((_, i) => (
                                  <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: dark ? COLOR.onInk : COLOR.ink }} />
                                ))}
                              </span>
                            </div>
                            <span style={{ fontFamily: FONT.sans, fontWeight: FW.semibold, fontSize: FS.sm, lineHeight: 1.25 }}>{m.name}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto' }}>
                              {measureChips(m).map((c, i) => <Chip key={i} chip={c} dark={dark} />)}
                            </div>
                            <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: dark ? 'rgba(255,255,255,0.8)' : (unaffordable ? '#5C6B7A' : COLOR.ink60) }}>{line}</span>
                          </button>
                          {owned && canReturn && (
                            <button type="button" onClick={() => onReturnCard(m)} disabled={busy}
                              style={{ border: `2px solid ${COLOR.ink}`, borderTop: 'none', borderRadius: 0, background: COLOR.paper, color: COLOR.ink, fontFamily: FONT.sans, fontSize: FS.micro, fontWeight: FW.semibold, padding: '8px 10px', cursor: busy ? 'default' : 'pointer' }}>
                              Return for {Math.floor((m.cost || 0) / 2)} coin{Math.floor((m.cost || 0) / 2) !== 1 ? 's' : ''}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Effective culture level */}
                  <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink, background: COLOR.ice, border: HAIRLINE, padding: '10px 14px', margin: '20px 0 0' }}>
                    Culture level: <strong>{BAND_RAMP[editingStrat.cultureLevel]?.label || '—'}</strong>
                    {portfolio.some(m => measureById.get(m.id)?.raisesCultureLevel) ? ' — raised by an enabler (#19 / #20)' : ''}
                    {editingStrat.roundReturned != null ? ` · returned #${editingStrat.roundReturned} this round` : ''}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        )}

        {/* 4 · ROULETTE — phase: wheel. One screen, no scroll; one obvious action. */}
        {phase === 'wheel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
          {!allConfirmed ? (
            <div style={{ border: HAIRLINE, padding: '48px 28px', textAlign: 'center' }}>
              <p style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.tight, margin: '0 0 8px' }}>The roulette opens once every team has locked round {currentRound} · {roundYear(currentRound)}.</p>
              {pendingConfirm.length > 0 && <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>Waiting on: {pendingConfirm.join(', ')}.</p>}
            </div>
          ) : !wheelTeam || !wheelComp ? (
            <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>Select a team below to open its wheel.</p>
          ) : (
            <>
              {/* LEFT COLUMN (port header + cards) + RIGHT ZONE (wheel + result) */}
              <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
                {(() => {
                  const bandBg = wheelPortColour || '#C5E4FF'
                  const bandFg = textOnColour(bandBg)
                  const cultLabel = BAND_RAMP[wheelComp.cultureLevel]?.label
                  const cultMult = (CULTURE_FACTOR[wheelComp.cultureLevel] ?? 1).toFixed(1)
                  const wStrat = strategyByGroup[wheelTeam]
                  const returnRefundW = wStrat?.roundReturned != null ? Math.floor((measureById.get(wStrat.roundReturned)?.cost || 0) / 2) : 0
                  const coinCapW = wStrat ? wStrat.roundStartCoins + returnRefundW : 0
                  const coinsSpentW = wStrat ? coinCapW - wStrat.coins : 0
                  const ids = [...(wheelComp.portfolio || [])].sort((a, b) => a - b)
                  const wheelCodes = wheelComp.exposure.filter(e => e.weight > 0).map(e => e.code)
                  const drawnCode = wheelRevealed ? wheelOutcome?.eventCode : null
                  const twoCol = ids.length > 5

                  const renderCard = (id) => {
                    const m = measureById.get(id)
                    const prot = m?.protection || {}
                    const isEnabler = !!m?.raisesCultureLevel
                    const helped = !!drawnCode && (prot[drawnCode] || 0) > 0
                    const notThisTime = !!drawnCode && !helped && !isEnabler
                    const chips = wheelCodes.filter(c => (prot[c] || 0) > 0)
                    const status = drawnCode ? (helped ? 'HELPED' : isEnabler ? 'RAISED CULTURE' : 'NOT THIS TIME') : null
                    const nameCol = notThisTime ? '#5C6B7A' : COLOR.ink
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'stretch', gap: 10, minWidth: 0, background: notThisTime ? '#F3F5F8' : COLOR.paper, border: notThisTime ? '2px dashed #5C6B7A' : `2px solid ${COLOR.ink}` }}>
                        <div style={{ width: 52, minHeight: 52, flexShrink: 0, background: notThisTime ? '#5C6B7A' : COLOR.ink, color: COLOR.onInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontWeight: FW.bold, fontSize: FS.h3 }}>{id}</div>
                        <div style={{ flex: 1, minWidth: 0, padding: '7px 10px 7px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontFamily: FONT.sans, fontSize: 17, fontWeight: 700, color: nameCol, lineHeight: 1.15 }}>{m?.name || `Measure ${id}`}</span>
                            <span style={{ display: 'flex', gap: 2, flexShrink: 0, marginTop: 3 }}>
                              {Array.from({ length: m?.cost || 0 }).map((_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#E3BF40' }} />)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                            {isEnabler ? (
                              <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: FW.bold, border: `1px solid ${COLOR.ink}`, padding: '1px 5px' }}>★ +1 culture level</span>
                            ) : chips.map(c => {
                              const inv = !!drawnCode && c === drawnCode
                              return (
                                <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${COLOR.ink}`, padding: '1px 5px', background: inv ? COLOR.ink : 'transparent', color: inv ? COLOR.onInk : COLOR.ink, fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: FW.bold }}>
                                  <span style={{ width: 8, height: 8, flexShrink: 0, background: EVENT_HEX[c] || COLOR.ice, border: `1px solid ${inv ? 'rgba(255,255,255,0.5)' : COLOR.ink}` }} />
                                  {c} {prot[c]}
                                </span>
                              )
                            })}
                            {status && <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: FW.bold, letterSpacing: LS.mono, color: notThisTime ? '#5C6B7A' : COLOR.ink }}>{status}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div style={{ flex: '0 0 clamp(480px, 42%, 600px)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
                      {/* a) port header row */}
                      <div style={{ display: 'flex', height: 150, flexShrink: 0, border: `2px solid ${COLOR.ink}`, overflow: 'hidden' }}>
                        {wheelImage && <img src={wheelImage} alt={`Illustration of the port of ${wheelComp.portName || wheelTeam}`} style={{ flex: '0 0 42%', minWidth: 0, objectFit: 'cover', display: 'block' }} />}
                        <div style={{ flex: 1, minWidth: 0, background: bandBg, color: bandFg, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                          <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', opacity: 0.85 }}>Now spinning · {wheelTeam}</div>
                          <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 'clamp(32px, 2.6vw, 48px)', lineHeight: 0.95, letterSpacing: LS.display, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wheelComp.portName}</div>
                          {wheelPortDesc && <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, opacity: 0.9 }}>{wheelPortDesc}</div>}
                          <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', marginTop: 2 }}>{cultLabel || '—'} · scores ×{cultMult}</div>
                        </div>
                      </div>
                      {/* b) heading */}
                      <div style={{ fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold, letterSpacing: LS.mono, textTransform: 'uppercase', flexShrink: 0 }}>
                        {drawnCode ? `Which cards helped against ${wheelOutcome.eventName || drawnCode}` : `${wheelTeam}'s cards · ${coinsSpentW} of ${coinCapW} coins`}
                      </div>
                      {/* c + d) cards */}
                      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: twoCol ? '1fr 1fr' : '1fr', gap: 8, alignContent: 'start' }}>
                        {ids.length === 0
                          ? <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>No cards.</p>
                          : ids.map(renderCard)}
                      </div>
                    </div>
                  )
                })()}

                {/* RIGHT ZONE · wheel, large and centred (+ result when revealed) */}
                <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', gap: 28, alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={() => setSoundOn(v => !v)}
                    style={{ position: 'absolute', top: 0, right: 0, zIndex: 1, fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60, background: COLOR.paper, border: HAIRLINE, borderRadius: 0, padding: '4px 8px', cursor: 'pointer' }}>
                    {soundOn ? '🔊 Sound on' : '🔇 Sound off'}
                  </button>
                  <div style={{ flexShrink: 0, width: wheelRevealed ? 'min(400px, 46vh)' : 'min(560px, 62vh)', maxWidth: '100%' }}>
                    <EventWheel slices={wheelComp.exposure} resultCode={wheelOutcome?.eventCode} animate={wheelAnimate} onReveal={onWheelRevealed} portColour={wheelPortColour || '#C5E4FF'} onPeg={playTick} size={560} />
                  </div>
                  {wheelRevealed && (() => {
                    const e = wheelOutcome.entry || {}
                    const code = wheelOutcome.eventCode
                    const sqBg = EVENT_HEX[code] || COLOR.ice
                    const sqFg = textOnColour(EVENT_HEX[code] || '#C5E4FF')
                    const bigNum = { fontFamily: FONT.sans, fontWeight: 800, fontSize: 'clamp(38px, 6vh, 60px)', lineHeight: 1 }
                    const sideLine = { fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold, lineHeight: 1.5, textAlign: 'right', whiteSpace: 'nowrap' }
                    return (
                      <div style={{ flex: 1, minWidth: 0, maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 64, height: 64, flexShrink: 0, border: HAIRLINE, background: sqBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <HazardIcon code={code} color={sqFg} size={38} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={uiLabel}>The wheel drew</p>
                            <div style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: 'clamp(28px, 4vw, 52px)', letterSpacing: LS.tight, lineHeight: 1 }}>{wheelOutcome.eventName || code}</div>
                          </div>
                        </div>
                        <div style={{ border: HAIRLINE, background: COLOR.paper, color: COLOR.ink, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                          <div>
                            <p style={uiLabel}>Luck · this spin</p>
                            <div style={bigNum}>{Math.round(e.lossesAvoidedPct ?? 0)}%</div>
                            <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: 0 }}>of losses avoided</p>
                          </div>
                          <p style={sideLine}>Damage: {e.damageBill != null ? e.damageBill.toFixed(1) : '—'} coins (instead of {e.impact ?? '—'})</p>
                        </div>
                        <div style={{ border: HAIRLINE, background: COLOR.harbour, color: COLOR.onHarbour, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                          <div>
                            <p style={{ ...uiLabel, color: COLOR.onHarbour }}>Strategy · your plan</p>
                            <div style={bigNum}>{e.strategyScore ?? '—'}%</div>
                            <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, margin: 0, opacity: 0.85 }}>strategy score</p>
                          </div>
                          <p style={sideLine}>Expected protection {Math.round(e.expectedProtection ?? 0)}%<br />Coins on useful cards {e.coinsThatHelped ?? 0} of {e.heldCost ?? 0}</p>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* ZONE 3 · bottom strip */}
              <div style={{ flexShrink: 0, borderTop: HAIRLINE, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minHeight: 56 }}>
                <span style={{ ...uiLabel, whiteSpace: 'nowrap' }}>Round {currentRound} · {roundYear(currentRound)} · {drawnGroups.size} of {groupStats.length} spun</span>
                <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {groupStats.map(g => {
                    const strat = strategyByGroup[g.group]
                    const entry = (strat?.rounds || []).find(r => r.round === g.currentRound)
                    const isNow = g.group === wheelTeam
                    const done = drawnGroups.has(g.group)
                    return (
                      <button key={g.group} onClick={() => openWheel(g.group)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, border: HAIRLINE, borderRadius: 0, background: isNow ? COLOR.ink : COLOR.paper, color: isNow ? COLOR.onInk : COLOR.ink, padding: '8px 10px', cursor: 'pointer' }}>
                        <span style={{ width: 14, height: 14, flexShrink: 0, background: g.portColour || COLOR.ice, border: `1px solid ${isNow ? COLOR.onInk : COLOR.ink}` }} />
                        <span style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.bold }}>{g.group}</span>
                        {done && entry?.drawnEvent ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <HazardIcon code={entry.drawnEvent} color={isNow ? COLOR.onInk : COLOR.ink} size={14} />
                            <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, fontWeight: FW.bold }}>{Math.round(entry.lossesAvoidedPct ?? 0)}%</span>
                          </span>
                        ) : (
                          <span style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: isNow ? COLOR.onInk : '#5C6B7A' }}>{isNow ? 'now' : 'Waiting'}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        )}

        {/* 5 · DEBRIEF — phase: debrief. Luck vs strategy over three rounds. */}
        {phase === 'debrief' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {(() => {
            const teams = debrief?.teams || []
            if (teams.length === 0) {
              return <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, margin: 0 }}>No debrief data yet. Play all three rounds first.</p>
            }
            const rint = v => Math.round(v || 0)
            // Facts across the room (all teams, all rounds).
            const scored = teams.filter(t => (t.rounds || []).length > 0)
            const roomAvgScore = scored.length ? Math.round(scored.reduce((s, t) => s + (t.finalScore || 0), 0) / scored.length) : 0
            let bestPlan = null
            for (const t of teams) if (!bestPlan || (t.finalScore || 0) > (bestPlan.finalScore || 0)) bestPlan = t
            let hardest = null
            for (const t of teams) if (!hardest || (t.totalDamage || 0) > (hardest.totalDamage || 0)) hardest = t
            const coinsNoHelp = teams.reduce((s, t) =>
              s + (t.rounds || []).reduce((rs, r) => rs + Math.max(0, (r.heldCost || 0) - (r.coinsThatHelped || 0)), 0), 0)

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
                    Each round's <strong style={{ color: COLOR.harbour }}>bar</strong> is losses avoided when the wheel hit; the <strong>▏marker</strong> is the plan's expected protection. Past the marker = lucky, short of it = unlucky.
                    The <strong>final score</strong> is the average of the three strategy scores (skill); <strong>total damage</strong> is the luck.
                  </p>
                </div>

                {/* One row per team, sorted by final strategy score (backend rank) */}
                <div style={{ border: HAIRLINE }}>
                  {teams.map(t => (
                    <div key={t.group} style={{ display: 'flex', alignItems: 'stretch', gap: 18, padding: '16px 18px', borderTop: HAIRLINE }}>
                      {t.illustrationMotifs?.length > 0 && (
                        <PortIllustration motifs={t.illustrationMotifs} size={96} style={{ flexShrink: 0, alignSelf: 'center' }} />
                      )}
                      <div style={{ flex: '0 0 170px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60 }}>#{t.rank ?? '—'}</div>
                        <div style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.bold }}>{t.group}</div>
                        <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60 }}>{t.portName || '—'}</div>
                      </div>

                      {/* Three round bars */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                        {(t.rounds || []).map(r => {
                          const res = rint(r.lossesAvoidedPct), exp = rint(r.expectedProtection)
                          const diff = res - exp
                          const luck = Math.abs(diff) <= 5 ? '≈ as expected' : diff > 0 ? `▲ ${diff} lucky` : `▼ ${-diff} unlucky`
                          return (
                            <div key={r.round} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ flex: '0 0 148px', fontFamily: FONT.sans, fontSize: FS.sm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ fontFamily: FONT.mono, fontWeight: FW.bold, marginRight: 6 }}>R{r.round}</span>{r.eventName || r.drawnEvent}
                              </span>
                              <div style={{ flex: 1, position: 'relative', height: 18, background: COLOR.ice, border: HAIRLINE }}>
                                <div style={{ position: 'absolute', inset: '0 auto 0 0', height: '100%', width: `${res}%`, background: COLOR.harbour }} />
                                <div title={`Expected ${exp}%`} style={{ position: 'absolute', top: -2, bottom: -2, left: `${exp}%`, width: 2, background: COLOR.ink }} />
                              </div>
                              <span style={{ flex: '0 0 44px', textAlign: 'right', fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold }}>{res}%</span>
                              <span style={{ flex: '0 0 96px', fontFamily: FONT.sans, fontSize: FS.micro, fontWeight: FW.semibold, color: COLOR.ink60 }}>{luck}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Final score + total damage */}
                      <div style={{ flex: '0 0 150px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display, lineHeight: 1 }}>{rint(t.finalScore)}</div>
                        <div style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.semibold }}>final score</div>
                        <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, color: COLOR.ink60, marginTop: 4 }}>Total damage {t.totalDamage ?? 0}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Four facts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {fact('Average strategy score', `${roomAvgScore}`, 'across the room')}
                  {fact('Best plan', bestPlan?.group || '—', bestPlan ? `final score ${rint(bestPlan.finalScore)}` : '')}
                  {fact('Hardest luck', hardest?.group || '—', hardest ? `total damage ${hardest.totalDamage ?? 0}` : '')}
                  {fact("Coins that didn't help", coinsNoHelp, 'across all three rounds')}
                </div>
              </>
            )
          })()}
        </div>
        )}

        {/* 3 · RESULTADOS PARI (agregado) — phase: par / debrief */}
        {/* 2 · RESULTS — phase: par. One projected screen, no scroll. */}
        {phase === 'par' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Filter row — six combinable filters, no minimum-group suppression */}
          <div style={{ flexShrink: 0, minHeight: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 24px', borderBottom: HAIRLINE, flexWrap: 'wrap' }}>
            <span style={uiLabel}>Filter</span>
            <FilterSelect value={filters.portSize}       onChange={v => setFilters(f => ({ ...f, portSize: v }))}       placeholder="All sizes"      options={demoOptions.portSize.map(o => ({ value: o.optionId, label: o.label }))} />
            <FilterSelect value={filters.governance}     onChange={v => setFilters(f => ({ ...f, governance: v }))}     placeholder="All governance" options={demoOptions.governance.map(o => ({ value: o.optionId, label: o.label }))} />
            <FilterSelect value={filters.climateZone}    onChange={v => setFilters(f => ({ ...f, climateZone: v }))}    placeholder="All climates"   options={demoOptions.climateZone.map(o => ({ value: o.optionId, label: o.label }))} />
            <FilterSelect value={filters.coastalSetting} onChange={v => setFilters(f => ({ ...f, coastalSetting: v }))} placeholder="All coasts"     options={demoOptions.coastalSetting.map(o => ({ value: o.optionId, label: o.label }))} />
            <FilterSelect value={filters.team}           onChange={v => setFilters(f => ({ ...f, team: v }))}           placeholder="All teams"      options={groups.map(g => ({ value: g, label: g }))} />
            <FilterSelect value={filters.band}           onChange={v => setFilters(f => ({ ...f, band: v }))}           placeholder="All bands"      options={BAND_ORDER.map(b => ({ value: b, label: BAND_RAMP[b].label }))} />
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Join QR + code stay on Results so late arrivals can still join. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, borderRight: HAIRLINE }}>
                <div style={{ border: HAIRLINE, padding: 3, lineHeight: 0 }}>
                  <QRCodeSVG value={joinUrl} size={44} fgColor="#0B1B33" bgColor="#FFFFFF" />
                </div>
                <div>
                  <div style={{ fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60 }}>Join</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: FS.body, fontWeight: FW.bold, letterSpacing: '0.08em' }}>{code}</div>
                </div>
              </div>
              {anyFilter ? (
                <>
                  <span style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold }}>Showing {shownCount} of {totalAnswers} answers</span>
                  <button onClick={() => setFilters({ portSize: '', governance: '', climateZone: '', coastalSetting: '', team: '', band: '' })}
                    style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.semibold, color: COLOR.ink, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Clear filters
                  </button>
                </>
              ) : (
                <span style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, color: COLOR.ink60 }}>{totalAnswers} of {answeredDenom} answered</span>
              )}
            </div>
          </div>

          {/* Main area — two equal columns, fills remaining height */}
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '16px 24px 40px' }}>

            {/* LEFT column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

              {/* Room average box */}
              <div style={{ flexShrink: 0, background: COLOR.sky, color: COLOR.ink, border: HAIRLINE, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                <div>
                  <p style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink, margin: 0 }}>Room average</p>
                  {hasData ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 128, letterSpacing: '-0.07em', lineHeight: 0.85 }}>{fAverage}</span>
                      <span style={{ fontSize: 28, fontWeight: 600 }}>/100</span>
                    </div>
                  ) : (
                    <p style={{ fontFamily: FONT.sans, fontSize: 28, fontWeight: 600, margin: '10px 0 0' }}>Waiting for the first answer…</p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>Lowest {hasData ? fMin : '—'} · Highest {hasData ? fMax : '—'}</div>
                  {hasData && sizeSummary.length > 0 && (
                    <div style={{ fontSize: 18, fontWeight: 500, marginTop: 6 }}>
                      {sizeSummary.map(ps => `${ps.label} ${ps.avg} (${ps.count})`).join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Average by area */}
              <div style={{ flex: 1, minHeight: 0, border: HAIRLINE, padding: '12px 18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flexShrink: 0, marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink }}>Average by area (out of 20)</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  {areaMeans.map(a => {
                    const weak = weakestIds.has(a.id), strong = strongestIds.has(a.id)
                    return (
                      <div key={a.id} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 22, fontWeight: (weak || strong) ? 800 : 500 }}>{a.label}</span>
                            {weak && <span style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 700, color: COLOR.ink, background: COLOR.paper, border: HAIRLINE, padding: '3px 8px' }}>▼ Weakest</span>}
                            {strong && <span style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 700, color: COLOR.onInk, background: COLOR.ink, border: HAIRLINE, padding: '3px 8px' }}>▲ Strongest</span>}
                          </span>
                          <span style={{ fontFamily: FONT.mono, fontSize: 20, fontWeight: 700 }}>{a.value}/20</span>
                        </div>
                        <div style={{ height: 22, background: COLOR.paper, border: HAIRLINE, position: 'relative' }}>
                          <div style={{ position: 'absolute', inset: '0 auto 0 0', height: '100%', width: `${(a.value / 20) * 100}%`, background: AREA_COLOR[a.id], borderRight: a.value > 0 ? HAIRLINE : 'none' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>

              {/* Distribution of individual scores — takes the rest of the height */}
              <div style={{ flex: 7, minHeight: 0, border: HAIRLINE, padding: '12px 18px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 13, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink }}>Distribution of individual scores</span>
                  <span style={{ fontSize: 15, color: COLOR.ink60 }}>People per score range</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: 6 }}>
                  {histBins.map(b => (
                    <div key={b.label} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <span style={{ fontFamily: FONT.mono, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{b.count}</span>
                        <div style={{ width: '72%', height: `${(b.count / histMax) * 82}%`, background: COLOR.harbour, border: b.count > 0 ? HAIRLINE : 'none' }} />
                      </div>
                      <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.ink60, marginTop: 6 }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Band distribution — four equal cells, always; ~30% of the column */}
              <div style={{ flex: 3, minHeight: 0, display: 'flex', border: HAIRLINE }}>
                {bandCounts.map((b, i) => {
                  const ramp = BAND_RAMP[b.band]
                  const pct = hasData ? Math.round((b.count / shownCount) * 100) : null
                  return (
                    <div key={b.band} style={{ flex: 1, minWidth: 0, background: ramp.bg, color: ramp.text, borderLeft: i === 0 ? 'none' : HAIRLINE, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '12px 14px' }}>
                      <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }}>{b.count}</div>
                      <div style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{ramp.label}</div>
                      <div style={{ fontFamily: FONT.mono, fontSize: 18 }}>{pct == null ? '—' : `${pct}%`}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        )}

      </div>

      {/* ═══ CONDUCTOR bar — one instruction + one primary action, always here ═══ */}
      <div style={{ flexShrink: 0, minHeight: 72, background: COLOR.ink, color: COLOR.onInk, borderTop: HAIRLINE, display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}>Now</span>
          <span style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.medium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conductor.text}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {(conductor.secondaries || []).map((s, i) => (
            <button key={i} onClick={s.onClick} disabled={s.disabled}
              style={{ height: 44, padding: '0 16px', border: `1px solid ${COLOR.onInk}`, borderRadius: 0, background: 'transparent', color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: s.disabled ? 'default' : 'pointer', opacity: s.disabled ? 0.45 : 1 }}>
              {s.label}
            </button>
          ))}
          {conductor.primary && (
            <button onClick={conductor.primary.onClick} disabled={conductor.primary.disabled}
              style={{ height: 50, padding: '0 28px', border: 'none', borderRadius: 0, background: conductor.primary.disabled ? 'rgba(255,255,255,0.22)' : COLOR.paper, color: conductor.primary.disabled ? 'rgba(255,255,255,0.75)' : COLOR.ink, fontFamily: FONT.sans, fontSize: FS.h3, fontWeight: FW.bold, letterSpacing: LS.tight, whiteSpace: 'nowrap', cursor: conductor.primary.disabled ? 'default' : 'pointer' }}>
              {conductor.primary.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
