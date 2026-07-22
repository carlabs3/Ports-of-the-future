// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 2,
  name: 'Delta Sud',
  meta: { zone: 'River delta', size: 'large', description: 'Delta port at a river mouth' },
  // PUBLIC
  contextSheet: 'Delta Sud is a large port built across the mouth of a major river, where the open sea meets the freshwater plain. Coastal high water backs up against the delta, while heavy rains upstream swell the river channels that thread between the terminals.',
  // SECRET — sum = 10
  exposureWeights: { SS: 4, RF: 2, HW: 1, WS: 2, DR: 1, WF: 0, SI: 0 },
}
