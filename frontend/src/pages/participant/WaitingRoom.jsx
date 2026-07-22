import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../../context/SessionContext.jsx'
import { socket } from '../../utils/socket.js'
import api from '../../utils/api.js'

function DotsLoader() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: '#0a0a0a',
          animation: `wrdot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes wrdot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

export default function WaitingRoom() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { participantGroup } = useSession()

  useEffect(() => {
    function onStepChange({ step }) {
      console.log('[WaitingRoom] step:change received', step)
      if (step >= 2) navigate(`/session/${code}/calculator`, { replace: true })
    }
    function onResultsRevealed() {
      navigate(`/session/${code}/results`, { replace: true })
    }
    function onSessionClosed() {
      navigate(`/session/${code}/end`, { replace: true })
    }

    socket.on('step:change', onStepChange)
    socket.on('results:revealed', onResultsRevealed)
    socket.on('session:closed', onSessionClosed)

    // Polling fallback: if the socket event was missed, detect via API every 3 s
    const poll = setInterval(async () => {
      try {
        const res = await api.get(`/api/sessions/${code}/info`)
        const { currentStep, resultsRevealed, status } = res.data
        if (resultsRevealed) {
          navigate(`/session/${code}/results`, { replace: true })
        } else if (currentStep >= 2) {
          navigate(`/session/${code}/calculator`, { replace: true })
        } else if (status === 'closed') {
          navigate('/', { replace: true })
        }
      } catch {}
    }, 3000)

    return () => {
      socket.off('step:change', onStepChange)
      socket.off('results:revealed', onResultsRevealed)
      socket.off('session:closed', onSessionClosed)
      clearInterval(poll)
    }
  }, [code, navigate])

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      background: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{
        fontWeight: 900, fontSize: '1rem', letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#0a0a0a', marginBottom: '2.5rem',
      }}>
        CO2 SPRINT *
      </div>

      <div style={{
        background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '16px',
        padding: '32px', maxWidth: '390px', width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem', lineHeight: 1 }}>🌿</div>

        <h1 style={{
          fontWeight: 900, fontSize: '1.35rem', textTransform: 'uppercase',
          marginBottom: '0.75rem', color: '#0a0a0a', letterSpacing: '0.02em',
        }}>
          Esperando al facilitador...
        </h1>

        <p style={{
          fontSize: '0.88rem', color: '#666',
          maxWidth: 320, lineHeight: 1.65, marginBottom: '2rem', margin: '0 0 2rem',
        }}>
          El taller comenzará en breve. Mantén esta pantalla abierta.
        </p>

        {participantGroup && (
          <div style={{
            background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 999,
            padding: '0.45rem 1.25rem', fontSize: '0.8rem', fontWeight: 700,
            color: '#0a0a0a', letterSpacing: '0.04em', marginBottom: '2.5rem',
          }}>
            Estás en el {participantGroup}
          </div>
        )}

        <DotsLoader />
      </div>
    </div>
  )
}
