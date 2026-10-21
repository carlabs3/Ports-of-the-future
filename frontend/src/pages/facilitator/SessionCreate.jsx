import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import { COLOR, FONT, FS, FW, LS, HAIRLINE } from '../../styles/tokens.js'

const MIN_TEAMS = 2
const MAX_TEAMS = 6 // D13: at most 6 tables, one per port

// Preview of the generated team names (the server generates the same list).
const teamNames = (count) => Array.from({ length: count }, (_, i) => `Team ${String.fromCharCode(65 + i)}`)

const s = {
  page: { flex: 1, minHeight: 'calc(100vh - 56px)', background: COLOR.paper, padding: '48px 24px' },
  inner: { maxWidth: 560, margin: '0 auto' },
  title: { fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display, color: COLOR.ink, margin: '0 0 32px' },
  card: { border: HAIRLINE, padding: 28 },
  field: { marginBottom: 32 },
  label: { display: 'block', fontFamily: FONT.mono, fontSize: FS.label, fontWeight: FW.medium, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60, marginBottom: 12 },
  input: { width: '100%', border: HAIRLINE, borderRadius: 0, padding: '14px 16px', fontFamily: FONT.sans, fontSize: FS.body, background: COLOR.paper, color: COLOR.ink, outline: 'none', boxSizing: 'border-box' },
  hint: { fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, marginTop: 10 },
  countRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  countBtn: (sel) => ({ width: 48, height: 48, border: HAIRLINE, borderRadius: 0, cursor: 'pointer', background: sel ? COLOR.harbour : COLOR.paper, color: sel ? COLOR.onHarbour : COLOR.ink, fontFamily: FONT.mono, fontSize: FS.body, fontWeight: FW.bold }),
  preview: { fontFamily: FONT.mono, fontSize: FS.sm, color: COLOR.ink, marginTop: 14, lineHeight: 1.6 },
  btn: (disabled) => ({ width: '100%', height: 56, border: HAIRLINE, borderRadius: 0, background: disabled ? COLOR.paper : COLOR.ink, color: disabled ? COLOR.ink40 : COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 8 }),
  error: { fontFamily: FONT.sans, fontSize: FS.sm, color: '#c0392b', marginBottom: 14 },
}

export default function SessionCreate() {
  const [sessionName, setSessionName] = useState('')
  const [teamCount,   setTeamCount]   = useState(3)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/sessions', { name: sessionName, teamCount })
      navigate(`/session/${data.code}/control`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating the session')
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <h1 style={s.title}>New session</h1>
        <div style={s.card}>
          <form onSubmit={handleSubmit}>

            <div style={s.field}>
              <label style={s.label} htmlFor="sessionName">Session name</label>
              <input
                id="sessionName"
                style={s.input}
                type="text"
                placeholder="e.g. Company X workshop — May 2026"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                maxLength={80}
              />
              <p style={s.hint}>Optional — if left empty, the code is used as the name.</p>
            </div>

            <div style={s.field}>
              <label style={s.label}>Number of teams</label>
              <div style={s.countRow}>
                {Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i).map(n => (
                  <button key={n} type="button" style={s.countBtn(teamCount === n)} onClick={() => setTeamCount(n)}>
                    {n}
                  </button>
                ))}
              </div>
              <p style={s.preview}>{teamNames(teamCount).join(' · ')}</p>
              <p style={s.hint}>Each team is assigned a random port, kept hidden until the Roulette.</p>
            </div>

            {error && <p style={s.error}>{error}</p>}

            <button style={s.btn(loading)} type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create session →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
