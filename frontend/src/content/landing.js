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
    h1: 'Is your port ready for whatever comes next?',
    lead: 'Step into the shoes of a port decision-maker. Assess the risks, invest wisely and see how your strategy holds up when extreme weather strikes.',
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
    text: 'Extreme weather can damage infrastructure, disrupt operations and affect supply chains far beyond the port. The challenge is not just understanding the risks, but deciding where to act first, with limited resources and an uncertain future.',
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
      { n: '01', time: '15 MIN', title: 'Assess your readiness', text: 'Start with a quick self-assessment of your organisation’s approach to climate adaptation. Ten questions, answered anonymously on your phone, reveal the room’s collective strengths and gaps.' },
      { n: '02', time: '15 MIN', title: 'Read the risks',        text: 'Each team takes charge of a fictional port and receives its vulnerability report. Analyse the hazards, identify what matters most and decide where your port is most at risk.' },
      { n: '03', time: '45 MIN', title: 'Make your move',        text: 'Three rounds. Three budgets. One port to protect. Invest in adaptation measures, spin the wheel to discover the next extreme weather event, and adjust your strategy as the years go by.',
        emphasis: 'A good strategy can still have a bad year. That’s part of the challenge.' },
    ],
    debrief: {
      n: '04', time: '10 MIN',
      lead: 'Beyond the game.',
      text: 'Compare strategies, look back at the decisions that made a difference, and explore what the exercise reveals about real-world port resilience. What would you do differently at your own port?',
    },
  },

  whyWorkshop: {
    anchor: 'why',
    eyebrow: 'Why this workshop',
    h2: 'More than a game. A different way to think about resilience.',
    items: [
      { n: '01', title: 'Think beyond the obvious',   text: 'Learn to distinguish the most visible hazards from those that pose the greatest risk to port operations.' },
      { n: '02', title: 'Make tough choices',         text: 'With limited resources, every investment comes with trade-offs. Discuss priorities, challenge assumptions and build a shared strategy.' },
      { n: '03', title: 'Adapt as conditions change', text: 'Discover why resilience is not about making one perfect plan, but about revisiting decisions as risks and resources evolve.' },
      { n: '04', title: 'Learn from the outcomes',    text: 'Compare strategies and understand why good decisions do not always lead to good outcomes, and vice versa.' },
    ],
  },

  madeToMeasure: {
    anchor: 'context',
    eyebrow: 'Made to measure',
    h2: 'A workshop built around your challenges',
    cards: [
      { title: 'Your ports',    text: 'Fictional port scenarios inspired by your region, infrastructure and governance context.' },
      { title: 'Your hazards',  text: 'Climate hazards relevant to your region, with realistic impacts and probabilities.' },
      { title: 'Your measures', text: 'Adaptation options and investment scenarios tailored to your priorities and available resources.' },
      { title: 'Your audience', text: 'Port professionals, policymakers, researchers, students or a mix of stakeholders.' },
      { title: 'Your format',   text: 'From conference sessions to team workshops and training programmes.' },
      { title: 'Your language', text: 'Available in English, French and Spanish.' },
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
        'Two facilitators to guide the experience',
        'All printed material: port reports, adaptation cards and worksheets',
        'Access to the interactive workshop platform',
        'A post-workshop summary of the results',
      ],
    },
    youProvide: {
      title: 'You provide',
      items: [
        'A room with six tables',
        'A projector or large screen',
        'Reliable Wi-Fi',
        'Participants with smartphones',
      ],
      price: 'Price: on request',
    },
  },

  request: {
    anchor: 'request',
    eyebrow: 'Request a workshop',
    h2: 'Let’s bring Ports of the Future to you.',
    text: 'Tell us about your event, your audience and when you’d like to organise the workshop. We’ll get back to you within two working days to discuss the possibilities.',
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
