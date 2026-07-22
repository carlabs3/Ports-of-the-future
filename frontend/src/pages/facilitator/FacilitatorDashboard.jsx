import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { socket } from '../../utils/socket.js'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
}

const AREA_LABELS = {
  transport: 'Transporte', energy: 'Vivienda', food: 'Alimentación',
  consumption: 'Compras y hábitos', waste: 'Vida digital',
}

const STATUS_LABEL = { draft: 'Borrador', waiting: 'En espera', active: 'Activa', actions: 'Fase acciones', closed: 'Cerrada' }
const STATUS_STYLE = {
  draft:   { background: '#f5f5f5', color: '#999', border: '1px solid #e5e5e5' },
  waiting: { background: 'rgba(74,222,128,0.1)', color: '#16a34a', border: '1px solid rgba(74,222,128,0.3)' },
  active:  { background: 'rgba(74,222,128,0.1)', color: '#16a34a', border: '1px solid rgba(74,222,128,0.3)' },
  actions: { background: 'rgba(74,222,128,0.1)', color: '#16a34a', border: '1px solid rgba(74,222,128,0.3)' },
  closed:  { background: '#f5f5f5', color: '#999', border: '1px solid #e5e5e5' },
}

const s = {
  page:  { flex: 1, background: '#f5f5f5', padding: '3rem 2rem' },
  inner: { maxWidth: '960px', margin: '0 auto' },
  header: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem',
  },
  title:    { fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: '#0a0a0a' },
  subtitle: { fontSize: '0.85rem', color: '#666', marginTop: '0.3rem' },
  btnNew: {
    background: '#0a0a0a', color: '#fff', padding: '0.75rem 1.5rem',
    fontSize: '0.85rem', borderRadius: '999px', fontWeight: 600, border: 'none', cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },
  card: { background: '#ffffff', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e5e5e5' },
  cardCode: { fontWeight: 900, fontSize: '1.4rem', letterSpacing: '0.05em', marginBottom: '0.4rem', color: '#0a0a0a' },
  cardMeta: { fontSize: '0.8rem', color: '#666', marginBottom: '0.3rem' },
  groupsRow: { display: 'flex', flexWrap: 'wrap', gap: '0.35rem', margin: '0.75rem 0' },
  groupPill: {
    fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: 999,
    background: '#f5f5f5', color: '#0a0a0a', border: '1px solid #e5e5e5',
  },
  badge: (status) => ({
    display: 'inline-block', padding: '3px 10px',
    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', borderRadius: 999,
    marginBottom: '1.2rem',
    ...STATUS_STYLE[status],
  }),
  cardActions: { display: 'flex', gap: '0.5rem', marginTop: '0.25rem' },
  btnOpen: {
    flex: 1, background: '#0a0a0a', color: '#fff', padding: '0.55rem',
    fontSize: '0.73rem', borderRadius: '999px', textAlign: 'center',
    border: 'none', cursor: 'pointer', fontWeight: 600,
  },
  btnDelete: {
    background: 'transparent', color: '#999', padding: '0.55rem 0.75rem',
    fontSize: '0.73rem', borderRadius: '999px',
    border: '1px solid #e5e5e5', cursor: 'pointer',
  },
  empty: {
    textAlign: 'center', padding: '5rem 2rem', color: '#999',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
  },
  emptyBtn: {
    background: '#0a0a0a', color: '#fff', padding: '0.85rem 2rem',
    fontSize: '0.85rem', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: 600,
  },
}

