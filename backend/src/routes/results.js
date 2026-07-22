import { Router } from 'express'
import { Resend } from 'resend'
import { authMiddleware } from '../middleware/authMiddleware.js'
import FootprintResult from '../models/FootprintResult.js'
import { getCategory } from '../utils/category.js'

const router = Router()

// ── Calculator MAP (mirror of frontend/src/utils/calculator.js) ──────────────

const MAP = {
  carKm:         { km_a: 184, km_b: 797, km_c: 1839, km_d: 3677, km_e: 0 },
  electricCar:   { km_a: 146, km_b: 775, km_c: 1550, km_d: 3600, km_e: 0 },
  pool:          { privatePool: 50, communityPool: 17, noPool: 0 },
  train:         { '3a': 21, '3b': 126, '3c': 630, '3d': 0 },
  moto:          { '4a': 11, '4b': 57, '4c': 228, '4d': 0 },
  urbanMobility: { '5a': 0, '5b': 15, '5c': 30, '5d': 38, '5e': 210, '5f': 330 },
  telework:      { never: 0, partial: -50, mostly: -150, always: -300 },
  heatingSmall:  { '26a': 0, '26b': 625, '26c': 975,  '26d': 1429, '26e': 230, '26f': 375, '26g': 668 },
  heatingMedium: { '26a': 0, '26b': 750, '26c': 1170, '26d': 1715, '26e': 276, '26f': 450, '26g': 802 },
  heatingLarge:  { '26a': 0, '26b': 781, '26c': 1219, '26d': 1787, '26e': 288, '26f': 469, '26g': 835 },
  renewable:     { 'a': -720, 'b': -150, 'c': 0 },
  homeHabits:    { closeWindows: -47, thermostat19: -47, ledBulbs: -4, ecoPrograms: -36, none: 0 },
  breakfastDaily: { '6a': 0.4, '6b': 0.81, '6c': 0.33, '6d': 0.11, '6e': 0.71, '6f': 0 },
  hotDrinksDaily: { '7a': 0, '7b': 1.63, '7c': 0.05, '7d_cow': 1.52, '7d_veg': 0.56, '7d_chai': 0.95, '7e': 0.16 },
  mealDaily:      { '9a': 0.3, '9b': 0.51, '9c': 1.35, '9d': 1.20, '9e': 6.29, '10a': 0.3, '10b': 0.51, '10c': 1.35, '10d': 1.20, '10e': 6.29, 'none': 0 },
  bottledWater:  { '13a': 97, '13b': 49, '13c': 0 },
  foodHabits:    { localFood: -75, composting: -146, noFoodWaste: -80, none: 0 },
  clothes:       { '15a': 75, '15b': 99, '15c': 187, '15d': 396, '15e': 594, '15f': 891, '15g': 15 },
  electronics:   { '16a': 86, '16b': 63, '16c': 194, '16d': 302, '16e': 375, '16f': 73, '16g': 24, '16h': 10, '16i': 0 },
  appliances:    { '19a': 340, '19b': 302, '19c': 270, '19d': 257, '19e': 217, '19f': 415, '19g': 98, '19h': 375, '19i': 0 },
  pets:          { bigDog: 1100, medDog: 770, smallDog: 400, cat: 310, none: 0 },
  hygiene:       { '22a': 13, '22b': 18, '22c': 39 },
  smoking:       { '23a': 0, '23b': 20, '23c': 11, '23d': 46, '23e': 102 },
  sports:        { outdoor: 0, cycling: 10, racket: 43, pool: 43, gym: 31, fitness: 43, martial: 43, athletics: 43, equestrian: 43, golf: 43, nautical: 43, ski: 93, motor: 43, climbing: 43, none: 0 },
  videoCalls:    { vc_none: 0, vc_sometimes: 8, vc_often: 18, vc_lots: 38 },
  streaming:     { st_none: 0, st_little: 8, st_often: 42, st_lots: 84 },
  socialMedia:   { sm_none: 0, sm_little: 16, sm_often: 58, sm_lots: 117 },
  aiUsage:       { none: 0, low: 25, medium: 100, high: 250 },
}

const ALCOHOL_FACTORS = {
  soda:    6,
  wine:    9,
  beer:    19,
  spirits: 3,
}

