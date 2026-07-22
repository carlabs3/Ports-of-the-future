import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../../context/SessionContext.jsx'
import api from '../../utils/api.js'

const AGE_RANGES = ['< 20', '20-29', '30-39', '40-49', '50-59', '60+', 'Prefiero no decirlo']
const GENDERS    = ['Mujer', 'Hombre', 'No binario', 'Prefiero no decirlo']

const s = {
  page: {
    flex: 1,
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    minHeight: 'calc(100vh - 60px)',
  },
  card: {
    background: '#ffffff',
    width: '100%',
    maxWidth: '390px',
    borderRadius: '16px',
    border: '1px solid #e5e5e5',
    padding: '32px',
  },
  logo: {
    fontWeight: 900,
    fontSize: '1.6rem',
    letterSpacing: '-0.02em',
    marginBottom: '0.3rem',
    textTransform: 'uppercase',
    color: '#0a0a0a',
  },
  asterisk: { color: '#0a0a0a' },
  tagline: {
    fontSize: '0.75rem',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '2.5rem',
  },
  field: { marginBottom: '1.8rem' },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#666',
    marginBottom: '0.5rem',
  },
  hint: {
    fontSize: '0.68rem',
    color: '#bbb',
    marginTop: '0.35rem',
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    border: '1px solid #e5e5e5',
    borderRadius: '12px',
    padding: '0.6rem 0.75rem',
    fontSize: '1.1rem',
    background: '#ffffff',
    outline: 'none',
    letterSpacing: '0.05em',
    fontWeight: 700,
    color: '#0a0a0a',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    border: '1px solid #e5e5e5',
    borderRadius: '12px',
    padding: '0.6rem 0.75rem',
    fontSize: '1rem',
    background: '#ffffff',
    outline: 'none',
    letterSpacing: '0.03em',
    fontWeight: 700,
    appearance: 'none',
    boxSizing: 'border-box',
  },
  groupRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  chip: (active) => ({
    padding: '0.45rem 1rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    borderRadius: '999px',
    background: active ? '#0a0a0a' : '#f5f5f5',
    color: active ? '#fff' : '#0a0a0a',
    border: '1px solid #e5e5e5',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  btn: {
    width: '100%',
    background: '#0a0a0a',
    color: '#fff',
    padding: '1rem',
    fontSize: '0.9rem',
    letterSpacing: '0.1em',
    borderRadius: '999px',
    marginTop: '0.5rem',
    border: 'none',
    cursor: 'pointer',
  },
  error: {
    fontSize: '0.78rem',
    color: '#cc4444',
    marginTop: '0.35rem',
  },
  fieldError: {
    border: '1px solid #cc4444',
  },
}

export default function JoinSession() {
  const [searchParams] = useSearchParams()
  const codeFromUrl = searchParams.get('code')

  const [code,        setCode]        = useState('')
  const [age,         setAge]         = useState('')
  const [gender,      setGender]      = useState('')
  const [group,       setGroup]       = useState('')
  const [groups,      setGroups]      = useState([])
  const [codeError,   setCodeError]   = useState('')
  const [ageError,    setAgeError]    = useState('')
  const [genderError, setGenderError] = useState('')
  const [groupError,  setGroupError]  = useState('')

  const { joinSession, clearSession } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    clearSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (codeFromUrl) setCode(codeFromUrl.toUpperCase())
  }, [codeFromUrl])

  useEffect(() => {
    const clean = code.replace('-', '')
    if (clean.length < 8) { setGroups([]); setCodeError(''); return }
    api.get(`/api/sessions/${code}/info`)
      .then(res => {
        const { status, groups: g } = res.data
        if (status === 'draft') {
          setGroups([])
          setCodeError('El taller aún no ha comenzado. Espera al facilitador.')
        } else if (status === 'closed') {
          setGroups([])
          setCodeError('Este taller ha finalizado.')
        } else {
          setGroups(g || [])
          setCodeError('')
        }
      })
      .catch(() => { setGroups([]); setCodeError('Sesión no encontrada') })
  }, [code])

  function formatCode(val) {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (clean.length <= 4) return clean
    return clean.slice(0, 4) + '-' + clean.slice(4, 8)
  }

  function handleSubmit(e) {
    e.preventDefault()
    let valid = true

    if (!code || code.length < 9) {
      setCodeError('Ingresa un código válido (ej: DROP-4872)')
      valid = false
    }
    if (!age) {
      setAgeError('Selecciona tu rango de edad')
      valid = false
    }
    if (!gender) {
      setGenderError('Selecciona una opción')
      valid = false
    }
    if (!group) {
      setGroupError('Selecciona un grupo')
      valid = false
    }
    if (!valid) return

    localStorage.setItem(`co2sprint_participant_${code}`, JSON.stringify({
      code, name: 'Anónimo', group, age, gender,
      joinedAt: new Date().toISOString(),
    }))
    joinSession(code, 'Anónimo', group, age, gender)
    navigate(`/session/${code}/calculator`)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          CO2 Sprint <span style={s.asterisk}>*</span>
        </div>
        <p style={s.tagline}>Calculadora de huella de carbono</p>
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px', lineHeight: 1.5 }}>
          Esta calculadora mide tu huella de carbono individual — no la de tu familia ni tu hogar compartido.
        </p>

        <form onSubmit={handleSubmit}>

          {/* Código */}
          <div style={s.field}>
            <label style={s.label} htmlFor="code">Código de sesión</label>
            <input
              id="code"
              style={{ ...s.input, ...(codeError ? s.fieldError : {}) }}
              type="text"
              value={code}
              onChange={e => { setCode(formatCode(e.target.value)); setCodeError('') }}
              placeholder="DROP-4872"
              maxLength={9}
            />
            {codeError && <div style={s.error}>{codeError}</div>}
          </div>

          {/* Grupo */}
          {groups.length > 0 && (
            <div style={s.field}>
              <label style={s.label}>Tu grupo</label>
              <div style={s.groupRow}>
                {groups.map(g => (
                  <button
                    key={g}
                    type="button"
                    style={s.chip(group === g)}
                    onClick={() => { setGroup(g); setGroupError('') }}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {groupError && <div style={{ ...s.error, marginTop: '0.5rem' }}>{groupError}</div>}
            </div>
          )}

          {/* Edad + Género */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.8rem' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label} htmlFor="age">Edad</label>
              <select
                id="age"
                value={age}
                onChange={e => { setAge(e.target.value); setAgeError('') }}
                style={{ ...s.select, color: age ? '#0a0a0a' : '#aaa', ...(ageError ? s.fieldError : {}) }}
              >
                <option value="">—</option>
                {AGE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {ageError && <div style={s.error}>{ageError}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label} htmlFor="gender">Género</label>
              <select
                id="gender"
                value={gender}
                onChange={e => { setGender(e.target.value); setGenderError('') }}
                style={{ ...s.select, color: gender ? '#0a0a0a' : '#aaa', ...(genderError ? s.fieldError : {}) }}
              >
                <option value="">—</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {genderError && <div style={s.error}>{genderError}</div>}
            </div>
          </div>

          <p style={{ fontSize: '11px', color: '#999', lineHeight: 1.5, marginBottom: '16px', marginTop: 0 }}>
            Los datos de edad, género y huella de carbono se recogen de forma anónima
            para los resultados del taller. No se asocian a ningún nombre ni se comparten
            con terceros.
          </p>

          <button style={s.btn} type="submit">Unirme →</button>
        </form>
      </div>
    </div>
  )
}
