# X — Project State

## Current Phase

**X2 — Local 2D Arena**

X0 — Rulebook / Establishment is **CLOSED**.
X1 — Headless Game Engine is **CLOSED**.

The X1 exit gate passed after all 16 architecture steps were implemented and verified. Do not reopen X1 for optional polish. Reopen only if a real contradiction, regression, or implementation blocker proves that an exit criterion was not actually satisfied.

## Project Identity

- Name: **X — The Card Game**
- Repository: `Nuar-Games/x`
- Relationship to Mega X: spinoff/divergence, not a continuation of the Mega X codebase
- Core design principle: anti-solitaire TCG with direct back-and-forth play

## Authoritative Documents

- `PROJECT_CONSTITUTION.md` — non-negotiable development constraints
- `GAME_RULES.md` — authoritative established game rules
- `WORKING_PROTOCOL.md` — operating constraints for future work
- `PHASES_AND_WORKFLOW.md` — mandatory phase sequence, gates, hard stops, and work cycle
- `ARCHITECTURE.md` — X1 engine boundaries, canonical state, commands, deterministic resolution, and implementation order
- `DECISIONS.md` — durable architectural decisions and conflict resolutions
- `PROJECT_STATE.md` — current milestone/status

## Rules Version

Current rules version: **0.2.2** (see `GAME_RULES.md`, D-013 through D-016).

## Current Implementation State

- X0 establishment is closed.
- X1 architecture is defined and implemented.
- Canonical serializable `GameState` is implemented and JSON round-trip tested.
- Command-driven state mutation contract is implemented.
- Deterministic resolution and seeded RNG are implemented.
- Card definitions vs card instances are separated.
- Repo skeleton exists (D-008): TypeScript monorepo, Vitest, CI, architecture boundary checks, determinism check.
- Greybox Three.js client boots and renders an empty 2.5D table (D-007).
- Card data (card-set 0.2.0) lives in `packages/cards/data/`: full 30-card set from CARD DATABASE.xlsx, 10-card engine-proof subset, and per-card effect cases. All validated by tests.
- Production match setup enforces 30–50 cards, max 2 copies per name, known cards and no deferred cards. A separate test-only helper allows sub-30 fixture decks (D-010, D-012).
- Turn-state machine and single command pipeline (`packages/engine/src/turn.ts`, handlers in `src/handlers/`): draw, hand limit, VS step, Effect step, ATTACK/PASS, Arena Collapse, turn end. Losing your own VS mid-turn ends the turn. Full matches are playable through commands only.
- Hand limit: 6 on each player's opening turn, 5 from their second turn; `DISCARD_FOR_HAND_LIMIT` moves chosen cards to Zone Tepi.
- VS deployment / keep / position change / voluntary replacement are implemented, including round end on voluntary replacement (D-013).
- Effect Zone / STA capacity, effective stats, slot locks, voluntary Effect removal and forced excess removal are implemented.
- Zone transitions are centralized; Zone X is absolute and cannot be used as a source.
- Battle matrix is implemented and reached only through commands.
- Round end is engine-driven (D-014).
- Arena Collapse is implemented, including prevented-attack inactivity and empty-hand post-collapse skip (D-015).
- Effect resolver runs the 10-card proof vocabulary; setup rejects cards whose effects the engine cannot run (D-016). All 10 real proof cards are tested through `applyCommand`.
- Deck exhaustion / scoring / tie-breaker are implemented.
- Legal command enumeration is implemented and validates candidates through `applyCommand`.
- Golden matches use fixed seeds, explicit commands and exact frozen terminal snapshots.
- X1 exit-gate production proof uses `setupMatch` with legal 30-card decks, plays to resolution through public legal commands only, serializes/restores authoritative state mid-match, and confirms both continuations are identical.
- No AI implemented yet.
- No X Supabase backend created yet.
- No X Vercel project created yet.
- Existing Mega X Supabase/Vercel resources are not X resources and must not be reused by default.

## Established Core Systems

- 30–50 card decks
- maximum 2 cards with the same name
- every card can function as VS
- VS ATK/DEF positioning
- start-of-turn VS action is position change OR voluntary replacement, not both
- Mega X-style STA capacity system
- Effect Zone occupancy
- Zone X capture scoring and absolute protection
- Zone Tepi discard/recovery behavior
- Arena Collapse after 3 consecutive inactive individual turns
- explicit ATK-vs-ATK and ATK-vs-DEF battle matrix
- own-turn Effect play
- one-shot and continuous Effect behavior
- explicit-text-first card interpretation
- no general chain/stack response system
- anti-solitaire design law
- deck exhaustion ends match after applicable resolution
- Zone X score determines winner
- tie-breaker by shuffled non-Zone-X pool and printed ATK; unbreakable tie = draw
- dual-use cards (VS or Effect role)
- only ATK-position VS can attack
- opening-turn 6-card hand allowance
- Arena Collapse at end of third inactive turn, counter reset, deploy-only continuation

## X0 Closure Record

X0 exit criteria are satisfied.

## X1 Closure Record

All 16 implementation steps in `ARCHITECTURE.md` §18 are complete.

The X1 exit gate in `PHASES_AND_WORKFLOW.md` is satisfied:
- a production-valid legal match can run from setup to final winner entirely through the engine;
- core rules required by the locked X1 proof scope are represented and the 10 real proof cards execute through the command pipeline;
- illegal commands are rejected deterministically;
- authoritative state is JSON serializable and can be restored mid-match;
- same seed + same commands is deterministic;
- all engine tests and golden matches pass;
- CI passes frozen install, typecheck, tests, architecture boundaries, determinism and build;
- no uncaught engine exception remains in the passing suite.

X1 is closed. Do not expand the headless engine for optional work before X2. Reopen only for a demonstrated regression or blocker.

### X1.1 (narrow reopen, closed)

- §19 deck-exhaustion timing fixed: an already-empty deck alone never ends the match (D-017). Golden snapshots unchanged.
- `viewFor` / `eventsFor` added; the X2 renderer boundary is defined and enforced (D-018, ARCHITECTURE.md §21).

## Branch Workflow

All substantial work happens on branches and merges into `main` (constitution Rule 18).

## Current Required Work — X2

Per `PHASES_AND_WORKFLOW.md`, X2 is the Local 2D Arena using the existing greybox 2.5D Three.js renderer.

Required work:
1. render `viewFor(state, viewerId)`, never `GameState` (ARCHITECTURE.md §21);
2. provide hand, deck, VS Zone, Effect Zone, Zone X and Zone Tepi views;
3. expose only legal actions supplied by `enumerateLegalCommands()`;
4. implement ATK/DEF position controls;
5. provide clear turn, round, Arena Collapse, STA and scoring feedback;
6. keep animation/audio non-authoritative: play `eventsFor(events, viewerId)` in order, then snap to the latest view; never diff states.

Do not start Supabase, networking, AI, cosmetics, progression or monetization during X2.

## Next Concrete Task

**Build the local match host and wire the Three.js greybox renderer to it: the renderer takes `viewFor()`, `enumerateLegalCommands()` and `eventsFor()` only (renderer code lives in `apps/client/src/render/`). Render the six gameplay zones and expose only legal local-player actions.**