function calcAlcohol(alcohol = {}) {
  if (!alcohol || typeof alcohol !== 'object' || Array.isArray(alcohol)) return 0
  return Math.round(
    (alcohol.soda    || 0) * ALCOHOL_FACTORS.soda    +
    (alcohol.wine    || 0) * ALCOHOL_FACTORS.wine    +
    (alcohol.beer    || 0) * ALCOHOL_FACTORS.beer    +
    (alcohol.spirits || 0) * ALCOHOL_FACTORS.spirits
  )
}

// ── Subcategory definitions ──────────────────────────────────────────────────

const SUBCATS = {
  transport: [
    { label: 'Vehículo privado',            calc: (a) => !a.carKm || a.carKm === 'km_e' ? 0 : a.carType === 'electric' ? (MAP.electricCar[a.carKm] || 0) : (MAP.carKm[a.carKm] || 0) },
    { label: 'Vuelos',                       calc: (a) => (a.flightShort || 0) * 550 + (a.flightMedium || 0) * 1252 + (a.flightLong || 0) * 1752 },
    { label: 'Transporte público y activo',  calc: (a) => (MAP.train[a.train] || 0) + (MAP.moto[a.moto] || 0) + (MAP.urbanMobility[a.urbanMobility] || 0) },
    { label: 'Teletrabajo',                  calc: (a) => MAP.telework[a.telework] ?? 0, negative: true },
  ],
  energy: [
    { label: 'Calefacción y agua caliente',  calc: (a) => { let h = 0; if (a.homeType === '25a') h = MAP.heatingSmall[a.heating] ?? 0; else if (a.homeType === '25b') h = MAP.heatingMedium[a.heating] ?? 0; else if (a.homeType === '25c') h = MAP.heatingLarge[a.heating] ?? 0; return h } },
    { label: 'Refrigeración',                calc: (a) => a.hasAC === 'yes' ? (a.homeType === '25a' ? 350 : a.homeType === '25b' ? 420 : 438) : 0 },
    { label: 'Extras (piscina y vacaciones)', calc: (a) => (MAP.pool?.[a.pool] || 0) + (a.hotelNights || 0) * 8 + (a.hostelNights || 0) + (a.campingNights || 0) + (a.airbnbNights || 0) * 5 + (a.secondHome ? 250 : 0) },
    { label: 'Energía renovable',            calc: (a) => MAP.renewable[a.renewable] ?? 0, negative: true },
    { label: 'Hábitos de eficiencia',        calc: (a) => ['closeWindows', 'thermostat19', 'ledBulbs', 'ecoPrograms'].filter(h => a.homeHabits?.includes(h)).reduce((s, h) => s + (MAP.homeHabits[h] || 0), 0), negative: true },
  ],
  food: [
    { label: 'Dieta diaria', calc: (a) => {
      const breakfast = Object.entries(a.breakfastDays || {}).reduce((s, [t, d]) => s + (MAP.breakfastDaily[t] ?? 0) * d * 52, 0) * (a.breakfastDouble ? 1.5 : 1)
      const lunch     = Object.entries(a.lunchDays    || {}).reduce((s, [t, d]) => s + (MAP.mealDaily[t]      ?? 0) * d * 52, 0)
      const dinner    = Object.entries(a.dinnerDays   || {}).reduce((s, [t, d]) => s + (MAP.mealDaily[t]      ?? 0) * d * 52, 0)
      return breakfast + lunch + dinner + (a.deliveryPerWeek || 0) * 3 * 52
    }},
    { label: 'Bebidas', calc: (a) => {
      const hotKg = Object.entries(a.hotDrinksCount || {}).reduce((s, [t, c]) => s + (MAP.hotDrinksDaily[t] ?? 0) * c * 365, 0)
      return hotKg + (MAP.bottledWater[a.bottledWater] || 0) + calcAlcohol(a.alcohol)
    }},
    { label: 'Hábitos sostenibles', calc: (a) => ['localFood', 'composting', 'noFoodWaste'].filter(h => a.foodHabits?.includes(h)).reduce((s, h) => s + (MAP.foodHabits[h] || 0), 0), negative: true },
  ],
  consumption: [
    { label: 'Moda',                         calc: (a) => MAP.clothes[a.clothes] || 0 },
    { label: 'Tecnología',                   calc: (a) => (Array.isArray(a.electronics) ? a.electronics : []).reduce((s, v) => s + (MAP.electronics[v] || 0), 0) + (Array.isArray(a.appliances) ? a.appliances : []).reduce((s, v) => s + (MAP.appliances[v] || 0), 0) },
    { label: 'Estilo de vida',               calc: (a) => ['bigDog', 'medDog', 'smallDog', 'cat'].filter(p => a.pets?.includes(p)).reduce((s, p) => s + (MAP.pets[p] || 0), 0) + (MAP.hygiene[a.hygiene] || 0) + (MAP.smoking[a.smoking] || 0) + (Array.isArray(a.sports) ? a.sports.filter(s => s !== 'none').reduce((sum, s) => sum + (MAP.sports[s] || 0), 0) : 0) },
  ],
  waste: [
    { label: 'Uso de pantallas',             calc: (a) => (MAP.videoCalls[a.videoCalls] || 0) + (MAP.streaming[a.streaming] || 0) + (MAP.socialMedia[a.socialMedia] || 0) },
    { label: 'Inteligencia artificial',      calc: (a) => MAP.aiUsage[a.aiUsage] || 0 },
  ],
  publicServices: [
    { label: 'Servicios colectivos', calc: () => 1500 },
  ],
}

