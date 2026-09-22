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
