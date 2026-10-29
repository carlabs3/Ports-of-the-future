# Ports of the Future — Architecture

A facilitated, in-person **climate-resilience workshop for ports**. One facilitator
drives a projected **control centre**; participants join from their phones with a
QR code. Over ~90 minutes a room assesses readiness (PAR Index), buys adaptation
measures on a budget, faces a weather "roulette", and debriefs luck vs strategy.

This document describes the app **as built**. It supersedes the old CO2-Sprint
README.

## Workshop v4 decisions (D11–D17)

The workshop moved to **v4**. Decisions, each replacing earlier ones:

- **D11 · Three rounds** — each table plays 3 rounds, one wheel spin per round.
  Replaces the v3 "no second spin".
- **D12 · No table devices at all** — no iPad and no table view, now or later. The
  projected control centre is the ONLY screen teams see; the facilitator enters
  every purchase and return there.
- **D13 · Max 6 tables**, one port each, no repeats — ports assigned as a random
  permutation of the 6. Teams stay named Team A, Team B … Replaces "max 8 tables".
- **D14 · Damage bill** = event losses × (1 − P/10), rounded to the nearest 0.5
  (halves up). A score only; it never removes coins.
- **D15 · Card returns (G1)** — round 1: nothing to return. Round 2: **no returns**
  (the server rejects with 409 `Returns are not allowed in round 2.`). Round 3: a
  table may return **any number** of held cards, each for its **full cost**.
  Returns only before the spin (409 once the round has been spun). Returning an
  enabler lowers the culture level (it falls out of the held portfolio). The
  policy lives in `config/game.js` (`returnPolicy: { 2: 'none', 3: 'full' }`);
  routes read it, never hard-coding round numbers.
- **D16 · Rounding** — full precision internally; P shown to 1 decimal; percentages
  as whole numbers (halves up).
- **D17 · Ports have a colour** *(superseded — originally "ports have no colour")* —
  the printed kit uses one colour per port, so the port config now carries a
  `colour` field and the `/par/ports` API exposes it. Values: Nord-Maris #062D69,
  Meridia #77AEF1, Riu Verd #F4B860, Boreal #C5E4FF, Coralia #2CDA9D, Sabkha
  #F07167 (Sabkha provisional). The control-centre team list shows a swatch +
  port name per team.

Rollout: config + `validateConfig` (commit 1, done) → scoring (2) → rounds/coins
(3) → control-centre flow (4) → PARI profile/filters (5) → results/debrief (6) →
colours (7). Sections below that still describe v3 behaviour (single-round draw,
"luck vs strategy" debrief, world-zone profile) are updated as those commits land.

## Config (v5)

- **6 ports** (`config/ports/*`), `id` a **string slug** (`nord-maris`, `meridia`,
  `riu-verd`, `boreal`, `coralia`, `sabkha`), each with `name`, `climateZone`,
  `coastalSetting`, `size`, `governance`, `colour`, `image`, `description`, and
  `deck` (always including the 6 shared cards 8/10/14/19/20/23; **85 cards** across
  all ports). SECRET (never served before the moment allowed, D3/D4): per-round
  **`wheels`** `{ 1|2|3: { year, likelihoods } }` — likelihoods are **percent in
  steps of 5, summing to 100** (replaces the v4 single `exposureWeights` summing
  to 10); and per-port **`impacts`** (coins 1–5 per event, used in rounds 1–2) plus
  **`impactRound3Plus`** (the two events that gain +1 impact in round 3 / 2036).
- **28 measures** (`config/measures.js`, Appendix A); #19/#20 are enablers with no
  protection and `raisesCultureLevel: true`. New: #27 Snow & ice clearance fleet,
  #28 Harbour ice management.
- **7 events** (`config/events.js`), single names per Appendix D (no global
  `lossValue` any more — damage is per port and per round).
- **`roundGrants = [6, 3, 3]`** in `config/game.js` (D2): per-round coin grants →
  cumulative budgets 6 / 9 / 12.
