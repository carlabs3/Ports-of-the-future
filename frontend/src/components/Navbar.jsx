import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { COLOR, FONT, FS, FW, HAIRLINE } from '../styles/tokens.js'

// The admin navbar shows ONLY on the landing-free admin routes. Everywhere else
// — the landing, the projected control centre, and every participant screen —
// has its own header in the Swiss design, so a second bar (and a stray "Log
// out"/logo-link that could let a participant leave mid-questionnaire) is
// hidden. Keep NAV_HEIGHT in sync with the calc(100vh - …) on SessionCreate.
export const NAV_HEIGHT = 56
const SHOW_ON = ['/login', '/dashboard', '/session/create']

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (!SHOW_ON.includes(pathname)) return null

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const sessionsActive = pathname === '/dashboard'

  return (
    <nav style={{
      height: NAV_HEIGHT, background: COLOR.paper, borderBottom: HAIRLINE,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 2rem', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link to="/" style={{
        fontFamily: FONT.sans, fontWeight: FW.display, fontSize: '22px',
        letterSpacing: '-0.02em', color: COLOR.ink, textDecoration: 'none',
      }}>
        Ports of the Future
      </Link>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/dashboard" style={{
            fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold,
            color: COLOR.ink, textDecoration: 'none',
            paddingBottom: 4, borderBottom: sessionsActive ? `4px solid ${COLOR.harbour}` : '4px solid transparent',
          }}>
            Sessions
          </Link>
          <Link to="/session/create" style={{ textDecoration: 'none' }}>
            <button style={{
              background: COLOR.ink, color: COLOR.onInk, border: HAIRLINE, borderRadius: 0,
              padding: '10px 18px', fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.semibold,
              cursor: 'pointer',
            }}>
              New session
            </button>
          </Link>
          <button onClick={handleLogout} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: FONT.mono, fontSize: '13px', color: COLOR.ink,
          }}>
            Log out
          </button>
        </div>
      )}
    </nav>
  )
}
