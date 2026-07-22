// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 4,
  name: 'Rhona',
  meta: { zone: 'Southern river', size: 'medium', description: 'River-fed southern port' },
  // PUBLIC
  contextSheet: 'River-fed southern port where drought/low water is the top threat, followed by rainfall, with heat, wind storms and hinterland wildfire as lesser risks.',
  // SECRET — sum = 10
  exposureWeights: { SS: 0, RF: 3, HW: 1, WS: 1, DR: 4, WF: 1, SI: 0 },
}
