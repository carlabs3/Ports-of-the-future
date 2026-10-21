# Ports of the Future: implement workshop v4

You are working in the Ports of the Future monorepo (`frontend/` React + Vite on Vercel, `backend/` Node + Express + Mongoose + Socket.io on Railway, MongoDB Atlas database `/ports-of-the-future`). The workshop design has moved to version 4: three rounds, six ports, a new card economy and a new scoring layer. Your job is to bring the app in line with it, in the commits below, stopping for my approval after each one.

## Where the code stands

The Swiss redesign (`PROMPT_swiss-redesign.md`, blocks B1–B11) is committed on `main` and **not pushed**, and the landing page blocks (L) are in progress. B12 (`docs/ARCHITECTURE.md`) has not been written yet. This prompt builds **on top of** that work. It does not rebuild screens from scratch: it changes the Strategy, Roulette and Debrief tabs, the "Before you start" step and the PAR Index filters that the redesign created.

Finish the landing block you are on, then start with Step 0 below.

## Sources of truth, in this order

1. The decisions and data in **this prompt** (sections "Decisions" and "Appendix"). Numbers in the appendix win over anything else.
2. `docs/workshop-v4.md`, the v4 facilitator handbook. Use it for card texts, event descriptions and wording. Where it mentions one iPad per table, ignore it (D12).
3. `PROMPT_swiss-redesign.md` for every visual rule: tokens, type, components, band ramp, anonymity rule, display rounding.

Do **not** use the old architecture document that lives outside the repo; it is outdated. Do not assume what the code does. Read it.

---

## Rules that apply to every commit

- **Exposure weights and scoring stay on the server.** A port's wheel composition and its illustration (B11) are sent to a client only once every team has locked round 1, and only for the team being drawn, as in B9 and B11. After a team's round-1 spin, its wheel may be shown again in later rounds. Scoring is computed only on the server.
- **The control center is projected.** It never shows the best-strategy card combinations (the answer key), and the Strategy tab never shows another team's cards, as in B8.
- **One `getBand()` function, one call path** for PARI bands and culture levels.
- **One protection formula.** Every new calculation reuses the existing preparedness function. No second copy.
- **`validateConfig()` fails fast** at server start.
- **Visual system:** only the B1 tokens and base components. No new colours, no per-port colours, no new fonts.
- **All UI copy in English**, sentence case.
- Keep the three-layer resilience (socket, HTTP keepalive, localStorage retry) for participant submissions.
- **Do not touch** the CO2 Sprint deployment or its database, or any Railway, Vercel or Atlas setting.
- **No push without my explicit approval.** Commit locally, report, wait.
- Run the full backend test suite before every commit. Old tests that encode v3 rules must be updated, not deleted. List each one you change and say why.

## Working method for every commit

1. **Inventory**: the files you will touch and what they do now.
2. **Impact**: what changes in behaviour, socket events, API responses and stored data.
3. **Implement** only that commit's scope. Note anything else you find; do not fix it.
4. **Test**: unit tests for logic, plus a short browser check list for me. Say explicitly if you could not check something in a browser.
5. **Report**: diff summary, tests, open questions. Then **stop and wait**.

---

## Step 0 · Audit (no code changes)

Report:

1. **Config:** the structure of ports, events, measures and `parQuestionnaire.js`, and what `validateConfig()` checks today.
2. **Scoring:** every function in the scoring service and every call site. Include `computePreparedness`, `rawLossesAvoidedPct`, `computeExpectedLossesAvoided`, `computeCoinsThatHelped` and how the #19/#20 culture bump works, in particular whether two enablers stack.
3. **Game state:** how a team's game is stored, including `drawnEvent`, the unlock endpoint and its 409 rule, the "all teams locked" gate, and "Shuffle again".
4. **Screens built in the redesign** that this prompt changes:
   - B3: "Before you start" and the fields it saves.
   - B7: the PAR Index filters and the anonymity rule.
   - B8: the Strategy tab.
   - B9: the Roulette tab.
   - B10: the Debrief tab.
   - B11: the port illustrations and how their motifs are derived.
5. **The 401 on session creation in production:** trace the login, token storage, session-create request and JWT check, and tell me whether the cause can be in the code or only in configuration (for example `JWT_SECRET` in Railway, or a stale token). Do not change any setting.
6. **A table** mapping every item in the "Commits" section to the files it will change.
7. **Contradictions** between this prompt, the redesign prompt and the code.

