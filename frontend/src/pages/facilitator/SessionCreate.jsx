import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api.js'
import FacilitatorLayout from '../../components/facilitator/FacilitatorLayout.jsx'

const MIN_TEAMS = 2
const MAX_TEAMS = 6 // D13: at most 6 tables, one per port

// Preview of the generated team names (the server generates the same list).
const teamNames = (count) => Array.from({ length: count }, (_, i) => `Team ${String.fromCharCode(65 + i)}`)

export default function SessionCreate() {
  const [sessionName, setSessionName] = useState('')
  const [teamCount,   setTeamCount]   = useState(3)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/api/sessions', { name: sessionName, teamCount })
      navigate(`/session/${data.code}/control`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating the session')
      setLoading(false)
    }
  }

  return (
    <FacilitatorLayout>
      <div className="pof-pagehead">
        <h1 className="pof-h1">New session</h1>
      </div>

      <div className="pof-card pof-formcard">
        <form onSubmit={handleSubmit}>
          <div className="pof-field">
            <label className="pof-label" htmlFor="sessionName">Session name</label>
            <input
              id="sessionName"
              className="pof-input"
              type="text"
              placeholder="e.g. Company X workshop — May 2026"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              maxLength={80}
            />
            <p className="pof-hint">Optional — if left empty, the code is used as the name.</p>
          </div>

          <div className="pof-field">
            <label className="pof-label">Number of teams</label>
            <div className="pof-count">
              {Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i).map(n => (
                <button
                  key={n}
                  type="button"
                  className={`pof-count__btn${teamCount === n ? ' pof-count__btn--active' : ''}`}
                  aria-pressed={teamCount === n}
                  onClick={() => setTeamCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="pof-preview">{teamNames(teamCount).join(' · ')}</p>
            <p className="pof-hint">Each team is assigned a random port, kept hidden until the Roulette.</p>
          </div>

          {error && <p className="pof-form-error">{error}</p>}

          <div className="pof-form-actions">
            <button className="pof-btn pof-btn--primary" type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create session →'}
            </button>
            <button
              className="pof-btn pof-btn--secondary"
              type="button"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </FacilitatorLayout>
  )
}
