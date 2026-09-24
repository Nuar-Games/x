# X — Project State

## Current Phase

**X1.1 — Pre-X2 rules fix and client-view boundary**

X0 — Rulebook / Establishment is **CLOSED**.
X1 — Headless Game Engine passed its exit gate at `eb2342a`, but a concrete §19 deck-exhaustion regression was found before X2 began. Per the phase rules, X1 is reopened narrowly only for this verified regression and the minimum client-facing view boundary needed to prevent X2 from depending on hidden information.

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

Current rules version: **0.2.2**.

## Current Implementation State

- X1 steps 1–16 are implemented and the exit gate previously passed.
- A concrete §19 regression is now the only rules blocker before X2: after an Effect or DEF battle, the engine currently scores whenever either deck is empty, even if that Effect/battle did not cause or encounter the exhaustion.
- Required X1.1 fix: Effect/battle exhaustion must end the match only when that specific resolution emptied a deck or required a top-deck card that was unavailable. Normal draw exhaustion remains: score only when a player starts a draw with an empty deck.
- Golden matches must be re-recorded if their terminal states change after the fix.
- Add `viewFor(state, playerId)` before X2 rendering. The per-player view must hide the opponent's hand identities and both deck orders while preserving public counts/state needed for rendering.
- X2 client must render from `viewFor(...)` and legal actions from `enumerateLegalCommands()`; it must not read canonical full `GameState` directly for presentation.
- X2 animations must be driven from ordered engine events (`CARD_MOVED`, `BATTLE_RESOLVED`, `ROUND_ENDED`, `ARENA_COLLAPSED`, etc.), then snap to the authoritative player view after the event queue completes. Do not derive animation semantics by diffing old/new states.

## X1.1 Acceptance Criteria

1. Regression test: drawing the last card normally does not end the match until a later draw is impossible.
2. Playing a deck-neutral Effect while a deck is already empty does not end the match.
3. A DEF battle that does not require an unavailable top-deck card does not end the match merely because a deck was already empty.
4. Effect/battle paths still end-and-score when they actually empty a deck or require a missing top-deck card under §19.
5. Golden matches pass with re-recorded snapshots if necessary.
6. `viewFor(state, playerId)` hides opponent hand identities and both deck orders deterministically and serializably.
7. Full `pnpm check` passes with frozen install.

## Next Concrete Task

**Build and merge the X1.1 PR containing the §19 deck-exhaustion regression fix, any required golden re-recording, and `viewFor(state, playerId)`. Then return to X2 and wire the Three.js client to player views + legal commands, with animation driven by the engine event stream.**
