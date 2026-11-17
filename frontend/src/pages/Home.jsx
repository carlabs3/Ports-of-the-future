import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useSession } from '../context/SessionContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { BACKEND_URL } from '../utils/config.js'
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

// 32px stroke icons for the practical-part tiles (currentColor = ink).
function Icon({ children }) {
  return (
    <svg className="home-practical__icon" width="32" height="32" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
const ClockIcon  = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
const PairIcon   = () => <Icon><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5" /><path d="M17 14a6 6 0 0 1 4 6" /></Icon>
const TrioIcon   = () => <Icon><circle cx="12" cy="7" r="3" /><circle cx="5" cy="9" r="2.3" /><circle cx="19" cy="9" r="2.3" /><path d="M6.5 20a5.5 5.5 0 0 1 11 0" /><path d="M2 20a4 4 0 0 1 4-4" /><path d="M22 20a4 4 0 0 0-4-4" /></Icon>
const GlobeIcon  = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 3.5 3 14.5 0 18c-3-3.5-3-14.5 0-18Z" /></Icon>
const CheckIcon  = ({ color }) => (
  <svg className="home-provide__check" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 6.5" />
  </svg>
)

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
            style={{ backgroundImage: `url(${HOME_IMG.heroShip}), linear-gradient(#D9EBF9 0 77.2%, #76AFF4 77.2% 100%)` }}
          />
        </section>

        {/* ── Why now (sea) ──────────────────────────────────────────────── */}
        <section id={c.whyNow.anchor} className="home-section home-why">
          <div className="home-wrap">
            <p className="home-eyebrow home-eyebrow--onsea">{c.whyNow.eyebrow}</p>
            <h2 className="home-h2">{c.whyNow.h2}</h2>
            <p className="home-why__text">{c.whyNow.text}</p>

            <div className="home-why__stats">
              <div className="home-stat home-stat--white">
                <span className="home-stat__big">{c.whyNow.stats[0].big}</span>
                <p className="home-stat__text">{c.whyNow.stats[0].text}</p>
              </div>
              <div className="home-stat home-stat--ink home-surface-ink">
                <span className="home-stat__big">{c.whyNow.stats[1].big}</span>
                <p className="home-stat__text">{c.whyNow.stats[1].text}</p>
              </div>
            </div>

            <p className="home-why__source">{c.whyNow.source}</p>
          </div>
        </section>

        {/* ── The experience (white) ─────────────────────────────────────── */}
        <section id={c.experience.anchor} className="home-section">
          <div className="home-wrap">
            <p className="home-eyebrow home-eyebrow--onlight">{c.experience.eyebrow}</p>
            <h2 className="home-h2">{c.experience.h2}</h2>

            <div className="home-exp__grid">
              {c.experience.steps.map((st, i) => (
                <div key={st.n} className="home-exp__card">
                  <div className="home-exp__panel">
                    <img src={[HOME_IMG.selfAssessment, HOME_IMG.readTheRisk, HOME_IMG.stormWave][i]} alt="" />
                  </div>
                  <div className="home-exp__body">
                    <div className="home-exp__meta">
                      <span>{st.n}</span>
                      <span>{st.time}</span>
                    </div>
                    <h3 className="home-card-title">{st.title}</h3>
                    <p className="home-exp__text">{st.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="home-exp__strip home-surface-ink">
              <p className="home-exp__strip-text">{c.experience.debrief.text}</p>
              <span className="home-exp__strip-meta">{c.experience.debrief.n} · {c.experience.debrief.time}</span>
            </div>
          </div>
        </section>

        {/* ── Why this workshop (ink) ────────────────────────────────────── */}
        <section id={c.whyWorkshop.anchor} className="home-section home-whyws home-surface-ink">
          <div className="home-wrap">
            <p className="home-eyebrow home-eyebrow--ondark home-eyebrow--strong">{c.whyWorkshop.eyebrow}</p>
            <h2 className="home-h2 home-h2--wide">{c.whyWorkshop.h2}</h2>

            <div className="home-whyws__grid">
              {c.whyWorkshop.items.map((it, i) => {
                const color = ['var(--home-blue-100)', 'var(--home-blue-300)', 'var(--home-sea)', 'var(--home-gold)'][i]
                return (
                  <div key={it.n} className="home-whyws__col" style={{ borderTopColor: color }}>
                    <span className="home-whyws__num" style={{ color }}>{it.n}</span>
                    <div className="home-whyws__col-body">
                      <h3 className="home-whyws__title">{it.title}</h3>
                      <p className="home-whyws__text">{it.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Made to measure (white) ────────────────────────────────────── */}
        <section id={c.madeToMeasure.anchor} className="home-section">
          <div className="home-wrap">
            <p className="home-eyebrow home-eyebrow--onlight home-eyebrow--strong">{c.madeToMeasure.eyebrow}</p>
            <h2 className="home-h2 home-h2--wide">{c.madeToMeasure.h2}</h2>

            <div className="home-mtm__grid">
              {c.madeToMeasure.cards.map((card, i) => {
                // Fill per spec order; dark fills use a surface class (bg + white).
                const fill = [
                  'home-mtm__card--blue100',
                  'home-mtm__card--blue300',
                  'home-surface-blue',
                  'home-surface-ink2',
                  'home-mtm__card--gold',
                  'home-mtm__card--skypale',
                ][i]
                return (
                  <div key={card.title} className={`home-mtm__card ${fill}`}>
                    <h3 className="home-card-title">{card.title}</h3>
                    <p className="home-mtm__text">{card.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Who it’s for (sky) ─────────────────────────────────────────── */}
        <section id={c.whoFor.anchor} className="home-section home-who">
          <div className="home-wrap">
            <p className="home-eyebrow home-eyebrow--onlight">{c.whoFor.eyebrow}</p>
            <h2 className="home-h2">{c.whoFor.h2}</h2>

            <div className="home-who__grid">
              {c.whoFor.cards.map((card, i) => {
                const panel = [
                  { img: HOME_IMG.isometricPort, mode: 'cover',  bg: 'var(--home-blue-100)' },
                  { img: HOME_IMG.people,        mode: 'bottom', bg: 'var(--home-blue-300)' },
                  { img: HOME_IMG.railTerminal,  mode: 'cover',  bg: 'var(--home-sky-pale)' },
                ][i]
                return (
                  <div key={card.title} className="home-who__card">
                    <div className={`home-who__panel home-who__panel--${panel.mode}`} style={{ background: panel.bg }}>
                      <img src={panel.img} alt="" />
                    </div>
                    <div className="home-who__body">
                      <p className="home-who__tag">{card.tags.join(' · ')}</p>
                      <h3 className="home-card-title">{card.title}</h3>
                      <p className="home-who__text">{card.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── The practical part (ink) ───────────────────────────────────── */}
        <section className="home-section home-practical home-surface-ink">
          <div className="home-wrap">
            <p className="home-eyebrow home-eyebrow--ondark">{c.practical.eyebrow}</p>
            <h2 className="home-h2">{c.practical.h2}</h2>

            <div className="home-practical__tiles">
              {c.practical.tiles.map((t, i) => (
                <div key={t.label} className="home-practical__tile">
                  {[<ClockIcon key="c" />, <PairIcon key="p" />, <TrioIcon key="t" />, <GlobeIcon key="g" />][i]}
                  <span className="home-practical__big">{t.big}</span>
                  <span className="home-practical__label">{t.label}</span>
                </div>
              ))}
            </div>

            <div className="home-practical__cards">
              <div className="home-provide-card">
                <h3 className="home-provide-card__title">{c.practical.weBring.title}</h3>
                <ul className="home-provide-card__list">
                  {c.practical.weBring.items.map(item => (
                    <li key={item}><CheckIcon color="var(--home-sea)" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>

              <div className="home-provide-card">
                <h3 className="home-provide-card__title">{c.practical.youProvide.title}</h3>
                <ul className="home-provide-card__list">
                  {c.practical.youProvide.items.map(item => (
                    <li key={item}><CheckIcon color="var(--home-gold)" /><span>{item}</span></li>
                  ))}
                </ul>
                <p className="home-provide-card__price">{c.practical.youProvide.price}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Request a workshop (sea) ───────────────────────────────────── */}
        <section id={c.request.anchor} className="home-section home-request">
          <div className="home-wrap home-request__grid">
            <div className="home-request__info">
              <p className="home-eyebrow home-eyebrow--onsea">{c.request.eyebrow}</p>
              <h2 className="home-h2">{c.request.h2}</h2>
              <p className="home-request__text">{c.request.text}</p>
            </div>

            <RequestForm content={c} />

            <p className="home-request__email">
              {c.request.emailPrefix}{c.request.emailName} · <a href={`mailto:${c.request.email}`}>{c.request.email}</a>
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="home-footer home-surface-ink">
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

// Request form — four Appendix A fields + consent + hidden honeypot. Posts to
// /api/contact (backend unchanged; it validates name/organisation/email/consent
// and treats everything else as optional). Keeps typed values on error.
function RequestForm({ content }) {
  const f = content.request
  const empty = { name: '', organisation: '', email: '', message: '', consent: false, website: '' }
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
    return (
      <div className="home-request__form">
        <p className="home-form__status">{f.success}</p>
      </div>
    )
  }

  return (
    <form className="home-request__form" onSubmit={handleSubmit}>
      {/* honeypot — hidden from humans; if filled, the backend silently drops it */}
      <div className="home-honeypot" aria-hidden="true">
        <label htmlFor="rf-website">Website</label>
        <input id="rf-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      <div className="home-field">
        <label htmlFor="rf-name">{f.fields.name}</label>
        <input id="rf-name" className="home-input" value={form.name} onChange={set('name')} required />
      </div>
      <div className="home-field">
        <label htmlFor="rf-org">{f.fields.organisation}</label>
        <input id="rf-org" className="home-input" value={form.organisation} onChange={set('organisation')} required />
      </div>
      <div className="home-field">
        <label htmlFor="rf-email">{f.fields.email}</label>
        <input id="rf-email" className="home-input" type="email" value={form.email} onChange={set('email')} required />
      </div>
      <div className="home-field">
        <label htmlFor="rf-message">{f.fields.message}</label>
        <textarea id="rf-message" className="home-input home-input--area" value={form.message} onChange={set('message')} />
      </div>

      <label className="home-consent">
        <input type="checkbox" checked={form.consent} onChange={set('consent')} required />
        <span>{f.consent}</span>
      </label>

      {state === 'error' && <p className="home-form__status home-form__status--err">{f.error}</p>}

      <button type="submit" className="home-btn home-request__submit" disabled={state === 'sending'}>
        {state === 'sending' ? f.sending : f.submit}
      </button>
    </form>
  )
}
