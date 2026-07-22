export const PUBLIC_SERVICES_KG = 1500

export const MAP = {
  // ── TRANSPORTE ──
  carKm:         { km_a: 184, km_b: 797, km_c: 1839, km_d: 3677, km_e: 0 },
  electricCar:   { km_a: 146, km_b: 775, km_c: 1550, km_d: 3600, km_e: 0 },
  train:         { '3a': 21, '3b': 126, '3c': 630, '3d': 0 },
  moto:          { '4a': 11, '4b': 57, '4c': 228, '4d': 0 },
  urbanMobility: { '5a': 0, '5b': 15, '5c': 30, '5d': 38, '5e': 210, '5f': 330 },
  telework:      {never: 0, partial: -50, mostly: -150, always: -300 },

  // ── VIVIENDA ── (3 tablas de calefacción por tipo de vivienda)
  heatingSmall:  { '26a': 0, '26b': 625, '26c': 975,  '26d': 1429, '26e': 230, '26f': 375, '26g': 668 },
  heatingMedium: { '26a': 0, '26b': 750, '26c': 1170, '26d': 1715, '26e': 276, '26f': 450, '26g': 802 },
  heatingLarge:  { '26a': 0, '26b': 781, '26c': 1219, '26d': 1787, '26e': 288, '26f': 469, '26g': 835 },
  renewable:     { 'a': -720, 'b': -150, 'c': 0 },
  pool:          { privatePool: 50, communityPool: 17, noPool: 0 }, // single now
  homeHabits:    { closeWindows: -47, thermostat19: -47, ledBulbs: -4, ecoPrograms: -36, none: 0 },

  // ── ALIMENTACIÓN ──
  breakfastDaily: { '6a': 0.4, '6b': 0.81, '6c': 0.33, '6d': 0.11, '6e': 0.71, '6f': 0 }, // kgCO2e/día
  hotDrinksDaily: { '7a': 0, '7b': 1.63, '7c': 0.05, '7d_cow': 1.52, '7d_veg': 0.56, '7d_chai': 0.95, '7e': 0.16 }, // kgCO2e/unidad/día
  mealDaily:      { '9a': 0.3, '9b': 0.51, '9c': 1.35, '9d': 1.20, '9e': 6.29, '10a': 0.3, '10b': 0.51, '10c': 1.35, '10d': 1.20, '10e': 6.29, 'none': 0 }, // kgCO2e/día
  bottledWater: { '13a': 97, '13b': 49, '13c': 0 },
  foodHabits:   { localFood: -75, composting: -146, noFoodWaste: -80, none: 0 },

  // ── CONSUMO ──
  clothes:     { '15a': 75, '15b': 99, '15c': 187, '15d': 396, '15e': 594, '15f': 891, '15g': 15 },
  electronics: { '16a': 86, '16b': 63, '16c': 194, '16d': 302, '16e': 375, '16f': 73, '16g': 24, '16h': 10, '16i': 0 },
  appliances:  { '19a': 340, '19b': 302, '19c': 270, '19d': 257, '19e': 217, '19f': 415, '19g': 98, '19h': 375, '19i': 0 },
  pets:        { bigDog: 1100, medDog: 770, smallDog: 400, cat: 310, none: 0 },
  hygiene:     { '22a': 13, '22b': 18, '22c': 39 },
  smoking:     { '23a': 0, '23b': 20, '23c': 11, '23d': 46, '23e': 102 },
  sports:      { outdoor: 0, cycling: 10, racket: 43, pool: 43, gym: 31, fitness: 43, martial: 43, athletics: 43, equestrian: 43, golf: 43, nautical: 43, ski: 93, motor: 43, climbing: 43, none: 0 },

  // ── DIGITAL ──
  videoCalls:  { vc_none: 0, vc_sometimes: 8, vc_often: 18, vc_lots: 38 },
  streaming:   { st_none: 0, st_little: 8, st_often: 42, st_lots: 84 },
  socialMedia: { sm_none: 0, sm_little: 16, sm_often: 58, sm_lots: 117 },
  aiUsage:     { none: 0, low: 25, medium: 100, high: 250 },
}

// Bebidas alcohólicas — kgCO2e/año por unidad/semana
const ALCOHOL_FACTORS = {
  soda:    6,   // kg/año por 1 refresco/semana
  wine:    9,   // kg/año por 1 copa/semana
  beer:    19,  // kg/año por 1 botellín/semana
  spirits: 3,   // kg/año por 1 copa destilado/semana
}

export function calcAlcohol(alcohol = {}) {
  if (!alcohol || typeof alcohol !== 'object' || Array.isArray(alcohol)) return 0
  return Math.round(
    (alcohol.soda    || 0) * ALCOHOL_FACTORS.soda    +
    (alcohol.wine    || 0) * ALCOHOL_FACTORS.wine    +
    (alcohol.beer    || 0) * ALCOHOL_FACTORS.beer    +
    (alcohol.spirits || 0) * ALCOHOL_FACTORS.spirits
  )
}

function get(key, val) {
  return MAP[key]?.[val] ?? 0
}

