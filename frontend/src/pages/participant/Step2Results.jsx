import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { PieChart, Pie, Cell } from 'recharts'
import { useSession } from '../../context/SessionContext.jsx'
import SessionClosedBanner from '../../components/SessionClosedBanner.jsx'
import WaitingForFacilitator from '../../components/WaitingForFacilitator.jsx'
import { socket } from '../../utils/socket.js'
import api from '../../utils/api.js'
import { AREA_QUESTIONS } from '../../utils/answerLabels.js'
import { MAP, calcAlcohol } from '../../utils/calculator.js'
import { fmtTons } from '../../utils/format.js'

const SPAIN_AVG = 8.1
const BAR_MAX_H = 120

const CATEGORY_CONFIG = {
  bajo:       { label: 'Huella reducida 🌿',    color: '#38bdf8', bg: '#eaf3de' },
  medio:      { label: 'Huella moderada 🌱',    color: '#f59e0b', bg: '#fff8e0' },
  alto:       { label: 'Huella elevada 🌍',     color: '#a855f7', bg: '#fff0e0' },
  'muy alto': { label: 'Huella muy elevada 🔥', color: '#f472b6', bg: '#fce8e8' },
}

const CATEGORY_MESSAGES = {
  bajo:       '¡Genial! Tu huella está muy por debajo de la media',
  medio:      'Tu huella es moderada, hay margen de mejora',
  alto:       'Tu huella está por encima de lo sostenible',
  'muy alto': 'Tu huella es alta — este taller es para ti',
}

const AREA_LABELS = {
  transport:      'Transporte',
  energy:         'Vivienda',
  food:           'Alimentación',
  consumption:    'Compras y hábitos',
  waste:          'Vida digital',
  publicServices: 'Servicios públicos',
}

const AREA_COLORS = {
  transport:      '#38bdf8',
  energy:         '#f59e0b',
  food:           '#4ade80',
  consumption:    '#a855f7',
  waste:          '#f472b6',
  publicServices: '#94a3b8',
}

function getCategory(tons) {
  if (tons < 4)  return 'bajo'
  if (tons < 7)  return 'medio'
  if (tons < 10) return 'alto'
  return 'muy alto'
}

// Areas ordered for the detail section
const AREAS = [
  { id: 'transport',      label: 'Transporte',        iconUrl: '/icons/transport.svg',   color: '#38bdf8' },
  { id: 'energy',         label: 'Vivienda',           iconUrl: '/icons/energy.svg',      color: '#f59e0b' },
  { id: 'food',           label: 'Alimentación',       iconUrl: '/icons/food.svg',        color: '#4ade80' },
  { id: 'consumption',    label: 'Compras y hábitos',  iconUrl: '/icons/consumption.svg', color: '#a855f7' },
  { id: 'waste',          label: 'Vida digital',       iconUrl: '/icons/waste.svg',       color: '#f472b6' },
  { id: 'publicServices', label: 'Servicios públicos', iconUrl: '/icons/public-services.svg', color: '#94a3b8' },
]

