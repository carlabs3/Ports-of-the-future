import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket } from '../../utils/socket.js'
import api from '../../utils/api.js'
import { useSession } from '../../context/SessionContext.jsx'
import SessionClosedBanner from '../../components/SessionClosedBanner.jsx'
import { AREA_QUESTIONS } from '../../utils/answerLabels.js'
import { calculator } from '../../utils/calculator.js'

const AREA_VISUAL = {
  transport:   { color: '#38bdf8', bg: '#e8f2fd', iconBg: '#d0e8f8' },
  energy:      { color: '#f59e0b', bg: '#fff8ec', iconBg: '#fff3d6' },
  food:        { color: '#4ade80', bg: '#f0f7ee', iconBg: '#e0f0dc' },
  consumption: { color: '#a855f7', bg: '#fdf4e8', iconBg: '#f5e6cc' },
  waste:       { color: '#f472b6', bg: '#f0f0f8', iconBg: '#e0e0f0' },
}
const AREA_ICON_URLS = {
  transport:   '/icons/transport.svg',
  energy:      '/icons/energy.svg',
  food:        '/icons/food.svg',
  consumption: '/icons/consumption.svg',
  waste:       '/icons/waste.svg',
}

const AREAS = AREA_QUESTIONS.map(a => ({
  id: a.areaId,
  label: a.areaLabel,
  questions: a.questions,
  ...AREA_VISUAL[a.areaId],
}))

