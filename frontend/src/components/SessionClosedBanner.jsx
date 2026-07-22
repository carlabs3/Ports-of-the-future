import { useSession } from '../context/SessionContext.jsx'

export default function SessionClosedBanner({ onViewPartial }) {
  const { sessionClosed } = useSession()

  if (!sessionClosed) return null

  return (
    <div style={{
      background: '#ffffff',
      borderBottom: '1px solid #e5e5e5',
      padding: '0.7rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
      <span style={{ fontSize: '0.82rem', color: '#666', flex: 1, lineHeight: 1.5 }}>
        El facilitador ha cerrado esta sesión. Tus resultados han sido guardados.
      </span>
      {onViewPartial && (
        <button
          onClick={onViewPartial}
          style={{
            background: 'transparent',
            border: '1px solid #e5e5e5',
            color: '#0a0a0a',
            borderRadius: '999px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Ver mis resultados parciales
        </button>
      )}
    </div>
  )
}