const SUBCATEGORIES = {
  transport: [
    {
      label: 'Vehículo privado',
      calc: (answers) => {
        if (!answers.carKm || answers.carKm === 'km_e') return 0
        return (answers.carType === 'electric'
          ? (MAP.electricCar[answers.carKm] || 0)
          : (MAP.carKm[answers.carKm] || 0)) / 1000
      },
    },
    {
      label: 'Vuelos',
      calc: (answers) => (
        (answers.flightShort  || 0) * 550  +
        (answers.flightMedium || 0) * 1252 +
        (answers.flightLong   || 0) * 1752
      ) / 1000,
    },
    {
      label: 'Transporte público y activo',
      calc: (answers) => (
        (MAP.train[answers.train]                   || 0) +
        (MAP.moto[answers.moto]                     || 0) +
        (MAP.urbanMobility[answers.urbanMobility]   || 0)
      ) / 1000,
    },
  ],
  energy: [
    {
      label: 'Calefacción y agua caliente',
      calc: (answers) => {
        let kg = 0
        if (answers.homeType === '25a')      kg = MAP.heatingSmall[answers.heating]  ?? 0
        else if (answers.homeType === '25b') kg = MAP.heatingMedium[answers.heating] ?? 0
        else if (answers.homeType === '25c') kg = MAP.heatingLarge[answers.heating]  ?? 0
        return kg / 1000
      },
    },
    {
      label: 'Refrigeración',
      calc: (answers) => {
        if (answers.hasAC !== 'yes') return 0
        return (answers.homeType === '25a' ? 350 : answers.homeType === '25b' ? 420 : 438) / 1000
      },
    },
    {
      label: 'Extras (piscina y vacaciones)',
      calc: (answers) => {
        const poolKg = MAP.pool?.[answers.pool] || 0
        const vacKg  = (answers.hotelNights   || 0) * 8 + (answers.hostelNights  || 0) + (answers.campingNights || 0) + (answers.airbnbNights || 0) * 5 + (answers.secondHome ? 250 : 0)
        return (poolKg + vacKg) / 1000
      },
    },
    {
      label: 'Energía renovable',
      calc: (answers) => (MAP.renewable[answers.renewable] ?? 0) / 1000,
      negative: true,
    },
    {
      label: 'Hábitos de eficiencia',
      calc: (answers) => {
        const habits = ['closeWindows', 'thermostat19', 'ledBulbs', 'ecoPrograms']
        return habits.filter(h => answers.homeHabits?.includes(h)).reduce((s, h) => s + (MAP.homeHabits[h] || 0), 0) / 1000
      },
      negative: true,
    },
  ],
  food: [
    {
      label: 'Dieta diaria',
      calc: (answers) => {
        const breakfast = Object.entries(answers.breakfastDays || {}).reduce((s, [t, d]) => s + (MAP.breakfastDaily[t] ?? 0) * d * 52, 0)
          * (answers.breakfastDouble ? 1.5 : 1)
        const lunch     = Object.entries(answers.lunchDays    || {}).reduce((s, [t, d]) => s + (MAP.mealDaily[t]      ?? 0) * d * 52, 0)
        const dinner    = Object.entries(answers.dinnerDays   || {}).reduce((s, [t, d]) => s + (MAP.mealDaily[t]      ?? 0) * d * 52, 0)
        const delivery  = (answers.deliveryPerWeek || 0) * 3 * 52
        return (breakfast + lunch + dinner + delivery) / 1000
      },
    },
    {
      label: 'Bebidas',
      calc: (answers) => {
        const hotKg   = Object.entries(answers.hotDrinksCount || {}).reduce((s, [t, c]) => s + (MAP.hotDrinksDaily[t] ?? 0) * c * 365, 0)
        const waterKg = MAP.bottledWater[answers.bottledWater] || 0
        return (hotKg + waterKg + calcAlcohol(answers.alcohol)) / 1000
      },
    },
    {
      label: 'Hábitos sostenibles',
      calc: (answers) => ['localFood', 'composting', 'noFoodWaste'].filter(h => answers.foodHabits?.includes(h)).reduce((s, h) => s + (MAP.foodHabits[h] || 0), 0) / 1000,
      negative: true,
    },
  ],
  consumption: [
    {
      label: 'Moda',
      calc: (answers) => (MAP.clothes[answers.clothes] || 0) / 1000,
    },
    {
      label: 'Tecnología',
      calc: (answers) => {
        const elecKg = (Array.isArray(answers.electronics) ? answers.electronics : []).reduce((s, v) => s + (MAP.electronics[v] || 0), 0)
        const appKg  = (Array.isArray(answers.appliances)  ? answers.appliances  : []).reduce((s, v) => s + (MAP.appliances[v]  || 0), 0)
        return (elecKg + appKg) / 1000
      },
    },
    {
      label: 'Estilo de vida',
      calc: (answers) => {
        const petsKg    = ['bigDog','medDog','smallDog','cat'].filter(p => answers.pets?.includes(p)).reduce((s, p) => s + (MAP.pets[p] || 0), 0)
        return (petsKg + (MAP.hygiene[answers.hygiene] || 0) + (MAP.smoking[answers.smoking] || 0)) / 1000
      },
    },
  ],
  waste: [
    {
      label: 'Uso de pantallas',
      calc: (answers) => ((MAP.videoCalls[answers.videoCalls] || 0) + (MAP.streaming[answers.streaming] || 0) + (MAP.socialMedia[answers.socialMedia] || 0)) / 1000,
    },
    {
      label: 'Inteligencia artificial',
      calc: (answers) => (MAP.aiUsage[answers.aiUsage] || 0) / 1000,
    },
  ],
  publicServices: [
    {
      label: 'Sanidad, educación, infraestructuras...',
      calc: () => 1.5,
    },
  ],
}

