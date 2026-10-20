import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket } from '../../utils/socket.js'
import api from '../../utils/api.js'
import { BACKEND_URL } from '../../utils/config.js'
import { useSession } from '../../context/SessionContext.jsx'

// SECURITY: this screen never receives option scores. It fetches the public
// questionnaire (texts + labels only) from the backend and submits the chosen
// optionIds; the PAR Index is computed exclusively server-side.

const BORDER = '#e5e5e5'

// Visual palette per PAR area (by order). Backend labels are authoritative.
const AREA_COLORS = ['#38bdf8', '#f59e0b', '#4ade80', '#a855f7', '#f472b6']

// Single source for the port-navy selected state (Q0 demographics only).
const PORTS_BLUE = '#1B4B7A'

function DotsLoader() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: '#0a0a0a',
          animation: `paridot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes paridot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// Single-choice option list — reuses the calculator's grotesk card language.
// `selectedText` is the label/dot colour when selected (defaults to the dark
// text used on the light per-area colours; demographics pass white for the
// navy pill so it stays legible).
function OptionList({ options, selected, onSelect, color, selectedText = 'rgba(0,0,0,0.8)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => {
        const isSel = selected === opt.optionId
        return (
          <button key={opt.optionId} onClick={() => onSelect(opt.optionId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
              borderRadius: 12, width: '100%', textAlign: 'left',
              border: `1px solid ${isSel ? color : BORDER}`,
              background: isSel ? color : '#fff', cursor: 'pointer',
              transition: 'background 0.18s ease, border-color 0.18s ease',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${isSel ? color : '#ccc'}`,
              background: isSel ? color : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isSel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: selectedText }} />}
            </div>
            <span style={{ fontSize: 15, fontWeight: isSel ? 500 : 400, color: isSel ? selectedText : '#555', lineHeight: 1.4 }}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function PariCalculator() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { participantGroup } = useSession()

  const PROGRESS_KEY = `ports_par_progress_${code}`
  const PENDING_KEY  = `ports_par_pending_${code}`

  const [questionnaire, setQuestionnaire] = useState(null)
  const [loadError, setLoadError]         = useState(false)
  const [reloadTick, setReloadTick]       = useState(0)

  // Navigation: 'demographics' first, then flat walk over the 10 questions.
  const [phase, setPhase]         = useState('demographics')
  const [stepIndex, setStepIndex] = useState(0)

  // Demographics (Q0) — not scored, sent as separate payload fields.
  const [portSize, setPortSize]   = useState('')
  const [worldZone, setWorldZone] = useState('')

  // Scored answers: { questionId: optionId }
  const [answers, setAnswers]     = useState({})

  const [submitting, setSubmitting] = useState(false)

  // Guard: require an active participant for this session on this device.
  // Prevents a reused device from resuming a previous participant's questionnaire.
  const hasParticipant = !!localStorage.getItem(`ports_participant_${code}`)
  useEffect(() => {
    if (!hasParticipant) navigate('/join', { replace: true })
  }, [hasParticipant, navigate])

  // ── Fetch questionnaire (loader + retry on network error) ──────────────────
  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    setQuestionnaire(null)
    api.get('/api/par/questionnaire')
      .then(res => { if (!cancelled) setQuestionnaire(res.data) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [reloadTick])

  // ── Capa 3: retry pending submission on mount ──────────────────────────────
  useEffect(() => {
    const pending = localStorage.getItem(PENDING_KEY)
    if (!pending) return
    try {
      const payload = JSON.parse(pending)
      fetch(`${BACKEND_URL}/api/par/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).then(r => { if (r.ok) localStorage.removeItem(PENDING_KEY) }).catch(() => {})
    } catch {
      localStorage.removeItem(PENDING_KEY)
    }
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore progress on mount ──────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_KEY)
    if (!saved) return
    try {
      const { phase: p, stepIndex: si, portSize: ps, worldZone: wz, answers: a } = JSON.parse(saved)
      if (p) setPhase(p)
      if (typeof si === 'number') setStepIndex(si)
      if (ps) setPortSize(ps)
      if (wz) setWorldZone(wz)
      if (a) setAnswers(a)
    } catch {
      localStorage.removeItem(PROGRESS_KEY)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save progress on every change ──────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ phase, stepIndex, portSize, worldZone, answers }))
  }, [phase, stepIndex, portSize, worldZone, answers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / error states ─────────────────────────────────────────────────
  if (!hasParticipant) return null

  if (loadError) return (
    <div style={{ minHeight: 'calc(100dvh - 52px)', background: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📡</div>
      <p style={{ fontSize: 15, color: '#444', maxWidth: 320, lineHeight: 1.6, marginBottom: '1.5rem' }}>
        We couldn't load the questionnaire. Please check your connection.
      </p>
      <button onClick={() => setReloadTick(t => t + 1)}
        style={{ background: '#0a0a0a', color: '#f5f5f5', border: 'none', borderRadius: 999, padding: '12px 28px', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  )

  if (!questionnaire) return (
    <div style={{ minHeight: 'calc(100dvh - 52px)', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <DotsLoader />
    </div>
  )

  const areas = questionnaire.areas || []
  const demo  = questionnaire.demographics || {}
  const hasWorldZone = Array.isArray(demo.worldZone?.options) && demo.worldZone.options.length > 0

  // Flat list of the 10 questions with their owning area (for tabs/progress).
  const flatQuestions = areas.flatMap((area, ai) =>
    area.questions.map(q => ({ ...q, areaIndex: ai, areaLabel: area.label, color: AREA_COLORS[ai % AREA_COLORS.length] }))
  )

  // ── Submit — three resilience layers (socket + HTTP keepalive + pending) ───
  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const submissionId = `${code}_${participantGroup}_${Date.now()}`
    const payload = {
      submissionId,
      sessionCode: code,
      group: participantGroup,
      portSize,
      worldZone,
      answers,
    }

    // Capa 1: socket (tiempo real + persistencia server-side, emite par:result)
    socket.emit('par:submit', payload)

    // Capa 3: localStorage pending — se reintenta al montar si el envío falla
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload))

    // Capa 2: HTTP de respaldo con keepalive (sobrevive al bloqueo de pantalla)
    let result = null
    try {
      const res = await fetch(`${BACKEND_URL}/api/par/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      })
      if (res.ok) {
        localStorage.removeItem(PENDING_KEY)
        const data = await res.json().catch(() => null)
        result = data?.result || null
      }
    } catch {}

    localStorage.removeItem(PROGRESS_KEY)
    // Pass the result via state if we have it; otherwise PariResult receives it
    // via the 'par:result' socket event.
    navigate(`/session/${code}/par-result`, { state: result || undefined })
  }

  // ── Demographics (Q0) ──────────────────────────────────────────────────────
  if (phase === 'demographics') {
    const canContinue = portSize !== '' && (!hasWorldZone || worldZone !== '')
    return (
      <div style={{ minHeight: 'calc(100dvh - 52px)', background: '#f5f5f5', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '28px 18px 120px', flex: 1 }}>
          <p style={{ fontSize: 12, color: '#999', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
            Before you start
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#0a0a0a', margin: '0 0 24px' }}>
            Tell us about your port
          </h1>

          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#0a0a0a', margin: '0 0 12px', lineHeight: 1.4 }}>
              {demo.portSize?.text || 'Port size'}
            </p>
            <OptionList
              options={demo.portSize?.options || []}
              selected={portSize}
              onSelect={setPortSize}
              color={PORTS_BLUE}
              selectedText="#fff"
            />
          </div>

          {hasWorldZone && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#0a0a0a', margin: '0 0 12px', lineHeight: 1.4 }}>
                {demo.worldZone?.text || 'World zone'}
              </p>
              <OptionList
                options={demo.worldZone.options}
                selected={worldZone}
                onSelect={setWorldZone}
                color={PORTS_BLUE}
                selectedText="#fff"
              />
            </div>
          )}
        </div>

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '10px 16px 24px', display: 'flex', background: '#f5f5f5', borderTop: `1px solid ${BORDER}`, zIndex: 10 }}>
          <button onClick={() => { setPhase('questions'); setStepIndex(0) }} disabled={!canContinue}
            style={{ flex: 1, maxWidth: 560, margin: '0 auto', height: 48, borderRadius: 999, border: 'none', background: canContinue ? '#0a0a0a' : '#e5e5e5', color: canContinue ? '#f5f5f5' : '#bbb', fontSize: 16, fontWeight: 500, cursor: canContinue ? 'pointer' : 'default' }}>
            Start the questionnaire →
          </button>
        </div>
      </div>
    )
  }

  // ── Questions ──────────────────────────────────────────────────────────────
  const current   = flatQuestions[stepIndex]
  const areaColor = current.color
  const isLast    = stepIndex === flatQuestions.length - 1
  const canNext   = answers[current.questionId] !== undefined

  function handleSelect(optionId) {
    setAnswers(prev => ({ ...prev, [current.questionId]: optionId }))
  }
  function handleNext() {
    if (!canNext) return
    if (isLast) { handleSubmit(); return }
    setStepIndex(i => i + 1)
  }
  function handlePrev() {
    if (stepIndex === 0) { setPhase('demographics'); return }
    setStepIndex(i => i - 1)
  }

  // Progress within the current area
  const areaQuestions = areas[current.areaIndex].questions
  const qWithinArea = areaQuestions.findIndex(q => q.questionId === current.questionId)

  return (
    <div style={{ height: 'calc(100dvh - 52px)', background: '#f5f5f5', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>

      {/* Area tabs (numbered) */}
      <div style={{ display: 'flex', padding: '0 16px', borderBottom: `1px solid ${BORDER}`, background: '#f5f5f5', flexShrink: 0 }}>
        {areas.map((a, ai) => {
          const done = a.questions.every(q => answers[q.questionId] !== undefined)
          const active = ai === current.areaIndex
          const on = active || done
          return (
            <div key={a.id} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 0', background: on ? AREA_COLORS[ai % AREA_COLORS.length] : 'transparent', opacity: on ? 1 : 0.35, transition: 'background 0.2s ease' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: on ? 'rgba(0,0,0,0.8)' : '#999' }}>{ai + 1}</span>
            </div>
          )
        })}
      </div>

      {/* Progress */}
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '18px 18px 0', flexShrink: 0 }}>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 6, letterSpacing: '0.01em' }}>
          {current.areaLabel} · Question {qWithinArea + 1} of {areaQuestions.length}
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          {areaQuestions.map((q, qi) => (
            <div key={q.questionId} style={{ flex: 1, height: 2.5, borderRadius: 2, background: qi <= qWithinArea ? areaColor : BORDER }} />
          ))}
        </div>
      </div>

      {/* Question */}
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '18px 18px', flexShrink: 0 }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: '#0a0a0a', lineHeight: 1.4, margin: 0, letterSpacing: '-0.01em' }}>
          {current.text}
        </p>
      </div>

      {/* Options */}
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '0 18px 8px', flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        <OptionList
          options={current.options}
          selected={answers[current.questionId]}
          onSelect={handleSelect}
          color={areaColor}
        />
      </div>

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '10px 16px 24px', display: 'flex', gap: 8, background: '#f5f5f5', borderTop: `1px solid ${BORDER}`, zIndex: 10 }}>
        <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', gap: 8 }}>
          <button onClick={handlePrev}
            style={{ width: 48, height: 48, borderRadius: 999, border: `1px solid ${BORDER}`, background: '#fff', color: '#0a0a0a', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
          <button onClick={handleNext} disabled={!canNext || submitting}
            style={{ flex: 1, height: 48, borderRadius: 999, border: 'none', background: (canNext && !submitting) ? '#0a0a0a' : '#e5e5e5', color: (canNext && !submitting) ? '#f5f5f5' : '#bbb', fontSize: 18, fontWeight: 500, cursor: (canNext && !submitting) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isLast ? (submitting ? 'Submitting...' : '✓ Finish') : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