- `validateConfig()` fail-fasts at boot on: a wheel's likelihoods not summing to
  100; a likelihood not a multiple of 5; an event with likelihood > 0 but no
  impact; an impact outside 1–5 (incl. after the round-3 +1); a deck referencing a
  missing measure or missing a shared card; total card count ≠ 85; measure
  count ≠ 28; cost ∉ [1,5]; protection score ∉ [0,10]; the enabler flag/rule.
- New sessions store `configVersion: 'v5'` (D10); older sessions keep their stored
  spin results — nothing is recomputed from live config at read time.

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
  `submissionId`, `group`, the v4 profile fields `portSize` / `governance` /
  `climateZone` / `coastalSetting`, computed `score`/`band`/`areas`, and the
  chosen `answers`.
- **TeamStrategy** (v4) — per team over three rounds: `portId`, `startingBand`,
  cumulative `portfolio`, `coins`, `currentRound`, `roundLocked`, and a
  `rounds[]` snapshot per spin (event, losses avoided, damage bill, expected
  protection, strategy score, coins that helped, effective culture level).

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

## Results display units (E-decisions)

Display and copy only — no scoring formula changed. **1 impact coin = €1bn.**
Money formatting lives in one place (`frontend/src/utils/format.js`):
`formatEurBn` (one decimal, always), `formatEurBnInt` (whole €bn, the debrief
impact table only), `formatPercent` (P → whole %), `formatScore10` (raw ratio →
`X.X / 10`), and the `damageBreakdown` E3 helper. Card ordering / culture-line
copy live in `postSpin.js`.

| Metric | Shown as | Calculation (unchanged) |
|---|---|---|
| Protection this event | 0–100 % (half up) | P × 10 |
| Damage sustained | €bn, one decimal | impact × (1 − P/10) |
| Potential losses | €bn | the drawn event's impact for that port and round |
| Losses avoided | €bn | potentialShown − damageShown (E3) |
| Your strategy | score / 10, one decimal | (expected ÷ best) × 10 |
| Expected protection | not shown on the post-spin panel | still computed for the strategy score |

Coins remain the unit for **budget and card costs only**; damage never uses the
word "coin".

- **E1** Round only at display: % half up (D9), money `€X.Xbn` (always one
  decimal), strategy `X.X / 10`. Computation stays on unrounded values.
- **E2** €bn is a display conversion (1 coin = €1bn) in one shared formatter.
- **E3** `damageShown = round1(damage)`, `potentialShown = round1(impact)`,
  `avoidedShown = potentialShown − damageShown`; the on-screen figures always add
  up. The protection bar width uses unrounded P.
- **E4** The round panel shows the round's strategy to one decimal; the final
  ranking averages the **unrounded** per-round raw ratios (`strategyScoreRaw` =
  expected ÷ best) and rounds only for display. Teams share a rank only when
  their unrounded means are exactly equal.
- **E5** Reveal timing unchanged: the post-spin panel shows only the drawn
  event's impact (D4); no other event's impact is sent to draw it.
- **E6** Post-spin card order: HELPED, then RAISED CULTURE, then the rest
  (MAX-CULTURE enablers + NOT THIS TIME), each group by number; the drawn event's
  tag is highlighted.
- **E7** A culture block states where the multiplier came from (started level +
  which enabler cards raised it / none held / already at Proactive).
- **E8** Debrief uses the same units: total damage in €bn, average strategy as
  `/10`, and the "Impact by port" table in whole €bn (`€2bn → €3bn`).
- **E9** Every damage figure (post-spin, debrief totals, impact-by-port) uses the
  shared €bn formatter; "coins that didn't help" stays a budget metric.

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
- **Participant flow**: Join (code only) → "Before you start" (two screens: team
  + port size, then governance model, climate zone and coastal setting) → 10
  questions → result → end. Submissions use **three-layer
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
