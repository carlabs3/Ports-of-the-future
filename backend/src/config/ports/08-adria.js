// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 8,
  name: 'Adria',
  meta: { zone: 'Adriatic', size: 'medium', description: 'Adriatic port' },
  // PUBLIC
  contextSheet: 'Adria is a medium port on a semi-enclosed eastern sea, tucked against steep coastal hills. Sudden torrential downpours send flash floods down onto the quays, and a cold, violent wind funnels off the mountains to hammer the harbour.',
  // SECRET — sum = 10
  exposureWeights: { SS: 1, RF: 4, HW: 1, WS: 3, DR: 1, WF: 0, SI: 0 },
}
