import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket } from '../../utils/socket.js'
import api from '../../utils/api.js'
import { BACKEND_URL } from '../../utils/config.js'
import { useSession } from '../../context/SessionContext.jsx'
import { COLOR, FONT, FS, FW, LS, HAIRLINE } from '../../styles/tokens.js'

// SECURITY: this screen never receives option scores. It fetches the public
// questionnaire (texts + labels only) from the backend and submits the chosen
// optionIds; the PAR Index is computed exclusively server-side.
//
// Flow: "Before you start" (team + port size + world zone — not scored) →
// a flat walk over the 10 scored questions → submit. Team selection lives here
// now (it moved off the join screen); choosing it is the moment the participant
// "joins" (session:join emitted), and it is written into the device marker so a
// reload restores the group.

function DotsLoader() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, background: COLOR.ink,
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

// Full-width selectable row, separated by 1px rules. Selected = harbour fill,
// white text. Optional description shown muted below the label.
function SelectRow({ label, description, selected, onSelect, last }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        border: 'none', borderTop: HAIRLINE, borderBottom: last ? HAIRLINE : 'none',
        borderRadius: 0, padding: '16px 18px',
        background: selected ? COLOR.harbour : COLOR.paper,
        color: selected ? COLOR.onHarbour : COLOR.ink,
      }}
    >
      <span style={{ fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, display: 'block', lineHeight: 1.3 }}>
        {label}
      </span>
      {description && (
        <span style={{
          fontFamily: FONT.sans, fontSize: FS.sm, fontWeight: FW.regular, lineHeight: 1.4,
          display: 'block', marginTop: 4,
          color: selected ? 'rgba(255,255,255,0.85)' : COLOR.ink60,
        }}>
          {description}
        </span>
      )}
    </button>
  )
}

