// test-calculator.mjs
// Correr con: node test-calculator.mjs

import { calculator, calcAlcohol } from './frontend/src/utils/calculator.js'

let passed = 0
let failed = 0

function check(label, actual, expected, tolerance = 0.01) {
  const ok = Math.abs(actual - expected) <= tolerance
  if (ok) {
    console.log(`  ✓ ${label}: ${actual}`)
    passed++
  } else {
    console.error(`  ✗ ${label}: got ${actual}, expected ${expected}`)
    failed++
  }
}

// ─────────────────────────────────────────────
// PERFIL DE TEST — valores elegidos para cálculo manual sencillo
// ─────────────────────────────────────────────
const answers = {

  // TRANSPORTE
  carKm:          'km_b',       // gasolina, 3000-10000 km → 797 kg
  carType:        'gasoline',
  flightShort:    1,            // 1 vuelo corto → 550 kg
  flightMedium:   0,
  flightLong:     0,
  train:          '3b',         // bastante → 126 kg
  moto:           '4d',         // no moto → 0
  urbanMobility:  '5a',         // a pie → 0
  telework:       'never',      // nunca → 0

  // HOGAR
  householdSize:  '2',          // 2 personas → div = 2
  homeType:       '25b',        // piso mediano
  heating:        '26c',        // gas natural → heatingMedium[26c] = 1170 → /2 = 585
  hasAC:          'yes',        // piso mediano → 420
  renewable:      'c',          // mix convencional → 0
  pool:           'noPool',     // → 0
  homeHabits:     ['none'],     // → 0
  hotelNights:    5,            // 5 × 8 = 40
  hostelNights:   0,
  campingNights:  0,
  airbnbNights:   0,
  secondHome:     false,

  // ALIMENTACIÓN
  breakfastDays:  { '6a': 5, '6d': 2 },   // 5×0.4×52 + 2×0.11×52 = 104 + 11.44 = 115.44
  hotDrinksCount: { '7e': 2 },             // 2×0.16×365 = 116.8
  alcohol: { soda: 0, wine: 2, beer: 0, spirits: 0 }, // 2×9 = 18
  lunchDays:      { '9c': 4, '9a': 3 },   // 4×1.35×52 + 3×0.3×52 = 280.8 + 46.8 = 327.6
  dinnerDays:     { '9b': 7 },             // 7×0.51×52 = 185.64
  bottledWater:   '13c',                   // grifo → 0
  foodHabits:     ['none'],                // → 0
  deliveryPerWeek: 1,                      // 1×3×52 = 156

  // CONSUMO
  clothes:        '15b',        // 3-5 prendas → 99
  electronics:    ['16a'],      // smartphone → 86
  appliances:     ['19i'],      // ninguno reciente → 0
  pets:           ['none'],     // → 0
  hygiene:        '22a',        // pocos → 13
  smoking:        '23a',        // no fumo → 0
  sports:         ['cycling', 'gym'], // 10 + 31 = 41

  // DIGITAL
  videoCalls:     'vc_sometimes', // 8
  streaming:      'st_often',     // 28
  socialMedia:    'sm_little',    // 16
  aiUsage:        'low',          // 25
}

// ─────────────────────────────────────────────
// CÁLCULOS ESPERADOS
// ─────────────────────────────────────────────

// TRANSPORTE
const exp_car        = 797
const exp_flights    = 550
const exp_train      = 126
const exp_transport  = 797 + 550 + 126 + 0 + 0 + 0  // 1473

// HOGAR
const exp_heating    = 1170 / 2   // 585
const exp_ac         = 420
const exp_hotel      = 5 * 8      // 40
const exp_housing    = 585 + 420 + 0 + 0 + 0 + 40 + 0  // 1045

// ALIMENTACIÓN
const exp_breakfast  = (5 * 0.4 + 2 * 0.11) * 52   // 115.44
const exp_hotdrinks  = 2 * 0.16 * 365               // 116.8
const exp_alcohol    = 2 * 9                         // 18
const exp_lunch      = (4 * 1.35 + 3 * 0.3) * 52   // 327.6
const exp_dinner     = 7 * 0.51 * 52                // 185.64
const exp_delivery   = 1 * 3 * 52                   // 156
const exp_food       = exp_breakfast + exp_hotdrinks + exp_alcohol + exp_lunch + exp_dinner + exp_delivery
// 115.44 + 116.8 + 18 + 327.6 + 185.64 + 156 = 919.48

// CONSUMO
const exp_clothes    = 99
const exp_electronics = 86
const exp_sports     = 10 + 31    // 41
const exp_hygiene    = 13
const exp_consumption = 99 + 86 + 0 + 0 + 13 + 0 + 41  // 239

// DIGITAL
const exp_digital    = 8 + 28 + 16 + 25 + 1500  // 1577

const exp_total      = exp_transport + exp_housing + exp_food + exp_consumption + exp_digital
// 1473 + 1045 + 919.48 + 239 + 1577 = 5253.48

// ─────────────────────────────────────────────
// EJECUTAR TESTS
// ─────────────────────────────────────────────

const result = calculator(answers)

console.log('\n── TRANSPORTE ──')
check('transport kg', result.areas.transport * 1000, exp_transport, 1)

console.log('\n── HOGAR ──')
check('housing kg', result.areas.energy * 1000, exp_housing, 1)

console.log('\n── ALIMENTACIÓN ──')
check('alcohol kg', calcAlcohol(answers.alcohol), exp_alcohol, 0.5)
check('food kg', result.areas.food * 1000, exp_food, 1)

console.log('\n── CONSUMO ──')
check('consumption kg', result.areas.consumption * 1000, exp_consumption, 1)

console.log('\n── DIGITAL ──')
check('digital kg', result.areas.waste * 1000, exp_digital, 1)

console.log('\n── TOTAL ──')
check('total kg', result.carbonKg, Math.round(exp_total), 1)
check('total tons', result.carbonTons, parseFloat((exp_total / 1000).toFixed(2)), 0.01)
check('category', result.category === 'medio', true, 0) // 5.25t → medio

console.log(`\n${passed} passed, ${failed} failed`)
if (failed === 0) {
  console.log('✓ Todo correcto — el calculator es consistente\n')
} else {
  console.log('✗ Hay discrepancias — revisar los campos marcados arriba\n')
}