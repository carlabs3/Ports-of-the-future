// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 7,
  name: 'Boreal',
  meta: { zone: 'Northern / Baltic', size: 'medium', description: 'Cold northern port' },
  // PUBLIC
  contextSheet: 'Cold northern port where snow/ice storms and wind storms dominate, with storm surge secondary and some rainfall.',
  // SECRET — sum = 10
  exposureWeights: { SS: 2, RF: 1, HW: 0, WS: 3, DR: 0, WF: 0, SI: 4 },
}
