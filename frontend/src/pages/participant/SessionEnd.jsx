import { useParams, useNavigate } from 'react-router-dom'
import { COLOR, FONT, FS, FW, LS, HAIRLINE } from '../../styles/tokens.js'

export default function SessionEnd() {
  const { code } = useParams()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: COLOR.paper, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: COLOR.sky, color: COLOR.ink, padding: '48px 24px', borderBottom: HAIRLINE }}>
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16, lineHeight: 1 }}>🌍</div>
          <h1 style={{ fontWeight: FW.display, fontSize: FS.h1, letterSpacing: LS.display, lineHeight: 1.02, margin: 0 }}>
            Thank you for taking part
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', padding: '32px 24px', flex: 1 }}>
        <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, lineHeight: 1.6, margin: '0 0 28px' }}>
          Your PAR Index has been recorded.
        </p>

        <button
          onClick={() => navigate(`/session/${code}/par-result`)}
          style={{ width: '100%', height: 56, border: HAIRLINE, borderRadius: 0, background: COLOR.ink, color: COLOR.onInk, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: 'pointer' }}
        >
          View my result →
        </button>
      </div>
    </div>
  )
}
