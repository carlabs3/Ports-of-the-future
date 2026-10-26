// See 01-nord-maris.js for field conventions. exposureWeights is SECRET (sum 10).
export default {
  id: 'sabkha',
  name: 'Sabkha',
  climateZone: 'Arid / desert',
  coastalSetting: 'Artificial / engineered coastline',
  size: 'Large',
  governance: 'Private port',
  colour: '#F07167',
  image: '/ports/sabkha.webp',
  description: 'Hot desert coast',
  deck: [8, 10, 14, 19, 20, 23, 2, 3, 5, 11, 12, 16, 26],
  exposureWeights: { SS: 2, RF: 0, HW: 4, WS: 1, DR: 3, WF: 0, SI: 0 },
}
