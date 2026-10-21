# Ports of the Future — Architecture

A facilitated, in-person **climate-resilience workshop for ports**. One facilitator
drives a projected **control centre**; participants join from their phones with a
QR code. Over ~90 minutes a room assesses readiness (PAR Index), buys adaptation
measures on a budget, faces a weather "roulette", and debriefs luck vs strategy.

This document describes the app **as built**. It supersedes the old CO2-Sprint
README.

## Stack & layout

Monorepo:

```
frontend/   React 19 + Vite (participants, facilitators, public landing) — Vercel
backend/    Node + Express + Mongoose + Socket.io — Railway
            MongoDB Atlas
```

- Frontend talks to the backend over REST (`axios`) and Socket.io.
- All UI is English. The visual system is a Swiss-grotesk design with a single
  token source (`frontend/src/styles/tokens.css` + `tokens.js`): colours
  (`--paper/--ice/--sky/--harbour/--ink/--signal`), Inter Tight + JetBrains
  Mono, a `--type-scale`-driven size ramp, 1px `--ink` hairlines, 0 radius, no
  shadows. Nothing outside the token files should define a colour, font or size.

## Session lifecycle & phases

A session has a **status** (`draft → active → closed`) and a facilitator-driven
**phase** (`join → par → strategy → wheel → debrief`). Phase is manual (the tab
the facilitator selects), persisted on `Session.phase`, and broadcast as
`phase:change`. It is never derived from data.

## Data models (`backend/src/models`)

- **User** — facilitator login (email + bcrypt hash). Seeded admin on boot.
- **Session** — `code`, `facilitatorId`, `name`, `groups: [String]` (Team A…H),
  `portAssignments: [{ group, portId }]`, `status`, `phase`, and a stored
  aggregate `summary` computed at close.
- **Participant** — `sessionCode`, `group`, `socketId`. *(Age/gender were removed
  — see Migration notes.)*
- **ParIndexResult** — one questionnaire submission: `sessionCode`, idempotent
  `submissionId`, `group`, `portSize`, `worldZone`, computed `score`/`band`/
  `areas`, and the chosen `answers`.
- **TeamStrategy** — per team: `portId`, base `cultureBand`, bought `measures`,
  `coinsSpent`, `confirmed` (lock), and the draw snapshot `drawnEvent` /
  `preparedness` / `lossesAvoidedPct`.

## REST API

Auth (`/api/auth`): `POST /register`, `POST /login` (JWT).

Sessions (`/api/sessions`, JWT except `/info`):
- `GET /:code/info` *(public)* — groups, status, phase, portAssignments.
- `POST /` — create from `{ name, teamCount }`; the server generates Team A…H and
  assigns a **random distinct port** per team.
- `POST /:code/shuffle-ports` — re-roll the random assignment; **409** once the
  Strategy phase has started.
- `PATCH /:code/activate` · `PATCH /:code/phase` · `PATCH /:code/close` ·
  `GET /` · `GET /:code` · `DELETE /:code`.

PAR / workshop (`/api/par`):
- `GET /questionnaire` *(public)* — questions + options, **no scores**.
- `GET /ports` · `GET /measures` — public catalogues (`protection` scores stay
  secret; measures expose only id/name/cost/raisesCultureBand).
- `GET /:code/strategies` — per-team measures/coins/confirmed/effective culture.
- `PUT /:code/strategy/:group` · `PATCH …/confirm` · `PATCH …/unlock`
  (unlock is **409** after a draw).
- `GET /:code/strategy/:group/wheel` — wheel composition (exposure weights +
  measures + illustration motifs) for one team, **gated: all teams locked**.
- `POST /:code/strategy/:group/draw` — spin; **gated: all teams locked**.
- `GET /:code/outcomes` · `GET /:code/results`.
- `GET /:code/debrief` — result vs expected + coins that helped per team,
  **gated: debrief phase only**.
- `POST /submit` *(public)* — submit answers; score computed server-side.
- `POST /send-email` *(public)* — email a participant their result (Resend).

Contact (`/api/contact`, public): `POST /` — landing-page workshop request.
Honeypot → 200 silent; validated; emailed via Resend to `CONTACT_TO_EMAIL`
(reply-to = requester); **rate-limited 5/hour/IP** (`trust proxy = 1`). Not stored.

## Socket.io events

