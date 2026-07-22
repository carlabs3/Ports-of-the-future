import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const styles = {
  nav: {
    height: '52px',
    background: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontWeight: 700,
    fontSize: '1.5rem',
    letterSpacing: '-0.02em',
    color: '#ffffff',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  link: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)',
    textDecoration: 'none',
  },
  btnPill: {
    background: '#ffffff',
    color: '#000000',
    padding: '0.4rem 1.1rem',
    fontSize: '0.82rem',
    borderRadius: '999px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
  btnSalir: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    padding: '0.4rem 0.75rem',
    fontSize: '0.82rem',
    borderRadius: '6px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
  },
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.logo}>
        Drop.
      </Link>
      <div style={styles.links}>
        {user ? (
          <>
            <Link to="/dashboard" style={styles.link}>Sesiones</Link>
            <Link to="/session/create">
              <button style={styles.btnPill}>Nueva sesión</button>
            </Link>
            <button style={styles.btnSalir} onClick={handleLogout}>Salir</button>
          </>
        ) : null}
      </div>
    </nav>
  )
}