const AREA_META = [
  { id: 'transport',      label: 'Transporte',        emoji: '🚗', color: '#38bdf8' },
  { id: 'energy',         label: 'Vivienda',          emoji: '🏡', color: '#f59e0b' },
  { id: 'food',           label: 'Alimentación',      emoji: '🥗', color: '#4ade80' },
  { id: 'consumption',    label: 'Compras y hábitos', emoji: '🛍️', color: '#a855f7' },
  { id: 'waste',          label: 'Vida digital',      emoji: '📱', color: '#f472b6' },
  { id: 'publicServices', label: 'Servicios públicos', emoji: '🏛️', color: '#94a3b8' },
]

// ── HTTP submit fallback ──────────────────────────────────────────────────────

router.post('/submit', async (req, res) => {
  try {
    const { submissionId, sessionCode, group, age, gender, carbonTons, areas, answers } = req.body
    if (!sessionCode || !group || carbonTons == null) {
      return res.status(400).json({ error: 'Faltan datos' })
    }
    const category = getCategory(carbonTons)
    const filter = { submissionId: submissionId || `${sessionCode}_${group}_${carbonTons}` }
    const updateDoc = { submissionId, sessionCode, group, age: age || '', gender: gender || '', carbonTons, areas, answers, category }
    let result
    try {
      result = await FootprintResult.findOneAndUpdate(filter, updateDoc, { upsert: true, new: true })
    } catch (err) {
      if (err.code === 11000) {
        // Race with socket submission — document already exists, just update
        result = await FootprintResult.findOneAndUpdate(filter, updateDoc, { new: true })
      } else {
        throw err
      }
    }
    const allResults = await FootprintResult.find({ sessionCode })
      .select('group carbonTons category areas answers -_id')
      .sort({ carbonTons: 1 })
    req.app.get('io')?.to(sessionCode).emit('ranking:update', {
      individual: allResults.map(r => ({
        group: r.group, tons: r.carbonTons, category: r.category,
        areas: r.areas, answers: r.answers,
      }))
    })
    res.json({ ok: true, id: result._id })
  } catch (err) {
    console.error('Submit error:', err.message)
    res.status(500).json({ error: 'Error al guardar resultado' })
  }
})

// ── Email route ───────────────────────────────────────────────────────────────

