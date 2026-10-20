import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { socket } from '../../utils/socket.js'
import { BACKEND_URL } from '../../utils/config.js'
import { COLOR, FONT, FS, FW, LS, HAIRLINE, BAND_RAMP, BAND_ORDER } from '../../styles/tokens.js'

// Band meaning (content). Band colours come from BAND_RAMP (tokens) — the one
// band-colour definition. The band value itself is computed by the backend.
const BAND_MSG = {
  reactive:   'Starting point: climate adaptation is not yet on the agenda.',
  aware:      'There is awareness of the challenge; time to move to structured action.',
  developing: 'Good progress: adaptation is taking hold.',
  proactive:  'A benchmark: adaptation is embedded and actively managed.',
}

const AREA_LABELS = {
  governance:   'Governance & Strategy',
  organisation: 'Organisation & People',
  budget:       'Budget & Finance',
  measures:     'Implemented Measures',
  preparedness: 'Preparedness & Monitoring',
}
const AREA_ORDER = ['governance', 'organisation', 'budget', 'measures', 'preparedness']

export default function PariResult() {
  const location = useLocation()
  const { code } = useParams()
  const navigate = useNavigate()

  const RESULT_KEY = `ports_par_result_${code}`

  // Guard: only the participant who joined THIS session on THIS device may see a
  // result. Prevents a reused device from showing someone else's PARI.
  const hasParticipant = !!localStorage.getItem(`ports_participant_${code}`)

  useEffect(() => {
    if (!hasParticipant) navigate('/join', { replace: true })
  }, [hasParticipant, navigate])

  // Result may arrive via (1) navigation state, (2) localStorage, (3) socket.
  const savedRaw = localStorage.getItem(RESULT_KEY)
  const saved = savedRaw ? (() => { try { return JSON.parse(savedRaw) } catch { return null } })() : null

  const initial = (location.state && location.state.score != null)
    ? location.state
    : (hasParticipant && saved && saved.score != null)
      ? saved
      : null

  const [result, setResult] = useState(initial)
  const [emailInput,  setEmailInput]  = useState('')
  const [emailStatus, setEmailStatus] = useState('idle') // idle|sending|success|invalid|error|unavailable

  // Persist result once we have it (survives reload).
  useEffect(() => {
    if (result && result.score != null) {
      localStorage.setItem(RESULT_KEY, JSON.stringify({
        score: result.score, band: result.band, areas: result.areas || {},
      }))
    }
  }, [result, RESULT_KEY])

  // Socket: receive the computed result (in case it wasn't passed via state).
  useEffect(() => {
    function onParResult(payload) {
      if (payload && payload.score != null) setResult(payload)
    }
    function onSessionClosed() { navigate(`/session/${code}/end`, { replace: true }) }
    socket.on('par:result', onParResult)
    socket.on('session:closed', onSessionClosed)
    return () => {
      socket.off('par:result', onParResult)
      socket.off('session:closed', onSessionClosed)
    }
  }, [code, navigate])

  async function handleSendEmail(e) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) { setEmailStatus('invalid'); return }
    setEmailStatus('sending')
    try {
      await axios.post(`${BACKEND_URL}/api/par/send-email`, {
        email: emailInput,
        score: result.score,
        band:  result.band,
        areas: result.areas,
      })
      setEmailStatus('success')
    } catch (err) {
      if (err.response?.status === 503) setEmailStatus('unavailable')
      else setEmailStatus('error')
    }
  }

  if (!hasParticipant) return null

  // ── Waiting for the result to arrive ──────────────────────────────────────
  if (!result || result.score == null) return (
    <div style={{ minHeight: '100dvh', background: COLOR.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>⏳</div>
      <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, maxWidth: 300, lineHeight: 1.65 }}>
        Calculating your PAR Index…
      </p>
    </div>
  )

  const band = BAND_RAMP[result.band] || { label: result.band, bg: COLOR.ink, text: COLOR.onInk, border: HAIRLINE }
  const areas = result.areas || {}

  // Weakest area = lowest score (first on a tie). Marked in --signal.
  const weakestId = AREA_ORDER.reduce((min, id) => (areas[id] ?? 0) < (areas[min] ?? 0) ? id : min, AREA_ORDER[0])

  return (
    <div style={{ background: COLOR.paper, minHeight: '100dvh', fontFamily: FONT.sans }}>
      {/* ═══ HEADER — score on a harbour block ═══ */}
      <div style={{ background: COLOR.harbour, color: COLOR.onHarbour, borderBottom: HAIRLINE }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 32px' }}>
          <p style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', margin: '0 0 12px', color: 'rgba(255,255,255,0.8)' }}>
            Your PAR Index
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: FW.display, fontSize: FS.mega, letterSpacing: LS.display, lineHeight: 0.9 }}>{result.score}</span>
            <span style={{ fontSize: FS.h3, fontWeight: FW.bold, color: 'rgba(255,255,255,0.7)' }}>/ 100</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <span style={{ display: 'inline-block', padding: '6px 14px', background: band.bg, color: band.text, border: band.border, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.bold }}>
              {band.label}
            </span>
          </div>
          <p style={{ margin: '16px 0 0', fontSize: FS.lg, fontWeight: FW.medium, color: 'rgba(255,255,255,0.92)', lineHeight: 1.4, maxWidth: 460 }}>
            {BAND_MSG[result.band] || ''}
          </p>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 20px 40px' }}>

        {/* 4-segment band strip */}
        <p style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60, margin: '0 0 10px' }}>
          Maturity band
        </p>
        <div style={{ display: 'flex', border: HAIRLINE, marginBottom: 8 }}>
          {BAND_ORDER.map((id, i) => {
            const b = BAND_RAMP[id]
            const isCurrent = id === result.band
            return (
              <div key={id} style={{ flex: 1, borderLeft: i === 0 ? 'none' : HAIRLINE, position: 'relative' }}>
                {isCurrent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: COLOR.ink }} />}
                <div style={{ background: b.bg, color: b.text, padding: '18px 6px 12px', textAlign: 'center' }}>
                  <span style={{ fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: isCurrent ? FW.bold : FW.regular }}>{b.label}</span>
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: '0 0 32px' }}>
          You are in the <strong style={{ color: COLOR.ink }}>{band.label}</strong> band.
        </p>

        {/* Area bars out of 20, weakest marked */}
        <p style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60, margin: '0 0 14px' }}>
          Profile by area (out of 20)
        </p>
        <div>
          {AREA_ORDER.map(id => {
            const val = areas[id] ?? 0
            const isWeak = id === weakestId
            return (
              <div key={id} style={{ padding: '10px 0', borderTop: HAIRLINE }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink, fontWeight: isWeak ? FW.bold : FW.regular }}>
                    {AREA_LABELS[id]}
                    {isWeak && (
                      <span style={{ marginLeft: 8, fontFamily: FONT.mono, fontSize: FS.micro, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink, background: COLOR.signal, border: HAIRLINE, padding: '1px 6px' }}>
                        Weakest
                      </span>
                    )}
                  </span>
                  <span style={{ fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: FW.bold, color: COLOR.ink }}>{val}/20</span>
                </div>
                <div style={{ position: 'relative', height: 14, background: COLOR.ice, border: HAIRLINE }}>
                  <div style={{ position: 'absolute', inset: '0 auto 0 0', height: '100%', width: `${(val / 20) * 100}%`, background: isWeak ? COLOR.signal : COLOR.harbour }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Email */}
        <div style={{ border: HAIRLINE, padding: '20px', marginTop: 32 }}>
          <p style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', color: COLOR.ink60, margin: '0 0 16px' }}>
            Get your result by email
          </p>
          {emailStatus === 'success' ? (
            <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink, fontWeight: FW.bold, textAlign: 'center', padding: '12px 0', margin: 0 }}>
              ✓ Check your inbox
            </p>
          ) : emailStatus === 'unavailable' ? (
            <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, textAlign: 'center', padding: '12px 0', margin: 0, lineHeight: 1.6 }}>
              Email delivery is not available right now. You can note your result: <strong style={{ color: COLOR.ink }}>{result.score}/100 · {band.label}</strong>.
            </p>
          ) : (
            <form onSubmit={handleSendEmail}>
              <input
                type="email"
                placeholder="you@email.com"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setEmailStatus('idle') }}
                style={{ width: '100%', border: HAIRLINE, borderRadius: 0, padding: '14px 16px', fontFamily: FONT.sans, fontSize: FS.body, outline: 'none', marginBottom: 10, boxSizing: 'border-box', background: COLOR.paper, color: COLOR.ink }}
              />
              {(emailStatus === 'invalid' || emailStatus === 'error') && (
                <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: '#c0392b', margin: '0 0 10px' }}>
                  {emailStatus === 'invalid' ? 'Enter a valid email' : 'Something went wrong, try again'}
                </p>
              )}
              <button type="submit" disabled={emailStatus === 'sending'}
                style={{ width: '100%', height: 56, background: emailStatus === 'sending' ? COLOR.ink60 : COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, borderRadius: 0, border: HAIRLINE, cursor: emailStatus === 'sending' ? 'default' : 'pointer' }}>
                {emailStatus === 'sending' ? 'Sending…' : 'Email me my result'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