function sum(key, vals) {
  const arr = Array.isArray(vals) ? vals : []
  return arr.reduce((s, v) => s + (MAP[key]?.[v] ?? 0), 0)
}

export function calculator(answers) {
  // ── Transporte ──────────────────────────────────────────────────────────────
  const carKg = answers.carKm === 'km_e' ? 0
    : answers.carType === 'electric'
      ? (MAP.electricCar[answers.carKm] ?? 0)
      : (MAP.carKm[answers.carKm] ?? 0)
  const flightsKg = (answers.flightShort  || 0) * 550
                  + (answers.flightMedium || 0) * 1252
                  + (answers.flightLong   || 0) * 1752
  const transportKg = carKg + flightsKg
    + get('train', answers.train)
    + get('moto', answers.moto)
    + get('urbanMobility', answers.urbanMobility)
    + get('telework', answers.telework)

  // ── Hogar ───────────────────────────────────────────────────────────────────
  let heatingKg = 0
  if (answers.homeType === '25a')      heatingKg = MAP.heatingSmall[answers.heating]  ?? 0
  else if (answers.homeType === '25b') heatingKg = MAP.heatingMedium[answers.heating] ?? 0
  else if (answers.homeType === '25c') heatingKg = MAP.heatingLarge[answers.heating]  ?? 0

  let acKg = 0
  if (answers.hasAC === 'yes') {
    if (answers.homeType === '25a')      acKg = 350
    else if (answers.homeType === '25b') acKg = 420
    else if (answers.homeType === '25c') acKg = 438
  }

  const renewableKg = MAP.renewable[answers.renewable] ?? 0
  const poolKg      = get('pool', answers.pool)

  const housingKg = Math.max(0,
    heatingKg +
    acKg +
    renewableKg +
    sum('homeHabits', answers.homeHabits) +
    poolKg +
    (answers.hotelNights   || 0) * 8 +
    (answers.hostelNights  || 0) * 1 +
    (answers.campingNights || 0) * 1 +
    (answers.airbnbNights  || 0) * 5 +
    (answers.secondHome    ? 250 : 0)
  )

  // ── Alimentación ────────────────────────────────────────────────────────────
  const breakfastKg = Object.entries(answers.breakfastDays || {})
    .reduce((s, [type, days]) => s + (MAP.breakfastDaily[type] ?? 0) * days * 52, 0)
    * (answers.breakfastDouble ? 1.5 : 1)

  const hotDrinksKg = Object.entries(answers.hotDrinksCount || {})
    .reduce((s, [type, count]) => s + (MAP.hotDrinksDaily[type] ?? 0) * count * 365, 0)

  const lunchKg = Object.entries(answers.lunchDays || {})
    .reduce((s, [type, days]) => s + (MAP.mealDaily[type] ?? 0) * days * 52, 0)

  const dinnerKg = Object.entries(answers.dinnerDays || {})
    .reduce((s, [type, days]) => s + (MAP.mealDaily[type] ?? 0) * days * 52, 0)

  const deliveryKg = (answers.deliveryPerWeek || 0) * 3 * 52

  const foodKg = Math.max(0,
    breakfastKg +
    hotDrinksKg +
    calcAlcohol(answers.alcohol) +
    lunchKg +
    dinnerKg +
    get('bottledWater', answers.bottledWater) +
    sum('foodHabits', answers.foodHabits) +
    deliveryKg
  )

  // ── Consumo ─────────────────────────────────────────────────────────────────
  const consumptionKg =
    get('clothes', answers.clothes) +
    sum('electronics', answers.electronics) +
    sum('appliances', answers.appliances) +
    sum('pets', answers.pets) +
    get('hygiene', answers.hygiene) +
    get('smoking', answers.smoking) +
    sum('sports', answers.sports)

  // ── Huella digital ─────────────────────────────────────────────────────────
  const digitalKg =
    get('videoCalls', answers.videoCalls) +
    get('streaming', answers.streaming) +
    get('socialMedia', answers.socialMedia) +
    get('aiUsage', answers.aiUsage)

  // ── Totales ─────────────────────────────────────────────────────────────────
  const totalKg    = transportKg + housingKg + foodKg + consumptionKg + digitalKg + PUBLIC_SERVICES_KG
  const carbonTons = parseFloat((totalKg / 1000).toFixed(2))

  return {
    carbonTons,
    carbonKg: Math.round(totalKg),
    areas: {
      transport:      parseFloat((transportKg        / 1000).toFixed(2)),
      energy:         parseFloat((housingKg          / 1000).toFixed(2)),
      food:           parseFloat((foodKg             / 1000).toFixed(2)),
      consumption:    parseFloat((consumptionKg      / 1000).toFixed(2)),
      waste:          parseFloat((digitalKg          / 1000).toFixed(2)),
      publicServices: parseFloat((PUBLIC_SERVICES_KG / 1000).toFixed(2)),
    },
    category: carbonTons < 4 ? 'bajo' : carbonTons < 7 ? 'medio' : carbonTons < 10 ? 'alto' : 'muy alto',
  }
}
