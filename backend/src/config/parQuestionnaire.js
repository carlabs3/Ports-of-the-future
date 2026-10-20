// PAR Index questionnaire configuration ("Ports of the Future").
//
// Source of truth for question/option TEXT and SCORES. Labels are in English
// as per the source document; if the workshop is delivered in Spanish the
// translation happens in Fase 3 (UI layer) and does not affect the engine.
//
// Shape:
//   - AREAS: ordered list of the 5 scored areas, each pointing at its 2 question ids.
//   - QUESTIONS: map questionId -> { text, options: { optionId -> { label, score } } }.
//   - DEMOGRAPHICS: Q0 fields that are NOT scored (never fed to computeParIndex).
//
// The engine can (a) walk AREAS -> questions and (b) resolve optionId -> score
// via QUESTIONS[questionId].options[optionId].score.

// ── Scored areas (5 areas × 2 questions = 10 questions, max 100 points) ──────
export const AREAS = [
  { id: 'governance',   label: 'Governance & Strategy',     questions: ['q1', 'q2'] },
  { id: 'organisation', label: 'Organisation & People',     questions: ['q3', 'q4'] },
  { id: 'budget',       label: 'Budget & Finance',          questions: ['q5', 'q6'] },
  { id: 'measures',     label: 'Implemented Measures',      questions: ['q7', 'q8'] },
  { id: 'preparedness', label: 'Preparedness & Monitoring', questions: ['q9', 'q10'] },
]

// ── Scored questions (each option scores 0–10) ──────────────────────────────
export const QUESTIONS = {
  q1: {
    text: 'Does your port have a climate adaptation plan or strategy?',
    options: {
      q1a: { label: 'No, and none planned', score: 0 },
      q1b: { label: 'In development', score: 4 },
      q1c: { label: 'Yes, as part of a broader plan (masterplan, sustainability strategy)', score: 7 },
      q1d: { label: 'Yes, a standalone adaptation plan formally adopted by management', score: 10 },
    },
  },
  q2: {
    text: 'Has your port carried out a climate risk & vulnerability assessment?',
    options: {
      q2a: { label: "Never / I don't know", score: 0 },
      q2b: { label: 'Informal or partial assessment only', score: 4 },
      q2c: { label: 'Yes, but more than 5 years ago', score: 7 },
      q2d: { label: 'Yes, formal assessment updated within the last 5 years', score: 10 },
    },
  },
  q3: {
    text: 'Who is responsible for climate adaptation in your organisation?',
    options: {
      q3a: { label: 'No one', score: 0 },
      q3b: { label: 'Distributed informally (whoever is available)', score: 3 },
      q3c: { label: 'A named person, as part of a wider role', score: 7 },
      q3d: { label: 'A dedicated team, department or officer', score: 10 },
    },
  },
  q4: {
    text: 'How present is adaptation at leadership level?',
    options: {
      q4a: { label: 'Not on the agenda', score: 0 },
      q4b: { label: 'Discussed occasionally after incidents', score: 4 },
      q4c: { label: 'A director holds an explicit adaptation mandate', score: 7 },
      q4d: { label: 'Board-level objective with regular reporting/KPIs', score: 10 },
    },
  },
  q5: {
    text: 'Does your port have a dedicated adaptation budget?',
    options: {
      q5a: { label: "No / I don't know", score: 0 },
      q5b: { label: 'Only reactive spending after damage occurs', score: 3 },
      q5c: { label: 'An annual budget line (below ~1% of investment budget)', score: 7 },
      q5d: { label: 'A structural annual line or multiannual investment programme', score: 10 },
    },
  },
  q6: {
    text: 'Has your port sought external funding for adaptation (EU, national, regional)?',
    options: {
      q6a: { label: 'Never considered', score: 0 },
      q6b: { label: 'Considered but not applied', score: 4 },
      q6c: { label: 'Applied at least once', score: 7 },
      q6d: { label: 'Secured external funding', score: 10 },
    },
  },
  q7: {
    text: 'Which physical adaptation measures are already in place? (count the types: flood defences / drainage upgrades / elevated or reinforced infrastructure / heat protection / backup power / nature-based solutions)',
    options: {
      q7a: { label: 'None', score: 0 },
      q7b: { label: 'One type', score: 4 },
      q7c: { label: 'Two or three types', score: 7 },
      q7d: { label: 'Four or more types', score: 10 },
    },
  },
  q8: {
    text: 'Over the last 5 years, roughly what share of your infrastructure investment addressed climate resilience (even partially)?',
    options: {
      q8a: { label: "I don't know", score: 0 },
      q8b: { label: 'Less than 5%', score: 3 },
      q8c: { label: 'Between 5% and 15%', score: 7 },
      q8d: { label: 'More than 15%', score: 10 },
    },
  },
  q9: {
    text: 'How does your port use weather information operationally?',
    options: {
      q9a: { label: "We don't systematically", score: 0 },
      q9b: { label: 'Public forecasts, checked informally', score: 3 },
      q9c: { label: 'Port-specific alerts/thresholds trigger operational decisions', score: 7 },
      q9d: { label: 'Automated monitoring integrated with response protocols', score: 10 },
    },
  },
  q10: {
    text: 'Does your port have an extreme-weather emergency plan, and is it tested?',
    options: {
      q10a: { label: 'No plan', score: 0 },
      q10b: { label: 'Plan exists, never tested', score: 4 },
      q10c: { label: 'Tested, but more than 2 years ago', score: 7 },
      q10d: { label: 'Tested with drills within the last 2 years', score: 10 },
    },
  },
}

// ── Q0 demographics — NOT SCORED ─────────────────────────────────────────────
// These fields describe the respondent's port. They are collected for
// segmentation only and must NEVER be passed to the scoring engine or counted
// toward the PAR Index.
export const DEMOGRAPHICS = {
  portSize: {
    text: 'What is the size of your port?',
    scored: false,
    // `description` is shown under each option on the "Before you start" screen.
    options: {
      small:  { label: 'Small',  description: 'under 500,000 TEU a year, or mostly bulk, ferry or regional traffic.' },
      medium: { label: 'Medium', description: '500,000 to 2 million TEU a year.' },
      large:  { label: 'Large',  description: 'over 2 million TEU a year; a major international gateway.' },
    },
  },
  worldZone: {
    text: 'In which world zone is your port located?',
    scored: false,
    // Authoritative zone taxonomy (confirmed with the client). Array shape, so
    // each option carries its own stable id.
    options: [
      { id: 'europe',          label: 'Europe' },
      { id: 'africa',          label: 'Africa' },
      { id: 'middle-east',     label: 'Middle East' },
      { id: 'asia',            label: 'Asia' },
      { id: 'oceania',         label: 'Oceania' },
      { id: 'north-america',   label: 'North America' },
      { id: 'latam-caribbean', label: 'Latin America & Caribbean' },
    ],
  },
}
