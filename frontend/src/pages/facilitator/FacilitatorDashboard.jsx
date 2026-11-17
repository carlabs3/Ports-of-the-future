import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import { socket } from '../../utils/socket.js'
import FacilitatorLayout from '../../components/facilitator/FacilitatorLayout.jsx'
import { HOME_IMG } from '../../assets/home/images.js'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

// Status word is always shown; dot colour per status (waiting/active/actions all
// read as "live", actions shown as Active).
const STATUS = {
  draft:   { label: 'Draft',   dot: 'draft' },
  waiting: { label: 'Waiting', dot: 'waiting' },
  active:  { label: 'Active',  dot: 'active' },
  actions: { label: 'Active',  dot: 'active' },
  closed:  { label: 'Closed',  dot: 'closed' },
}

function StatusPill({ status }) {
  const m = STATUS[status] || { label: status, dot: 'closed' }
  return (
    <span className="pof-status">
      <span className={`pof-status__dot pof-status__dot--${m.dot}`} />
      {m.label}
    </span>
  )
}

function teamsLabel(session) {
  const n = session.groups?.length
  return n ? `${n} teams` : '—'
}

// Actions keep the original behaviour: draft → activate; otherwise open the
// control centre (or view results when closed); plus delete.
function SessionActions({ session, onActivate, onDelete, block }) {
  const primary = `pof-btn pof-btn--primary${block ? ' pof-btn--block' : ''}`
  const danger = `pof-btn pof-btn--danger${block ? ' pof-btn--block' : ''}`
  return (
    <>
      {session.status === 'draft' ? (
        <button type="button" className={primary} onClick={() => onActivate(session.code)}>
          Activate session →
        </button>
      ) : (
        <Link to={`/session/${session.code}/control`} className={primary}>
          {session.status === 'closed' ? 'View results →' : 'Control centre (CAP) →'}
        </Link>
      )}
      <button type="button" className={danger} onClick={() => onDelete(session.code)}>
        Delete
      </button>
    </>
  )
}

export default function FacilitatorDashboard() {
  const navigate = useNavigate()
  const [sessions, setSessions]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [activeBanner, setActiveBanner] = useState(null)

  // One fetcher, reused by the initial load, the 5s poll, the socket refresh and
  // the "Try again" button. Clears the error on success, sets it on failure.
  const fetchSessions = useCallback(() => (
    api.get('/api/sessions')
      .then(({ data }) => { setSessions(data); setError('') })
      .catch(() => setError('Could not load your sessions.'))
  ), [])

  useEffect(() => {
    fetchSessions().finally(() => setLoading(false))
    const poll = setInterval(fetchSessions, 5000)
    return () => clearInterval(poll)
  }, [fetchSessions])

  useEffect(() => {
    const active = sessions.find(s => s.status === 'active' || s.status === 'waiting' || s.status === 'actions')
    setActiveBanner(active || null)
  }, [sessions])

  useEffect(() => {
    // Join active session rooms and refresh the list live as PAR submissions arrive.
    sessions
      .filter(s => s.status === 'active' || s.status === 'waiting')
      .forEach(s => socket.emit('facilitator:join', { code: s.code }))
    socket.on('par:update', fetchSessions)
    return () => { socket.off('par:update', fetchSessions) }
  }, [sessions.length, fetchSessions])

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

  function retry() {
    setLoading(true)
    fetchSessions().finally(() => setLoading(false))
  }

  return (
    <FacilitatorLayout>
      <div className="pof-pagehead">
        <h1 className="pof-h1">Your sessions</h1>
        <Link to="/session/create" className="pof-btn pof-btn--primary">New session +</Link>
      </div>

      {activeBanner && (
        <div className="pof-banner">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="pof-banner__code">{activeBanner.code}</span>
              <StatusPill status={activeBanner.status} />
            </div>
            <p className="pof-banner__meta">
              {activeBanner.name || 'Untitled'} · Created {formatDate(activeBanner.createdAt)}
            </p>
          </div>
          <button
            type="button"
            className="pof-btn pof-btn--primary"
            onClick={() => navigate(`/session/${activeBanner.code}/control`)}
          >
            Resume session →
          </button>
        </div>
      )}

      <div className="pof-card">
        {loading ? (
          <div>
            <div className="pof-skel-row" />
            <div className="pof-skel-row" />
            <div className="pof-skel-row" />
          </div>
        ) : error && sessions.length === 0 ? (
          <div className="pof-errbox">
            <p className="pof-errbox__msg">{error}</p>
            <button type="button" className="pof-btn pof-btn--secondary" onClick={retry}>Try again</button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="pof-empty">
            <img src={HOME_IMG.people} alt="" />
            <p className="pof-empty__title">No sessions yet</p>
            <p className="pof-empty__text">Create your first session to run a workshop.</p>
            <Link to="/session/create" className="pof-btn pof-btn--primary">New session +</Link>
          </div>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="pof-only-desktop">
              <table className="pof-table">
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Date</th><th>Teams</th><th>Status</th><th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(session => (
                    <tr key={session.code}>
                      <td className="pof-table__code">{session.code}</td>
                      <td className="pof-table__name">{session.name || '—'}</td>
                      <td className="pof-table__muted">{formatDate(session.createdAt)}</td>
                      <td className="pof-table__muted">{teamsLabel(session)}</td>
                      <td><StatusPill status={session.status} /></td>
                      <td>
                        <div className="pof-table__actions">
                          <SessionActions session={session} onActivate={handleActivate} onDelete={handleDelete} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked blocks */}
            <div className="pof-only-mobile">
             <div className="pof-slist">
              {sessions.map(session => (
                <div key={session.code} className="pof-sblock">
                  <div className="pof-sblock__top">
                    <span className="pof-table__code">{session.code}</span>
                    <StatusPill status={session.status} />
                  </div>
                  <p className="pof-sblock__meta">
                    {(session.name || '—')} · {formatDate(session.createdAt)} · {teamsLabel(session)}
                  </p>
                  <div className="pof-sblock__actions">
                    <SessionActions session={session} onActivate={handleActivate} onDelete={handleDelete} block />
                  </div>
                </div>
              ))}
             </div>
            </div>
          </>
        )}
      </div>
    </FacilitatorLayout>
  )
}
