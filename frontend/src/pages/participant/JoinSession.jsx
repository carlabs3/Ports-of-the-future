import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../../context/SessionContext.jsx'
import api from '../../utils/api.js'
import { COLOR, FONT, FS, FW, LS, HAIRLINE } from '../../styles/tokens.js'

// Join = session code only. Team, port size and world zone move to the
// "Before you start" step (PariCalculator). The code is prefilled from the QR
// (?code=…). We only write a lightweight participant marker here; the team is
// added to it when the participant picks one on the next screen.

const s = {
  page: {
    flex: 1, minHeight: '100vh', background: COLOR.paper,
    display: 'flex', flexDirection: 'column',
  },
  hero: {
    background: COLOR.sky, color: COLOR.ink, padding: '40px 24px 36px',
    borderBottom: HAIRLINE,
  },
  heroInner: { maxWidth: 480, margin: '0 auto', width: '100%' },
  title: {
    fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.h1,
    letterSpacing: LS.display, lineHeight: 1.02, margin: 0,
  },
  tagline: {
    fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono,
    textTransform: 'uppercase', color: COLOR.ink, marginTop: 12,
  },
  body: { maxWidth: 480, margin: '0 auto', width: '100%', padding: '32px 24px', flex: 1 },
  intro: { fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, lineHeight: 1.5, margin: '0 0 28px' },
  label: {
    display: 'block', fontFamily: FONT.mono, fontSize: FS.label, fontWeight: FW.medium,
    letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60, marginBottom: 10,
  },
  input: {
    width: '100%', border: HAIRLINE, borderRadius: 0, padding: '16px 18px',
    fontFamily: FONT.mono, fontSize: FS.h3, fontWeight: FW.bold, letterSpacing: '0.12em',
    textTransform: 'uppercase', background: COLOR.paper, color: COLOR.ink,
    outline: 'none', boxSizing: 'border-box',
  },
  inputError: { borderColor: '#c0392b' },
  error: { fontFamily: FONT.sans, fontSize: FS.sm, color: '#c0392b', marginTop: 8 },
  btn: {
    width: '100%', height: 56, marginTop: 28, border: HAIRLINE, borderRadius: 0,
    background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body,
    fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
}

export default function JoinSession() {
  const [searchParams] = useSearchParams()
  const codeFromUrl = searchParams.get('code')

  const [code,      setCode]      = useState('')
  const [codeError, setCodeError] = useState('')
  const [ready,     setReady]     = useState(false) // session exists and is active

  const { clearSession } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    clearSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (codeFromUrl) setCode(formatCode(codeFromUrl))
  }, [codeFromUrl])

  // Live session lookup — mirrors the old behaviour but only reads status.
  useEffect(() => {
    const clean = code.replace('-', '')
    if (clean.length < 8) { setReady(false); setCodeError(''); return }
    api.get(`/api/sessions/${code}/info`)
      .then(res => {
        const { status } = res.data
        if (status === 'draft') {
          setReady(false)
          setCodeError("The workshop hasn't started yet. Wait for the facilitator.")
        } else if (status === 'closed') {
          setReady(false)
          setCodeError('This workshop has ended.')
        } else {
          setReady(true)
          setCodeError('')
        }
      })
      .catch(() => { setReady(false); setCodeError('Session not found') })
  }, [code])

  function formatCode(val) {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (clean.length <= 4) return clean
    return clean.slice(0, 4) + '-' + clean.slice(4, 8)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!code || code.length < 9) {
      setCodeError('Enter a valid code (e.g. PORT-4872)')
      return
    }
    if (!ready) return

    // Lightweight marker — the team is added on "Before you start". The marker
    // guards the questionnaire/result screens against a reused device.
    localStorage.setItem(`ports_participant_${code}`, JSON.stringify({
      code, name: 'Anonymous',
      joinedAt: new Date().toISOString(),
    }))
    navigate(`/session/${code}/par`)
  }

  const canJoin = code.length >= 9 && ready

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.heroInner}>
          <h1 style={s.title}>Ports of the Future</h1>
          <p style={s.tagline}>Port Adaptation Readiness Index</p>
        </div>
      </div>

      <div style={s.body}>
        <p style={s.intro}>
          A short individual questionnaire about your port's readiness for climate adaptation.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={s.label} htmlFor="code">Session code</label>
          <input
            id="code"
            style={{ ...s.input, ...(codeError ? s.inputError : {}) }}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={code}
            onChange={e => { setCode(formatCode(e.target.value)); setCodeError('') }}
            placeholder="PORT-4872"
            maxLength={9}
          />
          {codeError && <div style={s.error}>{codeError}</div>}

          <button type="submit" style={{ ...s.btn, ...(canJoin ? {} : s.btnDisabled) }} disabled={!canJoin}>
            Join →
          </button>
        </form>
      </div>
    </div>
  )
}
