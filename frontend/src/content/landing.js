// All landing-page copy and placeholders live here. Rule: when a placeholder is
// an empty string (or empty array), the line/element that uses it is NOT
// rendered — the public page never shows brackets, "TODO", or empty fields.

export const landing = {
  // ── Placeholders — fill these in when verified; empty = hidden ────────────
  contactEmail: '',          // TODO: workshop contact email (e.g. hello@…)
  responseTime: '',          // TODO: e.g. "We usually reply within a week."
  recommendedGroupSize: '',  // TODO: e.g. "6–40 participants across up to 8 teams."
  privacyUrl: '',            // TODO: link to the privacy policy
  sessionPhoto: '',          // TODO: URL of a real photo of a session
  partnerLogos: [],          // TODO: [{ src: '', alt: '' }, …]

  header: {
    brand: 'Ports of the Future',
    nav: [
      { label: 'The experience', href: '#how' },
      { label: 'What you get', href: '#get' },
      { label: "Who it's for", href: '#who' },
      { label: 'Request a workshop', href: '#request' },
    ],
    loginLabel: 'Facilitator login',
    sessionsLabel: 'Sessions', // shown instead of login when a facilitator is signed in
  },

  hero: {
    label: 'A 90-minute climate resilience workshop for ports',
    h1: 'How ready is your port for the next storm?',
    paragraph: 'Ninety minutes. One room. A port that has to get through what’s coming. What would you protect first?',
    primary: 'Request a workshop →',
    secondary: 'The experience',
    card: {
      label: 'In a session right now?',
      title: 'Enter the code on the screen',
      inputLabel: 'Session code',
      placeholder: 'PORT-0000',
      button: 'Join →',
    },
    panoramaAlt: 'A port at the water’s edge: cranes, stacked containers and a ship, under clouds and rain.',
  },

  whyNow: {
    num: '01', title: 'Why now',
    stats: [
      { big: '80%', color: 'ink', text: 'of international trade passes through ports — and every port is exposed to more than one hazard.', source: 'World Bank', url: '' },           // TODO: source url
      { big: '20–60%', color: 'harbour', text: 'economic losses from operational disruptions, depending on how severe and how long they are.', source: 'European Commission', url: '' }, // TODO: source url
      { big: 'More often', color: 'ink', text: 'Storms, heavy rainfall, coastal flooding and heatwaves have increased in Europe over the last decade.', source: 'European Commission', url: '' }, // TODO: source url
    ],
  },

  experience: {
    num: '02', title: 'The experience', anchor: 'how',
    labelRight: '90 minutes · one room',
    h2: 'From gut feeling to a decision you can defend.',
    steps: [
      { n: '01', title: 'Assess', text: 'Where does your port really stand? The answer is rarely the one you expect.' },
      { n: '02', title: 'Decide', text: 'Resources are limited. Every choice leaves something uncovered.' },
      { n: '03', title: 'Face it', text: 'Then the weather has its say.' },
      { n: '04', title: 'Learn', text: 'What held, what didn’t, and why — together, with the whole room.' },
    ],
  },

  photoBand: {
    caption: 'Up to 8 teams. One shared screen. Every phone in the room counts.',
  },

  get: {
    num: '03', title: 'What participants leave with', anchor: 'get',
    items: [
      { n: '01', tile: 'sky',     title: 'An honest picture',          text: 'Of how ready your own organisation is — and how that compares with the people around you.' },
      { n: '02', tile: 'harbour', title: 'Priorities you can defend',  text: 'A clearer sense of what to protect first, and what it costs to leave things uncovered.' },
      { n: '03', tile: 'ink',     title: 'A shared language',          text: 'For talking about climate risk across teams, departments and partners.' },
    ],
  },

  who: {
    num: '04', title: "Who it's for", anchor: 'who',
    audiences: [
      { n: '01', label: 'Port authorities' },
      { n: '02', label: 'Terminal operators and logistics' },
      { n: '03', label: 'City and regional governments' },
      { n: '04', label: 'Universities and training programmes' },
    ],
    needLabel: 'What you need',
    needs: [
      { title: 'Up to 8 teams', usesRecommendedGroupSize: true }, // text comes from recommendedGroupSize; hidden while empty
      { title: 'One projector', text: 'The facilitator screen runs in any browser.' },
      { title: 'Phones', text: 'Participants join with a QR code. No app, no sign-up, anonymous.' },
      { title: '90 minutes', text: 'In person, in English.' },
    ],
  },

  request: {
    num: '05', title: 'Request a workshop', anchor: 'request',
    h2: 'Bring it to your port.',
    text: 'Tell us about your group and we’ll get back to you with dates and a facilitator.',
    emailPrefix: 'Or write to ',
    fields: {
      name: 'Your name',
      organisation: 'Organisation',
      email: 'Email',
      country: 'Country',
      participants: 'Expected participants',
      dates: 'Preferred dates',
      message: 'Anything we should know?',
      messagePlaceholder: 'Context, goals, language, constraints…',
    },
    consent: 'I agree that my details are used only to answer this request.',
    submit: 'Send request →',
    sending: 'Sending…',
    success: 'Thanks — we’ll be in touch.',
    error: 'Something went wrong. Please try again.',
  },

  footer: {
    brand: 'Ports of the Future',
    privacyLabel: 'Privacy',
    loginLabel: 'Facilitator login',
  },
}
