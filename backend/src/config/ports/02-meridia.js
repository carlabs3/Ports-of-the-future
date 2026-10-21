// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 'meridia',
  name: 'Meridia',
  colour: '#D9822B',
  climateZone: 'Mediterranean',
  coastalSetting: 'Bay or lagoon',
  size: 'Medium',
  governance: 'Public port',
  deck: [8, 10, 14, 19, 20, 23, 4, 11, 12, 15, 16, 22, 25, 26],
  exposureWeights: { SS: 0, RF: 2, HW: 3, WS: 1, DR: 1, WF: 3, SI: 0 },
}
