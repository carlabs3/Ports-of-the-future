// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 4,
  name: 'Rhona',
  meta: { zone: 'Southern river', size: 'medium', description: 'River-fed southern port' },
  // PUBLIC
  contextSheet: 'Rhona is a medium river port in a dry southern basin fed by seasonal flows. Long rainless stretches leave the river running shallow and unreliable for navigation, while sudden downpours swing it the other way and send the channel spilling over its banks.',
  // SECRET — sum = 10
  exposureWeights: { SS: 0, RF: 3, HW: 1, WS: 1, DR: 4, WF: 1, SI: 0 },
}
