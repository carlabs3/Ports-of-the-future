// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 10,
  name: 'Kanal',
  meta: { zone: 'Lowland canal', size: 'small-medium', description: 'Canal / lowland port' },
  // PUBLIC
  contextSheet: 'Kanal is a small-to-medium port on a low-lying network of canals and channels linked to a river system. Prolonged rain swells those waterways until they spill over the flat terminals, while dry periods drop water levels enough to hamper barge movements.',
  // SECRET — sum = 10
  exposureWeights: { SS: 0, RF: 4, HW: 1, WS: 2, DR: 2, WF: 0, SI: 1 },
}
