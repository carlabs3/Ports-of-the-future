import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../utils/api.js'
import { socket } from '../../utils/socket.js'
import { ACTIONS, AREA_ICON_URL, AREA_LABEL } from '../../utils/actions.js'
import {
  DistributionView, GroupsView,
  computeGroups,
} from '../../components/RankingViews.jsx'
import { fmtTons } from '../../utils/format.js'

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

export default function Step2Rankings() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [view, setView]                             = useState('individual')
  const [ranking, setRanking]                       = useState([])
  const [groups, setGroups]                         = useState([])
  const [totalJoined, setTotalJoined]               = useState(0)
  const [calculatorStarted, setCalculatorStarted]   = useState(true)
  const [showRanking, setShowRanking]               = useState(false)
  const [revealed, setRevealed]                     = useState(false)

  // Step 3 state
  const [activeStep, setActiveStep]                 = useState(2)
  const [step3Started, setStep3Started]             = useState(false)
  const [teamConfirmations, setTeamConfirmations]   = useState({})
  const [step3Revealed, setStep3Revealed]           = useState(false)
  const [winnersRevealed, setWinnersRevealed]       = useState(false)
  const [step3Data, setStep3Data]                   = useState(null)
  const [sessionGroups, setSessionGroups]           = useState([])
  const [activeTeamTab,  setActiveTeamTab]          = useState('Equipo A')
  const [teamSelections, setTeamSelections]         = useState({})
  const [filter3Area,    setFilter3Area]            = useState('transport')
  const [sessionStatus,  setSessionStatus]           = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed]      = useState(false)

  const joinUrl = `${window.location.origin}/?code=${code}`

  async function fetchStep3Data() {
    try {
      const res = await api.get(`/api/sessions/${code}/step3`)
      setStep3Data(res.data)
      setSessionGroups(res.data.teams.map(t => t.group))
    } catch {}
  }

  useEffect(() => {
    api.get(`/api/results/${code}/ranking`)
      .then(res => {
        const items = res.data.map(r => ({
          name: 'Anónimo',
          group: r.group,
          tons: r.carbonTons,
          category: r.category,
          areas: r.areas || {},
          answers: r.answers || {},
        }))
        setRanking(items)
        setGroups(computeGroups(items))
        setTotalJoined(prev => Math.max(prev, items.length))
        if (items.length > 0) { setShowRanking(true); setRevealed(true) }
      })
      .catch(() => {})

    api.get(`/api/sessions/${code}`)
      .then(res => {
        const s = res.data
        setSessionStatus(s.status)
        setSessionGroups(s.groups || [])
        if (s.resultsRevealed || s.status === 'closed') { setRevealed(true); setShowRanking(true) }
        if (s.step3Revealed)   setStep3Revealed(true)
        if (s.winnersRevealed) setWinnersRevealed(true)
        if (s.currentStep >= 3) { setStep3Started(true); setActiveStep(3) }
      })
      .catch(() => {})

    fetchStep3Data()
  }, [code])

  useEffect(() => {
    // Ensure socket is connected and join the session room
    const joinRoom = () => socket.emit('facilitator:join', { code })
    if (!socket.connected) socket.connect()
    joinRoom()

    // Re-join after reconnect so the room membership survives network drops
    socket.on('connect', joinRoom)

    socket.on('participant:joined', ({ total, count }) => setTotalJoined(total ?? count ?? 0))
    socket.on('ranking:update', ({ individual }) => {
      if (individual) {
        const sorted = [...individual].sort((a, b) => a.tons - b.tons)
        setRanking(sorted)
        setGroups(computeGroups(sorted))
        setShowRanking(true)
        setRevealed(true)
      }
    })
    socket.on('team:confirmed', ({ group, confirmed, confirmedFinal }) => {
      setTeamConfirmations(prev => ({ ...prev, [group]: { confirmed, confirmedFinal } }))
    })
    socket.on('step3:revealed', () => { setStep3Revealed(true); fetchStep3Data() })
    socket.on('winners:revealed', () => setWinnersRevealed(true))

    return () => {
      socket.off('connect', joinRoom)
      socket.off('participant:joined')
      socket.off('ranking:update')
      socket.off('team:confirmed')
      socket.off('step3:revealed')
      socket.off('winners:revealed')
    }
  }, [code])

  async function handleReveal() {
    if (!window.confirm(`¿Revelar los resultados a los ${ranking.length} participantes?`)) return
    setRevealed(true)
    setShowRanking(true)
    socket.emit('results:reveal', { sessionCode: code })
    try { await api.patch(`/api/sessions/${code}/reveal`) } catch {}
  }

  async function handleClose() {
    const choice = window.confirm(
      '¿Qué quieres hacer con esta sesión?\n\nPulsa ACEPTAR para CERRAR la sesión (los participantes verán la pantalla de fin).\n\nPulsa CANCELAR para dejarla activa y retomarla más tarde.'
    )
    if (!choice) return
    try { await api.patch(`/api/sessions/${code}/close`) } catch {}
    navigate('/dashboard')
  }

  async function handleActivate() {
    try {
      await api.patch(`/api/sessions/${code}/activate`)
      setSessionStatus('active')
    } catch {}
  }

  async function handleStartStep3() {
    setStep3Started(true)
    setActiveStep(3)
    socket.emit('step:change', { sessionCode: code, step: 3 })
    try { await api.patch(`/api/sessions/${code}/step`, { step: 3 }) } catch {}
  }

  async function handleRevealStep3() {
    socket.emit('step3:reveal', { sessionCode: code })
  }

  async function handleRevealWinners() {
    socket.emit('winners:reveal', { sessionCode: code })
  }

  const completed   = ranking.length
  const total       = Math.max(totalJoined, completed)
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0
  const isClosed    = sessionStatus === 'closed'

  const confirmedCount      = sessionGroups.filter(g => teamConfirmations[g]?.confirmed).length
  const confirmedFinalCount = sessionGroups.filter(g => teamConfirmations[g]?.confirmedFinal).length
  const allConfirmed        = sessionGroups.length > 0 && sessionGroups.every(g => teamConfirmations[g]?.confirmed)
  const allConfirmedFinal   = sessionGroups.length > 0 && confirmedFinalCount === sessionGroups.length

  const groupAvgTons = sessionGroups.reduce((acc, g) => {
    const members = ranking.filter(r => r.group === g)
    if (members.length > 0) acc[g] = members.reduce((s, r) => s + r.tons, 0) / members.length
    return acc
  }, {})

  // ── Draft ─────────────────────────────────────────────────────────────────────
  if (sessionStatus === 'draft') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 52px)', background: '#f5f5f5', gap: '1.5rem', padding: '2.5rem 2rem', textAlign: 'center' }}>
      <div style={{ padding: '16px', background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '16px' }}>
        <QRCodeSVG value={joinUrl} size={180} fgColor="#000000" bgColor="#ffffff" level="M" />
      </div>
      <div style={{ fontWeight: 900, fontSize: 'clamp(2rem, 6vw, 3.5rem)', letterSpacing: '0.1em', color: '#0a0a0a', lineHeight: 1 }}>{code}</div>
      <p style={{ fontSize: '0.9rem', color: '#999', maxWidth: 360, lineHeight: 1.65 }}>
        La sesión está en borrador. Actívala para que los participantes puedan entrar.
      </p>
      <button onClick={handleActivate} style={{ background: '#0a0a0a', color: '#fff', border: 'none', padding: '0.9rem 2.5rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '999px', cursor: 'pointer' }}>
        Activar sesión →
      </button>
    </div>
  )

  // ── Step 3 panel (inside revealed view) ──────────────────────────────────────
  function handleToggleAction(group, actionId) {
    setTeamSelections(prev => {
      const current = prev[group] || []
      return {
        ...prev,
        [group]: current.includes(actionId)
          ? current.filter(id => id !== actionId)
          : [...current, actionId]
      }
    })
  }

  async function handleConfirmTeam(group) {
    const actions = teamSelections[group] || []
    const totalReduction = actions.reduce((sum, id) => {
      const action = ACTIONS.find(a => a.id === id)
      return sum + (action?.co2Reduction || 0)
    }, 0)
    const originalAvg = groupAvgTons[group] || 0
    const newCarbonTons = Math.max(0, originalAvg - totalReduction / 1000)

    console.log('[handleConfirmTeam]', { group, originalAvg, totalReduction, newCarbonTons })

    socket.emit('team:confirmActions', {
      sessionCode: code,
      group,
      actions,
      totalReduction,
      newCarbonTons,
    })
    try {
      await api.post(`/api/sessions/${code}/team-actions`, {
        group, actions, totalReduction, newCarbonTons
      })
    } catch {}

    setTeamConfirmations(prev => ({
      ...prev,
      [group]: { confirmed: true, actions, totalReduction, newCarbonTons }
    }))
  }

  const step3Panel = (() => {
    if (!step3Data && !step3Started) return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', color: '#aaa' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
          <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Espera a que terminen la calculadora
          </div>
        </div>
      </div>
    )

    if (!step3Revealed && step3Data) {
      return (
        <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto', background: '#f5f5f5' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontWeight: 900, fontSize: '1.4rem', color: '#0a0a0a' }}>Fase de acciones</h1>
            <span style={{ fontSize: '0.75rem', color: '#666', background: '#fff', padding: '0.3rem 0.85rem', borderRadius: 999, border: '1px solid #e5e5e5' }}>
              {confirmedCount}/{sessionGroups.length} equipos confirmados
            </span>
          </div>

          {/* Team tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {sessionGroups.map(g => {
              const isActive = activeTeamTab === g
              const isConf = teamConfirmations[g]?.confirmed
              return (
                <button key={g} onClick={() => setActiveTeamTab(g)} style={{
                  padding: '0.4rem 1rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                  background: isActive ? '#0a0a0a' : '#ffffff',
                  color: isActive ? '#fff' : (isConf ? '#16a34a' : '#666'),
                  border: `1px solid ${isActive ? '#0a0a0a' : (isConf ? '#bbf7d0' : '#e5e5e5')}`,
                  cursor: 'pointer',
                }}>
                  {isConf ? '✓ ' : ''}{g}
                </button>
              )
            })}
          </div>

          {/* Two-column layout */}
          {activeTeamTab && (() => {
            const group = activeTeamTab
            const conf = teamConfirmations[group]
            const selected = teamSelections[group] || []
            const originalAvg = groupAvgTons[group]

            const groupMembers = ranking.filter(r => r.group === group)
            const areaAvg = {}
            ;['transport','energy','food','consumption','waste','publicServices'].forEach(area => {
              areaAvg[area] = area === 'publicServices'
                ? 1.5
                : groupMembers.length
                  ? groupMembers.reduce((s, r) => s + (r.areas?.[area] || 0), 0) / groupMembers.length
                  : 0
            })
            const areaTotal = Object.values(areaAvg).reduce((s, v) => s + v, 0)
            const AREA_COLORS_LOCAL = { transport: '#38bdf8', energy: '#f59e0b', food: '#4ade80', consumption: '#a855f7', waste: '#f472b6', publicServices: '#94a3b8' }
            const AREA_LABELS_LOCAL = { transport: 'Transp.', energy: 'Vivienda', food: 'Alim.', consumption: 'Compras', waste: 'Digital', publicServices: 'Serv. púb.' }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>

                {/* LEFT COLUMN — huella + acciones seleccionadas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                  {/* Huella actual card */}
                  <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 16, padding: '1rem 1.25rem' }}>
                    <p style={{ fontSize: '0.68rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.5rem' }}>Huella actual del equipo</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 900, fontSize: '2rem', color: '#0a0a0a', lineHeight: 1 }}>
                        {originalAvg != null ? `${fmtTons(originalAvg)} t` : '–'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#aaa' }}>CO₂/año · media</span>
                    </div>
                    {areaTotal > 0 && (
                      <>
                        <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: '0.6rem' }}>
                          {['transport','energy','food','consumption','waste','publicServices'].map(area => {
                            const pct = areaTotal > 0 ? (areaAvg[area] / areaTotal) * 100 : 0
                            if (pct < 0.5) return null
                            return <div key={area} style={{ width: `${pct}%`, background: AREA_COLORS_LOCAL[area] }} />
                          })}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
                          {['transport','energy','food','consumption','waste','publicServices'].map(area => {
                            const pct = areaTotal > 0 ? Math.round((areaAvg[area] / areaTotal) * 100) : 0
                            if (!pct) return null
                            return (
                              <div key={area} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#666' }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: AREA_COLORS_LOCAL[area], flexShrink: 0 }} />
                                {AREA_LABELS_LOCAL[area]} {pct}%
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Acciones seleccionadas card */}
                  <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 16, padding: '1rem 1.25rem' }}>
                    <p style={{ fontSize: '0.68rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem' }}>
                      Acciones seleccionadas · {selected.length}
                    </p>

                    {selected.length === 0 ? (
                      <p style={{ fontSize: '0.78rem', color: '#ccc', fontStyle: 'italic' }}>Sin acciones seleccionadas aún</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                        {selected.map(id => {
                          const a = ACTIONS.find(x => x.id === id)
                          if (!a) return null
                          return (
                            <div key={id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 10, border: '1px solid #e5e5e5', background: '#fff', overflow: 'hidden' }}>
                              <img
                                src={a.image}
                                alt=""
                                style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', borderRadius: '10px 10px 0 0', filter: 'grayscale(100%)' }}
                                onError={e => { e.currentTarget.style.display = 'none' }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.75rem' }}>
                                <span style={{ flex: 1, fontSize: '0.75rem', fontWeight: 600, color: '#0a0a0a', lineHeight: 1.3 }}>{a.label}</span>
                                <button onClick={() => handleToggleAction(group, id)} style={{ background: 'transparent', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px' }}>✕</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!isClosed && (
                      <button
                        onClick={() => handleConfirmTeam(group)}
                        disabled={selected.length === 0}
                        style={{
                          width: '100%', padding: '0.85rem', borderRadius: 999, border: 'none',
                          background: selected.length > 0 ? '#0a0a0a' : '#f0f0f0',
                          color: selected.length > 0 ? '#fff' : '#aaa',
                          fontWeight: 600, fontSize: '0.82rem',
                          cursor: selected.length > 0 ? 'pointer' : 'default',
                        }}
                      >
                        {conf?.confirmed ? '✓ Confirmar de nuevo' : `Confirmar acciones de ${group} →`}
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN — filtros + listado de acciones */}
                <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 16, padding: '1rem 1.25rem' }}>

                  {/* Filtros por categoría */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {['transport','energy','food','consumption','waste'].map(area => {
                      const labels = { transport: 'Transporte', energy: 'Vivienda', food: 'Alimentación', consumption: 'Compras y hábitos', waste: 'Vida digital' }
                      const colors = { transport: '#38bdf8', energy: '#f59e0b', food: '#4ade80', consumption: '#a855f7', waste: '#f472b6' }
                      const isActive = filter3Area === area
                      return (
                        <button key={area} onClick={() => setFilter3Area(area === filter3Area ? 'all' : area)} style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.3rem 0.85rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
                          background: isActive ? colors[area] : 'transparent',
                          color: isActive ? '#0a0a0a' : '#666',
                          border: `1px solid ${isActive ? colors[area] : '#e5e5e5'}`,
                          cursor: 'pointer',
                        }}>
                          <img src={AREA_ICON_URL[area]} width={14} height={14} alt="" style={{ flexShrink: 0 }} />
                          {labels[area]}
                        </button>
                      )
                    })}
                  </div>

                  {/* Listado de acciones */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    {ACTIONS.filter(a => filter3Area === 'all' || a.area === filter3Area).map(a => {
                      const isSel = selected.includes(a.id)
                      return (
                        <div key={a.id}
                          onClick={() => handleToggleAction(group, a.id)}
                          style={{
                            position: 'relative', display: 'flex', flexDirection: 'column',
                            borderRadius: 12, cursor: 'pointer', overflow: 'hidden',
                            border: `1px solid ${isSel ? '#0a0a0a' : '#e5e5e5'}`,
                            background: isSel ? '#f5f5f5' : '#fff',
                          }}
                        >
                          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSel ? '#0a0a0a' : '#ccc'}`, background: isSel ? '#0a0a0a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSel && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                          </div>
                          <img
                            src={a.image}
                            alt=""
                            style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '12px 12px 0 0', display: 'block' }}
                            onError={e => { e.currentTarget.style.display = 'none' }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.75rem' }}>
                            <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: isSel ? 600 : 400, color: '#0a0a0a', lineHeight: 1.3 }}>{a.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )
          })()}

          {allConfirmed && !step3Revealed && !isClosed && (
            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={handleRevealStep3}
                style={{
                  width: '100%', padding: '1.1rem',
                  background: '#0a0a0a', color: '#fff',
                  border: 'none', borderRadius: 999,
                  fontWeight: 700, fontSize: '0.9rem',
                  cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >
                Revelar reducción a todos los equipos →
              </button>
            </div>
          )}

          {step3Revealed && (
            <div style={{ marginTop: '1.5rem', padding: '0.85rem 1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a' }}>✓ Reducción revelada a todos los equipos</span>
            </div>
          )}

        </div>
      )
    }

    return step3Data ? <Step3Results step3Data={step3Data} ranking={ranking} sessionGroups={sessionGroups} /> : null
  })()

  // ── Step3Results helper ───────────────────────────────────────────────────────
  function Step3Results({ step3Data, ranking, sessionGroups }) {
    const AREA_ORDER = ['transport', 'energy', 'food', 'consumption', 'waste', 'publicServices']

    function getCategory(tons) {
      if (tons < 4)  return 'bajo'
      if (tons < 7)  return 'medio'
      if (tons < 10) return 'alto'
      return 'muy alto'
    }
    const A_COLORS = {
      transport:      '#38bdf8',
      energy:         '#f59e0b',
      food:           '#4ade80',
      consumption:    '#a855f7',
      waste:          '#f472b6',
      publicServices: '#94a3b8',
    }

    const [sortBy, setSortBy] = useState('count')

    const sortedTeams = [...(step3Data.teams || [])].sort((a, b) => (b.totalReduction || 0) - (a.totalReduction || 0))
    const enrichedTeams = sortedTeams.map(team => {
      if (team.originalTons != null && team.originalTons > 0) return team
      const members = ranking.filter(r => r.group === team.group)
      const originalTons = members.length
        ? members.reduce((s, r) => s + r.tons, 0) / members.length
        : 0
      const newTons = Math.max(0, originalTons - (team.totalReduction || 0) / 1000)
      return { ...team, originalTons, newTons }
    })
    const allActionsSorted = [...(step3Data.actionStats || [])].sort((a, b) => b.count - a.count)
    const sorted = sortBy === 'count'
      ? [...allActionsSorted].sort((a, b) => b.count - a.count)
      : [...ACTIONS].sort((a, b) =>
          sortBy === 'reduction_desc'
            ? b.co2Reduction - a.co2Reduction
            : a.co2Reduction - b.co2Reduction
        ).map(a => ({
            ...a,
            count: allActionsSorted.find(x => x.id === a.id)?.count ?? 0,
          }))
    const actionTeams = {}
    ;(step3Data.teams || []).forEach(team => {
      (team.actions || []).forEach(id => {
        if (!actionTeams[id]) actionTeams[id] = []
        actionTeams[id].push(team.group)
      })
    })
    const maxOriginal = Math.max(...enrichedTeams.map(t => t.originalTons || 0), 0.1)

    const getGroupAreaAvg = (group) => {
      const members = ranking.filter(r => r.group === group)
      if (!members.length) return {}
      const avg = {}
      AREA_ORDER.forEach(area => {
        avg[area] = area === 'publicServices'
          ? 1.5
          : members.reduce((s, r) => s + (r.areas?.[area] || 0), 0) / members.length
      })
      return avg
    }

    const getGroupAreaAfter = (group, areaAvg) => {
      const teamData = step3Data.teams?.find(t => t.group === group)
      const red = { transport: 0, energy: 0, food: 0, consumption: 0, waste: 0, publicServices: 0 }
      if (teamData?.actions) {
        teamData.actions.forEach(id => {
          const a = ACTIONS.find(x => x.id === id)
          if (a) red[a.area] = (red[a.area] || 0) + a.co2Reduction / 1000
        })
      }
      const after = {}
      AREA_ORDER.forEach(area => { after[area] = Math.max(0, (areaAvg[area] || 0) - (red[area] || 0)) })
      return after
    }

    const AREA_LABELS_S3 = { transport: 'Transporte', energy: 'Vivienda', food: 'Alimentación', consumption: 'Compras y hábitos', waste: 'Vida digital', publicServices: 'Servicios públicos' }

    const StackedBar = ({ areaAvg, total, maxVal, label, muted = false }) => {
      const areaSum = AREA_ORDER.reduce((s, a) => s + (areaAvg[a] || 0), 0)
      return (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: '0.65rem', color: '#aaa' }}>{label}</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#000' }}>{fmtTons(total)} t</span>
          </div>
          <div style={{ height: 12, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden', display: 'flex', marginBottom: 5 }}>
            {AREA_ORDER.map(area => {
              const pct = maxVal > 0 ? (areaAvg[area] / maxVal) * 100 : 0
              if (pct < 0.1) return null
              return <div key={area} style={{ width: `${pct}%`, background: A_COLORS[area], opacity: muted ? 0.7 : 1 }} />
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {AREA_ORDER.filter(area => (areaAvg[area] || 0) > 0).map(area => {
              const areaPct = areaSum > 0 ? Math.round((areaAvg[area] / areaSum) * 100) : 0
              return (
                <div key={area} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: A_COLORS[area], flexShrink: 0 }} />
                  <span style={{ color: '#666' }}>{AREA_LABELS_S3[area]}</span>
                  <span style={{ fontWeight: 700, color: '#333' }}>{fmtTons(areaAvg[area] || 0)}t</span>
                  <span style={{ color: '#bbb' }}>{areaPct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    const globalBefore = enrichedTeams.length
      ? enrichedTeams.reduce((s, t) => s + (t.originalTons || 0), 0) / enrichedTeams.length
      : 0
    const globalAfter = enrichedTeams.length
      ? enrichedTeams.reduce((s, t) => s + (t.newTons || 0), 0) / enrichedTeams.length
      : 0
    const globalAreaAvg = AREA_ORDER.reduce((acc, area) => {
      acc[area] = ranking.length ? ranking.reduce((s, r) => s + (r.areas?.[area] || 0), 0) / ranking.length : 0
      return acc
    }, {})

    return (
      <div style={{ flex: 1, padding: '2rem', overflow: 'auto', background: '#f5f5f5' }}>
        <h1 style={{ fontWeight: 900, fontSize: '1.4rem', color: '#0a0a0a', marginBottom: '1.5rem' }}>Resultados por equipo</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Column 1: Teams */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: '0.85rem' }}>Equipos</div>
            {enrichedTeams.map((team, i) => {
              const areaAvg   = getGroupAreaAvg(team.group)
              const areaAfter = getGroupAreaAfter(team.group, areaAvg)
              const cat       = getCategory(team.newTons || 0)
              const catBadge  = {
                bajo:      { label: '🌿 Huella reducida',  color: '#16a34a', bg: 'rgba(74,222,128,0.1)'  },
                medio:     { label: '🌱 Huella moderada',  color: '#ca8a04', bg: 'rgba(251,191,36,0.1)'  },
                alto:      { label: '🌍 Huella elevada',   color: '#ea580c', bg: 'rgba(251,146,60,0.1)'  },
                'muy alto':{ label: '🔥 Huella muy alta',  color: '#dc2626', bg: 'rgba(248,113,113,0.1)' },
              }[cat]
              return (
                <div key={team.group} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 14, padding: '1.25rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                    <span style={{ fontWeight: 900, fontSize: '1rem', color: '#ccc', minWidth: 24 }}>#{i + 1}</span>
                    <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1, color: '#0a0a0a' }}>{team.group}</span>
                    {catBadge && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: catBadge.color, background: catBadge.bg, padding: '0.2rem 0.7rem', borderRadius: 999, border: '1px solid currentColor' }}>
                        {catBadge.label}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
                    <span style={{ fontWeight: 900, fontSize: '1.6rem', color: '#0a0a0a' }}>{fmtTons(team.originalTons || 0)}</span>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>t</span>
                    <span style={{ fontSize: '1.2rem', color: '#ccc' }}>→</span>
                    <span style={{ fontWeight: 900, fontSize: '1.6rem', color: '#16a34a' }}>{fmtTons(team.newTons || 0)}</span>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>t</span>
                  </div>
                  <StackedBar areaAvg={areaAvg}   total={team.originalTons || 0} maxVal={maxOriginal} label="Antes" />
                  <StackedBar areaAvg={areaAfter} total={team.newTons || 0}      maxVal={maxOriginal} label="Después" muted />
                  {team.totalReduction > 0 && (
                    <div style={{ textAlign: 'right', marginTop: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                        −{fmtTons(team.totalReduction / 1000)} t
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Column 2: Top actions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>
                Resumen de acciones
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'count',          label: 'Más elegidas'  },
                  { id: 'reduction_desc', label: 'Mayor impacto' },
                  { id: 'reduction_asc',  label: 'Menor impacto' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setSortBy(opt.id)} style={{
                    padding: '0.25rem 0.75rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
                    background: sortBy === opt.id ? '#0a0a0a' : 'transparent',
                    color:      sortBy === opt.id ? '#fff'    : '#666',
                    border:    `1px solid ${sortBy === opt.id ? '#0a0a0a' : '#e5e5e5'}`,
                    cursor: 'pointer',
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {allActionsSorted.length === 0 ? (
              <div style={{ color: '#ccc', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin acciones aún</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {sorted.map((a, i) => {
                  const enrichedAction = ACTIONS.find(x => x.id === a.id)
                  return (
                  <div key={a.id} style={{
                    position: 'relative', display: 'flex', flexDirection: 'column',
                    background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12,
                    overflow: 'hidden',
                  }}>
                    <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 900 }}>
                      #{i + 1}
                    </div>
                    <img
                      src={enrichedAction?.image}
                      alt=""
                      style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '12px 12px 0 0', display: 'block' }}
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                    <div style={{ padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>{a.label}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#16a34a', marginTop: 6 }}>
                        −{fmtTons(a.co2Reduction / 1000)} t CO₂
                      </div>
                      <div style={{ fontSize: '0.68rem', color: (actionTeams[a.id]?.length > 0) ? '#16a34a' : '#bbb', lineHeight: 1.4 }}>
                        {actionTeams[a.id]?.length > 0
                          ? actionTeams[a.id].join(', ')
                          : 'Sin elegir'}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}

            {!winnersRevealed && step3Data.allConfirmedFinal && !isClosed && (
              <button
                onClick={handleRevealWinners}
                style={{ width: '100%', marginTop: '1.5rem', padding: '0.9rem', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '999px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Revelar ganadores →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────────
  const sidebar = (
    <div style={{ width: sidebarCollapsed ? '48px' : '280px', flexShrink: 0, borderRight: '1px solid #e5e5e5', padding: sidebarCollapsed ? '12px 8px' : '2rem 1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', background: '#ffffff', overflow: 'hidden', transition: 'width 0.2s ease' }}>
      {/* Toggle button */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setSidebarCollapsed(prev => !prev)}
          style={{ width: 28, height: 28, borderRadius: '999px', border: '1px solid #e5e5e5', background: 'transparent', cursor: 'pointer', color: '#888', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>
      </div>
      <div style={{ display: sidebarCollapsed ? 'none' : 'contents' }}>
      {/* QR */}
      <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px' }}>
        <QRCodeSVG value={joinUrl} size={160} fgColor="#000000" bgColor="#ffffff" level="M" />
      </div>
      <div style={{ fontWeight: 900, fontSize: '1.5rem', letterSpacing: '0.1em', color: '#0a0a0a' }}>{code}</div>
      <div style={{ fontSize: '0.62rem', color: '#999', textAlign: 'center', letterSpacing: '0.04em', wordBreak: 'break-all' }}>{joinUrl}</div>

      <div style={{ width: '100%', borderTop: '1px solid #e5e5e5' }} />

      {/* Counter */}
      <div style={{ textAlign: 'center', padding: '0.25rem 0' }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#0a0a0a', lineHeight: 1 }}>{completed}</div>
        <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
          Huellas recibidas
        </div>
      </div>

      <div style={{ width: '100%', borderTop: '1px solid #e5e5e5' }} />

      {/* Step toggle */}
      {revealed && (
        <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
          <button
            onClick={() => setActiveStep(2)}
            style={{
              flex: 1, padding: '0.45rem', fontSize: '0.72rem', fontWeight: 700,
              background: activeStep === 2 ? '#0a0a0a' : 'transparent',
              color: activeStep === 2 ? '#fff' : '#666',
              border: `1px solid ${activeStep === 2 ? '#0a0a0a' : '#e5e5e5'}`,
              borderRadius: '999px', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Huellas
          </button>
          <button
            onClick={() => { setActiveStep(3); if (!step3Started) handleStartStep3() }}
            style={{
              flex: 1, padding: '0.45rem', fontSize: '0.72rem', fontWeight: 700,
              background: activeStep === 3 ? '#0a0a0a' : 'transparent',
              color: activeStep === 3 ? '#fff' : '#666',
              border: `1px solid ${activeStep === 3 ? '#0a0a0a' : '#e5e5e5'}`,
              borderRadius: '999px', cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Acciones
          </button>
        </div>
      )}

      {/* Step 2 controls */}
      {activeStep === 2 && (
        <>
          <button
            disabled
            style={{ width: '100%', background: '#f5f5f5', color: '#999', border: '1px solid #e5e5e5', padding: '0.8rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '999px', cursor: 'default' }}
          >
            Calculadora activa
          </button>

          {revealed && !step3Started && !isClosed && (
            <button
              onClick={() => { setActiveStep(3); handleStartStep3() }}
              style={{ width: '100%', background: '#0a0a0a', color: '#fff', border: 'none', padding: '0.85rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '999px', cursor: 'pointer' }}
            >
              → Iniciar fase de acciones
            </button>
          )}
        </>
      )}

      {/* Step 3 controls */}
      {activeStep === 3 && (
        <>
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: '0.68rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              Equipos
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {sessionGroups.map(g => {
                const conf = teamConfirmations[g]?.confirmed
                return (
                  <span key={g} style={{
                    padding: '0.3rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                    background: conf ? '#f0fdf4' : '#f5f5f5',
                    color: conf ? '#16a34a' : '#999',
                    border: `1px solid ${conf ? '#bbf7d0' : '#e5e5e5'}`,
                  }}>
                    {conf ? '✓ ' : ''}{g}
                  </span>
                )
              })}
            </div>
          </div>

          {!step3Revealed && allConfirmed && !isClosed && (
            <button
              onClick={handleRevealStep3}
              style={{ width: '100%', background: '#0a0a0a', color: '#fff', border: 'none', padding: '0.8rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, cursor: 'pointer' }}
            >
              Revelar reducción →
            </button>
          )}
          {step3Revealed && (
            <button disabled style={{ width: '100%', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '0.8rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, cursor: 'default' }}>
              ✓ Reducción revelada
            </button>
          )}
        </>
      )}

      {isClosed ? (
        <div style={{ width: '100%', textAlign: 'center', fontSize: '0.72rem', color: '#aaa', marginTop: 'auto', padding: '0.5rem 0' }}>
          Sesión cerrada
        </div>
      ) : (
        <button onClick={handleClose} style={{ width: '100%', background: '#0a0a0a', color: '#fff', border: 'none', padding: '0.7rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: '999px', marginTop: 'auto', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      )}
      </div>
    </div>
  )

  // ── Phase 1: waiting for results ─────────────────────────────────────────────
  if (!showRanking) return (
    <div style={{ flex: 1, display: 'flex', background: '#f5f5f5', minHeight: 'calc(100vh - 52px)' }}>
      {sidebar}
      {activeStep === 3 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
            <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Espera a que terminen la calculadora
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2.5rem' }}>
          <p style={{ fontSize: '1rem', color: '#888', margin: 0 }}>Esperando resultados...</p>
          <DotsLoader color="#aaa" />
        </div>
      )}
    </div>
  )

  // ── Phase 2 / 3: results revealed ────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', background: '#f5f5f5', minHeight: 'calc(100vh - 52px)' }}>
      {sidebar}

      {activeStep === 3 ? step3Panel : (
        <div style={{ flex: 1, padding: '2.5rem', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontWeight: 900, fontSize: '1.6rem', color: '#0a0a0a' }}>
              {view === 'individual' ? 'Distribución de huellas individuales' : 'Ranking por equipos'}
            </h1>
            {/* Global / Equipos toggle pill */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {[{ id: 'individual', label: 'Global' }, { id: 'groups', label: 'Equipos' }].map(v => (
                <button key={v.id} onClick={() => setView(v.id)} style={{
                  background: view === v.id ? '#0a0a0a' : 'transparent',
                  color: view === v.id ? '#fff' : '#666',
                  border: `1px solid ${view === v.id ? '#0a0a0a' : '#e5e5e5'}`,
                  padding: '0.4rem 1.1rem', fontSize: '0.78rem', fontWeight: 600,
                  borderRadius: '999px', cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ animation: 'rankReveal 0.4s ease both' }}>
            <style>{`@keyframes rankReveal { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
            {view === 'individual'
              ? <DistributionView ranking={ranking} />
              : <GroupsView groups={groups} />
            }
          </div>
        </div>
      )}
    </div>
  )
}