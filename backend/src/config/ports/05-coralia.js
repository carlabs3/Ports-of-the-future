// See 01-nord-maris.js for field conventions. wheels + impacts are SECRET (v5).
export default {
  id: 'coralia',
  name: 'Coralia',
  climateZone: 'Tropical',
  coastalSetting: 'Bay or lagoon (behind a coral reef)',
  size: 'Medium',
  governance: 'Tool port',
  colour: '#2CDA9D',
  image: '/ports/coralia.webp',
  description: 'Tropical island (cyclone belt)',
  deck: [8, 10, 14, 19, 20, 23, 1, 2, 3, 5, 12, 13, 15, 18],
  wheels: {
    1: { year: 2026, likelihoods: { SS: 30, RF: 20, HW: 10, WS: 40 } },
    2: { year: 2031, likelihoods: { SS: 30, RF: 15, HW: 15, WS: 40 } },
    3: { year: 2036, likelihoods: { SS: 35, RF: 15, HW: 15, WS: 35 } },
  },
  impacts: { SS: 4, RF: 3, HW: 2, WS: 5 },
  impactRound3Plus: ['SS', 'HW'],
}
