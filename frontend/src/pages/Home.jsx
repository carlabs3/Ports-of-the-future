import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { BACKEND_URL } from '../utils/config.js'
import { landing } from '../content/landing.js'
import { PortPanorama, StepIcon } from '../components/landing/LandingArt.jsx'
import { COLOR } from '../styles/tokens.js'
import '../styles/landing.css'

function formatCode(val) {
  const clean = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 4) return clean
  return clean.slice(0, 4) + '-' + clean.slice(4, 8)
}

const TILE = {
  sky:     { background: COLOR.sky,     color: COLOR.ink },
  harbour: { background: COLOR.harbour, color: COLOR.onHarbour },
  ink:     { background: COLOR.ink,     color: COLOR.onInk },
}

// Mono "01 / Why now" label over a 1px rule; optional right-aligned label.
function LabelRow({ num, title, right }) {
  return (
    <div className="lp-labelrow">
      <p className="lp-label">{num} / {title}</p>
      {right && <p className="lp-label">{right}</p>}
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const codeFromUrl = searchParams.get('code')
  const { clearSession } = useSession()
  const { user } = useAuth()

  const [code, setCode]   = useState('')
  const [codeErr, setCodeErr] = useState('')

  // QR links point at /?code=… — skip the landing and go straight to join.
  useEffect(() => {
    if (codeFromUrl) {
      navigate(`/join?code=${formatCode(codeFromUrl)}`, { replace: true })
    } else {
      clearSession()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // While redirecting a QR visitor, render nothing (no landing flash).
  if (codeFromUrl) return null

  function handleJoin(e) {
    e.preventDefault()
    const formatted = formatCode(code).trim()
    if (formatted.length < 9) { setCodeErr('Enter a code like PORT-0000'); return }
    navigate(`/join?code=${formatted}`)
  }

  const c = landing

  return (
    <div className="lp">

      {/* 1 · Header */}
      <header className="lp-header lp-pad">
        <Link to="/" className="lp-brand">{c.header.brand}</Link>
        <nav className="lp-nav" aria-label="Primary">
          {c.header.nav.map(n => <a key={n.href} href={n.href}>{n.label}</a>)}
          {user
            ? <Link to="/dashboard" className="lp-login">{c.header.sessionsLabel}</Link>
            : <Link to="/login" className="lp-login">{c.header.loginLabel}</Link>}
        </nav>
      </header>

      {/* 2 · Hero */}
      <section className="lp-hero">
        <div className="lp-hero-grid lp-pad">
          <div>
            <p className="lp-label">{c.hero.label}</p>
            <h1 className="lp-h1">{c.hero.h1}</h1>
            <p className="lp-lead">{c.hero.paragraph}</p>
            <div className="lp-hero-cta">
              <a href={`#${c.request.anchor}`} className="lp-btn lp-btn--primary">{c.hero.primary}</a>
              <a href={`#${c.experience.anchor}`} className="lp-btn lp-btn--secondary">{c.hero.secondary}</a>
            </div>
          </div>

          <div className="lp-hero-card">
            <div className="lp-card">
              <p className="lp-label" style={{ marginBottom: 8 }}>{c.hero.card.label}</p>
              <h2 className="lp-title" style={{ fontSize: 'var(--fs-h3)', marginBottom: 16 }}>{c.hero.card.title}</h2>
              <form onSubmit={handleJoin}>
                <div className="lp-field">
                  <label htmlFor="hero-code">{c.hero.card.inputLabel}</label>
                  <div className="lp-card-row">
                    <input id="hero-code" className="lp-input lp-input--mono" type="text"
                      value={code} maxLength={9} autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                      placeholder={c.hero.card.placeholder}
                      onChange={e => { setCode(formatCode(e.target.value)); setCodeErr('') }} />
                    <button type="submit" className="lp-btn lp-btn--primary">{c.hero.card.button}</button>
                  </div>
                  {codeErr && <p className="lp-para" style={{ color: '#c0392b', marginTop: 8 }}>{codeErr}</p>}
                </div>
              </form>
            </div>
          </div>
        </div>
        <PortPanorama alt={c.hero.panoramaAlt} />
      </section>

      {/* 3 · Why now */}
      <section className="lp-sec lp-pad">
        <LabelRow num={c.whyNow.num} title={c.whyNow.title} />
        <div className="lp-cols-3">
          {c.whyNow.stats.map((s, i) => (
            <div key={i}>
              <div className="lp-stat" style={{ color: s.color === 'harbour' ? COLOR.harbour : COLOR.ink }}>{s.big}</div>
              <p className="lp-para">{s.text}</p>
              <p className="lp-src">
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">Source: {s.source}</a> : <>Source: {s.source}</>}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · The experience */}
      <section id={c.experience.anchor} className="lp-sec lp-pad">
        <LabelRow num={c.experience.num} title={c.experience.title} right={c.experience.labelRight} />
        <h2 className="lp-h2">{c.experience.h2}</h2>
        <div className="lp-steps">
          {c.experience.steps.map((st, i) => (
            <div key={st.n} className="lp-step">
              <div className={`lp-tile ${i % 2 === 0 ? 'lp-tile--ice' : 'lp-tile--sky'}`}>
                <StepIcon index={i} />
              </div>
              <p className="lp-step-num">{st.n}</p>
              <h3 className="lp-title">{st.title}</h3>
              <p className="lp-para">{st.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5 · Photo band */}
      <section className="lp-photo" style={c.sessionPhoto ? { backgroundImage: `url(${c.sessionPhoto})` } : undefined}>
        <div className="lp-photo-cap">{c.photoBand.caption}</div>
      </section>

      {/* 6 · What participants leave with */}
      <section id={c.get.anchor} className="lp-sec lp-pad">
        <LabelRow num={c.get.num} title={c.get.title} />
        <div className="lp-cols-3">
          {c.get.items.map(it => (
            <div key={it.n}>
              <div className="lp-gettile" style={TILE[it.tile]}>{it.n}</div>
              <h3 className="lp-title" style={{ fontSize: 'var(--fs-h2)' }}>{it.title}</h3>
              <p className="lp-para">{it.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7 · Who it's for */}
      <section id={c.who.anchor} className="lp-sec lp-pad">
        <LabelRow num={c.who.num} title={c.who.title} />
        <div className="lp-cols-2">
          <div>
            {c.who.audiences.map(a => (
              <div key={a.n} className="lp-aud">
                <span className="lp-aud-label">{a.label}</span>
                <span className="lp-aud-num">{a.n}</span>
              </div>
            ))}
          </div>
          <div className="lp-need-block">
            <p className="lp-label" style={{ color: COLOR.ice, marginBottom: 16 }}>{c.who.needLabel}</p>
            {c.who.needs.map((nd, i) => {
              const text = nd.usesRecommendedGroupSize ? c.recommendedGroupSize : nd.text
              return (
                <div key={i} className="lp-need">
                  <p className="lp-need-title">{nd.title}</p>
                  {text && <p className="lp-need-text">{text}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 8 · Request a workshop */}
      <section id={c.request.anchor} className="lp-sec lp-pad">
        <LabelRow num={c.request.num} title={c.request.title} />
        <div className="lp-cols-2">
          <div>
            <h2 className="lp-h2">{c.request.h2}</h2>
            <p className="lp-lead" style={{ fontWeight: 400 }}>
              {c.request.text}{c.responseTime ? ` ${c.responseTime}` : ''}
            </p>
            {c.contactEmail && (
              <p className="lp-para">{c.request.emailPrefix}<a href={`mailto:${c.contactEmail}`} style={{ color: COLOR.harbour }}>{c.contactEmail}</a>.</p>
            )}
          </div>
          <ContactForm content={c} />
        </div>
      </section>

      {/* 9 · Footer */}
      <footer className="lp-footer lp-pad">
        <span className="lp-brand" style={{ fontSize: 18 }}>{c.footer.brand}</span>
        <div className="lp-footer-logos">
          {c.partnerLogos.map((logo, i) => <img key={i} src={logo.src} alt={logo.alt} />)}
          {c.privacyUrl && <a href={c.privacyUrl}>{c.footer.privacyLabel}</a>}
          {user
            ? <Link to="/dashboard" className="lp-login">{c.header.sessionsLabel}</Link>
            : <Link to="/login" className="lp-login">{c.footer.loginLabel}</Link>}
        </div>
      </footer>
    </div>
  )
}

// Contact form — markup + frontend states (sending/success/error) + honeypot.
// Posts to /api/contact (backend added in L4). Keeps typed values on error.
function ContactForm({ content }) {
  const f = content.request
  const empty = { name: '', organisation: '', email: '', country: '', participants: '', dates: '', message: '', consent: false, website: '' }
  const [form, setForm] = useState(empty)
  const [state, setState] = useState('idle') // idle | sending | success | error

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetch(`${BACKEND_URL}/api/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setState('success')
    } catch {
      setState('error')
    }
  }

  if (state === 'success') {
    return <div className="lp-form"><p className="lp-form-status">{f.success}</p></div>
  }

  return (
    <form className="lp-form" onSubmit={handleSubmit}>
      {/* honeypot — hidden from humans; if filled, the backend silently drops it */}
      <div className="lp-honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      <div className="lp-form-grid">
        <div className="lp-field"><label htmlFor="cf-name">{f.fields.name}</label><input id="cf-name" className="lp-input" value={form.name} onChange={set('name')} required /></div>
        <div className="lp-field"><label htmlFor="cf-org">{f.fields.organisation}</label><input id="cf-org" className="lp-input" value={form.organisation} onChange={set('organisation')} required /></div>
        <div className="lp-field"><label htmlFor="cf-email">{f.fields.email}</label><input id="cf-email" className="lp-input" type="email" value={form.email} onChange={set('email')} required /></div>
        <div className="lp-field"><label htmlFor="cf-country">{f.fields.country}</label><input id="cf-country" className="lp-input" value={form.country} onChange={set('country')} /></div>
        <div className="lp-field"><label htmlFor="cf-participants">{f.fields.participants}</label><input id="cf-participants" className="lp-input" type="number" min="1" value={form.participants} onChange={set('participants')} /></div>
        <div className="lp-field"><label htmlFor="cf-dates">{f.fields.dates}</label><input id="cf-dates" className="lp-input" value={form.dates} onChange={set('dates')} /></div>
        <div className="lp-field lp-full"><label htmlFor="cf-message">{f.fields.message}</label><textarea id="cf-message" className="lp-input" value={form.message} onChange={set('message')} placeholder={f.fields.messagePlaceholder} /></div>
      </div>

      <label className="lp-consent" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={form.consent} onChange={set('consent')} required />
        <span>{f.consent}{content.privacyUrl && <> <a href={content.privacyUrl} style={{ color: COLOR.harbour }}>Privacy</a></>}</span>
      </label>

      {state === 'error' && <p className="lp-form-status" style={{ color: '#c0392b', marginTop: 12 }}>{f.error}</p>}

      <div className="lp-form-actions">
        <button type="submit" className="lp-btn lp-btn--primary" disabled={state === 'sending'}>
          {state === 'sending' ? f.sending : f.submit}
        </button>
      </div>
    </form>
  )
}