Stop and wait.

---

## Decisions (v4, take these as settled)

- **D11 · Three rounds.** Each team plays 3 rounds with one wheel spin per round. This replaces "no second spin".
- **D12 · No table devices.** No iPad or other screen per team, and no team view in the app. The projected control center is the only screen the teams see. The facilitator or assistant enters every purchase and return there, as in B8.
- **D13 · Up to 6 teams.** The team count is now 2–6 (was 2–8), still generating Team A, Team B and so on. Each team gets a different port at random, with "Shuffle again" as in B4.
- **D14 · Damage bill** = event losses × (1 − P/10), rounded to the nearest 0.5, halves up. It is a score only and never takes coins away.
- **D15 · Card returns.** In rounds 2 and 3 a team may return at most one card per round and gets back floor(cost / 2) coins, so a 1-coin card refunds 0. Enablers can be returned, which lowers the culture level again. A returned card can be bought again in a later round.
- **D16 · Display.** Keep the redesign rules:
  - Show "% of losses avoided" and never "Preparedness".
  - Show percentages as whole numbers.
  - Compute every on-screen difference from the displayed integers.
  - Strategy scores are whole-number percentages too.
  - Inside the server, compute in full precision.
- **D17 · No port colours.** Ports are identified by their name and their B11 illustration. The app uses only the brand palette from B1.

---

## Commits

### Commit 1 · Game content v4 (backend)

- Record D11–D17 in `docs/DECISIONS-v4.md`. B12 will fold this file into `docs/ARCHITECTURE.md` later.
- Replace the port config: 6 ports instead of 10 (appendix A), each with `id`, `name`, `climateZone`, `coastalSetting`, `size`, `governance`, `deck` and secret `exposureWeights`. Delete the 4 ports that no longer exist, and their illustrations if any are stored.
- Replace the measures config with the 26 measures in appendix B.
  - Remove "Biodiversity & ecosystem monitoring".
  - Add #16 Alternative water supply & reuse and #26 Cool surfaces & shaded yards.
  - #19 and #20 are enablers with no protection.
  - Take each card's text from `docs/workshop-v4.md`.
- Check the event config against appendix C.
- Extend `validateConfig()` so the server refuses to start if any of these fail:
  - Weights add up to exactly 10 for every port.
  - Every deck id exists.
  - The 6 shared measures (8, 10, 14, 19, 20, 23) are in every deck.
  - Decks have 13 to 15 cards.
  - Decks match appendix A exactly.
  - Scores are 0–10 and costs 1–5.
- Check that the B11 illustrations derive correct motifs for the 6 new ports, from the v4 weights.
- Add `configVersion: "v4"` to new sessions. Do not migrate old test sessions, but opening one must not crash anything: show "This session was created with an older version of the workshop."

Acceptance: the server starts; a test copy of the config with one wrong weight stops it with a clear message.

### Commit 2 · Scoring (backend, fully tested)

- **Culture level.**
  - The starting level comes from the team's average PARI, through `getBand()`. Multipliers: Reactive ×0.8, Aware ×0.9, Developing ×1.0, Proactive ×1.1.
  - **Each** enabler in the current portfolio raises the level by one, up to Proactive. If today two enablers give only one step, change it.
  - Every card's score is capped at 10 after the multiplier.
  - A team with no PARI answers cannot lock round 1 until the facilitator picks its starting level.
- **Protection** (existing function): P = 10 × [1 − Π(1 − min(10, c·sᵢ)/10)] over the cards that score on the event drawn.
- **Damage bill:** as in D14.
- **Expected protection:** this is the existing `computeExpectedLossesAvoided`. Keep it, applied to the portfolio as it stands after that round's purchases.
- **Coins that helped:** keep `computeCoinsThatHelped`, measured against the total cost of the cards held at that spin.
- **Best possible expected protection** for each port, starting culture level and budget (6, 8 or 10): try every subset of the port's deck that fits the budget, enablers included. Compute the 72 values once at server start and keep them in memory. Never send the winning combinations to any client.
- **Strategy score** = expected protection ÷ best possible, for the team's port, its starting culture level and the round's cumulative budget (6, 8, 10). The denominator does not change if the team lost coins on a return.
- **Final ranking** = average of the 3 strategy scores, highest first; ties share a rank. **Luck** = total damage over the 3 spins, shown next to it but never used to rank.

