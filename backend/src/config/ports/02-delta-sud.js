// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 2,
  name: 'Delta Sud',
  meta: { zone: 'River delta', size: 'large', description: 'Delta port at a river mouth' },
  // PUBLIC
  contextSheet: 'Delta port where storm surge and river flooding are the leading threats, followed by wind storms and heatwaves.',
  // SECRET — sum = 10
  exposureWeights: { SS: 4, RF: 2, HW: 1, WS: 2, DR: 1, WF: 0, SI: 0 },
}