function DotsLoader() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: '#0a0a0a',
          animation: `calcdot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes calcdot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

const homeTypeLabels = {
  '25a': 'piso pequeño (~45 m²)',
  '25b': 'piso mediano (~120 m²)',
  '25c': 'casa grande (más de 180 m²)',
}

function NightsInput({ question, answers, onChange, unit = 'noches' }) {
  const handleChange = (value, delta) => {
    const current = answers[value] || 0
    const newVal = Math.max(0, current + delta)
    onChange({ ...answers, [value]: newVal })
  }

  const totalNights = question.options.reduce((sum, opt) => sum + (answers[opt.value] || 0), 0)

  return (
    <div>
      {question.options.map(opt => (
        <div key={opt.value} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '12px', marginBottom: '6px',
          border: `1px solid ${(answers[opt.value] || 0) > 0 ? '#0a0a0a' : '#e5e5e5'}`,
          background: '#ffffff',
        }}>
          <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{opt.emoji}</span>
          <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: '#0a0a0a' }}>{opt.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => handleChange(opt.value, -1)}
              style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1.5px solid #0a0a0a', background: 'transparent', color: '#0a0a0a', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: '15px', fontWeight: 700, width: '24px', textAlign: 'center' }}>
              {answers[opt.value] || 0}
            </span>
            <button onClick={() => handleChange(opt.value, 1)}
              style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1.5px solid #0a0a0a', background: 'transparent', color: '#0a0a0a', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
          <span style={{ fontSize: '10px', color: '#aaa', width: '32px' }}>{unit}</span>
        </div>
      ))}
      {totalNights > 0 && (
        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '8px 12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#888' }}>Total {unit}</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0a0a0a' }}>{totalNights} {unit}</span>
        </div>
      )}
    </div>
  )
}

function DrinksInput({ question, answers, onChange }) {
  const handleChange = (value, delta) => {
    const current = answers[value] || 0
    const newVal = Math.max(0, current + delta)
    onChange({ ...answers, [value]: newVal })
  }

  const total = question.options.reduce((s, o) => s + (answers[o.value] || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {question.options.map(opt => {
        const val = answers[opt.value] || 0
        const active = val > 0
        return (
          <div key={opt.value} style={{
            background: '#fff',
            border: `1px solid ${active ? '#0a0a0a' : '#e5e5e5'}`,
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{opt.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#0a0a0a' }}>{opt.label}</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{opt.sublabel}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={() => handleChange(opt.value, -1)} style={{
                width: 26, height: 26, borderRadius: '50%',
                border: '1.5px solid #0a0a0a', background: 'transparent',
                color: '#0a0a0a', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: val === 0 ? 'default' : 'pointer', opacity: val === 0 ? 0.3 : 1,
              }}>−</button>
              <div style={{ textAlign: 'center', minWidth: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0a' }}>{val}</div>
                <div style={{ fontSize: 9, color: '#aaa' }}>por sem.</div>
              </div>
              <button onClick={() => handleChange(opt.value, 1)} style={{
                width: 26, height: 26, borderRadius: '50%',
                border: '1.5px solid #0a0a0a', background: 'transparent',
                color: '#0a0a0a', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>+</button>
            </div>
          </div>
        )
      })}
      {total > 0 && (
        <div style={{
          background: '#f5f5f5', borderRadius: 8, padding: '7px 12px',
          display: 'flex', justifyContent: 'space-between', marginTop: 2,
        }}>
          <span style={{ fontSize: 11, color: '#aaa' }}>Total por semana</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0a0a0a' }}>{total} bebidas</span>
        </div>
      )}
    </div>
  )
}

function isWeekDistributionValid(question, answers) {
  const dist = answers[question.id] || {}
  const total = Object.values(dist).reduce((s, v) => s + (Number(v) || 0), 0)
  return total === 7
}

function WeekDistributionInput({ question, answers, onChange }) {
  const dist = answers[question.id] || {}
  const maxDays = question.maxDays || 7
  const total = Object.values(dist).reduce((s, v) => s + v, 0)
  const isValid = total === maxDays

  function handleChange(value, delta) {
    const current = dist[value] || 0
    const newVal = Math.max(0, current + delta)
    if (delta > 0 && total >= maxDays) return
    onChange({ ...answers, [question.id]: { ...dist, [value]: newVal } })
  }

  return (
    <div>
      <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#888' }}>{total} / {maxDays} días</span>
        {isValid
          ? <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Completo</span>
          : <span style={{ fontSize: 11, color: '#f59e0b' }}>Distribuye los {maxDays} días</span>
        }
      </div>
      {question.options.map(opt => {
        const val = dist[opt.value] || 0
        const active = val > 0
        return (
          <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, marginBottom: 6, border: `1px solid ${active ? '#0a0a0a' : '#e5e5e5'}`, background: '#ffffff' }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#0a0a0a', lineHeight: 1.3 }}>{opt.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={() => handleChange(opt.value, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #0a0a0a', background: 'transparent', color: '#0a0a0a', fontSize: 14, fontWeight: 600, cursor: val === 0 ? 'default' : 'pointer', opacity: val === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ fontSize: 15, fontWeight: 700, width: 20, textAlign: 'center' }}>{val}</span>
              <button onClick={() => handleChange(opt.value, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #0a0a0a', background: 'transparent', color: '#0a0a0a', fontSize: 14, fontWeight: 600, cursor: total >= maxDays ? 'default' : 'pointer', opacity: total >= maxDays ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
            <span style={{ fontSize: 10, color: '#aaa', width: 26, textAlign: 'right' }}>días</span>
          </div>
        )
      })}
      {question.allowDouble && (
        <div
          onClick={() => onChange({ ...answers, breakfastDouble: !answers.breakfastDouble })}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 12, marginTop: 8,
            border: `1px solid ${answers.breakfastDouble ? '#e8a020' : '#e5e5e5'}`,
            background: answers.breakfastDouble ? '#fff8ec' : '#fff',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: `1.5px solid ${answers.breakfastDouble ? '#e8a020' : '#ccc'}`,
            background: answers.breakfastDouble ? '#e8a020' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {answers.breakfastDouble && (
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>
            )}
          </div>
          <span style={{ fontSize: 14, color: answers.breakfastDouble ? '#e8a020' : '#666' }}>
            También almuerzo a media mañana
          </span>
        </div>
      )}
    </div>
  )
}

function DailyCountInput({ question, answers, onChange }) {
  const counts = answers[question.id] || {}
  const noneOption = question.options.find(o => o.isNone)
  const noneActive = noneOption ? (counts[noneOption.value] || 0) > 0 : false
  const total = Object.entries(counts)
    .filter(([k]) => !noneOption || k !== noneOption.value)
    .reduce((s, [, v]) => s + v, 0)

  function handleChange(value, delta) {
    const current = counts[value] || 0
    const newVal = Math.max(0, current + delta)
    if (noneOption && value === noneOption.value) {
      if (newVal > 0) {
        const newCounts = {}
        question.options.forEach(o => { newCounts[o.value] = 0 })
        newCounts[noneOption.value] = 1
        onChange({ ...answers, [question.id]: newCounts })
      } else {
        onChange({ ...answers, [question.id]: { ...counts, [value]: 0 } })
      }
      return
    }
    const newCounts = { ...counts, [value]: newVal }
    if (noneOption && newVal > 0) newCounts[noneOption.value] = 0
    onChange({ ...answers, [question.id]: newCounts })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {total > 0 && (
        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: '#aaa' }}>Total al día</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0a0a0a' }}>{total} bebida{total !== 1 ? 's' : ''}</span>
        </div>
      )}
      {question.options.map(opt => {
        const val = counts[opt.value] || 0
        const active = val > 0
        const isNoneOpt = opt.isNone
        return (
          <div key={opt.value} style={{ background: '#fff', border: `1px solid ${active ? '#0a0a0a' : '#e5e5e5'}`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#0a0a0a' }}>{opt.label}</span>
            {isNoneOpt ? (
              <button onClick={() => handleChange(opt.value, active ? -1 : 1)} style={{ padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${active ? '#0a0a0a' : '#e5e5e5'}`, background: active ? '#0a0a0a' : 'transparent', color: active ? '#fff' : '#0a0a0a', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {active ? '✓' : 'Seleccionar'}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleChange(opt.value, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #0a0a0a', background: 'transparent', color: '#0a0a0a', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: val === 0 ? 'default' : 'pointer', opacity: val === 0 ? 0.3 : 1 }}>−</button>
                <div style={{ textAlign: 'center', minWidth: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0a' }}>{val}</div>
                  <div style={{ fontSize: 9, color: '#aaa' }}>por día</div>
                </div>
                <button onClick={() => handleChange(opt.value, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #0a0a0a', background: 'transparent', color: '#0a0a0a', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: noneActive ? 'default' : 'pointer', opacity: noneActive ? 0.3 : 1 }}>+</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StepperInput({ question, answers, onChange }) {
  const val = answers[question.id] || 0
  const min = question.min ?? 0
  const max = question.max ?? 20
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <button onClick={() => onChange({ ...answers, [question.id]: Math.max(min, val - 1) })}
          style={{ width: 48, height: 48, borderRadius: '50%', border: '1.5px solid #0a0a0a', background: 'transparent', color: '#0a0a0a', fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: val === min ? 'default' : 'pointer', opacity: val === min ? 0.3 : 1 }}>−</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: '#0a0a0a', lineHeight: 1 }}>{val}</div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>por semana</div>
        </div>
        <button onClick={() => onChange({ ...answers, [question.id]: Math.min(max, val + 1) })}
          style={{ width: 48, height: 48, borderRadius: '50%', border: '1.5px solid #0a0a0a', background: 'transparent', color: '#0a0a0a', fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: val === max ? 'default' : 'pointer', opacity: val === max ? 0.3 : 1 }}>+</button>
      </div>
    </div>
  )
}

// Grotesk card style — black on select, white on light background
const CREAM = '#f5f5f5'
const BORDER = '#e5e5e5'

function groteskCard(isSel, isNone = false, areaColor = '#0a0a0a', extra = {}) {
  return {
    gridColumn: isNone ? 'span 2' : 'span 1',
    background: isSel ? areaColor : '#ffffff',
    border: `1px solid ${isSel ? areaColor : BORDER}`,
    borderRadius: 14,
    padding: '16px 10px',
    fontSize: 14,
    fontWeight: isSel ? 500 : 400,
    color: isSel ? 'rgba(0,0,0,0.75)' : '#0a0a0a',
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    textAlign: 'center',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.18s ease, border-color 0.18s ease, color 0.15s ease',
    ...extra,
  }
}

function OptionList({ question, area, answers, onSelect, onToggle, compact }) {
  if (question.type === 'multi') {
    const selected = Array.isArray(answers[question.id]) ? answers[question.id] : []

    if (compact) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {question.options.map(opt => {
              const isSel = selected.includes(opt.value)
              const isNone = opt.value === question.noneValue
              return (
                <button key={opt.value} onClick={() => onToggle(question.id, opt.value)}
                  style={groteskCard(isSel, isNone, area.color)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: '#bbb', margin: '2px 0 0', fontStyle: 'italic', fontWeight: 400 }}>
            {selected.length === 0 ? 'Si no aplica ninguna, continúa sin marcar.' : `${selected.length} seleccionado${selected.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      )
    }

    // Desktop multi — list with checkboxes, grotesk palette
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {question.options.map(opt => {
          const isSel = selected.includes(opt.value)
          return (
            <button key={opt.value} onClick={() => onToggle(question.id, opt.value)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, width: '100%', textAlign: 'left', border: `1px solid ${isSel ? area.color : BORDER}`, background: isSel ? area.color : '#fff', cursor: 'pointer', transition: 'background 0.18s ease, border-color 0.18s ease' }}
            >
              <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${isSel ? area.color : '#ccc'}`, background: isSel ? area.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSel && <span style={{ color: 'rgba(0,0,0,0.75)', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: 14, fontWeight: isSel ? 500 : 400, color: isSel ? 'rgba(0,0,0,0.75)' : '#666', lineHeight: 1.4, letterSpacing: '-0.01em' }}>{opt.label}</span>
            </button>
          )
        })}
        <p style={{ fontSize: 11, color: '#bbb', margin: '2px 0 0', fontStyle: 'italic', fontWeight: 400 }}>
          {selected.length === 0 ? 'Si no aplica ninguna, continúa sin marcar.' : `${selected.length} seleccionado${selected.length !== 1 ? 's' : ''}`}
        </p>
      </div>
    )
  }

  // Single
  const currentAnswer = answers[question.id]

  if (compact) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {question.options.map(opt => {
          const isSel = currentAnswer === opt.value
          const isNone = opt.value === question.noneValue
          return (
            <button key={opt.value} onClick={() => onSelect(question.id, opt.value)}
              style={groteskCard(isSel, isNone, area.color)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  // Desktop single — 2 cols for 4+ options, grotesk palette
  const cols = question.options.length >= 4 ? 2 : 1
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 7 }}>
      {question.options.map(opt => {
        const isSel = currentAnswer === opt.value
        return (
          <button key={opt.value} onClick={() => onSelect(question.id, opt.value)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, width: '100%', textAlign: 'left', border: `1px solid ${isSel ? area.color : BORDER}`, background: isSel ? area.color : '#fff', cursor: 'pointer', transition: 'background 0.18s ease, border-color 0.18s ease' }}
          >
            <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${isSel ? area.color : '#ccc'}`, background: isSel ? area.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isSel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(0,0,0,0.75)' }} />}
            </div>
            <span style={{ fontSize: 14, fontWeight: isSel ? 500 : 400, color: isSel ? 'rgba(0,0,0,0.75)' : '#666', lineHeight: 1.4 }}>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function Step2Calculator() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { participantGroup, participantName, participantAge, participantGender } = useSession()

  const [showIntro, setShowIntro]         = useState(true)
  const [areaIndex, setAreaIndex]         = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers]             = useState({})
  const [isMobile, setIsMobile]           = useState(() => window.innerWidth <= 768)
  const STORAGE_KEY                       = `co2sprint_progress_${code}`
  const PARTICIPANT_KEY                   = `co2sprint_participant_${code}`

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Retry pending submission on mount (capa 3 — localStorage)
  useEffect(() => {
    const pendingKey = `co2sprint_pending_${code}`
    const pending = localStorage.getItem(pendingKey)
    if (!pending) return
    try {
      const payload = JSON.parse(pending)
      fetch(`${import.meta.env.VITE_BACKEND_URL}/api/results/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).then(r => { if (r.ok) localStorage.removeItem(pendingKey) }).catch(() => {})
    } catch {
      localStorage.removeItem(pendingKey)
    }
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore progress on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const { answers: a, areaIndex: ai, questionIndex: qi } = JSON.parse(saved)
      if (a && Object.keys(a).length > 0) setShowIntro(false)
      setAnswers(a || {})
      setAreaIndex(ai || 0)
      setQuestionIndex(qi || 0)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save progress on every change (never remove here — server confirms via footprint:saved)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, areaIndex, questionIndex }))
  }, [answers, areaIndex, questionIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onFootprintSaved() {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(PARTICIPANT_KEY)
    }
    socket.on('footprint:saved', onFootprintSaved)
    return () => {
      socket.off('footprint:saved', onFootprintSaved)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function isSkipped(q) {
    if (q.showIf) return !q.showIf(answers)
    return false
  }

  const area     = AREAS[areaIndex]
  const question = area.questions[questionIndex]
  const isFirst  = areaIndex === 0 && questionIndex === 0
  const isLast   = areaIndex === AREAS.length - 1 && questionIndex === area.questions.length - 1
  const canNext  = isSkipped(question) || question.type === 'multi' || question.type === 'nights' || question.type === 'flights' || question.type === 'drinks' || question.type === 'dailyCount' || question.type === 'stepper' || question.isSensibilization || (question.type === 'weekDistribution' && isWeekDistributionValid(question, answers)) || answers[question.id] !== undefined

  function isAreaDone(ai) {
    return AREAS[ai].questions.every(q =>
      isSkipped(q) || q.type === 'multi' || q.type === 'nights' || q.type === 'flights' || q.type === 'drinks' || q.type === 'dailyCount' || q.type === 'stepper' || q.isSensibilization ||
      (q.type === 'weekDistribution' ? isWeekDistributionValid(q, answers) : answers[q.id] !== undefined)
    )
  }

  function getAreaStatus(ai) {
    if (isAreaDone(ai)) return 'done'
    if (ai === areaIndex) return 'active'
    return 'inactive'
  }

  function handleSelect(questionId, value) {
    const newAnswers = { ...answers, [questionId]: value }
    setAnswers(newAnswers)
  }

  function handleToggle(questionId, value) {
    const q = AREAS.flatMap(a => a.questions).find(q => q.id === questionId)
    const noneVal = q?.noneValue
    setAnswers(prev => {
      const current = Array.isArray(prev[questionId]) ? prev[questionId] : []
      if (current.includes(value)) {
        return { ...prev, [questionId]: current.filter(v => v !== value) }
      }
      if (noneVal && value === noneVal) {
        return { ...prev, [questionId]: [noneVal] }
      }
      if (noneVal) {
        return { ...prev, [questionId]: [...current.filter(v => v !== noneVal), value] }
      }
      return { ...prev, [questionId]: [...current, value] }
    })
  }

  // overrideAnswers: passed from handleSelect to avoid stale closure on the answers state
  function handleNext(overrideAnswers = null) {
    const currentAnswers = overrideAnswers ?? answers
    // Recompute canNext with the actual answers (avoids stale state in timeouts)
    const currentCanNext = isSkipped(question) || question.type === 'multi' || question.type === 'nights' || question.type === 'flights' || question.type === 'drinks' || question.type === 'dailyCount' || question.type === 'stepper' || question.isSensibilization || (question.type === 'weekDistribution' && isWeekDistributionValid(question, currentAnswers)) || currentAnswers[question.id] !== undefined
    if (!currentCanNext) return
    if (isLast) {
      const calcResult = calculator(currentAnswers)
      const state = { ...calcResult, answers: currentAnswers }
      const submissionId = `${code}_${participantGroup}_${Date.now()}`
      const payload = {
        submissionId,
        sessionCode: code,
        group: participantGroup,
        name: participantName,
        age: participantAge,
        gender: participantGender,
        carbonTons: calcResult.carbonTons,
        areas: calcResult.areas,
        answers: currentAnswers,
        category: calcResult.category,
      }
      // Capa 1: socket (tiempo real)
      socket.emit('footprint:submit', payload)
      // Capa 2: HTTP de respaldo con keepalive (sobrevive al bloqueo de pantalla del móvil)
      // Capa 3: localStorage pending — se reintenta en Step2Results si fetch falla
      ;(() => {
        const pendingKey = `co2sprint_pending_${code}`
        localStorage.setItem(pendingKey, JSON.stringify(payload))
        fetch(`${import.meta.env.VITE_BACKEND_URL}/api/results/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).then(r => { if (r.ok) localStorage.removeItem(pendingKey) }).catch(() => {})
      })()
      // Navigate immediately — no waiting screen needed
      navigate(`/session/${code}/results`, { state })
      return
    }
    let nextQ = questionIndex + 1
    let nextA = areaIndex
    if (nextQ >= AREAS[nextA].questions.length) { nextA++; nextQ = 0 }
    while (nextA < AREAS.length && isSkipped(AREAS[nextA].questions[nextQ])) {
      nextQ++
      if (nextQ >= AREAS[nextA].questions.length) { nextA++; nextQ = 0 }
    }
    setAreaIndex(nextA)
    setQuestionIndex(nextQ)
  }

  function handlePrev() {
    if (isFirst) return
    let prevQ = questionIndex - 1
    let prevA = areaIndex
    if (prevQ < 0) { prevA--; prevQ = AREAS[prevA].questions.length - 1 }
    while (prevA >= 0 && isSkipped(AREAS[prevA].questions[prevQ])) {
      prevQ--
      if (prevQ < 0) { prevA--; if (prevA >= 0) prevQ = AREAS[prevA].questions.length - 1 }
    }
    setAreaIndex(prevA)
    setQuestionIndex(prevQ)
  }

  function handleAreaClick(ai) {
    if (getAreaStatus(ai) !== 'inactive') {
      setAreaIndex(ai)
      setQuestionIndex(0)
    }
  }

  function handleViewPartial() {
    const calcResult = calculator(answers)
    navigate(`/session/${code}/results`, { state: { ...calcResult, answers } })
  }

  function renderProgressDots(aIdx, activeQIdx) {
    const a = AREAS[aIdx]
    return (
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        {a.questions.map((q, qi) => {
          if (isSkipped(q)) return null
          const done   = q.type === 'multi' || q.type === 'nights' || q.type === 'drinks' || q.type === 'dailyCount' || q.type === 'stepper' || q.isSensibilization || (q.type === 'weekDistribution' ? isWeekDistributionValid(q, answers) : answers[q.id] !== undefined)
          const active = aIdx === areaIndex && qi === activeQIdx
          return (
            <div key={qi} style={{
              height: 4, width: 20, borderRadius: 2,
              background: active ? a.color + '88' : done ? a.color : '#e5e5e5',
            }} />
          )
        })}
      </div>
    )
  }

  const nextIcon = isLast ? '✓' : '→'

  // ── intro screen ─────────────────────────────────────────────────────────────
  if (showIntro) return (
    <div>
      <SessionClosedBanner onViewPartial={handleViewPartial} />
      <div style={{
        minHeight: 'calc(100dvh - 52px)', background: '#f5f5f5',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem', textAlign: 'left',
        fontFamily: "'Instrument Sans', sans-serif",
      }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {AREAS.map(a => <img key={a.id} src={AREA_ICON_URLS[a.id]} width={24} height={24} alt="" />)}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#0a0a0a', marginBottom: 16 }}>
          Antes de empezar
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: '#444', maxWidth: 340, marginBottom: 8, textAlign: 'left' }}>
          ¡Es un cuestionario individual! Responde a las preguntas de forma personal, no en nombre de tu hogar. Por supuesto, algunos elementos son compartidos (mi vivienda con mi familia, el coche con las personas con las que comparto trayecto, etc.). Esto se tendrá en cuenta al calcular tu huella de carbono, así que no te preocupes.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: '#0a0a0a', fontWeight: 700, maxWidth: 340, marginBottom: 36, textAlign: 'left' }}>
          Las preguntas se refieren a tu vida personal, no a tu actividad profesional.
        </p>
        <button
          onClick={() => setShowIntro(false)}
          style={{ background: '#0a0a0a', color: '#f5f5f5', border: 'none', borderRadius: 999, padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer', letterSpacing: '-0.01em' }}
        >
          Empezar →
        </button>
      </div>
    </div>
  )

  // ── desktop ─────────────────────────────────────────────────────────────────
  if (!isMobile) return (
    <div>
      <SessionClosedBanner onViewPartial={handleViewPartial} />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: 'calc(100dvh - 52px)', overflow: 'hidden', fontFamily: "'Instrument Sans', sans-serif" }}>

        {/* Sidebar */}
        <div style={{ background: '#ffffff', borderRight: `1px solid ${BORDER}`, padding: '24px 14px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bbb', marginBottom: 10, paddingLeft: 8 }}>
            Áreas
          </div>
          {AREAS.map((a, ai) => {
            const status = getAreaStatus(ai)
            const isDone = status === 'done'
            const isAct  = status === 'active'
            return (
              <div key={a.id} onClick={() => handleAreaClick(ai)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 10,
                  background: isAct ? '#f5f5f5' : 'transparent',
                  border: isAct ? `1px solid ${BORDER}` : '1px solid transparent',
                  opacity: status === 'inactive' ? 0.3 : 1,
                  cursor: status !== 'inactive' ? 'pointer' : 'default',
                }}
              >
                <img src={AREA_ICON_URLS[a.id]} width={22} height={22} alt="" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: isAct ? 500 : 400, color: isDone ? '#0a0a0a' : '#0a0a0a', letterSpacing: '-0.01em' }}>
                    {a.label}
                  </div>
                  {isAct && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                      {a.questions.filter(q => !isSkipped(q)).map((q, qi) => (
                        <div key={qi} style={{ flex: 1, height: 2, borderRadius: 1, background: qi <= questionIndex ? a.color : BORDER }} />
                      ))}
                    </div>
                  )}
                </div>
                {isDone && <span style={{ fontSize: 12, color: '#0a0a0a', fontWeight: 500, flexShrink: 0 }}>✓</span>}
              </div>
            )
          })}
        </div>

        {/* Main */}
        <div style={{ background: '#f5f5f5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Progress */}
          <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 6, fontWeight: 400, letterSpacing: '0.01em' }}>
              Pregunta {questionIndex + 1} de {area.questions.filter(q => !isSkipped(q)).length}
            </p>
            <div style={{ display: 'flex', gap: 4 }}>
              {area.questions.filter(q => !isSkipped(q)).map((q, qi) => (
                <div key={qi} style={{ flex: 1, height: 2.5, borderRadius: 2, background: qi <= questionIndex ? area.color : BORDER }} />
              ))}
            </div>
          </div>

          {/* Question */}
          <div style={{ padding: '22px 28px 14px', flexShrink: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 700, maxWidth: 560, lineHeight: 1.4, letterSpacing: '-0.01em', color: '#0a0a0a', margin: 0 }}>
              {question.text}
            </p>
            {question.id === 'heating' && answers.homeType && (
              <p style={{ fontSize: 13, color: area.color, margin: '4px 0 0', fontWeight: 400 }}>
                Para tu {homeTypeLabels[answers.homeType]}
              </p>
            )}
            {question.info && (
              <p style={{ fontSize: 14, color: '#999', margin: '6px 0 0', fontWeight: 400, lineHeight: 1.4 }}>{question.info}</p>
            )}
          </div>

          {/* Options */}
          <div style={{ padding: '0 28px 16px', maxWidth: 640, flex: 1, overflowY: 'auto' }}>
            {question.type === 'drinks' ? (
              <DrinksInput question={question} answers={answers} onChange={setAnswers} />
            ) : question.type === 'flights' ? (
              <div style={{ '--area-color': '#4a90d9', '--area-bg': '#e8f2fd' }}>
                <NightsInput question={question} answers={answers} onChange={setAnswers} unit="vuelo/s" />
              </div>
            ) : question.type === 'nights' ? (
              <div style={{ '--area-color': '#0a0a0a', '--area-bg': '#f5f5f5' }}>
                <NightsInput question={question} answers={answers} onChange={setAnswers} />
              </div>
            ) : question.type === 'weekDistribution' ? (
              <WeekDistributionInput question={question} answers={answers} onChange={setAnswers} />
            ) : question.type === 'dailyCount' ? (
              <DailyCountInput question={question} answers={answers} onChange={setAnswers} />
            ) : question.type === 'stepper' ? (
              <StepperInput question={question} answers={answers} onChange={setAnswers} />
            ) : (
              <OptionList
                question={question} area={area} answers={answers}
                onSelect={handleSelect} onToggle={handleToggle} compact={false}
              />
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, borderTop: `1px solid ${BORDER}`, background: '#f5f5f5' }}>
            <button onClick={handlePrev} disabled={isFirst}
              style={{ width: 48, height: 48, borderRadius: 999, fontSize: 16, background: '#fff', border: `1px solid ${isFirst ? BORDER : BORDER}`, color: isFirst ? '#e5e5e5' : '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isFirst ? 'default' : 'pointer' }}
            >←</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => handleNext()} disabled={!canNext}
              style={{ width: 48, height: 48, borderRadius: 999, border: 'none', fontSize: 16, fontWeight: 500, background: canNext ? '#0a0a0a' : '#e5e5e5', color: canNext ? '#f5f5f5' : '#bbb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canNext ? 'pointer' : 'default' }}
            >{nextIcon}</button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── mobile ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <SessionClosedBanner onViewPartial={handleViewPartial} />
      <div style={{ height: 'calc(100dvh - 52px)', background: '#f5f5f5', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Instrument Sans', sans-serif" }}>

        {/* Area tabs — emoji only */}
        <div style={{ display: 'flex', padding: '0 16px', borderBottom: `1px solid ${BORDER}`, background: '#f5f5f5', flexShrink: 0 }}>
          {AREAS.map((a, ai) => {
            const status = getAreaStatus(ai)
            return (
              <div key={a.id} onClick={() => handleAreaClick(ai)}
                style={{
                  flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
                  padding: '12px 0',
                  background: (status === 'active' || status === 'done') ? a.color : 'transparent',
                  opacity: status === 'inactive' ? 0.2 : 1,
                  cursor: status !== 'inactive' ? 'pointer' : 'default',
                  transition: 'background 0.2s ease',
                }}
              >
                <img
                  src={AREA_ICON_URLS[a.id]}
                  width={22} height={22}
                  alt=""
                  style={{ filter: (status === 'active' || status === 'done') ? 'brightness(0) invert(1)' : 'none' }}
                />
              </div>
            )
          })}
        </div>

        {/* Progress — "Pregunta X de Y" + bar */}
        <div style={{ padding: '18px 18px 0', flexShrink: 0, background: '#f5f5f5', marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 6, fontWeight: 400, letterSpacing: '0.01em' }}>
            Pregunta {questionIndex + 1} de {area.questions.filter(q => !isSkipped(q)).length}
          </p>
          <div style={{ display: 'flex', gap: 4 }}>
            {area.questions.filter(q => !isSkipped(q)).map((q, qi) => (
              <div key={qi} style={{ flex: 1, height: 2.5, borderRadius: 2, background: qi <= questionIndex ? area.color : BORDER }} />
            ))}
          </div>
        </div>

      {/* Question */}
<div style={{ padding: '18px 18px 18px', flexShrink: 0, background: '#f5f5f5' }}>
  <p style={{ fontSize: 22, fontWeight: 700, color: '#0a0a0a', lineHeight: 1.4, margin: 0, letterSpacing: '-0.01em' }}>
    {question.text}
  </p>
  {question.info && (
    <p style={{ fontSize: 14, color: '#999', marginTop: 6, fontWeight: 400, lineHeight: 1.4 }}>
      {question.info}
    </p>
  )}
  {question.id === 'heating' && answers.homeType && (
    <p style={{ fontSize: 12, color: area.color, marginTop: 4, fontWeight: 400 }}>
      Para tu {homeTypeLabels[answers.homeType]}
    </p>
  )}
</div>



        {/* Options — flex 1, tarjetas blancas sobre fondo claro */}
        <div style={{ padding: '0 16px 8px', flex: 1, overflowY: 'auto', background: '#f5f5f5', paddingBottom: 100 }}>
          {question.type === 'drinks' ? (
            <DrinksInput question={question} answers={answers} onChange={setAnswers} />
          ) : question.type === 'flights' ? (
            <div style={{ '--area-color': '#4a90d9', '--area-bg': '#e8f2fd' }}>
              <NightsInput question={question} answers={answers} onChange={setAnswers} unit="vuelo/s" />
            </div>
          ) : question.type === 'nights' ? (
            <div style={{ '--area-color': '#0a0a0a', '--area-bg': '#f5f5f5' }}>
              <NightsInput question={question} answers={answers} onChange={setAnswers} />
            </div>
          ) : question.type === 'weekDistribution' ? (
            <WeekDistributionInput question={question} answers={answers} onChange={setAnswers} />
          ) : question.type === 'dailyCount' ? (
            <DailyCountInput question={question} answers={answers} onChange={setAnswers} />
          ) : question.type === 'stepper' ? (
            <StepperInput question={question} answers={answers} onChange={setAnswers} />
          ) : (
            <OptionList
              question={question} area={area} answers={answers}
              onSelect={handleSelect} onToggle={handleToggle} compact={true}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '10px 16px 24px', display: 'flex', gap: 8, background: '#f5f5f5', borderTop: `1px solid ${BORDER}`, zIndex: 10 }}>
          <button onClick={handlePrev} disabled={isFirst}
            style={{ width: 48, height: 48, borderRadius: 999, border: `1px solid ${BORDER}`, background: '#fff', color: isFirst ? '#e5e5e5' : '#0a0a0a', fontSize: 16, cursor: isFirst ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >←</button>
          <button onClick={() => handleNext()} disabled={!canNext}
            style={{ flex: 1, height: 48, borderRadius: 999, border: 'none', background: canNext ? '#0a0a0a' : '#e5e5e5', color: canNext ? '#f5f5f5' : '#bbb', fontSize: 18, fontWeight: 500, cursor: canNext ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >{nextIcon}</button>
        </div>
      </div>
    </div>
  )
}
