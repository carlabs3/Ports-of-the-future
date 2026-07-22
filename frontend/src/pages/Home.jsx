import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'

function formatCode(val) {
  const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 4) return clean
  return clean.slice(0, 4) + '-' + clean.slice(4, 8)
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const codeFromUrl = searchParams.get('code')
  const [code, setCode]   = useState('')
  const [error, setError] = useState('')
  const { clearSession } = useSession()

  useEffect(() => {
    clearSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (codeFromUrl) setCode(formatCode(codeFromUrl))
  }, [codeFromUrl])

  function handleCodeChange(e) {
    setCode(formatCode(e.target.value))
    setError('')
  }

  function handleJoin(e) {
    e.preventDefault()
    const formatted = code.trim()
    if (!formatted) {
      setError('Introduce el código de sesión')
      return
    }
    if (formatted.length < 9) {
      setError('El código debe tener el formato DROP-0000')
      return
    }
    navigate(`/join?code=${formatted}`)
  }

  function scrollToHow(e) {
    e.preventDefault()
    document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--gris-borde)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="hero-grid">

            {/* Left */}
            <div>
              <p className="hero-tag" style={{ color: 'rgba(0,0,0,0.4)' }}>· TALLER DE HUELLA DE CARBONO</p>
              <h1 style={{
                color: '#0a0a0a',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                fontSize: 'clamp(38px, 5vw, 58px)',
                lineHeight: 1.05,
                marginBottom: 24,
              }}>
                tu estilo de vida<br />
                tiene un{' '}
                <span style={{
                  fontStyle: 'italic',
                  textDecoration: 'underline',
                  textDecorationThickness: '3px',
                  textUnderlineOffset: '4px',
                }}>
                  coste.
                </span>
              </h1>
              <p className="hero-sub">
                Transporte, alimentación, energía en casa… todo suma. En 5 minutos sabrás exactamente cuánto CO₂ genera tu vida — y cómo te comparas con tu equipo.
              </p>
            </div>

            {/* Right — join box */}
            <div className="join-box" style={{ background: '#0a0a0a', borderRadius: 16, border: 'none' }}>
              <div style={{ marginBottom: 18 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 10, fontWeight: 600, color: '#4ade80',
                  background: 'rgba(74, 222, 128, 0.15)', borderRadius: 999, border: '1px solid rgba(74, 222, 128, 0.3)',
                  padding: '4px 10px', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                  Sesión activa
                </span>
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.01em' }}>
                Únete al taller
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55, marginBottom: 20 }}>
                Introduce el código que te ha dado tu facilitador para calcular tu huella.
              </p>

              <form onSubmit={handleJoin}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: '#fff', marginBottom: 8,
                }}>
                  Código de sesión
                </label>
                <div className="join-box-inner">
                  <input
                    className="join-input"
                    type="text"
                    placeholder="DROP-0000"
                    value={code}
                    onChange={handleCodeChange}
                    maxLength={9}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button className="join-btn" type="submit">
                    UNIRME AL TALLER →
                  </button>
                </div>
                {error && (
                  <p style={{ fontSize: 12, color: '#cc4444', marginTop: 8 }}>{error}</p>
                )}
              </form>

              {/* Info pills */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 9,
                marginTop: 20, paddingTop: 18,
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}>
                {[
                  { dot: '#38bdf8', text: 'Sin registro ni instalación' },
                  { dot: '#f59e0b', text: '5 minutos para completarlo' },
                  { dot: '#4ade80', text: 'Resultados en tiempo real' },
                ].map(({ dot, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    {text}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── STATS ────────────────────────────────────────────── */}
      <div className="stats">
        {[
          { bg: '#fff',    numColor: '#0a0a0a', textColor: '#555', big: '4.7 t', text: 'Media de CO₂ por persona al año en España' },
          { bg: '#0a0a0a', numColor: '#fff',    textColor: 'rgba(255,255,255,0.6)', big: '2×', text: 'El doble de lo que el planeta puede absorber' },
          { bg: '#fff',    numColor: '#0a0a0a', textColor: '#555', big: "5'", text: 'Minutos para calcular tu huella y empezar a cambiar' },
        ].map(({ bg, numColor, textColor, big, text }, i) => (
          <div key={big} className="stat" style={{ background: bg, borderRight: i < 2 ? '1px solid #e5e5e5' : 'none' }}>
            <div style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900, color: numColor, lineHeight: 1, marginBottom: 12 }}>
              {big}
            </div>
            <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: textColor, lineHeight: 1.55, margin: 0 }}>
              {text}
            </p>
          </div>
        ))}
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="como-funciona" style={{ background: '#fff', padding: '64px 0 72px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#aaa', marginBottom: 40 }}>
            ¿Cómo funciona el taller?
          </p>
          <div className="how-steps">
            {[
              {
                n: '1',
                title: 'Entra con tu código',
                text:  'El facilitador comparte un código. Entra desde tu móvil sin registro ni instalación.',
              },
              {
                n: '2',
                title: 'Calcula tu huella',
                text:  'Responde preguntas sobre transporte, energía, alimentación y más.',
              },
              {
                n: '3',
                title: 'Ve los resultados',
                text:  'Compara con tu equipo y la media de España en tiempo real.',
              },
            ].map(({ n, title, text }) => (
              <div key={n}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: '#0a0a0a', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, marginBottom: 16, flexShrink: 0,
                }}>
                  {n}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 8, textTransform: 'none', letterSpacing: 0 }}>
                  {title}
                </h3>
                <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, margin: 0 }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
