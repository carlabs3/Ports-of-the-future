import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../utils/api.js'
import { DistributionView, GroupsView, computeGroups } from '../../components/RankingViews.jsx'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function SessionStats() {
  const { code } = useParams()
  const [session,  setSession]  = useState(null)
  const [ranking,  setRanking]  = useState([])
  const [groups,   setGroups]   = useState([])
  const [view,     setView]     = useState('individual')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/api/sessions/${code}`),
      api.get(`/api/results/${code}/ranking`),
    ])
      .then(([sessionRes, rankingRes]) => {
        setSession(sessionRes.data)
        const items = rankingRes.data.map(r => ({
          name: 'Anónimo',
          group: r.group,
          tons: r.carbonTons,
          category: r.category,
          areas: r.areas || {},
          answers: r.answers || {},
        }))
        setRanking(items)
        setGroups(computeGroups(items))
      })
      .catch(() => setError('No se pudieron cargar los datos de la sesión'))
      .finally(() => setLoading(false))
  }, [code])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', minHeight: 'calc(100vh - 52px)' }}>
      <div style={{ color: '#666', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cargando...</div>
    </div>
  )

  if (error) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', minHeight: 'calc(100vh - 52px)', gap: '1rem' }}>
      <div style={{ color: '#cc4444', fontSize: '0.85rem' }}>{error}</div>
      <Link to="/dashboard" style={{ fontSize: '0.8rem', color: '#0a0a0a', textDecoration: 'underline' }}>← Volver al panel</Link>
    </div>
  )

  const count = ranking.length

  return (
    <div style={{ flex: 1, background: '#f5f5f5', minHeight: 'calc(100vh - 52px)' }}>

      {/* ── Header ── */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e5e5', padding: '1.25rem 2.5rem' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link to="/dashboard" style={{ fontSize: '0.78rem', color: '#0a0a0a', letterSpacing: '0.06em', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem', border: '1px solid #e5e5e5', borderRadius: '999px', padding: '0.35rem 0.85rem' }}>
              ← Panel
            </Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, fontSize: '1.4rem', letterSpacing: '0.04em', color: '#0a0a0a' }}>{code}</span>
                {session?.name && (
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>{session.name}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#f5f5f5', color: '#999', padding: '2px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid #e5e5e5' }}>
                  Sesión cerrada
                </span>
                <span style={{ fontSize: '0.72rem', color: '#666' }}>
                  {count} participante{count !== 1 ? 's' : ''}
                </span>
                {session?.createdAt && (
                  <span style={{ fontSize: '0.72rem', color: '#666' }}>·</span>
                )}
                {session?.createdAt && (
                  <span style={{ fontSize: '0.72rem', color: '#666' }}>{formatDate(session.createdAt)}</span>
                )}
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {['individual', 'groups'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                background: view === v ? '#0a0a0a' : '#ffffff',
                color: view === v ? '#fff' : '#666',
                border: `1px solid ${view === v ? '#0a0a0a' : '#e5e5e5'}`,
                padding: '0.45rem 1.1rem', fontSize: '0.75rem', letterSpacing: '0.06em',
                borderRadius: '999px', cursor: 'pointer',
              }}>
                {v === 'individual' ? 'Individual' : 'Equipos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 2.5rem' }}>

        {/* Summary strip */}
        {session?.summary && (() => {
          const sm = session.summary
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
              {[
                { label: 'Media', value: `${sm.averageCarbonTons?.toFixed(1)} t` },
                { label: 'Mediana', value: `${sm.medianCarbonTons?.toFixed(1)} t` },
                { label: 'Mínimo', value: `${sm.minCarbonTons?.toFixed(1)} t` },
                { label: 'Máximo', value: `${sm.maxCarbonTons?.toFixed(1)} t` },
                { label: 'Participantes', value: String(sm.totalParticipants) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '16px', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#0a0a0a', lineHeight: 1, marginBottom: '0.3rem' }}>{value ?? '–'}</div>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666' }}>{label}</div>
                </div>
              ))}
            </div>
          )
        })()}

        <div style={{ animation: 'statsReveal 0.3s ease both' }}>
          <style>{`@keyframes statsReveal { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
          {view === 'individual'
            ? <DistributionView ranking={ranking} />
            : <GroupsView groups={groups} />
          }
        </div>
      </div>
    </div>
  )
}
