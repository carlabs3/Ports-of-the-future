// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 6,
  name: 'Insularis',
  meta: { zone: 'Island', size: 'small', description: 'Island port' },
  // PUBLIC
  contextSheet: 'Insularis is a small island port ringed by open sea and exposed to the full strength of the summer sun. Prolonged heat stresses operations, while its unsheltered shoreline takes the brunt of coastal high water driven in from the surrounding waters.',
  // SECRET — sum = 10
  exposureWeights: { SS: 2, RF: 1, HW: 3, WS: 2, DR: 1, WF: 1, SI: 0 },
}
