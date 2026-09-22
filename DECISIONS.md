# X — Decision Log

This file records foundational project decisions that must remain visible and durable.

## D-001 — X Uses Engine-Before-UI Phase Order

Status: **ACTIVE**

Decision:

X uses this implementation order for the early project:

1. X0 — rules / establishment
2. X1 — headless deterministic engine
3. X2 — local 2D arena
4. X3 — AI
5. later phases as defined in `PHASES_AND_WORKFLOW.md`

Reason:

`PROJECT_CONSTITUTION.md` contains one early summary list that places a local playable prototype before the tested headless engine. That conflicts with the constitution's stronger repeated rules:

- Rule 2 — Engine Before UI
- Rule 25 — X1 Engine, X2 Local Arena
- Core Development Law — Engine before UI
- `PHASES_AND_WORKFLOW.md` — X1 Headless Game Engine before X2 Local 2D Arena

Therefore the authoritative interpretation is engine first, local UI second.

Consequence:

No local UI/prototype may become the owner of game rules or block completion of the headless engine. X1 must pass before X2 starts.

---

## D-002 — Canonical State + Commands

Status: **ACTIVE**

Decision:

Every match has exactly one serializable authoritative `GameState`.

Players, AI, future network clients, and UI submit validated commands. They do not directly mutate match state.

Reason:

This prevents split game truth, UI-owned rules, reconnect failure, and architecture drift.

Consequence:

Any future UI, AI, or online layer must consume the same engine command/state contracts.

---

## D-003 — Deterministic Engine

Status: **ACTIVE**

Decision:

Given the same rules version, card-set version, initial state, RNG seed, and ordered commands, X must produce the same result.

Consequence:

All gameplay randomness uses one controlled seeded RNG abstraction. Golden-match fixtures are valid regression locks.

---

## D-004 — Cards Are Data First

Status: **ACTIVE**

Decision:

Card definitions are structured data interpreted through reusable engine mechanics. Card-name-specific branching is not the normal implementation model.

Consequence:

The first engine proof uses a small card set and grows only after reusable mechanics are stable.

---

## D-005 — Rules 0.1.0 Lock (X1 Blocker Resolutions)

Status: **ACTIVE**

Decision:

The six rules gaps found in the pre-X1 audit are resolved in `GAME_RULES.md` version 0.1.0:

1. **Terminology.** "Opening turn" = each player's first turn (6-card hand allowance). "Round" = only the combat cycle ending in VS destruction.
2. **DEF cannot attack.** Only a VS in ATK position may attack.
3. **Arena Collapse timing.** Checked at the end of the third consecutive inactive turn; counter resets to 0; triggering player deploys a new VS only, then the turn ends.
4. **Tie-breaker.** Uses a shuffled pool of all owned cards not in Zone X, compared by printed/base ATK, repeating on ties; unbreakable tie = draw. Not claimed as inherited Mega X implementation.
5. **Card roles.** Every card is dual-use (VS or Effect). No construction-level card types. Cards without a playable Effect cannot enter the Effect Zone.
6. **Empty VS Zone.** A player with no VS must deploy one after hand-limit enforcement and before Effects or attack/pass.

Reason:

Each gap prevented deterministic engine implementation.

Consequence:

X0 rules gate is closed. Reopen only for a real contradiction found during implementation.

---

## D-006 — Constitution Development Order Corrected

Status: **ACTIVE**

Decision:

The constitution's Development Order list now reads engine before local 2D arena, matching D-001. D-001 remains as the historical record of the conflict.
