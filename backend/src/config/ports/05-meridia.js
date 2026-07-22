// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 5,
  name: 'Meridia',
  meta: { zone: 'Southern Mediterranean', size: 'medium', description: 'Hot southern port' },
  // PUBLIC
  contextSheet: 'Meridia is a medium Mediterranean port on a sun-baked southern shore backed by dry scrubland. Long spells of extreme summer heat bake the terminals, and the tinder-dry hills inland behind the port are prone to fast-spreading blazes.',
  // SECRET — sum = 10
  exposureWeights: { SS: 1, RF: 1, HW: 4, WS: 1, DR: 1, WF: 2, SI: 0 },
}
