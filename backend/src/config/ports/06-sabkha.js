// See 01-nord-maris.js for field conventions. wheels are SECRET (v5); potential losses live on the events (J1).
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
  wheels: {
    1: { year: 2026, likelihoods: { SS: 20, HW: 40, WS: 10, DR: 30 } },
    2: { year: 2031, likelihoods: { SS: 15, HW: 45, WS: 10, DR: 30 } },
    3: { year: 2036, likelihoods: { SS: 20, HW: 45, WS: 5, DR: 30 } },
  },
}