router.post('/send-email', async (req, res) => {
  const { email, carbonTons, category, areas, answers } = req.body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email no válido' })
  }
  if (carbonTons == null || !category) {
    return res.status(400).json({ error: 'Faltan datos del resultado' })
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Servicio de email no configurado' })
  }

  // Build subcategory HTML
  const ans = answers || {}
  const subcatHtml = AREA_META.map(area => {
    const subcats = SUBCATS[area.id] || []
    const areaKg  = (areas?.[area.id] || 0) * 1000

    const rows = subcats.map(sub => {
      const kg       = sub.calc(ans)
      const tons     = (kg / 1000).toFixed(2)
      const pct      = areaKg > 0 ? Math.round((Math.abs(kg) / areaKg) * 100) : 0
      const isNeg    = sub.negative && kg < 0
      const color    = isNeg ? '#3b6d11' : area.color
      const barWidth = Math.min(pct, 100)
      return `
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #555; border-bottom: 1px solid #f5f5f5;">${sub.label}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #f5f5f5; width: 120px;">
            <div style="background: #f0f0f0; border-radius: 3px; height: 5px; overflow: hidden;">
              <div style="background: ${color}; height: 100%; width: ${barWidth}%; border-radius: 3px;"></div>
            </div>
          </td>
          <td style="padding: 6px 0; text-align: right; font-size: 13px; font-weight: 600; color: ${color}; border-bottom: 1px solid #f5f5f5; white-space: nowrap;">${tons}t &nbsp; ${pct}%</td>
        </tr>`
    }).join('')

    return `
      <div style="margin-bottom: 20px;">
        <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: 700; color: ${area.color};">${area.label}</span>
          <span style="font-size: 13px; font-weight: 700; color: ${area.color}; margin-left: 8px;">${Number(areas?.[area.id] || 0).toFixed(1)}t</span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">${rows}</table>
      </div>`
  }).join('')

  const CATEGORY_MESSAGES = {
    bajo:       '¡Genial! Tu huella está muy por debajo de la media',
    medio:      'Tu huella es moderada, hay margen de mejora',
    alto:       'Tu huella está por encima de lo sostenible',
    'muy alto': 'Tu huella es alta — este taller es para ti',
  }
  const categoryMsg = CATEGORY_MESSAGES[category] || category

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Drop. <noreply@apps.threeoclock.co>',
      to: email,
      subject: `Tu huella de carbono — ${Number(carbonTons).toFixed(1)} t CO₂/año`,
      html: `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <p style="font-size: 13px; color: #666; margin: 0 0 12px; line-height: 1.7;">Gracias por participar en nuestro taller CO₂ Sprint de Drop. 🌱</p>
          <p style="font-size: 13px; color: #666; margin: 0 0 12px; line-height: 1.7;">Calcular tu huella no es un examen — es conocer tu punto de partida. Pero ese mismo número tiene otra lectura: cuanto mayor es nuestra huella, más dependemos de un sistema frágil. Y eso, poco a poco, podemos cambiarlo.</p>
          <p style="font-size: 13px; color: #666; margin: 0 0 24px; line-height: 1.7;">Aquí tienes tus resultados:</p>

          <div style="background: #000000; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
            <p style="color: rgba(255,255,255,0.55); font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Tu huella total</p>
            <h2 style="color: #fff; font-size: 52px; font-weight: 700; margin: 0;">${Number(carbonTons).toFixed(1)} t <span style="font-size: 20px; color: rgba(255,255,255,0.55);">CO₂/año</span></h2>
            <p style="color: rgba(255,255,255,0.75); font-size: 14px; margin: 12px 0 0;">${categoryMsg}</p>
          </div>

          <h3 style="color: #1a1a1a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;">Desglose por áreas</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #555;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#38bdf8;margin-right:6px;vertical-align:middle;"></span>🚗 Transporte</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${Number(areas?.transport || 0).toFixed(1)} t</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #555;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#f59e0b;margin-right:6px;vertical-align:middle;"></span>🏡 Vivienda</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${Number(areas?.energy || 0).toFixed(1)} t</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #555;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#4ade80;margin-right:6px;vertical-align:middle;"></span>🥗 Alimentación</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${Number(areas?.food || 0).toFixed(1)} t</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #555;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#a855f7;margin-right:6px;vertical-align:middle;"></span>🛍️ Compras y hábitos</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${Number(areas?.consumption || 0).toFixed(1)} t</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #555;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#f472b6;margin-right:6px;vertical-align:middle;"></span>📱 Vida digital</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${Number(areas?.waste || 0).toFixed(1)} t</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #555;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#94a3b8;margin-right:6px;vertical-align:middle;"></span>🏛️ Servicios públicos</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 600;">${Number(areas?.publicServices || 1.5).toFixed(1)} t</td>
            </tr>
          </table>

          <h3 style="color: #1a1a1a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; margin: 32px 0 16px;">Detalle por categoría</h3>
          ${subcatHtml}

          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
            <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0 0 6px;">🎯 El objetivo: 2 t CO₂e por persona para 2050</p>
            <p style="font-size: 12px; color: #666; margin: 0; line-height: 1.6;">El objetivo de España para alcanzar la neutralidad climática y contribuir a limitar el calentamiento global a +2°C.</p>
          </div>

          <div style="border-top: 1px solid #f0f0f0; padding-top: 20px; margin-top: 8px;">
            <p style="font-size: 13px; font-weight: 600; color: #1a1a1a; margin: 0 0 6px;">Importante: esto no va solo de ti</p>
            <p style="font-size: 12px; color: #666; margin: 0 0 12px; line-height: 1.6;">La descarbonización es un esfuerzo colectivo.</p>
            <p style="font-size: 12px; color: #666; margin: 0 0 8px; line-height: 1.6;">· El Estado puede acelerar la transición con leyes, ayudas e inversiones.</p>
            <p style="font-size: 12px; color: #666; margin: 0 0 8px; line-height: 1.6;">· Los ayuntamientos configuran el entorno en el que vivimos: el transporte, los espacios, los servicios. Sus decisiones pueden impulsar prácticas más sostenibles locales.</p>
            <p style="font-size: 12px; color: #666; margin: 0; line-height: 1.6;">· Las empresas trabajan para reducir progresivamente la huella de sus productos y servicios.</p>
          </div>

          <p style="font-size: 11px; color: #aaa; margin-top: 32px; text-align: center;">
            Drop. · Taller de huella de carbono · Una iniciativa de Three o'clock
          </p>
        </div>
      `,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('Email error:', err.message)
    res.status(500).json({ error: 'Error al enviar el email' })
  }
})

