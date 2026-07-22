import { useParams, useNavigate } from 'react-router-dom'

export default function SessionEnd() {
  const { code } = useParams()
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      background: '#f5f5f5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2.5rem 2rem', textAlign: 'center',
    }}>
      <div style={{
        background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '16px',
        padding: '32px', maxWidth: '390px', width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem', lineHeight: 1 }}>🌍</div>

        <h1 style={{
          fontWeight: 900, fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: '#0a0a0a', marginBottom: '0.6rem',
        }}>
          ¡Gracias por participar!
        </h1>

        <p style={{ fontSize: '0.95rem', color: '#666', maxWidth: 320, lineHeight: 1.65, marginBottom: '2rem' }}>
          Tu huella de carbono ha quedado registrada.
        </p>

        <button
          onClick={() => navigate(`/session/${code}/results`)}
          style={{
            background: '#0a0a0a', color: '#fff', border: 'none',
            padding: '0.9rem 2rem', borderRadius: '999px',
            fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', cursor: 'pointer', marginBottom: '2.5rem',
          }}
        >
          Ver mi huella →
        </button>

        <p style={{ fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>
          Pequeños cambios, gran impacto.
        </p>
      </div>
    </div>
  )
}
