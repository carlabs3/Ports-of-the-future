// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 'boreal',
  name: 'Boreal',
  climateZone: 'Cold / sub-arctic',
  coastalSetting: 'Open coast',
  size: 'Small',
  governance: 'Public port (municipal)',
  colour: '#C5E4FF',
  image: '/ports/boreal.webp',
  deck: [8, 10, 14, 19, 20, 23, 1, 5, 6, 12, 13, 17, 24],
  exposureWeights: { SS: 2, RF: 1, HW: 0, WS: 3, DR: 0, WF: 0, SI: 4 },
}
