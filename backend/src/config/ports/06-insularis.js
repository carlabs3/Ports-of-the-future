// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 6,
  name: 'Insularis',
  meta: { zone: 'Island', size: 'medium', description: 'Island port' },
  // PUBLIC
  contextSheet: 'Island port led by heatwaves, with balanced storm surge and wind storm exposure and lighter rainfall, drought and wildfire risk.',
  // SECRET — sum = 10
  exposureWeights: { SS: 2, RF: 1, HW: 3, WS: 2, DR: 1, WF: 1, SI: 0 },
}
