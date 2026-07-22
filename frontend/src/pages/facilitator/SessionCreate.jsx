import { useState } from 'react'
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
  const [groups, setGroups]     = useState(['Equipo A', 'Equipo B', 'Equipo C'])
  const [newGroup, setNewGroup] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  function addGroup(e) {
    e?.preventDefault()
    const name = newGroup.trim()
    if (!name) return
    if (groups.includes(name)) { setError('Ese grupo ya existe'); return }
    if (groups.length >= MAX_GROUPS) { setError(`Máximo ${MAX_GROUPS} grupos`); return }
    setGroups(prev => [...prev, name])
    setNewGroup('')
    setError('')
  }

  function removeGroup(name) {
    if (groups.length <= MIN_GROUPS) { setError(`Mínimo ${MIN_GROUPS} grupos`); return }
    setGroups(prev => prev.filter(g => g !== name))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (groups.length < MIN_GROUPS) {
      setError(`Añade al menos ${MIN_GROUPS} grupos`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/sessions', { name: sessionName, groups })
      navigate(`/session/${data.code}/rankings`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la sesión')
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <h1 style={s.title}>Nueva Sesión</h1>
        <div style={s.card}>
          <form onSubmit={handleSubmit}>

            {/* Session name */}
            <div style={s.field}>
              <label style={s.label} htmlFor="sessionName">Nombre de la sesión</label>
              <input
                id="sessionName"
                style={s.addInput}
                type="text"
                placeholder="ej. Taller Empresa X — Mayo 2026"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                maxLength={80}
              />
              <p style={s.hint}>Opcional — si lo dejas vacío se usará el código como nombre.</p>
            </div>

            {/* Groups */}
            <div style={s.field}>
              <label style={s.label}>Equipos</label>

              {/* Add new group */}
              <div style={s.addRow}>
                <input
                  style={s.addInput}
                  type="text"
                  placeholder="Nombre del equipo..."
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
                  + Añadir
                </button>
              </div>

              {/* Chips */}
              <div style={s.chipsRow}>
                {groups.map(g => (
                  <div key={g} style={s.chip}>
                    {g}
                    <button
                      type="button"
                      style={s.chipX}
                      onClick={() => removeGroup(g)}
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <p style={s.hint}>
                {groups.length} equipo{groups.length !== 1 ? 's' : ''} · mín. {MIN_GROUPS}, máx. {MAX_GROUPS}
              </p>
            </div>

            {error && <p style={s.error}>{error}</p>}

            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Sesión →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
