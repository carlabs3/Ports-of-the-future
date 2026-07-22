export default function WaitingForFacilitator({ message = 'Espera al facilitador para continuar...' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', textAlign: 'center', padding: '2rem',
      background: 'transparent',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
      <p style={{ fontSize: '15px', fontWeight: 500, color: '#0a0a0a', marginBottom: '8px' }}>
        {message}
      </p>
      <p style={{ fontSize: '13px', color: '#999', marginBottom: '28px' }}>
        El facilitador está preparando la siguiente fase
      </p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: '#0a0a0a',
            animation: `wff_dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
        <style>{`
          @keyframes wff_dot {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40%            { opacity: 1;   transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  )
}
