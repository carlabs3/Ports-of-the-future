// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 10,
  name: 'Kanal',
  meta: { zone: 'Lowland canal', size: 'medium', description: 'Canal / lowland port' },
  // PUBLIC
  contextSheet: 'Canal / lowland port where river flooding dominates, with drought/low water and wind storms as secondary threats, plus a touch of heat and ice.',
  // SECRET — sum = 10
  exposureWeights: { SS: 0, RF: 4, HW: 1, WS: 2, DR: 2, WF: 0, SI: 1 },
}
