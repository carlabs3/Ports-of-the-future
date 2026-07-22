// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 9,
  name: 'Atlantis',
  meta: { zone: 'Atlantic', size: 'large', description: 'Exposed Atlantic port' },
  // PUBLIC
  contextSheet: 'Exposed Atlantic port where wind storms and storm surge dominate, with lighter rainfall, heat and drought exposure.',
  // SECRET — sum = 10
  exposureWeights: { SS: 3, RF: 1, HW: 1, WS: 4, DR: 1, WF: 0, SI: 0 },
}