export default function PariCalculator() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { participantGroup, joinSession } = useSession()

  const PROGRESS_KEY = `ports_par_progress_${code}`
  const PENDING_KEY  = `ports_par_pending_${code}`

  const [questionnaire, setQuestionnaire] = useState(null)
  const [groups, setGroups]               = useState([])
  const [loadError, setLoadError]         = useState(false)
  const [reloadTick, setReloadTick]       = useState(0)

  // Navigation: 'start' (Before you start) first, then flat walk over the 10 questions.
  const [phase, setPhase]         = useState('start')
  const [stepIndex, setStepIndex] = useState(0)

  // "Before you start" (Q0) — not scored, sent as separate payload fields.
  const [team, setTeam]           = useState('')
  const [portSize, setPortSize]   = useState('')
  const [worldZone, setWorldZone] = useState('')

  // Scored answers: { questionId: optionId }
  const [answers, setAnswers]     = useState({})

  const [submitting, setSubmitting] = useState(false)

  // Guard: require an active participant marker for this session on this device.
  // Prevents a reused device from resuming a previous participant's questionnaire.
  const hasParticipant = !!localStorage.getItem(`ports_participant_${code}`)
  useEffect(() => {
    if (!hasParticipant) navigate('/join', { replace: true })
  }, [hasParticipant, navigate])

  // ── Fetch questionnaire + session groups (loader + retry on network error) ──
  useEffect(() => {
    let cancelled = false
    setLoadError(false)
    setQuestionnaire(null)
    Promise.all([
      api.get('/api/par/questionnaire'),
      api.get(`/api/sessions/${code}/info`),
    ])
      .then(([q, info]) => {
        if (cancelled) return
        setQuestionnaire(q.data)
        setGroups(info.data?.groups || [])
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [reloadTick, code])

  // ── Layer 3: retry pending submission on mount ─────────────────────────────
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
      const { phase: p, stepIndex: si, team: t, portSize: ps, worldZone: wz, answers: a } = JSON.parse(saved)
      if (p) setPhase(p === 'demographics' ? 'start' : p) // back-compat with old key
      if (typeof si === 'number') setStepIndex(si)
      if (t) setTeam(t)
      if (ps) setPortSize(ps)
      if (wz) setWorldZone(wz)
      if (a) setAnswers(a)
    } catch {
      localStorage.removeItem(PROGRESS_KEY)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save progress on every change ──────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ phase, stepIndex, team, portSize, worldZone, answers }))
  }, [phase, stepIndex, team, portSize, worldZone, answers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / error states ─────────────────────────────────────────────────
  if (!hasParticipant) return null

  if (loadError) return (
    <div style={{ minHeight: '100dvh', background: COLOR.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📡</div>
      <p style={{ fontFamily: FONT.sans, fontSize: FS.body, color: COLOR.ink60, maxWidth: 320, lineHeight: 1.6, marginBottom: '1.5rem' }}>
        We couldn't load the questionnaire. Please check your connection.
      </p>
      <button onClick={() => setReloadTick(t => t + 1)}
        style={{ background: COLOR.ink, color: COLOR.onInk, border: HAIRLINE, borderRadius: 0, padding: '14px 28px', fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  )

  if (!questionnaire) return (
    <div style={{ minHeight: '100dvh', background: COLOR.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <DotsLoader />
    </div>
  )

  const areas = questionnaire.areas || []
  const demo  = questionnaire.demographics || {}
  const hasWorldZone = Array.isArray(demo.worldZone?.options) && demo.worldZone.options.length > 0

  // Flat list of the 10 questions with their owning area (for progress labels).
  const flatQuestions = areas.flatMap((area, ai) =>
    area.questions.map(q => ({ ...q, areaIndex: ai, areaLabel: area.label }))
  )

  // ── Submit — three resilience layers (socket + HTTP keepalive + pending) ───
  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    const group = participantGroup || team // defensive: context is the committed source
    const submissionId = `${code}_${group}_${Date.now()}`
    const payload = {
      submissionId,
      sessionCode: code,
      group,
      portSize,
      worldZone,
      answers,
    }

    // Layer 1: socket (real-time + server-side persistence, emits par:result)
    socket.emit('par:submit', payload)

    // Layer 3: localStorage pending — retried on mount if the send fails
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload))

    // Layer 2: HTTP fallback with keepalive (survives a screen lock)
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

  // ── Before you start (Q0: team + port size + world zone) ───────────────────
  if (phase === 'start') {
    const canContinue = team !== '' && portSize !== '' && (!hasWorldZone || worldZone !== '')

    function startQuestionnaire() {
      if (!canContinue) return
      // Commit the team: update the device marker and join (emits session:join).
      try {
        const markerKey = `ports_participant_${code}`
        const marker = JSON.parse(localStorage.getItem(markerKey) || '{}')
        localStorage.setItem(markerKey, JSON.stringify({ ...marker, code, group: team }))
      } catch {}
      joinSession(code, 'Anonymous', team)
      setPhase('questions')
      setStepIndex(0)
    }

    const sectionLabel = {
      fontFamily: FONT.mono, fontSize: FS.label, fontWeight: FW.medium, letterSpacing: LS.mono,
      textTransform: 'uppercase', color: COLOR.ink60, margin: '0 0 12px',
    }

    return (
      <div style={{ minHeight: '100dvh', background: COLOR.paper, display: 'flex', flexDirection: 'column', fontFamily: FONT.sans }}>
        {/* Sky header */}
        <div style={{ background: COLOR.sky, color: COLOR.ink, padding: '32px 20px 28px', borderBottom: HAIRLINE }}>
          <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
            <p style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase', margin: '0 0 10px' }}>
              Before you start
            </p>
            <h1 style={{ fontWeight: FW.display, fontSize: FS.h2, letterSpacing: LS.display, lineHeight: 1.05, margin: 0 }}>
              Tell us about your port
            </h1>
          </div>
        </div>

        <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '28px 20px 140px', flex: 1 }}>
          {/* Your team */}
          <div style={{ marginBottom: 36 }}>
            <p style={sectionLabel}>Your team</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {groups.map(g => {
                const sel = team === g
                return (
                  <button key={g} type="button" onClick={() => setTeam(g)}
                    style={{
                      padding: '12px 18px', border: HAIRLINE, borderRadius: 0, cursor: 'pointer',
                      background: sel ? COLOR.harbour : COLOR.paper, color: sel ? COLOR.onHarbour : COLOR.ink,
                      fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold,
                    }}>
                    {g}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Your port size */}
          <div style={{ marginBottom: 36 }}>
            <p style={sectionLabel}>{demo.portSize?.text || 'Your port size'}</p>
            <div>
              {(demo.portSize?.options || []).map((opt, i, arr) => (
                <SelectRow key={opt.optionId}
                  label={opt.label}
                  description={opt.description}
                  selected={portSize === opt.optionId}
                  onSelect={() => setPortSize(opt.optionId)}
                  last={i === arr.length - 1}
                />
              ))}
            </div>
            <p style={{ fontFamily: FONT.sans, fontSize: FS.sm, color: COLOR.ink60, margin: '10px 0 0' }}>
              Not sure? Pick the closest.
            </p>
          </div>

          {/* World zone */}
          {hasWorldZone && (
            <div style={{ marginBottom: 8 }}>
              <p style={sectionLabel}>{demo.worldZone?.text || 'World zone'}</p>
              <div>
                {demo.worldZone.options.map((opt, i, arr) => (
                  <SelectRow key={opt.optionId}
                    label={opt.label}
                    selected={worldZone === opt.optionId}
                    onSelect={() => setWorldZone(opt.optionId)}
                    last={i === arr.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 24px', background: COLOR.paper, borderTop: HAIRLINE, zIndex: 10 }}>
          <button onClick={startQuestionnaire} disabled={!canContinue}
            style={{ display: 'block', width: '100%', maxWidth: 560, margin: '0 auto', height: 56, border: HAIRLINE, borderRadius: 0, background: canContinue ? COLOR.ink : COLOR.paper, color: canContinue ? COLOR.onInk : COLOR.ink40, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: canContinue ? 'pointer' : 'not-allowed' }}>
            Start the questionnaire →
          </button>
        </div>
      </div>
    )
  }

  // ── Questions ──────────────────────────────────────────────────────────────
  const current = flatQuestions[stepIndex]
  const total   = flatQuestions.length
  const isLast  = stepIndex === total - 1
  const canNext = answers[current.questionId] !== undefined

  function handleSelect(optionId) {
    setAnswers(prev => ({ ...prev, [current.questionId]: optionId }))
  }
  function handleNext() {
    if (!canNext) return
    if (isLast) { handleSubmit(); return }
    setStepIndex(i => i + 1)
  }
  function handlePrev() {
    if (stepIndex === 0) { setPhase('start'); return }
    setStepIndex(i => i - 1)
  }

  const qNumber = String(stepIndex + 1).padStart(2, '0')

  return (
    <div style={{ height: '100dvh', background: COLOR.paper, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FONT.sans }}>

      {/* Sky header: big question number + 10-segment progress */}
      <div style={{ background: COLOR.sky, color: COLOR.ink, borderBottom: HAIRLINE, flexShrink: 0 }}>
        <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '18px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontFamily: FONT.sans, fontWeight: FW.display, fontSize: FS.display, letterSpacing: LS.display, lineHeight: 1 }}>
              {qNumber}
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: FS.label, letterSpacing: LS.mono, textTransform: 'uppercase' }}>
              {current.areaLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {flatQuestions.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 6, background: i <= stepIndex ? COLOR.ink : 'rgba(11,27,51,0.22)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Question */}
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '24px 20px 12px', flexShrink: 0 }}>
        <p style={{ fontFamily: FONT.sans, fontSize: FS.h3, fontWeight: FW.display, color: COLOR.ink, lineHeight: 1.25, margin: 0, letterSpacing: LS.tight }}>
          {current.text}
        </p>
      </div>

      {/* Options — full-width rows separated by 1px rules */}
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '4px 20px 8px', flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {current.options.map((opt, i, arr) => (
          <SelectRow key={opt.optionId}
            label={opt.label}
            selected={answers[current.questionId] === opt.optionId}
            onSelect={() => handleSelect(opt.optionId)}
            last={i === arr.length - 1}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 24px', background: COLOR.paper, borderTop: HAIRLINE, zIndex: 10 }}>
        <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', gap: 10 }}>
          <button onClick={handlePrev}
            style={{ width: 56, height: 56, border: HAIRLINE, borderRadius: 0, background: COLOR.paper, color: COLOR.ink, fontSize: FS.h3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
          <button onClick={handleNext} disabled={!canNext || submitting}
            style={{ flex: 1, height: 56, border: HAIRLINE, borderRadius: 0, background: (canNext && !submitting) ? COLOR.ink : COLOR.paper, color: (canNext && !submitting) ? COLOR.onInk : COLOR.ink40, fontFamily: FONT.sans, fontSize: FS.body, fontWeight: FW.semibold, letterSpacing: LS.tight, cursor: (canNext && !submitting) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isLast ? (submitting ? 'Submitting…' : 'Finish →') : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
