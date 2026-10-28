// See 01-nord-maris.js for field conventions. wheels + impacts are SECRET (v5).
export default {
  id: 'boreal',
  name: 'Boreal',
  climateZone: 'Cold / sub-arctic',
  coastalSetting: 'Open coast',
  size: 'Small',
  governance: 'Public port (municipal)',
  colour: '#C5E4FF',
  image: '/ports/boreal.webp',
  description: 'Northern Baltic coast',
  deck: [8, 10, 14, 19, 20, 23, 1, 5, 6, 12, 13, 17, 24, 27, 28],
  wheels: {
    1: { year: 2026, likelihoods: { SS: 20, RF: 10, WS: 30, SI: 40 } },
    2: { year: 2031, likelihoods: { SS: 25, RF: 10, WS: 30, SI: 35 } },
    3: { year: 2036, likelihoods: { SS: 25, RF: 15, WS: 30, SI: 30 } },
  },
  impacts: { SS: 3, RF: 1, WS: 3, SI: 5 },
  impactRound3Plus: ['SS', 'RF'],
}
