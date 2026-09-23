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

---

## D-007 — X2 Uses a Greybox 2.5D Renderer

Status: **ACTIVE**

Decision:

The X2 local arena is built in the same Three.js 2.5D renderer that X6 will polish: a tilted-camera table scene with cards as 3D planes. During X2 it uses greybox visuals only (plain shapes, no final art, no effects).

Reason:

The creator's target is a real 2.5D browser game. Building X2 as a flat 2D page and replacing it with a 2.5D renderer at X6 would be a renderer rewrite, which Rule 21 exists to prevent.

Scope of the amendment to Rule 11:

- Allowed at X2: 2.5D camera, 3D card planes, simple movement tied to engine events.
- Still blocked until X6: final art, VFX, audio polish, arena theming, 3D avatars.
- The renderer remains presentation-only. It never owns or mutates game truth (Rules 2, 10).

---

## D-008 — Implementation Tooling

Status: **ACTIVE**

Decision:

- Language: TypeScript, strict mode.
- Repo: pnpm workspace monorepo — `packages/engine`, `packages/cards`, `packages/ai`, `apps/client`.
- Tests: Vitest.
- Card data validation: zod (in `packages/cards` only).
- Renderer: Three.js, bundled with Vite (in `apps/client` only).
- Boundaries: dependency-cruiser (`.dependency-cruiser.cjs`).
- Determinism guard: `scripts/check-determinism.mjs`.
- CI: GitHub Actions runs typecheck, tests, boundaries, determinism and build on every pull request.

Enforced boundaries:

- The engine imports nothing outside itself, and has no DOM or Node types.
- Card data depends only on zod.
- AI and client use only the engine's public entry point.
- Nothing imports the client.
- No circular dependencies.
- No `Math.random`, clock reads or `crypto` randomness in engine or AI code.

Consequence:

Architecture rules are checked by machines, not memory. A pull request that breaks a boundary cannot pass CI.

---

## D-009 — Rules 0.2.0 and Card Set 0.2.0

Status: **ACTIVE**

Decision:

The creator's rulings on the card-data audit are recorded in `GAME_RULES.md` 0.2.0:

- stat floor at 0; STA 0 destroys the VS;
- stat calculation order: printed → set → swap → +/− → multiply, in play order within a step;
- "cannot attack for 1 time" prevents one attack attempt, then is consumed; ends immediately if its source leaves the Effect Zone for any reason;
- losing your own VS during your turn ends the turn;
- a VS leaving the VS Zone without destruction also ends the round;
- choosing from the opponent's hand reveals it to the chooser for that choice only;
- conditions use a VS's current stats and an Effect card's printed stats;
- slot locks do not remove existing Effect cards;
- card-specific rulings for X003, X007, X009, X010, X018, X019, X023, X028, X029 (§18A);
- SPUDUR (X026) is deferred, not implemented, and no definition may be invented;
- `star` is metadata only.

Card data moved to card-set 0.2.0 to match these rulings. SPUDUR carries `status: "DEFERRED"`.

Consequence:

The 10-card proof set can be implemented without further rules questions.

---

## D-010 — Test-Only Deck Exception

Status: **ACTIVE**

Decision:

Automated engine tests and golden-match fixtures may use decks below 30 cards, so the 8–12 card proof set (Rule 7) can form test decks.

Real matches always enforce 30–50 cards and a maximum of 2 copies per name. Production match setup must never expose or inherit the exception.

Implementation constraint:

The exception must live only in test code. Production deck validation has no switch, flag or parameter that disables the limits.

---

## D-011 — PENDEKAR CAHAYA PRISMA Is Not an Attack

Status: **ACTIVE**

Decision:

X027's "SPECIAL ATTACK: LIGHT SWORD PRISM" is an Effect resolution. It is not blocked by attack restrictions, does not consume them, and does not use the attack action or battle matrix. Recorded in `GAME_RULES.md` §18A.

---

## D-012 — Engine Setup Review Fixes

Status: **ACTIVE**

Decision:

1. **Pure RNG.** `nextUint32`, `nextInt` and `shuffle` return the next RNG state instead of mutating it. The earlier mutable RNG would have silently changed old `GameState` objects once commands started using randomness, which breaks replays and golden matches.
2. **No deck-size switch in production code (D-010).** The shared setup core has no mode flag. The 30–50 rule lives only in `setupMatch`. The test helper calls the core directly. A dependency-cruiser rule stops any other engine file from importing the core.
3. **Deferred cards rejected at setup.** Any match, including test fixtures, rejects a card definition with `status: "DEFERRED"` (§18A).
4. **Hand limit derived, not stored.** `PlayerState.handSizeLimit` is replaced by `turnsStarted`. The limit is 6 while `turnsStarted === 1` (opening turn) and 5 afterwards (§3).
5. **`DISCARD_FOR_HAND_LIMIT` command added** to the command vocabulary, since §3 requires the player to choose discards.
