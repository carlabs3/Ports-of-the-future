// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 3,
  name: 'Riu Verd',
  meta: { zone: 'Inland river', size: 'medium', description: 'Riverine port with inland links' },
  // PUBLIC
  contextSheet: 'Riu Verd is a medium inland port set well up a single river valley, entirely dependent on that watercourse. Intense rainfall upstream can send the river over its banks, yet in dry spells the same channel drops so low that vessel draughts and berths are constrained.',
  // SECRET — sum = 10
  exposureWeights: { SS: 0, RF: 4, HW: 2, WS: 1, DR: 3, WF: 0, SI: 0 },
}
