import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'

const s = {
  page:  { flex: 1, background: '#f5f5f5', padding: '3rem 2rem' },
  inner: { maxWidth: '560px', margin: '0 auto' },
  title: { fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', textTransform: 'uppercase', marginBottom: '2rem', color: '#0a0a0a' },
  card:  { background: '#ffffff', borderRadius: '16px', border: '1px solid #e5e5e5', padding: '32px' },
  field: { marginBottom: '2rem' },
  label: {
    display: 'block', fontSize: '12px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: '#666', marginBottom: '0.75rem',
  },
  addRow: { display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' },
  addInput: {
    flex: 1, border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '0.5rem 0.75rem', fontSize: '0.95rem',
    background: '#ffffff', outline: 'none', color: '#0a0a0a',
  },
  addBtn: {
    background: '#f5f5f5', color: '#0a0a0a',
    border: '1px solid #e5e5e5', borderRadius: '999px',
    padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 600,
    letterSpacing: '0.04em', flexShrink: 0, cursor: 'pointer',
  },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#f5f5f5', color: '#0a0a0a',
    border: '1px solid #e5e5e5', borderRadius: '999px',
    padding: '5px 12px', fontSize: '12px', fontWeight: 500,
  },
  chipX: {
    color: '#999', cursor: 'pointer', fontSize: '14px',
    background: 'none', border: 'none', padding: 0, lineHeight: 1,
    transition: 'color 0.15s',
  },
  hint: { fontSize: '0.72rem', color: '#999', marginTop: '0.4rem' },
  groupRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    border: '1px solid #e5e5e5', borderRadius: '12px',
    padding: '0.5rem 0.75rem', marginBottom: '0.5rem',
  },
  groupName: { flex: '0 0 auto', fontSize: '0.9rem', fontWeight: 600, color: '#0a0a0a', minWidth: 90 },
  portSelect: {
    flex: 1, border: '1px solid #e5e5e5', borderRadius: '8px',
    padding: '0.4rem 0.5rem', fontSize: '0.85rem', background: '#fff', color: '#0a0a0a', outline: 'none',
  },
  btn: {
    width: '100%', background: '#0a0a0a', color: '#fff',
    padding: '1rem', fontSize: '0.9rem', letterSpacing: '0.1em',
    borderRadius: '999px', marginTop: '0.5rem', border: 'none', cursor: 'pointer',
  },
  error: { fontSize: '0.8rem', color: '#cc4444', marginTop: '-1rem', marginBottom: '1rem' },
}

const MIN_GROUPS = 2
const MAX_GROUPS = 8

export default function SessionCreate() {
  const [sessionName, setSessionName] = useState('')
  const [groups, setGroups]     = useState(['Team A', 'Team B', 'Team C'])
  const [newGroup, setNewGroup] = useState('')
  const [ports, setPorts]       = useState([])   // [{ id, name, meta }]
  const [portByGroup, setPortByGroup] = useState({}) // group -> portId
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/api/par/ports')
      .then(res => setPorts(res.data || []))
      .catch(() => setError('Could not load the port catalogue'))
  }, [])

  function setPort(group, portId) {
    setPortByGroup(prev => ({ ...prev, [group]: portId ? Number(portId) : undefined }))
    setError('')
  }

  function addGroup(e) {
    e?.preventDefault()
    const name = newGroup.trim()
    if (!name) return
    if (groups.includes(name)) { setError('That team already exists'); return }
    if (groups.length >= MAX_GROUPS) { setError(`Maximum ${MAX_GROUPS} teams`); return }
    setGroups(prev => [...prev, name])
    setNewGroup('')
    setError('')
  }

  function removeGroup(name) {
    if (groups.length <= MIN_GROUPS) { setError(`Minimum ${MIN_GROUPS} teams`); return }
    setGroups(prev => prev.filter(g => g !== name))
    setPortByGroup(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (groups.length < MIN_GROUPS) {
      setError(`Add at least ${MIN_GROUPS} teams`)
      return
    }
    // Every group needs a distinct port.
    const missing = groups.find(g => !portByGroup[g])
    if (missing) { setError(`Assign a port to team "${missing}"`); return }
    const chosen = groups.map(g => portByGroup[g])
    if (new Set(chosen).size !== chosen.length) {
      setError('Each team must have a different port'); return
    }
    const portAssignments = groups.map(g => ({ group: g, portId: portByGroup[g] }))

    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/sessions', { name: sessionName, groups, portAssignments })
      navigate(`/session/${data.code}/control`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating the session')
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <h1 style={s.title}>New Session</h1>
        <div style={s.card}>
          <form onSubmit={handleSubmit}>

            {/* Session name */}
            <div style={s.field}>
              <label style={s.label} htmlFor="sessionName">Session name</label>
              <input
                id="sessionName"
                style={s.addInput}
                type="text"
                placeholder="ej. Taller Empresa X — Mayo 2026"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                maxLength={80}
              />
              <p style={s.hint}>Optional — if left empty, the code will be used as the name.</p>
            </div>

            {/* Groups */}
            <div style={s.field}>
              <label style={s.label}>Teams</label>

              {/* Add new group */}
              <div style={s.addRow}>
                <input
                  style={s.addInput}
                  type="text"
                  placeholder="Team name..."
                  value={newGroup}
                  onChange={e => { setNewGroup(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && addGroup(e)}
                  maxLength={30}
                />
                <button
                  type="button"
                  style={s.addBtn}
                  onClick={addGroup}
                  disabled={groups.length >= MAX_GROUPS}
                >
                  + Add
                </button>
              </div>

              {/* One row per group: name + port selector */}
              {groups.map(g => {
                const takenByOthers = new Set(
                  groups.filter(other => other !== g).map(other => portByGroup[other]).filter(Boolean)
                )
                return (
                  <div key={g} style={s.groupRow}>
                    <span style={s.groupName}>{g}</span>
                    <select
                      style={s.portSelect}
                      value={portByGroup[g] || ''}
                      onChange={e => setPort(g, e.target.value)}
                    >
                      <option value="">— Choose port —</option>
                      {ports.map(p => (
                        <option key={p.id} value={p.id} disabled={takenByOthers.has(p.id)}>
                          {p.name}{p.meta?.zone ? ` · ${p.meta.zone}` : ''}{takenByOthers.has(p.id) ? ' (ocupado)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      style={s.chipX}
                      onClick={() => removeGroup(g)}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                )
              })}

              <p style={s.hint}>
                {groups.length} team{groups.length !== 1 ? 's' : ''} · min. {MIN_GROUPS}, max. {MAX_GROUPS} · one distinct port per team
              </p>
            </div>

            {error && <p style={s.error}>{error}</p>}

            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Session →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
