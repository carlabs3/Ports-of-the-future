// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 3,
  name: 'Riu Verd',
  meta: { zone: 'Inland river', size: 'medium', description: 'Riverine port with inland links' },
  // PUBLIC
  contextSheet: 'Riverine port dominated by heavy rainfall and drought/low-water events, with heatwaves as a further stressor.',
  // SECRET — sum = 10
  exposureWeights: { SS: 0, RF: 4, HW: 2, WS: 1, DR: 3, WF: 0, SI: 0 },
}