export default function FacilitatorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeBanner, setActiveBanner] = useState(null)

  useEffect(() => {
    const fetchSessions = () =>
      api.get('/api/sessions').then(({ data }) => setSessions(data)).catch(() => {})

    fetchSessions().finally(() => setLoading(false))

    // Poll every 5 s so new footprints and status changes appear without refreshing
    const poll = setInterval(fetchSessions, 5000)
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    const active = sessions.find(s => s.status === 'active' || s.status === 'waiting' || s.status === 'actions')
    setActiveBanner(active || null)
  }, [sessions])

  useEffect(() => {
    // Join all active session rooms to receive real-time events
    sessions
      .filter(s => s.status === 'active' || s.status === 'waiting')
      .forEach(s => socket.emit('facilitator:join', { code: s.code }))

    function onFootprintSubmitted() {
      api.get('/api/sessions').then(({ data }) => setSessions(data)).catch(() => {})
    }

    socket.on('footprint:submitted', onFootprintSubmitted)
    socket.on('ranking:update', onFootprintSubmitted)

    return () => {
      socket.off('footprint:submitted', onFootprintSubmitted)
      socket.off('ranking:update', onFootprintSubmitted)
    }
  }, [sessions.length])

  async function handleDelete(code) {
    if (!confirm('¿Eliminar esta sesión? Se borrarán todos los datos permanentemente. Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`/api/sessions/${code}`)
      setSessions(prev => prev.filter(s => s.code !== code))
    } catch {
      alert('Error al eliminar la sesión')
    }
  }

  async function handleActivate(code) {
    try {
      await api.patch(`/api/sessions/${code}/activate`)
      setSessions(prev => prev.map(s => s.code === code ? { ...s, status: 'active' } : s))
    } catch {
      alert('Error al activar la sesión')
    }
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Mis Sesiones</h1>
            <p style={s.subtitle}>{user?.email}</p>
          </div>
          <Link to="/session/create">
            <button style={s.btnNew}>+ Nueva Sesión</button>
          </Link>
        </div>

        {/* Active session banner */}
        {activeBanner && (
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#0a0a0a', margin: 0 }}>
                🟢 Sesión activa: {activeBanner.code}
              </p>
              <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>
                {activeBanner.name || 'Sin nombre'} · Creada {formatDate(activeBanner.createdAt)}
              </p>
            </div>
            <button
              onClick={() => navigate(`/session/${activeBanner.code}/rankings`)}
              style={{ background: '#0a0a0a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em' }}
            >
              RETOMAR SESIÓN →
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Cargando...</div>
        ) : sessions.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Aún no has creado ninguna sesión
            </p>
            <Link to="/session/create">
              <button style={s.emptyBtn}>CREAR MI PRIMERA SESIÓN</button>
            </Link>
          </div>
        ) : (
          <div style={s.grid}>
            {sessions.map(session => (
              <div key={session.code} style={s.card}>
                {session.name && (
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.25rem' }}>
                    {session.name}
                  </div>
                )}
                <div style={s.cardCode}>{session.code}</div>
                <div style={s.cardMeta}>{formatDate(session.createdAt)}</div>

                {session.groups?.length > 0 && (
                  <div style={s.groupsRow}>
                    {session.groups.map(g => (
                      <span key={g} style={s.groupPill}>{g}</span>
                    ))}
                  </div>
                )}

                <div style={s.badge(session.status)}>
                  {STATUS_LABEL[session.status] || session.status}
                </div>

                {/* Summary block for sessions with revealed results */}
                {session.summary && (() => {
                  const sm = session.summary
                  const topArea = sm.byArea
                    ? Object.entries(sm.byArea).sort((a, b) => b[1] - a[1])[0]
                    : null
                  return (
                    <div style={{ background: '#f5f5f5', borderRadius: '12px', padding: '0.9rem 1rem', marginBottom: '1rem', border: '1px solid #e5e5e5' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 900, fontSize: '1.7rem', lineHeight: 1, color: '#000' }}>
                          {sm.averageCarbonTons?.toFixed(1)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          t CO₂/año media
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#666', marginBottom: topArea ? '0.4rem' : 0 }}>
                        {sm.totalParticipants} participante{sm.totalParticipants !== 1 ? 's' : ''}
                        {' · '}min {sm.minCarbonTons?.toFixed(1)} t · máx {sm.maxCarbonTons?.toFixed(1)} t
                      </div>
                      {topArea && (
                        <div style={{ fontSize: '0.68rem', color: '#888' }}>
                          Área mayor: <strong style={{ color: '#000' }}>{AREA_LABELS[topArea[0]] || topArea[0]}</strong> ({topArea[1].toFixed(1)} t)
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Team URLs — visible for waiting/active sessions with groups */}
                {session.status !== 'closed' && session.groups?.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#bbb', marginBottom: '0.5rem' }}>
                      Pantallas de equipo
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {session.groups.map(group => {
                        const url = `${window.location.origin}/team/${session.code}/${encodeURIComponent(group)}`
                        return (
                          <div key={group} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#555', minWidth: 60, flexShrink: 0 }}>{group}</span>
                            <code style={{ flex: 1, fontSize: '0.62rem', color: '#aaa', background: '#f5f5f5', padding: '2px 6px', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                              /team/{session.code}/{group}
                            </code>
                            <button
                              onClick={() => navigator.clipboard.writeText(url)}
                              style={{ fontSize: '0.65rem', color: '#0a0a0a', background: 'transparent', border: '1px solid #e5e5e5', borderRadius: '6px', padding: '2px 7px', cursor: 'pointer', flexShrink: 0 }}
                            >
                              Copiar
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div style={s.cardActions}>
                  {session.status === 'draft' ? (
                    <button
                      style={{ ...s.btnOpen, flex: 1 }}
                      onClick={() => handleActivate(session.code)}
                    >
                      Activar sesión →
                    </button>
                  ) : (
                    <Link
                      to={`/session/${session.code}/rankings`}
                      style={{ flex: 1 }}
                    >
                      <button style={{ ...s.btnOpen, width: '100%' }}>
                        {session.status === 'closed' ? 'Ver resultados' : 'Abrir sesión'}
                      </button>
                    </Link>
                  )}
                  <button style={s.btnDelete} onClick={() => handleDelete(session.code)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}