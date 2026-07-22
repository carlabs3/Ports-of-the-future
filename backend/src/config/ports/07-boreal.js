// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 7,
  name: 'Boreal',
  meta: { zone: 'Northern / Baltic', size: 'small', description: 'Cold northern port' },
  // PUBLIC
  contextSheet: 'Boreal is a small port on a cold, high-latitude coast where winters are long and severe. Heavy snowfall and freezing conditions grip the terminals for months, and fierce winter winds off the sea batter the exposed berths.',
  // SECRET — sum = 10
  exposureWeights: { SS: 2, RF: 1, HW: 0, WS: 3, DR: 0, WF: 0, SI: 4 },
}