Tests that must pass:

- All 72 values in appendix E, ±1 point. Nord-Maris, Aware, 10 coins is exactly 68.5.
- **Boreal.** PARI 42 (Aware), with Winterisation, Wind-resistant mooring and Governance, which raises it to Developing.
  - Snow, ice & cold snap: P = 7.6, 76% losses avoided, damage 0.5.
  - Storm surge: P = 0, damage 4.
  - Expected protection 51%, best possible 58%, strategy score 88%.
- **Nord-Maris.** Aware, with Coastal defence structures and Governance.
  - Storm surge: P = 8.
  - Expected protection 41%, best possible 51%, strategy score 80%.
  - Emergency plan + insurance + structural health monitoring at Aware: 51%.
- A score of 10 at Proactive stays 10. Two enablers take Reactive to Developing. Enablers never go past Proactive.
- The old B10 test cases (Nord-Maris 57.18, Boreal 65.62) were written for v3 weights and the v3 culture rule. Replace them with v4 cases and say so.

### Commit 3 · Rounds and coins (backend)

- Replace the single `drawnEvent` with a `rounds` array of 3 entries. Each entry holds:
  - the cards bought and the card returned;
  - coins at the start, coins spent, the refund and coins left;
  - the event drawn;
  - the raw and displayed losses avoided, and the damage bill;
  - expected protection, the strategy score and coins that helped;
  - the culture level that applied.
- **Coins:** round 1 starts with 6, and rounds 2 and 3 add 2 each to what is left. The server rejects a purchase when:
  - the team lacks the coins;
  - the card is not in its port's deck;
  - the team already holds that card.
  Returns follow D15.
- **Locking:**
  - A round's purchases and its return can change until that round's spin, and never after. This replaces the current 409 rule on unlock.
  - Keep the "all teams locked" gate before the spins of each round.
  - "Shuffle again" works only until round 1 is locked.
- **Weights:** follow the rule at the top of this prompt.
- **Reconnection:** the control center rebuilds the full round state after a reload or reconnect.
- **One test** plays 3 full rounds for one team, including a return, and checks every number by hand.

### Commit 4 · Strategy and Roulette tabs, three rounds (frontend + socket)

Keep the B5 shell and add the round: the header shows "Round N of 3", and the NOW strip copy covers each round. Strategy and Roulette repeat once per round, then Debrief opens.

- **Strategy (B8, adapted):**
  - The coin meter shows the current round's coins.
  - The measure number input accepts only numbers in that team's deck. Out of range, not in the deck, duplicate and over budget each get their own inline message.
  - In rounds 2 and 3, add "Return one card" with the refund shown.
  - The read-aloud line covers the round, for example: "Team D, round 2: return 13, add 8 and 24. Three coins left. Correct?"
  - In rounds 2 and 3 the dictating team's wheel legend can be shown, since its wheel was revealed at its round-1 spin.
- **Roulette (B9, adapted):**
  - One team at a time and full screen, with words on the slices.
  - After the spin, show "% of losses avoided" and the damage bill.
  - Keep the table "Measure · Protection · With culture", the culture line, and "Coins that helped: N of M".
  - The queue strip covers the current round.

Browser check: 3 rounds with 6 test teams, entirely from the control center.

### Commit 5 · "Before you start" and PAR Index filters (B3 + B7, adapted)

- **"Before you start"** asks:
  - the team;
  - port size, with the B3 descriptions;
  - governance model, with its descriptions;
  - climate zone;
  - coastal setting.
  World zone is removed, and the options are in appendix D. Five questions do not fit on one phone screen, so split them into two screens: team and port size first, then the other three. All options are served from `parQuestionnaire.js`, as today.
- Save the four profile fields with each PARI result. The 10 scored questions do not change.
- **PAR Index tab (B7):**
  - The filters become: port size, governance model, climate zone, coastal setting, team, band.
  - They still combine, the anonymity rule (fewer than 3 answers, show nothing) stays, and so do "Showing N of M answers" and "Clear filters".
  - Keep everything else in B7 as built.

### Commit 6 · Debrief tab (B10, adapted)

