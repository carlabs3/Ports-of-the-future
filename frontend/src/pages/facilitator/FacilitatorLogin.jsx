import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../utils/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { HOME_IMG } from '../../assets/home/images.js'

export default function FacilitatorLogin() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { email, password })
      login(data.token, email)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pof pof-facil pof-login">
      <div className="pof-login__body">
        <div className="pof-login__card">
          <span className="pof-pill">Facilitator</span>
          <h1 className="pof-login__title">Sign in</h1>
          <p className="pof-login__help">
            For workshop facilitators. Participants join with the code on the screen.
          </p>

          {error && <div className="pof-login__error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="pof-field">
              <label className="pof-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="pof-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="facilitator@example.com"
                required
              />
            </div>
            <div className="pof-field">
              <label className="pof-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="pof-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button className="pof-btn pof-btn--primary pof-login__submit" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>

        <Link to="/" className="pof-login__back">← Back to the home page</Link>
      </div>

      <div
        className="pof-login__ship"
        role="img"
        aria-label="Illustration of a container ship at sea"
        style={{ backgroundImage: `url(${HOME_IMG.heroShip}), linear-gradient(#D9EBF9 0 77.2%, #76AFF4 77.2% 100%)` }}
      />
    </div>
  )
}
