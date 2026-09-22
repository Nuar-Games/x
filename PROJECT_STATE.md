# X — Project State

## Current Phase

**X1 — Headless Game Engine**

X0 — Rulebook / Establishment is **CLOSED**.

The establishment gate was closed after:
- project constitution existed;
- authoritative game rules were consolidated and verified against the establishment decisions;
- working protocol existed;
- phases/workflow with hard exit criteria existed;
- no known contradiction remained that blocks implementation of the base engine.

Do not reopen X0 for optional polish or hypothetical edge cases. Reopen only if a real contradiction, regression, or implementation blocker proves an establishment rule is insufficient or inconsistent.

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

Current rules version: **0.1.0** (see `GAME_RULES.md` and D-005).

## Current Implementation State

- X0 establishment is closed.
- X1 architecture is defined.
- Canonical serializable `GameState` requirements are defined.
- Command-driven state mutation contract is defined.
- Deterministic resolution and seeded RNG requirements are defined.
- Card definitions vs card instances are separated architecturally.
- Test layers and golden-match requirements are defined.
- No executable game engine code exists yet.
- No UI implemented yet.
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

Final rule verification found one wording mismatch in the previous `GAME_RULES.md`: start-of-turn VS replacement and position change were listed as separate actions. This was corrected to the established rule: choose at most one — change position OR voluntarily replace the current VS.

No other known contradiction currently blocks implementation of the base headless engine.

## X1 Architecture Record

`ARCHITECTURE.md` is now created and defines:
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
- implementation order for X1.

`DECISIONS.md` records that the authoritative early-phase order is X0 Rules -> X1 Headless Engine -> X2 Local 2D Arena. This resolves the conflicting early summary line in the constitution in favor of Rule 2, Rule 25, the Core Development Law, and the phase workflow.

## Pre-X1 Audit Record

The pre-X1 audit found six rules gaps and several repo issues. All are resolved:
- rules gaps resolved in `GAME_RULES.md` 0.1.0 (D-005);
- stale X0 transition text removed from `PHASES_AND_WORKFLOW.md`;
- constitution development order corrected (D-006);
- `BACKLOG.md`, `README.md`, `.gitignore` added.

## Branch Workflow

All X1 work happens on branches and merges into `main` (constitution Rule 18).

## Current Required Work — X1

The next work is implementation, not more establishment.

Immediate sequence:
1. add the first engine-proof card set (8–12 cards, constitution Rule 7) as structured data;
2. choose and record the implementation language/tooling only when code creation begins;
3. create the engine source/test skeleton;
4. implement serializable state and card models;
5. implement deterministic RNG;
6. implement match setup and opening draw;
7. implement turn-state machine and hand-cap enforcement;
8. continue through the X1 order defined in `ARCHITECTURE.md`;
9. add tests as each subsystem is implemented.

Do not proceed to X2 until all X1 exit criteria in `PHASES_AND_WORKFLOW.md` pass.

## Next Concrete Task

**Begin executable X1 implementation: engine source/test skeleton, canonical state types, card models, deterministic RNG, and setup/turn-state tests.**
