// See 01-nord-maris.js for field conventions. wheels are SECRET (v5); potential losses live on the events (J1).
export default {
  id: 'meridia',
  name: 'Meridia',
  climateZone: 'Mediterranean',
  coastalSetting: 'Bay or lagoon',
  size: 'Medium',
  governance: 'Public port',
  colour: '#77AEF1',
  image: '/ports/meridia.webp',
  description: 'Northern Mediterranean coast',
  deck: [8, 10, 14, 19, 20, 23, 4, 11, 12, 15, 16, 22, 25, 26],
  wheels: {
    1: { year: 2026, likelihoods: { RF: 20, HW: 30, WS: 10, DR: 10, WF: 30 } },
    2: { year: 2031, likelihoods: { RF: 15, HW: 35, WS: 10, DR: 10, WF: 30 } },
    3: { year: 2036, likelihoods: { RF: 15, HW: 35, WS: 5, DR: 15, WF: 30 } },
  },
}