function AreaDetailCard({ areaId, areaLabel, areaIconUrl, areaColor, areaTons, subcategories, answers, totalTons, maxAreaTons }) {
  const [expanded, setExpanded] = useState(false)

  const subcatValues = subcategories.map(sub => ({
    label:    sub.label,
    tons:     Math.round(sub.calc(answers) * 100) / 100,
    negative: sub.negative || false,
  }))

  const maxVal = Math.max(...subcatValues.filter(s => !s.negative).map(s => Math.abs(s.tons)), 0.01)

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 10, cursor: 'pointer' }}>
        <img src={areaIconUrl} width={18} height={18} alt="" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#0a0a0a' }}>{areaLabel}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: areaColor }}>{fmtTons(areaTons)}t</span>
        <span style={{ fontSize: 10, color: '#aaa', marginLeft: 4 }}>
          {totalTons > 0 ? Math.round((areaTons / totalTons) * 100) : 0}%
        </span>
        <span style={{ fontSize: 9, color: '#bbb', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      <div style={{ height: 3, margin: '0 12px', background: '#e5e5e5', borderRadius: 2, overflow: 'hidden', marginBottom: expanded ? 0 : 10 }}>
        <div style={{ height: '100%', width: `${maxAreaTons > 0 ? Math.min((areaTons / maxAreaTons) * 100, 100) : 0}%`, background: areaColor, borderRadius: 2 }} />
      </div>
      {expanded && (
        <div style={{ padding: '4px 12px 10px' }}>
          {subcatValues.map((sub, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '0.5px solid #e5e5e5' }}>
              <span style={{ flex: 1, fontSize: 13, color: '#555' }}>{sub.label}</span>
              <div style={{ width: 70, height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((Math.abs(sub.tons) / maxVal) * 100, 100)}%`,
                  background: sub.negative ? '#16a34a' : areaColor,
                  borderRadius: 2,
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, width: 36, textAlign: 'right', color: sub.negative ? '#16a34a' : areaColor }}>
                {fmtTons(sub.tons)}t
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MOCK_RESULT = {
  carbonTons: 8.1,
  areas: { transport: 2.1, energy: 1.8, food: 1.6, consumption: 1.4, waste: 1.2 },
  answers: {},
}

// ── helpers ────────────────────────────────────────────────────────────────

function Square({ size = 8, opacity = 1 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `1.5px solid rgba(0,0,0,${opacity * 0.25})`,
      flexShrink: 0,
    }} />
  )
}

function SquareWhite({ size = 8 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '1.5px solid rgba(255,255,255,0.4)',
      flexShrink: 0,
    }} />
  )
}

function CardTitle({ children, dark = false }) {
  return (
    <div style={{
      fontSize: '0.78rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      color: dark ? 'rgba(255,255,255,0.55)' : '#999',
      marginBottom: '1rem',
    }}>
      {children}
    </div>
  )
}

function DonutChart({ pct, color, size = 80 }) {
  const r   = size * 0.34
  const sw  = size * 0.13
  const circ   = 2 * Math.PI * r
  const filled = (Math.min(pct ?? 0, 100) / 100) * circ
  const c = size / 2
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#e8e8e8" strokeWidth={sw} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  )
}

function DotGrid({ lowerCount, higherCount }) {
  const MAX = 42
  let lo = lowerCount
  let hi = higherCount
  const raw = lo + 1 + hi
  if (raw > MAX) {
    const scale = (MAX - 1) / (lo + hi)
    lo = Math.round(lo * scale)
    hi = Math.round(hi * scale)
  }
  const dots = [...Array(lo).fill('lo'), 'me', ...Array(hi).fill('hi')]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '0.6rem 0 0.5rem' }}>
      {dots.map((t, i) => (
        <span key={i} style={{
          display: 'inline-block', width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
          background: t === 'me' ? '#fff'
            : t === 'lo' ? 'rgba(255,255,255,0.82)'
            : 'rgba(255,255,255,0.22)',
          outline: t === 'me' ? '1.5px solid rgba(255,255,255,0.5)' : 'none',
        }} />
      ))}
    </div>
  )
}

// ── component ──────────────────────────────────────────────────────────────

export default function Step2Results() {
  const location = useLocation()
  const { code }  = useParams()
  const navigate  = useNavigate()
  const { participantGroup } = useSession()

  // Restore from localStorage if available (survives page reload)
  const RESULTS_KEY = `co2sprint_results_${code}`
  const savedRaw = localStorage.getItem(RESULTS_KEY)
  const saved = savedRaw ? (() => { try { return JSON.parse(savedRaw) } catch { return null } })() : null

  const data = location.state?.carbonTons != null
    ? location.state
    : saved?.carbonTons != null
      ? saved
      : MOCK_RESULT
  const { carbonTons, areas, answers } = data

  // Save real results to localStorage on mount (revealed:true for late participants)
  if (location.state?.carbonTons != null && !savedRaw) {
    localStorage.setItem(RESULTS_KEY, JSON.stringify({
      carbonTons: location.state.carbonTons,
      areas: location.state.areas || {},
      answers: location.state.answers || {},
      revealed: true,
    }))
  }

  // If navigated directly with results (late participant after reveal), show immediately
  const [revealed,       setRevealed]       = useState(
    saved?.revealed || location.state?.carbonTons != null || false
  )
  const [step3Started,   setStep3Started]   = useState(false)
  const [sessionResults, setSessionResults] = useState(null)
  const [emailInput,     setEmailInput]     = useState('')
  const [emailStatus,    setEmailStatus]    = useState('idle')
  const [pendingBanner,  setPendingBanner]  = useState(false)

  const retryPending = useCallback(() => {
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
      }).then(r => {
        if (r.ok) {
          localStorage.removeItem(pendingKey)
          setPendingBanner(false)
        } else {
          setPendingBanner(true)
        }
      }).catch(() => setPendingBanner(true))
    } catch {
      localStorage.removeItem(pendingKey)
    }
  }, [code])

  useEffect(() => {
    // Retry any pending submission from localStorage (capa 3)
    const pendingKey = `co2sprint_pending_${code}`
    if (localStorage.getItem(pendingKey)) retryPending()

    api.get(`/api/sessions/${code}/info`)
      .then(res => {
        if (res.data.resultsRevealed) setRevealed(true)
        if (res.data.currentStep >= 3) setStep3Started(true)
      })
      .catch(() => {})

    function onResultsRevealed() {
      setRevealed(true)
      const existing = savedRaw ? JSON.parse(savedRaw) : { carbonTons, areas, answers: answers || {} }
      localStorage.setItem(RESULTS_KEY, JSON.stringify({ ...existing, revealed: true }))
    }
    function onStepChange({ step }) { if (step >= 3) setStep3Started(true) }
    function onSessionClosed() { navigate(`/session/${code}/end`, { replace: true }) }
    function onRankingUpdate({ individual }) {
      if (individual && individual.length > 0) {
        setSessionResults(individual.map(r => ({
          carbonTons: r.tons,
          group: r.group,
          category: r.category,
        })))
      }
    }
    function onFootprintSaved() {
      localStorage.removeItem(`co2sprint_pending_${code}`)
      setPendingBanner(false)
    }

    socket.on('results:revealed', onResultsRevealed)
    socket.on('step:change', onStepChange)
    socket.on('session:closed', onSessionClosed)
    socket.on('ranking:update', onRankingUpdate)
    socket.on('footprint:saved', onFootprintSaved)
    return () => {
      socket.off('results:revealed', onResultsRevealed)
      socket.off('step:change', onStepChange)
      socket.off('session:closed', onSessionClosed)
      socket.off('ranking:update', onRankingUpdate)
      socket.off('footprint:saved', onFootprintSaved)
    }
  }, [code, navigate, retryPending])

  useEffect(() => {
    if (!revealed) return
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/api/results/${code}/ranking`)
      .then(res => setSessionResults(res.data))
      .catch(() => setSessionResults([]))
  }, [code, revealed])

  // ── derived ───────────────────────────────────────────────────
  const category = getCategory(carbonTons)
  const cfg      = CATEGORY_CONFIG[category]

  // spain bars
  const barNorm  = Math.max(carbonTons, SPAIN_AVG) * 1.1
  const userBarH  = Math.round((carbonTons / barNorm) * BAR_MAX_H)
  const spainBarH = Math.round((SPAIN_AVG  / barNorm) * BAR_MAX_H)
  const diffPct  = Math.abs(Math.round(((carbonTons - SPAIN_AVG) / SPAIN_AVG) * 100))
  const isBelow  = carbonTons < SPAIN_AVG

  // session percentile
  const loaded      = sessionResults !== null
  const sTons       = loaded ? sessionResults.map(r => r.carbonTons) : []
  const hasMany     = loaded && sTons.length > 1
  const lowerCount  = hasMany ? sTons.filter(t => t < carbonTons).length : 0
  const higherCount = hasMany ? sTons.filter(t => t > carbonTons).length : 0
  const pctHigher   = hasMany ? Math.round((higherCount / sTons.length) * 100) : null
  const topPct      = pctHigher !== null ? 100 - pctHigher : null

  // team
  const myGroup     = participantGroup || ''
  const teamResults = loaded ? sessionResults.filter(r => r.group === myGroup) : []
  const isTeamAlone = teamResults.length <= 1
  const teamTotal   = isTeamAlone ? null : teamResults.reduce((s, r) => s + r.carbonTons, 0)
  const teamAvg     = teamTotal !== null ? teamTotal / teamResults.length : null
  const myContrib   = teamTotal ? Math.round((carbonTons / teamTotal) * 100) : null

  async function handleSendEmail(e) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setEmailStatus('invalid'); return
    }
    setEmailStatus('sending')
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/results/send-email`, {
        email: emailInput, carbonTons, category, areas, answers, sessionCode: code,
      })
      setEmailStatus('success')
    } catch {
      setEmailStatus('error')
    }
  }

  // ── render ────────────────────────────────────────────────────
  if (!revealed) return (
    <div style={{
      minHeight: 'calc(100vh - 52px)', background: '#f5f5f5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1.25rem', lineHeight: 1 }}>⏳</div>
      <h1 style={{ fontWeight: 900, fontSize: '1.35rem', textTransform: 'uppercase', marginBottom: '0.75rem', color: '#0a0a0a' }}>
        Espera al facilitador
      </h1>
      <p style={{ fontSize: '0.85rem', color: '#888', maxWidth: 300, lineHeight: 1.65, margin: '0 0 2rem' }}>
        El facilitador revelará los resultados de todos al mismo tiempo...
      </p>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: '#0a0a0a',
            animation: `resdot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
        <style>{`
          @keyframes resdot {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40%            { opacity: 1;   transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 52px)', animation: 'resReveal 0.4s ease both' }}>
      <style>{`
        @keyframes resReveal {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <SessionClosedBanner />

      {pendingBanner && (
        <div style={{
          background: '#fff8e0', borderBottom: '1px solid #f0d060',
          padding: '10px 16px', display: 'flex', alignItems: 'center',
          gap: 12, fontSize: 13, color: '#7a5f00',
        }}>
          <span style={{ flex: 1 }}>Tu huella aún no se ha podido enviar al servidor.</span>
          <button onClick={retryPending} style={{
            background: '#0a0a0a', color: '#fff', border: 'none',
            borderRadius: 999, padding: '6px 14px', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            Reintentar
          </button>
        </div>
      )}

      {/* ═══ HEADER ════════════════════════════════════════════ */}
      <div style={{ background: '#0a0a0a', color: '#fff' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '1.25rem 1.5rem 0' }}>

          {/* eyebrow */}
          <p style={{ margin: '0 0 0.65rem', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.55)' }}>
            Tu huella de carbono
          </p>

          {/* hero row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem 3.5rem', paddingBottom: '2.25rem', alignItems: 'flex-start' }}>

            {/* big number */}
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, fontSize: 'clamp(3.2rem, 11vw, 4.8rem)', lineHeight: 1, color: '#fff' }}>
                  {fmtTons(carbonTons)}
                </span>
                <span style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', opacity: 0.75 }}>
                  t CO₂/año
                </span>
              </div>
              <p style={{ marginTop: '0.6rem', fontSize: 'clamp(1rem, 3.5vw, 1.3rem)', fontWeight: 500, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
  {CATEGORY_MESSAGES[category]}
</p>
            </div>
          </div>
        </div>

        {/* wave */}
        <svg viewBox="0 0 100 12" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 28 }}>
          <path d="M0,0 Q50,12 100,0 L100,12 L0,12 Z" fill="#f5f5f5" />
        </svg>
      </div>

      {/* ═══ CONTENT ═══════════════════════════════════════════ */}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '1.25rem 1.25rem 2.5rem' }}>

        {/* ── area donut chart ── */}
        {(() => {
          const pieData = AREAS
            .map(a => ({ name: a.label, value: areas[a.id] ?? 0, color: a.color }))
            .filter(d => d.value > 0.001)
          const total = pieData.reduce((s, d) => s + d.value, 0)
          return (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
              <CardTitle>Distribución por áreas</CardTitle>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <PieChart width={160} height={160}>
                    <Pie data={pieData} cx={80} cy={80} innerRadius={46} outerRadius={72} dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontWeight: 900, fontSize: '1.3rem', lineHeight: 1.1, color: '#0a0a0a' }}>{fmtTons(carbonTons)}</span>
                    <span style={{ fontSize: '0.8rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em' }}>t CO₂</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 1rem', justifyContent: 'center' }}>
                  {pieData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 9, height: 9, background: d.color, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', color: '#555' }}>{d.name}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0a0a0a' }}>{fmtTons(d.value)} t</span>
                      <span style={{ fontSize: '0.72rem', color: '#bbb' }}>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── detalle por subcategoría ── */}
        {(() => {
          const maxAreaTons = Math.max(...AREAS.map(a => areas[a.id] || 0), 0.01)
          return (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                Detalle por categoría
              </p>
              {AREAS.map(area => (
                <AreaDetailCard
                  key={area.id}
                  areaId={area.id}
                  areaLabel={area.label}
                  areaIconUrl={area.iconUrl}
                  areaColor={area.color}
                  areaTons={areas[area.id] || 0}
                  subcategories={SUBCATEGORIES[area.id] || []}
                  answers={answers}
                  totalTons={carbonTons}
                  maxAreaTons={maxAreaTons}
                />
              ))}
            </div>
          )
        })()}

        {/* ── middle row: spain + percentile ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>

          {/* Spain comparison */}
          <div style={{ flex: '1 1 240px', background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '1.25rem 1.5rem', minWidth: 0 }}>
            <CardTitle>Comparativa con España</CardTitle>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 900, fontSize: '0.95rem', color: cfg.color }}>{fmtTons(carbonTons)} t</span>
                <div style={{ width: 80, height: userBarH, background: cfg.color, borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontSize: '0.72rem', color: '#888' }}>Tú</span>
              </div>
              <div style={{ paddingBottom: 24, fontSize: '0.7rem', color: '#ccc', fontWeight: 700 }}>VS</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#888' }}>{fmtTons(SPAIN_AVG)} t</span>
                <div style={{ width: 80, height: spainBarH, background: '#d4d4d4', borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontSize: '0.72rem', color: '#888' }}>Media España</span>
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: isBelow ? '#f0f7ef' : '#faf3e8',
              color: isBelow ? '#16a34a' : '#b07a30',
              padding: '0.45rem 0.8rem', borderRadius: 4,
              fontSize: '0.76rem', fontWeight: 700, marginBottom: '0.5rem',
            }}>
              <Square size={7} opacity={0} />
              <span style={{ display: 'inline-block', width: 7, height: 7, border: `1.5px solid ${isBelow ? '#16a34a' : '#b07a30'}`, flexShrink: 0 }} />
              {diffPct}% {isBelow ? 'por debajo de la media de España' : 'por encima de la media de España'}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#bbb', margin: 0 }}>
              Fuente: Ministerio para la Transición Ecológica, 2023
            </p>
          </div>
        </div>

        {/* ── bottom row: percentile + team + email ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>

          {/* Percentile — dark card */}
          <div style={{ flex: '1 1 190px', background: '#0a0a0a', borderRadius: 8, padding: '1.25rem 1.5rem', color: '#fff', minWidth: 0 }}>
            <CardTitle dark>Posición en la sesión</CardTitle>
            {!hasMany ? (
              <p style={{ fontSize: '0.78rem', opacity: 0.7, lineHeight: 1.6, margin: 0 }}>
                Esperando a que el resto complete la calculadora...
              </p>
            ) : (
              <>
                <div style={{ fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', lineHeight: 1, marginBottom: '0.35rem' }}>
                  TOP {topPct}%
                </div>
                <p style={{ fontSize: '0.88rem', opacity: 0.78, lineHeight: 1.5, margin: '0 0 0' }}>
                  Tu huella es menor que la del {pctHigher}% de los participantes
                </p>
                <DotGrid lowerCount={lowerCount} higherCount={higherCount} />
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', opacity: 0.6, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.82)', display: 'inline-block', flexShrink: 0 }} />
                    Menor huella ({lowerCount})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'inline-block', flexShrink: 0 }} />
                    Mayor huella ({higherCount})
                  </span>
                </div>
              </>
            )}
          </div>


          {/* Email */}
          <div style={{ flex: '1 1 200px', background: '#fff', borderRadius: 8, border: '1px solid #e5e5e5', padding: '1.25rem 1.5rem', minWidth: 0 }}>
            <CardTitle>Recibe tus resultados</CardTitle>
            {emailStatus === 'success' ? (
              <p style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', padding: '1.25rem 0', margin: 0 }}>
                ✓ Revisa tu bandeja de entrada
              </p>
            ) : (
              <>
                <p style={{ fontSize: '0.78rem', color: '#888', lineHeight: 1.55, marginBottom: '1rem', marginTop: 0 }}>
                  Solo tus datos personales, sin información del resto de participantes.
                </p>
                <form onSubmit={handleSendEmail}>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={emailInput}
                    onChange={e => { setEmailInput(e.target.value); setEmailStatus('idle') }}
                    style={{ width: '100%', border: '1.5px solid #e5e5e5', borderRadius: 4, padding: '0.6rem 0.75rem', fontSize: '0.85rem', outline: 'none', marginBottom: '0.55rem', boxSizing: 'border-box', background: '#fff', color: '#0a0a0a' }}
                  />
                  {(emailStatus === 'invalid' || emailStatus === 'error') && (
                    <p style={{ fontSize: '0.7rem', color: '#cc4444', margin: '-0.15rem 0 0.5rem' }}>
                      {emailStatus === 'invalid' ? 'Introduce un email válido' : 'Algo ha fallado, inténtalo de nuevo'}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={emailStatus === 'sending'}
                    style={{ width: '100%', background: emailStatus === 'sending' ? '#aaa' : '#0a0a0a', color: '#fff', padding: '0.85rem', fontSize: '0.73rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, borderRadius: 999, cursor: emailStatus === 'sending' ? 'default' : 'pointer', border: 'none' }}
                  >
                    {emailStatus === 'sending' ? 'Enviando...' : 'Enviarme mis resultados'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem', paddingTop: '0.5rem' }}>
          <div style={{ width: 32, height: 3, background: '#0a0a0a', borderRadius: 2 }} />
          <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#888', margin: 0, textAlign: 'center' }}>
            Tu huella forma parte del resultado colectivo del taller
          </p>
        </div>

      </div>
    </div>
  )
}
