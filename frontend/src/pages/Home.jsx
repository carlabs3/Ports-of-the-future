import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { landing } from '../content/landing.js'
import '../styles/landing.css'

// Session codes are PORT-0000: four chars, a hyphen, four chars.
function formatCode(val) {
  const clean = String(val).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 4) return clean
  return clean.slice(0, 4) + '-' + clean.slice(4, 8)
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const codeFromUrl = searchParams.get('code')
  const { clearSession } = useSession()
  const { user } = useAuth()
  const c = landing

  const [menuOpen, setMenuOpen] = useState(false)

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

      {/* ── Main (sections added in commits 2–4) ─────────────────────────── */}
      <main />

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
