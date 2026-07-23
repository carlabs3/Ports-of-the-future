import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { socket } from '../../utils/socket.js'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_LABEL = { draft: 'Draft', waiting: 'Waiting', active: 'Active', actions: 'Active', closed: 'Closed' }
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

    // Poll every 5 s so new submissions and status changes appear without refreshing
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

    function refreshSessions() {
      api.get('/api/sessions').then(({ data }) => setSessions(data)).catch(() => {})
    }

    // Refresh the session list live as PAR submissions arrive.
    socket.on('par:update', refreshSessions)

    return () => {
      socket.off('par:update', refreshSessions)
    }
  }, [sessions.length])

  async function handleDelete(code) {
    if (!confirm('Delete this session? All data will be permanently removed. This action cannot be undone.')) return
    try {
      await api.delete(`/api/sessions/${code}`)
      setSessions(prev => prev.filter(s => s.code !== code))
    } catch {
      alert('Error deleting the session')
    }
  }

  async function handleActivate(code) {
    try {
      await api.patch(`/api/sessions/${code}/activate`)
      setSessions(prev => prev.map(s => s.code === code ? { ...s, status: 'active' } : s))
    } catch {
      alert('Error activating the session')
    }
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>My Sessions</h1>
            <p style={s.subtitle}>{user?.email}</p>
          </div>
          <Link to="/session/create">
            <button style={s.btnNew}>+ New Session</button>
          </Link>
        </div>

        {/* Active session banner */}
        {activeBanner && (
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#0a0a0a', margin: 0 }}>
                🟢 Active session: {activeBanner.code}
              </p>
              <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>
                {activeBanner.name || 'Untitled'} · Created {formatDate(activeBanner.createdAt)}
              </p>
            </div>
            <button
              onClick={() => navigate(`/session/${activeBanner.code}/control`)}
              style={{ background: '#0a0a0a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em' }}
            >
              RESUME SESSION →
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ color: '#aaa', textAlign: 'center', padding: '3rem' }}>Loading...</div>
        ) : sessions.length === 0 ? (
          <div style={s.empty}>
            <p style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              You haven't created any sessions yet
            </p>
            <Link to="/session/create">
              <button style={s.emptyBtn}>CREATE MY FIRST SESSION</button>
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

                <div style={s.cardActions}>
                  {session.status === 'draft' ? (
                    <button
                      style={{ ...s.btnOpen, flex: 1 }}
                      onClick={() => handleActivate(session.code)}
                    >
                      Activate session →
                    </button>
                  ) : (
                    <Link
                      to={`/session/${session.code}/control`}
                      style={{ flex: 1 }}
                    >
                      <button style={{ ...s.btnOpen, width: '100%' }}>
                        {session.status === 'closed' ? 'View results' : 'Control centre (PAR)'} →
                      </button>
                    </Link>
                  )}
                  <button style={s.btnDelete} onClick={() => handleDelete(session.code)}>
                    Delete
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