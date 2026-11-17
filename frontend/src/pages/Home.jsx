import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { landing } from '../content/landing.js'
import { HOME_IMG } from '../assets/home/images.js'
import '../styles/landing.css'

// Session codes are PORT-0000: four chars, a hyphen, four chars.
function formatCode(val) {
  const clean = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 4) return clean
  return clean.slice(0, 4) + '-' + clean.slice(4, 8)
}

// Small stroke icons (currentColor, so they take the surrounding text colour).
function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const codeFromUrl = searchParams.get('code')
  const { clearSession } = useSession()
  const { user } = useAuth()
  const c = landing

  const [menuOpen, setMenuOpen] = useState(false)
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState('')

  // QR links point at /?code=… — skip the home page and go straight to join.
  useEffect(() => {
    if (codeFromUrl) {
      navigate(`/join?code=${formatCode(codeFromUrl)}`, { replace: true })
    } else {
      clearSession()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // While redirecting a QR visitor, render nothing (no home-page flash).
  if (codeFromUrl) return null

  function handleJoin(e) {
    e.preventDefault()
    const formatted = formatCode(code).trim()
    if (formatted.length < 9) { setCodeErr('Enter a code like PORT-0000'); return }
    navigate(`/join?code=${formatted}`)
  }

  // Facilitator link: /dashboard when signed in, /login otherwise.
  const facilitatorTo = user ? '/dashboard' : '/login'
  const facilitatorLabel = user ? c.header.sessionsLabel : c.header.loginLabel

  return (
    <div className="home">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="home-header">
        <div className="home-wrap home-header__bar">
          <Link to="/" className="home-brand">{c.header.brand}</Link>

          <nav className="home-nav" aria-label="Primary">
            {c.header.nav.map(n => <a key={n.href} href={n.href}>{n.label}</a>)}
            <Link to={facilitatorTo} className="home-login">{facilitatorLabel}</Link>
          </nav>

          <button
            type="button"
            className="home-menu-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="home-menu"
            onClick={() => setMenuOpen(o => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen
                ? <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>
                : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>

        <div className="home-wrap">
          <div id="home-menu" className={`home-menu-panel${menuOpen ? ' is-open' : ''}`}>
            {c.header.nav.map(n => (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}>{n.label}</a>
            ))}
            <Link to={facilitatorTo} className="home-login" onClick={() => setMenuOpen(false)}>
              {facilitatorLabel}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="home-hero">
          <div className="home-wrap home-hero__inner">
            <div className="home-hero__text">
              <p className="home-eyebrow home-eyebrow--onlight">{c.hero.eyebrow}</p>
              <h1 className="home-hero__h1">{c.hero.h1}</h1>
              <p className="home-hero__lead">{c.hero.lead}</p>
              <a href={`#${c.request.anchor}`} className="home-btn home-hero__cta">{c.hero.button}</a>
            </div>

            <div className="home-hero__card">
              <div className="home-joincard">
                <div className="home-joincard__pill">
                  <span className="home-joincard__pill-label">
                    <span className="home-joincard__dot" aria-hidden="true" />
                    {c.joinCard.pill}
                  </span>
                  <PhoneIcon />
                </div>

                <h2 className="home-joincard__title">{c.joinCard.title}</h2>
                <p className="home-joincard__text">{c.joinCard.text}</p>

                <form onSubmit={handleJoin} noValidate>
                  <label className="home-joincard__label" htmlFor="home-code">{c.joinCard.label}</label>
                  <input
                    id="home-code"
                    className="home-joincard__input"
                    type="text"
                    value={code}
                    maxLength={9}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={c.joinCard.placeholder}
                    aria-describedby={codeErr ? 'home-code-err' : undefined}
                    onChange={e => { setCode(formatCode(e.target.value)); setCodeErr('') }}
                  />
                  {codeErr && <p id="home-code-err" className="home-joincard__err">{codeErr}</p>}
                  <button type="submit" className="home-btn home-joincard__btn">{c.joinCard.button}</button>
                </form>

                <div className="home-joincard__strip">
                  <span>{c.joinCard.stripText}</span>
                  <Link to="/login" className="home-joincard__striplink">{c.joinCard.stripLink}</Link>
                </div>
              </div>
            </div>
          </div>

          {/* Full-bleed ship scene. Gradient horizon at 76% continues the sky/sea
              split beyond the photo edges; the sea runs into "Why now". The image
              URL comes from the hashed asset; sizing/position live in the CSS. */}
          <div
            className="home-hero__ship"
            role="img"
            aria-label={c.hero.shipAlt}
            style={{ backgroundImage: `url(${HOME_IMG.heroShip}), linear-gradient(#D9EBF9 0 76%, #76AFF4 76% 100%)` }}
          />
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="home-footer">
        {c.footer.partnerLogos.length > 0 && (
          <div className="home-footer__logos-strip">
            <div className="home-wrap home-footer__logos">
              {c.footer.partnerLogos.map((logo, i) => (
                <img key={i} src={logo.src} alt={logo.alt} />
              ))}
            </div>
          </div>
        )}

        <div className="home-wrap home-footer__body">
          <p className="home-footer__brand">{c.footer.brand}</p>
          <p className="home-footer__blurb">{c.footer.blurb}</p>

          <div className="home-footer__links">
            <Link to={facilitatorTo} className="home-login">{facilitatorLabel}</Link>
            {c.privacyUrl && <a href={c.privacyUrl}>{c.footer.privacyLabel}</a>}
            <span>{c.footer.hashtag}</span>
          </div>

          {c.footer.euDisclaimer && (
            <p className="home-footer__disclaimer">{c.footer.euDisclaimer}</p>
          )}
        </div>
      </footer>
    </div>
  )
}
