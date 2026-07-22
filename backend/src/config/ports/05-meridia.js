// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 5,
  name: 'Meridia',
  meta: { zone: 'Southern Mediterranean', size: 'medium', description: 'Hot southern port' },
  // PUBLIC
  contextSheet: 'Hot southern port where heatwaves dominate and hinterland wildfire is a clear secondary threat, with a mild spread of storm surge, rainfall, wind and drought.',
  // SECRET — sum = 10
  exposureWeights: { SS: 1, RF: 1, HW: 4, WS: 1, DR: 1, WF: 2, SI: 0 },
}
