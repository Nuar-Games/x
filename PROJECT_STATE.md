# X — Project State

## Current Phase

**X2 — Local 2D Arena**

X0 — Rulebook / Establishment is **CLOSED**.
X1 — Headless Game Engine is **CLOSED**.

Closed phases are not reopened for optional polish or hypothetical edge cases. Reopen only if a real contradiction, regression, or implementation blocker proves an exit criterion was not actually satisfied.

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
- X1 headless engine is closed after passing its exit gate.
- Canonical serializable `GameState` is implemented.
- Command-driven state mutation and deterministic seeded resolution are implemented.
- Card definitions and mutable card instances are separated.
- Repo tooling exists: TypeScript monorepo, Vitest, frozen-lockfile CI, architecture boundary checks and determinism check.
- Greybox Three.js client boots and renders an empty 2.5D table (D-007); this is the starting surface for X2.
- Card data (card-set 0.2.0) lives in `packages/cards/data/`: full 30-card set, 10-card engine-proof subset and per-card effect cases.
- Production setup enforces 30–50 cards, max 2 copies per name, known cards and no deferred/unsupported cards. D-010 short decks remain test-only.
- Turn flow, opening hand rule, hand cap, VS deployment/keep/change/replacement, Effect play/removal, STA capacity, battle, round end, Arena Collapse, deck exhaustion, scoring and tie-breaker are implemented.
- Zone transitions are centralized and Zone X is absolute.
- Effect resolver runs the locked 10-card engine-proof vocabulary; unsupported card effects are rejected at setup rather than silently ignored (D-016).
- All 10 real proof cards are executed through `applyCommand` tests.
- Legal command enumeration is implemented and validates candidates through `applyCommand` so legality remains single-source.
- Golden matches are frozen against exact terminal snapshots.
- A production-valid 30-card exit-gate match runs from `setupMatch` to a resolved winner using public legal commands only, survives JSON serialize/restore mid-match, and produces an identical continuation after restore.
- No AI implemented yet.
- No X Supabase backend created yet.
- No X Vercel project created yet.
- Existing Mega X Supabase/Vercel resources are not X resources and must not be reused by default.

## Established Core Systems

- 30–50 card decks
- maximum 2 cards with the same name
- every card can function as VS
- VS ATK/DEF positioning
- start-of-turn VS action is keep OR position change OR voluntary replacement
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
- only ATK-position VS can attack
- opening-turn 6-card hand allowance
- Arena Collapse at end of third inactive turn, counter reset, deploy-only continuation

## X0 Closure Record

X0 exit criteria are satisfied. No known contradiction prevents implementation of the base engine.

## X1 Architecture Record

`ARCHITECTURE.md` defines:
- one serializable authoritative match state;
- engine-owned zone transitions;
- command validation instead of direct mutation;
- deterministic resolution order;
- controlled seeded randomness;
- card data separate from mutable card instances;
- explicit turn-state stages;
- STA capacity enforcement;
- Zone X invariants;
- battle/effect resolver boundaries;
- test architecture and golden matches;
- the 16-step X1 implementation order.

`DECISIONS.md` records that the authoritative early-phase order is X0 Rules -> X1 Headless Engine -> X2 Local 2D Arena.

## X1 Exit-Gate Audit Record

The X1 exit gate in `PHASES_AND_WORKFLOW.md` and `ARCHITECTURE.md` §20 was audited after all 16 implementation steps.

Evidence:
- **setup to winner:** golden matches resolve through engine commands; `test/x1-exit-gate.test.ts` additionally runs a production-valid 30-card match through `setupMatch`, legal-command enumeration and `applyCommand` only;
- **core rules represented:** deck construction, setup, hand limits, VS rules, STA/Effect Zone, Zone X/Zone Tepi transitions, battle, round end, Arena Collapse, effect-resolution primitives, deck exhaustion, scoring and tie-breaker all have implemented engine paths and regression tests;
- **illegal commands reject deterministically:** command handlers return stable rejection codes and legal-command enumeration is checked against the same `applyCommand` path;
- **serializable authoritative state:** canonical state round-trips through JSON, and the production exit-gate match resumes from serialized state;
- **determinism:** same seed + same commands yields the same state; CI determinism check and golden snapshots pass;
- **tests/golden matches:** full frozen-lockfile CI passes typecheck, engine/card tests, architecture boundaries, determinism and build;
- **uncaught exceptions:** no uncaught engine exception remains in the passing test suite.

No concrete blocker was found that requires X1 to remain open. Per `PHASES_AND_WORKFLOW.md`, X1 is closed and optional engine expansion must not block X2.

## X1 Implementation Order — Complete

1. ~~types / serializable state model~~ — done;
2. ~~card definition and instance model~~ — done;
3. ~~deterministic RNG abstraction~~ — done;
4. ~~match setup and initial draw~~ — done;
5. ~~turn-state machine~~ — done;
6. ~~hand-cap enforcement~~ — done;
7. ~~VS deployment / position / replacement~~ — done;
8. ~~Effect Zone and STA capacity~~ — done;
9. ~~zone-transition invariants including Zone X~~ — done;
10. ~~battle resolver~~ — done;
11. ~~round end~~ — done;
12. ~~Arena Collapse~~ — done;
13. ~~effect resolver primitives~~ — done;
14. ~~deck exhaustion / scoring / tie-breaker~~ — done;
15. ~~legal command enumeration~~ — done;
16. ~~golden match fixtures~~ — done.

## X2 Scope

Per D-007 and `PHASES_AND_WORKFLOW.md`, X2 is the local 2.5D Three.js arena. It must consume authoritative engine state/events and expose only legal actions supplied by the engine. UI must never own or mutate game truth.

## Next Concrete Task

**Begin X2 by wiring the existing greybox Three.js client to the engine for a local two-player match: render authoritative zones/state and expose the engine's enumerated legal commands without adding backend, networking, AI or presentation polish.**
