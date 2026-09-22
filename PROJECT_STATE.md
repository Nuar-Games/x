# X — Project State

## Current Phase

**X0 — Rulebook / Establishment**

X0 is not open-ended. Its exit criteria are defined in `PHASES_AND_WORKFLOW.md`.

## Project Identity

- Name: **X — The Card Game**
- Repository: `Nuar-Games/x`
- Relationship to Mega X: spinoff/divergence, not a continuation of the Mega X codebase
- Core design principle: anti-solitaire TCG with direct back-and-forth play

## Authoritative Documents

- `PROJECT_CONSTITUTION.md` — non-negotiable development constraints
- `GAME_RULES.md` — authoritative established game rules
- `WORKING_PROTOCOL.md` — operating constraints for future work
- `PHASES_AND_WORKFLOW.md` — mandatory development phases, hard exit criteria, and anti-endless-work rules
- `PROJECT_STATE.md` — current project state

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

## X0 Hard Exit

X0 closes when:

1. `PROJECT_CONSTITUTION.md` exists.
2. `GAME_RULES.md` contains the established base rules.
3. `WORKING_PROTOCOL.md` exists.
4. `PHASES_AND_WORKFLOW.md` exists.
5. This file records current state and next task.
6. No known contradiction prevents implementation of the base engine.

Once these conditions are verified, X0 must be marked **CLOSED** and work moves to **X1 — Headless Game Engine**. Optional polish or hypothetical edge cases may not keep X0 open.

## Next Concrete Work

1. Verify `GAME_RULES.md` against the creator's establishment decisions from this session.
2. Amend only genuine inaccuracies or omissions.
3. If no implementation-blocking contradiction remains, mark X0 **CLOSED**.
4. Begin X1 by creating the headless engine architecture and implementation plan.
5. Do not build UI/backend/online systems before the X1 engine gate passes.
