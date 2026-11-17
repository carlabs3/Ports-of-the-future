// All public home-page copy lives here, verbatim from the workshop brief
// (Appendix A). Rule kept from before: when a value is an empty string (or empty
// array), the element that uses it is NOT rendered — the page never shows
// brackets, "TODO", or empty fields. Typographic apostrophes (’) are intentional.

export const landing = {
  header: {
    brand: 'Ports of the Future',
    nav: [
      { label: 'The experience',     href: '#session' },
      { label: 'Made to measure',    href: '#context' },
      { label: 'Who it’s for',       href: '#who' },
      { label: 'Request a workshop', href: '#request' },
    ],
    loginLabel: 'Facilitator login',
    sessionsLabel: 'Sessions', // shown instead of login when a facilitator is signed in
  },

  hero: {
    eyebrow: 'A 90-minute climate resilience workshop for ports',
    h1: 'How ready is your port for the next storm?',
    lead: 'A port that has to get through what’s coming. What would you protect first?',
    button: 'Request a workshop →',
    shipAlt: 'Illustration of a container ship at sea',
  },

  joinCard: {
    pill: 'Participants',
    title: 'Join your session',
    text: 'Type the code shown on the facilitator’s screen. No sign-up, no app to install.',
    label: 'Session code',
    placeholder: 'PORT-0000',
    button: 'Join the session →',
    stripText: 'Running the workshop?',
    stripLink: 'Facilitator login →',
  },

  whyNow: {
    anchor: 'why-now',
    eyebrow: 'Why now',
    h2: 'Ports are already paying for this.',
    text: 'Most port teams know the risk. Fewer have agreed what to fix first, who decides, or who pays.',
    stats: [
      { big: '86%',   text: 'of major ports are exposed to more than three types of natural hazard.' },
      { big: '$67bn', text: 'of trade is at risk every year from port downtime.' },
    ],
    source: 'Verschuur et al. (2023), University of Oxford, Communications Earth & Environment',
  },

  experience: {
    anchor: 'session',
    eyebrow: 'The experience',
    h2: 'What happens in the room',
    steps: [
      { n: '01', time: '15 MIN', title: 'Look at yourselves',    text: 'Everyone answers ten questions on their phone about how their own organisation handles climate adaptation. The room sees its answers on the big screen, anonymously, as they come in.' },
      { n: '02', time: '15 MIN', title: 'Read the risk',         text: 'Each table takes over a port and receives its vulnerability report. The clues are in there. So are a few red herrings.' },
      { n: '03', time: '45 MIN', title: 'Spend, then live with it', text: 'A limited budget, a deck of real adaptation measures and three rounds: 2026, 2031, 2036. Then the weather arrives. A good plan can still have a bad year, and the scoring knows the difference.' },
    ],
    debrief: {
      n: '04', time: '10 MIN',
      text: 'The last ten minutes are a debrief: what worked, what the room’s own culture changed, and what people take back to the office.',
    },
  },

  whyWorkshop: {
    anchor: 'why',
    eyebrow: 'Why this workshop',
    h2: 'Why Ports of the Future?',
    items: [
      { n: '01', title: 'See the real risk',          text: 'Tell apart the hazards that drive a port’s losses from the ones that only feel urgent.' },
      { n: '02', title: 'From your port to a strategy', text: 'Everyone rates their own port’s readiness, then each table builds a strategy for a fictional port.' },
      { n: '03', title: 'Learn by playing',           text: 'An app, port briefs and solution cards on the table. No passive slides.' },
      { n: '04', title: 'Leave with evidence',        text: 'The room’s own readiness scores and a written results report you can take to your board.' },
    ],
  },

  madeToMeasure: {
    anchor: 'context',
    eyebrow: 'Made to measure',
    h2: 'Adapted to your context',
    cards: [
      { title: 'Your ports',    text: 'Fictional ports modelled on your region, your port types and your governance.' },
      { title: 'Your hazards',  text: 'The extreme events that matter where you are, with their likelihood and their cost.' },
      { title: 'Your measures', text: 'Solution cards built from your own adaptation options and budgets.' },
      { title: 'Your audience', text: 'Port staff, partners and stakeholders, students or a mixed room at a conference.' },
      { title: 'Your format',   text: 'A conference session, a team day or a module in a training course.' },
      { title: 'Your language', text: 'Delivered in English, French or Spanish.' },
    ],
  },

  whoFor: {
    anchor: 'who',
    eyebrow: 'Who it’s for',
    h2: 'Built for the people who run ports',
    cards: [
      { tags: ['IN-HOUSE', 'TEAM DAY'],        title: 'Port authorities and terminal operators', text: 'Run it with your own staff. Mix operations, engineering, finance and HR at each table: that is where it gets interesting.' },
      { tags: ['CONFERENCE SESSION'],          title: 'Port associations and conferences',        text: 'A hands-on slot for 24 to 36 delegates that people talk about afterwards, with data from the room you can publish.' },
      { tags: ['STAKEHOLDER WORKSHOP', 'TRAINING'], title: 'EU projects, networks and universities', text: 'A stakeholder session that produces findings as well as attendance, or a module that gives students a port to run.' },
    ],
  },

  practical: {
    eyebrow: 'What you need',
    h2: 'The practical part',
    tiles: [
      { big: '90',    label: 'minutes, start to finish' },
      { big: '24–36', label: 'people per session' },
      { big: '6',     label: 'teams, one port each' },
      { big: '3',     label: 'languages: EN, FR, ES' },
    ],
    weBring: {
      title: 'We bring',
      items: [
        'Two facilitators',
        'Printed port reports, solution cards and worksheets',
        'The app: phones for participants, one screen for the room',
        'A results report after the session',
      ],
    },
    youProvide: {
      title: 'You provide',
      items: [
        'A room with six tables',
        'A projector or a big screen',
        'Wifi the participants can join',
      ],
      price: 'Price: on request',
    },
  },

  request: {
    anchor: 'request',
    eyebrow: 'Request a workshop',
    h2: 'Bring it to your port.',
    text: 'Tell us roughly when and how many people. We reply within two working days with dates and a quote.',
    emailPrefix: 'Prefer email? Write to ',
    emailName: 'Eva Boo',
    email: 'eva@werightclick.com',
    fields: {
      name: 'Name',
      organisation: 'Port or organisation',
      email: 'Work email',
      message: 'Anything we should know? Event, date, context',
    },
    consent: 'I agree that my details are used only to answer this request.',
    submit: 'Send request →',
    sending: 'Sending…',
    success: 'Thanks — we’ll be in touch.',
    error: 'Something went wrong. Please try again.',
  },

  footer: {
    brand: 'Ports of the Future',
    blurb: 'Developed within SAFARI, a Horizon Europe project (grant agreement 101147432) building tools for climate-resilient ports, piloted in Dunkirk, Seville and Lisbon. Designed and run by Three o’clock and We Right Click.',
    privacyLabel: 'Privacy',
    loginLabel: 'Facilitator login',
    hashtag: '#PortsoftheFuture',
    // TODO (confirmed with Carla): EU emblem + SAFARI + Three o'clock + We Right
    // Click logos go here, in a row above the disclaimer. Add image files to
    // src/assets/home/ and list them as { src, alt }. Empty = row hidden.
    // The EU emblem must not be recoloured.
    partnerLogos: [],
    // TODO (confirmed with Carla): final wording + granting authority to be
    // supplied. Placeholder below is kept so the footer layout is correct.
    euDisclaimer: 'Funded by the European Union under grant agreement No 101147432. Views and opinions expressed are however those of the author(s) only and do not necessarily reflect those of the European Union or [GRANTING AUTHORITY]. Neither the European Union nor the granting authority can be held responsible for them.',
  },

  privacyUrl: '', // TODO: link to the privacy policy; empty = Privacy link hidden
}
