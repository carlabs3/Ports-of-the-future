import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'
import { socket } from '../../utils/socket.js'
import { BACKEND_URL } from '../../utils/config.js'

// Band presentation. Spanish labels (display only) — the band value itself
// comes from the backend and is the source of truth.
const BAND_CONFIG = {
  reactive:   { label: 'Reactive',   color: '#f472b6', bg: '#fce8f0', msg: 'Starting point: climate adaptation is not yet on the agenda.' },
  aware:      { label: 'Aware',      color: '#f59e0b', bg: '#fff8e0', msg: 'There is awareness of the challenge; time to move to structured action.' },
  developing: { label: 'Developing', color: '#38bdf8', bg: '#e8f2fd', msg: 'Good progress: adaptation is taking hold.' },
  proactive:  { label: 'Proactive',  color: '#4ade80', bg: '#eaf7ee', msg: 'A benchmark: adaptation is embedded and actively managed.' },
}

const AREA_LABELS = {
  governance:   'Governance & Strategy',
  organisation: 'Organisation & People',
  budget:       'Budget & Finance',
  measures:     'Implemented Measures',
  preparedness: 'Preparedness & Monitoring',
}
const AREA_ORDER = ['governance', 'organisation', 'budget', 'measures', 'preparedness']

// Custom radar axis tick: wraps a long label into up to 2 balanced lines and
// uses a small font, so the 5 area names don't clip at the sides on narrow
// phones (~380px). textAnchor is supplied by recharts per label position.
function RadarAngleTick({ x, y, textAnchor, payload }) {
  const words = String(payload?.value ?? '').split(' ')
  const lines = words.length <= 2
    ? words
    : [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="#555" fontSize={10}>
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? (lines.length > 1 ? -3 : 4) : 11}>{ln}</tspan>
      ))}
    </text>
  )
}

export default function PariResult() {
  const location = useLocation()
  const { code } = useParams()
  const navigate = useNavigate()

  const RESULT_KEY = `ports_par_result_${code}`

  // Guard: only the participant who joined THIS session on THIS device may see a
  // result. Prevents a reused device (previous participant left on this screen)
  // from showing someone else's PARI to whoever lands here next.
  const hasParticipant = !!localStorage.getItem(`ports_participant_${code}`)

  useEffect(() => {
    if (!hasParticipant) navigate('/join', { replace: true })
  }, [hasParticipant, navigate])

  // Result may arrive via (1) navigation state, (2) localStorage, (3) socket.
  const savedRaw = localStorage.getItem(RESULT_KEY)
  const saved = savedRaw ? (() => { try { return JSON.parse(savedRaw) } catch { return null } })() : null

  // Never trust the saved result unless this device has an active participant
  // for this session. Navigation state (just completed) still counts.
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
      // 503 = email service not configured on the backend — soft message.
      if (err.response?.status === 503) setEmailStatus('unavailable')
      else setEmailStatus('error')
    }
  }

  // No active participant for this session on this device → redirecting to join.
  if (!hasParticipant) return null

  // ── Waiting for the result to arrive ──────────────────────────────────────
  if (!result || result.score == null) return (
    <div style={{ minHeight: 'calc(100dvh - 52px)', background: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>⏳</div>
      <p style={{ fontSize: '0.9rem', color: '#888', maxWidth: 300, lineHeight: 1.65 }}>
        Calculating your PAR Index...
      </p>
    </div>
  )

  const cfg = BAND_CONFIG[result.band] || { label: result.band, color: '#0a0a0a', bg: '#f5f5f5', msg: '' }
  const areas = result.areas || {}
  const radarData = AREA_ORDER.map(id => ({
    area: AREA_LABELS[id] || id,
    value: areas[id] ?? 0,
  }))

  return (
    <div style={{ background: '#f5f5f5', minHeight: 'calc(100dvh - 52px)', fontFamily: "'Instrument Sans', sans-serif" }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ background: '#0a0a0a', color: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1.5rem 0' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)' }}>
            Your PAR Index
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: 'clamp(3.2rem, 11vw, 4.8rem)', lineHeight: 1 }}>{result.score}</span>
            <span style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>/ 100</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '1rem 0 1.75rem', background: cfg.bg, color: '#0a0a0a', padding: '0.5rem 1rem', borderRadius: 999 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{cfg.label}</span>
          </div>
          {cfg.msg && (
            <p style={{ margin: '0 0 1.5rem', fontSize: 'clamp(1rem, 3vw, 1.2rem)', fontWeight: 500, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, maxWidth: 460 }}>
              {cfg.msg}
            </p>
          )}
        </div>
        <svg viewBox="0 0 100 12" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 28 }}>
          <path d="M0,0 Q50,12 100,0 L100,12 L0,12 Z" fill="#f5f5f5" />
        </svg>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1.25rem 2.5rem' }}>

        {/* Area radar */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#999', marginBottom: '0.5rem' }}>
            Profile by area (0–20)
          </div>
          <div style={{ width: '100%', height: 330 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="62%" margin={{ top: 16, right: 64, bottom: 16, left: 64 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="area" tick={<RadarAngleTick />} />
                <Radar dataKey="value" stroke={cfg.color} fill={cfg.color} fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Área breakdown numérico */}
          <div style={{ marginTop: '0.5rem' }}>
            {AREA_ORDER.map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '0.5px solid #eee' }}>
                <span style={{ flex: 1, fontSize: 13, color: '#555' }}>{AREA_LABELS[id]}</span>
                <div style={{ width: 90, height: 5, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${((areas[id] ?? 0) / 20) * 100}%`, background: cfg.color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0a0a0a', width: 42, textAlign: 'right' }}>{areas[id] ?? 0}/20</span>
              </div>
            ))}
          </div>
        </div>

        {/* Email */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '1.25rem 1.5rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#999', marginBottom: '1rem' }}>
            Get your result by email
          </div>
          {emailStatus === 'success' ? (
            <p style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 700, textAlign: 'center', padding: '1rem 0', margin: 0 }}>
              ✓ Check your inbox
            </p>
          ) : emailStatus === 'unavailable' ? (
            <p style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center', padding: '1rem 0', margin: 0, lineHeight: 1.6 }}>
              Email delivery is not available right now. You can note your result: <strong>{result.score}/100 · {cfg.label}</strong>.
            </p>
          ) : (
            <form onSubmit={handleSendEmail}>
              <input
                type="email"
                placeholder="you@email.com"
                value={emailInput}
                onChange={e => { setEmailInput(e.target.value); setEmailStatus('idle') }}
                style={{ width: '100%', border: '1.5px solid #e5e5e5', borderRadius: 6, padding: '0.7rem 0.85rem', fontSize: '0.9rem', outline: 'none', marginBottom: '0.6rem', boxSizing: 'border-box', background: '#fff', color: '#0a0a0a' }}
              />
              {(emailStatus === 'invalid' || emailStatus === 'error') && (
                <p style={{ fontSize: '0.72rem', color: '#cc4444', margin: '-0.2rem 0 0.6rem' }}>
                  {emailStatus === 'invalid' ? 'Enter a valid email' : 'Something went wrong, try again'}
                </p>
              )}
              <button type="submit" disabled={emailStatus === 'sending'}
                style={{ width: '100%', background: emailStatus === 'sending' ? '#aaa' : '#0a0a0a', color: '#fff', padding: '0.85rem', fontSize: '0.73rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, borderRadius: 999, cursor: emailStatus === 'sending' ? 'default' : 'pointer', border: 'none' }}>
                {emailStatus === 'sending' ? 'Sending...' : 'Email me my result'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
