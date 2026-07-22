// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 9,
  name: 'Atlantis',
  meta: { zone: 'Atlantic', size: 'large', description: 'Exposed Atlantic port' },
  // PUBLIC
  contextSheet: 'Atlantis is a large port on a fully exposed ocean coast, facing the open Atlantic with nothing to break the weather. Relentless ocean gales drive across the terminals, and the same storms push the sea high against the breakwaters and quays.',
  // SECRET — sum = 10
  exposureWeights: { SS: 3, RF: 1, HW: 1, WS: 4, DR: 1, WF: 0, SI: 0 },
}
