// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 8,
  name: 'Adria',
  meta: { zone: 'Adriatic', size: 'medium', description: 'Adriatic port' },
  // PUBLIC
  contextSheet: 'Adriatic port where river flooding and wind storms dominate, with lighter storm surge, heat and drought exposure.',
  // SECRET — sum = 10
  exposureWeights: { SS: 1, RF: 4, HW: 1, WS: 3, DR: 1, WF: 0, SI: 0 },
}
