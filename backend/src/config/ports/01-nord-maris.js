// Port catalogue entry (workshop v5, Appendices B / E / F). One file per port.
// PUBLIC fields: id, name, climateZone, coastalSetting, size, governance, colour,
// image, description, deck.
// SECRET (never served before the moment the prompt allows — see D3/D4):
//   `wheels`  — one per round (1=2026, 2=2031, 3=2036). Each `likelihoods` map is
//               in percent, in steps of 5, and MUST sum to 100. Events not listed
//               are 0 and can never be drawn that round.
//   `impacts` — damage in coins (1–5) per event for this port, used in rounds 1 & 2.
//   `impactRound3Plus` — the two events that gain +1 impact in round 3 (2036).
// `deck` = the measure ids this port may buy (6 shared + port-specific).
export default {
  id: 'nord-maris',
  name: 'Nord-Maris',
  climateZone: 'Temperate',
  coastalSetting: 'Artificial / engineered coastline',
  size: 'Large',
  governance: 'Landlord port',
  colour: '#062D69',
  image: '/ports/nord-maris.webp',
  description: 'North Sea coast',
  deck: [8, 10, 14, 19, 20, 23, 1, 2, 3, 6, 9, 13, 18, 27],
  wheels: {
    1: { year: 2026, likelihoods: { SS: 40, RF: 10, HW: 10, WS: 30, SI: 10 } },
    2: { year: 2031, likelihoods: { SS: 40, RF: 10, HW: 15, WS: 30, SI: 5 } },
    3: { year: 2036, likelihoods: { SS: 45, RF: 10, HW: 15, WS: 25, SI: 5 } },
  },
  impacts: { SS: 5, RF: 2, HW: 1, WS: 4, SI: 2 },
  impactRound3Plus: ['RF', 'HW'],
}