- One row per team, sorted by **final strategy score**:
  - Team, port, final strategy score and total damage (luck).
  - For each round: event, % losses avoided, and expected protection as the thin ink marker on the bar, as in B10.
- The luck label compares each spin's displayed result with its displayed expected value, using the B10 wording and the ±5 rule.
- The four facts at the bottom become:
  - the room's average strategy score;
  - the best plan (highest final strategy score);
  - the hardest luck (highest total damage);
  - coins that didn't help, across the room and all rounds.
- Readable from the back of a room on a projector.

---

## Out of scope (do not do)

- Any team view or per-team device screen (D12), or a digital map for placing ports.
- Per-port colours (D17).
- Copy changes to the 40 PARI answer options.
- Projection typography tuning.
- Any push, or any infrastructure setting change.

---

## Appendix A · Ports

| id | Name | Climate zone | Coastal setting | Size | Governance |
|---|---|---|---|---|---|
| nord-maris | Nord-Maris | Temperate | Artificial / engineered coastline | Large | Landlord port |
| meridia | Meridia | Mediterranean | Bay or lagoon | Medium | Public port |
| riu-verd | Riu Verd | Mediterranean (inland) | Estuary or river | Medium | Landlord port |
| boreal | Boreal | Cold / sub-arctic | Open coast | Small | Public port (municipal) |
| coralia | Coralia | Tropical | Bay or lagoon (behind a coral reef) | Medium | Tool port |
| sabkha | Sabkha | Arid / desert | Artificial / engineered coastline | Large | Private port |

Ports have no colour field (D17).

**Exposure weights (secret, 10 slices per wheel):**

| Port | SS | RF | HW | WS | DR | WF | SI |
|---|---|---|---|---|---|---|---|
| Nord-Maris | 4 | 1 | 1 | 3 | 0 | 0 | 1 |
| Meridia | 0 | 2 | 3 | 1 | 1 | 3 | 0 |
| Riu Verd | 0 | 3 | 2 | 0 | 4 | 1 | 0 |
| Boreal | 2 | 1 | 0 | 3 | 0 | 0 | 4 |
| Coralia | 3 | 2 | 1 | 4 | 0 | 0 | 0 |
| Sabkha | 2 | 0 | 4 | 1 | 3 | 0 | 0 |

**Decks (measure ids):**

| Port | Cards | Shared | Port-specific |
|---|---|---|---|
| Nord-Maris | 14 | 8, 10, 14, 19, 20, 23 | 1, 2, 3, 6, 9, 13, 18, 24 |
| Meridia | 14 | 8, 10, 14, 19, 20, 23 | 4, 11, 12, 15, 16, 22, 25, 26 |
| Riu Verd | 15 | 8, 10, 14, 19, 20, 23 | 3, 5, 7, 9, 11, 17, 21, 22, 25 |
| Boreal | 13 | 8, 10, 14, 19, 20, 23 | 1, 5, 6, 12, 13, 17, 24 |
| Coralia | 14 | 8, 10, 14, 19, 20, 23 | 1, 2, 3, 5, 12, 13, 15, 18 |
| Sabkha | 13 | 8, 10, 14, 19, 20, 23 | 2, 3, 5, 11, 12, 16, 26 |

## Appendix B · Measures (scores 0–10, a dash means no effect)