// Todos los resultados — requiere JWT
router.get('/:code', authMiddleware, async (req, res) => {
  try {
    const results = await FootprintResult.find({ sessionCode: req.params.code })
    res.json(results)
  } catch {
    res.status(500).json({ error: 'Error al obtener resultados' })
  }
})

// Ranking individual anónimo — público
router.get('/:code/ranking', async (req, res) => {
  try {
    const results = await FootprintResult.find({ sessionCode: req.params.code })
      .select('group carbonTons category areas answers -_id')
      .sort({ carbonTons: 1 })
    res.json(results)
  } catch {
    res.status(500).json({ error: 'Error al obtener ranking' })
  }
})

// Ranking grupal — público
router.get('/:code/ranking/groups', async (req, res) => {
  try {
    const results = await FootprintResult.aggregate([
      { $match: { sessionCode: req.params.code } },
      {
        $group: {
          _id: '$group',
          avg: { $avg: '$carbonTons' },
          min: { $min: '$carbonTons' },
          max: { $max: '$carbonTons' },
          count: { $sum: 1 },
        },
      },
      { $sort: { avg: 1 } },
    ])
    res.json(results)
  } catch {
    res.status(500).json({ error: 'Error al obtener ranking grupal' })
  }
})

// Estadísticas — público
router.get('/:code/stats', async (req, res) => {
  try {
    const results = await FootprintResult.find({ sessionCode: req.params.code })
    if (!results.length) return res.json({ totalParticipants: 0 })

    const tons = results.map(r => r.carbonTons)
    const average = tons.reduce((a, b) => a + b, 0) / tons.length
    const min = Math.min(...tons)
    const max = Math.max(...tons)

    const groupMap = {}
    for (const r of results) {
      if (!groupMap[r.group]) groupMap[r.group] = { total: 0, count: 0 }
      groupMap[r.group].total += r.carbonTons
      groupMap[r.group].count += 1
    }
    const byGroup = Object.entries(groupMap).map(([group, d]) => ({
      group,
      average: d.total / d.count,
      total: d.total,
      count: d.count,
    }))

    res.json({ average, min, max, totalParticipants: results.length, byGroup })
  } catch {
    res.status(500).json({ error: 'Error al obtener estadísticas' })
  }
})

export default router
