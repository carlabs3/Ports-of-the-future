import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

// Shell for the signed-in facilitator pages (dashboard, session creation).
// Provides the `.pof` brand scope, `.pof-facil` component/focus scope, the 64px
// header and the 1240px content container. Login is standalone and does NOT use
// this. Logout reuses the exact AuthContext logic the old Navbar used.
export default function FacilitatorLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="pof pof-facil pof-shell">
      <header className="pof-shell__header">
        <div className="pof-shell__header-inner">
          <div className="pof-brand-wrap">
            <Link to="/" className="pof-brand">Ports of the Future</Link>
            <span className="pof-pill">Facilitator</span>
          </div>
          <div className="pof-shell__user">
            {user?.email && <span className="pof-shell__email">{user.email}</span>}
            <button type="button" className="pof-shell__logout" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </header>
      <main className="pof-shell__main">{children}</main>
    </div>
  )
}
