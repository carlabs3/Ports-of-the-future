// See 01-nord-maris.js for field conventions. wheels are SECRET (v5); potential losses live on the events (J1).
export default {
  id: 'riu-verd',
  name: 'Riu Verd',
  climateZone: 'Mediterranean (inland)',
  coastalSetting: 'Estuary or river',
  size: 'Medium',
  governance: 'Landlord port',
  colour: '#F4B860',
  image: '/ports/riu-verd.webp',
  description: 'River port in Southern Europe',
  deck: [8, 10, 14, 19, 20, 23, 3, 5, 7, 9, 11, 17, 21, 22, 25],
  wheels: {
    1: { year: 2026, likelihoods: { RF: 30, HW: 20, DR: 40, WF: 10 } },
    2: { year: 2031, likelihoods: { RF: 25, HW: 25, DR: 40, WF: 10 } },
    3: { year: 2036, likelihoods: { RF: 20, HW: 25, DR: 45, WF: 10 } },
  },
}
