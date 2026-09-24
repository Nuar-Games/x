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

---

## D-013 — Voluntary VS Replacement Ends the Round

Status: **ACTIVE**

Decision:

Voluntary replacement captures the old VS into the opponent's Zone X, and §12 ends the round whenever a VS leaves the VS Zone by capture. Replacement is therefore not an exception: it ends the round. Sequence recorded in `GAME_RULES.md` §12 (rules 0.2.1).

Consequence:

Both Effect Zones are empty when the replacement VS is deployed, so its STA never has to be reconciled against existing Effect cards.

---

## D-014 — Step 11.5: Engine-Driven Round End and Command Wiring

Status: **ACTIVE**

Decision (from the step 9 audit):

1. **Round end is engine-driven.** `moveCard` / `moveCardsSimultaneously` end the round whenever a VS leaves the VS Zone. No other code triggers round end, and it is not exported.
2. **ATTACK and PASS commands** connect battle into play: Effect step → attack/pass → battle → Arena Collapse check (pass-through until step 12) → turn end.
3. **One command pipeline.** `applyCommand` runs: common checks → handler → engine consequences (losing your own VS mid-turn ends the turn) → automatic transitions. Handlers live in `src/handlers/`.
4. **PLAY_EFFECT no longer leaves a pending resolution** that blocked the rest of the turn. Effects occupy capacity until the resolver lands in step 13.
5. **Stat floor per reduction.** The 0 floor applies after every modifier, matching §5.
6. **Turn-bound modifiers expire at turn end.**
7. **Rule modifiers take a list of expiry conditions** (`expiresOn`), so an attack restriction can end when consumed or when its source leaves.
8. **Battle events are in the main event stream**, and every card move emits `CARD_MOVED` with a reason.
9. **Duplicate logic removed** (Effect-source cleanup, slot-limit calculation).
10. **Public API narrowed** to setup, advance, applyCommand, derived reads and types.
11. **Lockfile restored.** CI installs with `--frozen-lockfile` and caches pnpm.

---

## D-015 — Prevented Attacks and Empty-Hand Collapse

Status: **ACTIVE**

Decision:

1. **A prevented attack is not an attack for Arena Collapse.** The attempt consumes the restriction, but no attack occurs, so the inactivity counter is not reset. Events keep this explicit: `ATTACK_ATTEMPTED` and `ATTACK_PREVENTED` are distinct from `BATTLE_RESOLVED`, and `attacksThisTurn` counts only attacks that reach battle.
2. **No card to deploy after a collapse:** the post-collapse deployment is skipped (`POST_COLLAPSE_DEPLOYMENT_SKIPPED`) and the turn ends. The player deploys normally on their next turn. The match can never wait for an impossible deployment.

Recorded in `GAME_RULES.md` §13 (rules 0.2.2).

---

## D-016 — Step 13.5: Real Cards Through the Engine

Status: **ACTIVE**

Decision (from the step 13 audit):

1. **One effect vocabulary.** `parseEffectSpec` is the only definition of runnable effects. Setup rejects any deck card whose effect is unsupported or has unexpected fields. `hasPlayableEffect` is removed; a card is playable as an Effect exactly when it has a parsed effect.
2. **Real-card tests.** All 10 engine-proof cards run through `applyCommand` using the real card data, with a coverage test.
3. **KAPORES order.** STA 0 destruction stays immediate; the capacity check runs once after all instructions of the effect.
4. **Monotonic modifier ids** (`modifierSequence`), never reused after removal.

---

## D-017 — X1.1: §19 Deck Exhaustion Timing

Status: **ACTIVE**

Problem found at the X1 exit-gate audit:

After every Effect and every DEF battle, the engine ended the match if **either** deck was empty, even if that Effect or battle did not touch a deck. Drawing your last card normally and then playing SINGAU ended the match.

Decision (GAME_RULES.md §19 unchanged; the engine now matches it):

- **Normal draw:** the match ends only when the required draw cannot happen.
- **Effect:** the match ends only if that Effect emptied a deck or needed a deck card that was missing. The Effect finishes first (including any pending choice), `EFFECT_RESOLVED` is emitted, then the match is scored. The flag survives a paused choice (`deckExhaustedByEffect`).
- **Battle:** the match ends only if that battle's own top-deck operation took the last card of a deck or needed a missing top-deck card.
- An already-empty deck by itself never ends the match.

Golden matches were rerun after the fix. None of their frozen snapshots changed, so no snapshot was updated.

---

## D-018 — X1.1: Per-Player Views and the X2 Renderer Boundary

Status: **ACTIVE**

Decision:

- `viewFor(state, viewerId)` returns a `PlayerView`: own hand with identities; opponent hand as a count; both decks as counts; VS, Effect Zones, Zone X, Zone Tepi, effective stats, scores, turn, round, Arena Collapse, status and pending-choice data as public information. Deterministic, pure, JSON-serializable.
- `eventsFor(events, viewerId)` returns the event stream as that player may see it: a card that stays hidden on both ends of a move (e.g. the opponent drawing) keeps its zones and reason but has `instanceId: null`. A card that becomes public keeps its identity.
- A whole-match test checks, after every command, that neither player's view nor filtered events contain any opponent-hand or deck instance id.
- X2 renderer inputs are exactly `viewFor`, `enumerateLegalCommands` and `eventsFor` (ARCHITECTURE.md §21), enforced by `scripts/check-renderer-boundary.mjs`.

---

## D-019 — X2 Step 1: Local Match Host

Status: **ACTIVE**

Decision:

The X2 client talks to the engine only through the local match host (ARCHITECTURE.md §22): private `GameState`, externally supplied setup, non-consuming output reads, per-viewer event acknowledgement, legal commands only for the active viewer, and actions only as `(stateVersion, index)` picks from the current legal list.

Coverage added: real-card tests for all 15 currently supported cards; a production-valid 30-card real-deck match played entirely through the host, with privacy checks for both viewers after every step, deterministic replay, viewer-switch invariance and a frozen seed that reaches a pending choice.

Boundary enforcement is import-based (dependency-cruiser) and proven by a negative probe that is never committed: an uncommitted host/render probe made the no-DOM host typecheck, eight dependency rules and the determinism scan all fail, and the tree passed again once the probe was deleted.