Client → server: `facilitator:join {code}`, `session:join {code,name,group}`,
`par:submit {…}`.
Server → client: `participant:joined {total}`, `par:update {individual,groups}`,
`par:result {score,band,areas}`, `strategy:update {…}`, `outcome:update {…}`,
`phase:change {phase}`, `session:closed`.

## Scoring (all server-side, single source of truth)

- **PAR Index** (`scoringService`): 5 areas × 2 questions, each option 0–10 →
  `score` 0–100. `getBand(score)` is the **only** band-boundary definition
  (reactive ≤25, aware ≤50, developing ≤75, proactive). Never duplicated on the
  client.
- **Culture band** (`cultureService`): base band = `getBand(mean team PARI)`;
  `applyCultureMeasureBonus` raises it one level if the team bought a
  culture-raising measure (#19/#20), capped at proactive.
- **Preparedness / losses avoided** (`preparednessService`): per bought measure,
  take its protection for the drawn event, multiply by the culture factor
  (reactive .8 / aware .9 / developing 1.0 / proactive 1.1), cap at 10, then
  `P = 10·(1 − Π(1 − sᵢ/10))`; `lossesAvoidedPct = P·10`. An unrounded
  `rawLossesAvoidedPct` is exposed for the expected-value maths.
- **Debrief** (`preparednessService`): `computeExpectedLossesAvoided` =
  Σₑ (weightₑ/10)·lossesAvoided(measures, e, effectiveBand) — reuses the
  preparedness function and the #19/#20 bump (no second copy);
  `computeCoinsThatHelped` = Σ cost of measures with protection > 0 for the event.
  Displayed numbers are integers; luck = displayed result − displayed expected.
- **Roulette** (`wheelService`): `drawEvent` samples an event using the port's
  secret `exposureWeights` (sum 10). `topExposureEvents` picks the two highest
  for the illustration motifs.

## Secret-data rule (the core invariant)

Exposure weights, measure protection scores, questionnaire option scores, and the
derived illustration motifs **never reach the client during gameplay**:

- The questionnaire and catalogues are served through explicit field copies that
  can't leak `score`/`protection`.
- Exposure weights + motifs are revealed **only** by the wheel-composition and
  draw endpoints, **after every team is locked**, and per team.
- The expected-result maths runs server-side; the debrief endpoint returns only
  the resulting numbers, **only in the debrief phase** — no weights.

Config (`backend/src/config`): 10 ports (secret `exposureWeights` sum 10), 7
events, 25 measures (secret `protection`), 5-area questionnaire. `validateConfig`
fail-fasts on boot if any of these is malformed.

## Frontend structure

- **Landing** (`/`, `pages/Home.jsx` + `content/landing.js` + `styles/landing.css`):
  public page. `?code=…` (QR) redirects straight to the join flow. Contact form
  posts to `/api/contact`.
- **Admin navbar** (`components/Navbar.jsx`): shown only on `/login`,
  `/dashboard`, `/session/create`; hidden on the landing, control centre and
  participant screens (they have their own headers).
- **Control centre** (`pages/facilitator/PortsControlCenter.jsx`): full-width
  projected board with the 5 phase tabs, a NOW strip, and an End-session dialog.
- **Participant flow**: Join (code only) → "Before you start" (team + port size +
  world zone) → 10 questions → result → end. Submissions use **three-layer
  resilience**: socket `par:submit` → HTTP `fetch(keepalive)` → `localStorage`
  pending retry. Progress + the result survive a reload.

## Environment

Backend: `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `ADMIN_EMAIL/PASSWORD`,
`RESEND_API_KEY`, `CONTACT_TO_EMAIL`. Frontend: `VITE_BACKEND_URL`.

## Migration notes

- **Age/gender removed.** The fields are gone from the schema, socket payload,
  join form and context. Existing documents may still carry `age`/`gender`
  strings; they are ignored (never read or written) — no backfill needed.
- **Team naming / ports.** Teams are generated Team A…H from a count (2–8); ports
  are assigned randomly server-side. The old free-text team editor and manual
  port picker are gone.

## Running locally

```bash
# backend  (needs MongoDB)
cd backend && npm install && node index.js      # http://localhost:5000

# frontend
cd frontend && npm install && npm run dev        # http://localhost:5173
```

Backend tests: `cd backend && npm test` (`node --test`).
