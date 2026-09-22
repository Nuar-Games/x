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
- `PROJECT_STATE.md` — current milestone/status
- `ARCHITECTURE.md` — to be created during X1
- `DECISIONS.md` — to be created when the first architecture decision needs durable recording

## Current Implementation State

- No game engine implemented yet.
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
- simplified Mega X-derived tie-breaker

## X0 Closure Record

X0 exit criteria are satisfied.

Final rule verification found one wording mismatch in the previous `GAME_RULES.md`: start-of-turn VS replacement and position change were listed as separate actions. This was corrected to the established rule: choose at most one — change position OR voluntarily replace the current VS.

No other known contradiction currently blocks implementation of the base headless engine.

## Current Required Work — X1

Build the headless deterministic rules engine before any UI, backend, networking, 3D, progression, or monetization work.

Immediate sequence:
1. Create `ARCHITECTURE.md` defining canonical serializable `GameState`, command-driven mutation, deterministic resolution, seeded randomness, and engine/module boundaries.
2. Define the card data schema separately from rules logic.
3. Define legal player command types and validation rules.
4. Implement setup, draw, hand-cap enforcement, VS deployment, position/replacement timing, Effect Zone/STA capacity, battle resolution, round end, Arena Collapse, deck exhaustion, scoring, and tie-breaker.
5. Add automated rule tests and deterministic golden-match fixtures as each subsystem is implemented.
6. Do not proceed to X2 until all X1 exit criteria in `PHASES_AND_WORKFLOW.md` pass.

## Next Concrete Task

**Create the X1 engine architecture and implementation skeleton, then begin the deterministic core from setup/turn state.**