| # | Measure | Cost | SS | RF | HW | WS | DR | WF | SI |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Coastal defence structures | 5 | 8 | – | – | 3 | – | – | – |
| 2 | Elevated critical infrastructure | 4 | 7 | 4 | – | – | – | – | – |
| 3 | Deployable flood barriers | 3 | 5 | 5 | – | – | – | – | – |
| 4 | Green infrastructure & permeable surfaces | 2 | – | 5 | 2 | – | – | – | – |
| 5 | Nature-based coastal & riverbank protection | 2 | 4 | 3 | – | 2 | – | – | – |
| 6 | Structural health monitoring | 3 | 3 | 3 | 2 | 3 | – | – | 3 |
| 7 | Digital twin & predictive maintenance | 4 | 3 | 3 | 2 | 2 | 3 | – | 3 |
| 8 | Early warning & forecasting system | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 9 | Real-time operations platform | 3 | 3 | 3 | – | 3 | 3 | – | 3 |
| 10 | Emergency response plan & drills | 2 | 3 | 3 | 3 | 3 | – | 2 | 3 |
| 11 | Worker heat-protection protocol | 1 | – | – | 7 | – | – | 2 | – |
| 12 | Climate-resilient materials & retrofits | 4 | 3 | 3 | 3 | 5 | – | 2 | 3 |
| 13 | Wind-resistant mooring & crane reinforcement | 3 | – | – | – | 7 | – | – | 2 |
| 14 | Backup power & microgrid | 3 | 1 | 1 | 4 | 2 | – | 1 | 3 |
| 15 | Drainage system upgrade | 3 | – | 7 | – | – | – | – | – |
| 16 | Alternative water supply & reuse | 3 | – | – | 1 | – | 6 | 2 | – |
| 17 | Multimodal shift platform | 2 | 2 | 3 | – | 3 | 2 | 2 | 2 |
| 18 | Artificial reefs & wave dissipation | 3 | 4 | – | – | 2 | – | – | – |
| 19 | Governance & institutional protocols (enabler) | 1 | – | – | – | – | – | – | – |
| 20 | Capacity building & training programme (enabler) | 1 | – | – | – | – | – | – | – |
| 21 | Adaptive dredging & sediment management | 3 | – | 3 | – | – | 6 | – | – |
| 22 | Stormwater retention & storage basins | 3 | – | 6 | – | – | 3 | 1 | – |
| 23 | Parametric climate insurance | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| 24 | Winterisation package | 2 | – | – | – | – | – | – | 7 |
| 25 | Firebreaks & vegetation management | 2 | – | – | 1 | – | – | 6 | – |
| 26 | Cool surfaces & shaded yards | 2 | – | – | 5 | – | – | – | – |

## Appendix C · Events

| Code | Event | Losses |
|---|---|---|
| SS | Storm surge & coastal flooding | 4 |
| RF | Heavy rain & river flooding | 4 |
| HW | Heatwave | 3 |
| WS | Windstorm & cyclone | 4 |
| DR | Drought & water scarcity | 3 |
| WF | Wildfire | 3 |
| SI | Snow, ice & cold snap | 3 |

Sea-level rise and erosion are not wheel events.

## Appendix D · PARI profile questions (unscored)

- **Port size:** keep the descriptions already built in B3 (Small: under 500,000 TEU a year, or mostly bulk, ferry or regional traffic · Medium: 500,000 to 2 million TEU a year · Large: over 2 million TEU a year; a major international gateway), with the helper text “Not sure? Pick the closest.”
- **Governance model:**
  - Landlord port: authority owns land and infrastructure; private companies operate terminals with their own equipment and staff
  - Public port: fully owned and operated by a public authority
  - Private port: fully privately owned and operated
  - Tool port: publicly owned, including equipment; private companies provide the labour
  - Other
- **Climate zone:** Tropical / subtropical · Arid / desert · Mediterranean · Temperate · Cold / polar / sub-arctic
- **Coastal setting:** Open coast · Estuary or river · Bay or lagoon · Artificial / engineered coastline

## Appendix E · Best possible expected protection (%), for tests

Budgets 6 / 8 / 10 coins, by starting culture level.

| Port | Reactive | Aware | Developing | Proactive |
|---|---|---|---|---|
| Nord-Maris | 46 / 56 / 64 | 51 / 60 / 68 | 55 / 64 / 74 | 59 / 68 / 76 |
| Meridia | 51 / 60 / 68 | 56 / 65 / 72 | 60 / 68 / 75 | 64 / 72 / 78 |
| Riu Verd | 49 / 62 / 70 | 55 / 67 / 76 | 60 / 73 / 79 | 65 / 76 / 81 |
| Boreal | 53 / 62 / 71 | 58 / 67 / 76 | 62 / 71 / 80 | 67 / 76 / 82 |
| Coralia | 49 / 59 / 68 | 54 / 64 / 73 | 59 / 68 / 76 | 63 / 73 / 79 |
| Sabkha | 49 / 59 / 68 | 54 / 64 / 72 | 59 / 68 / 75 | 64 / 72 / 78 |

These values were reproduced independently from the formula in commit 2: 71 of 72 match exactly. The remaining one, Nord-Maris Aware at 10 coins, is exactly 68.5.
