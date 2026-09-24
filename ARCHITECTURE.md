# X — Architecture

Status: **X1 — HEADLESS GAME ENGINE**

This document defines the architecture for X before gameplay implementation expands. It is subordinate to `PROJECT_CONSTITUTION.md`, `GAME_RULES.md`, and explicit creator amendments.

## 1. Architectural Goal

Build one deterministic, serializable, headless rules engine that can complete a full legal match without depending on UI, browser state, backend services, networking, animation, or presentation.

The engine is the only authority for match truth.

## 2. Dependency Direction

Required direction:

`CARD DATA -> ENGINE RULES -> CANONICAL GAME STATE -> ADAPTERS -> UI / AI / NETWORK`

Never:

`UI / AI / NETWORK -> DIRECT STATE MUTATION`

External systems may submit commands and consume results. They do not own rules or match truth.

## 3. Canonical Game State

There is exactly one authoritative `GameState` per match.

`GameState` must be fully serializable and contain all information required to resume a match deterministically without hidden UI state.

Minimum state domains:

- rules version
- card-set version
- match identifier
- random seed / deterministic RNG state
- active player / turn owner
- turn number
- round state
- Arena Collapse consecutive-inactivity counter
- match status
- winner when resolved
- each player's deck
- each player's hand
- each player's VS Zone
- each player's Effect Zone
- each player's Zone X
- each player's Zone Tepi
- current VS position
- current card stat modifiers
- active continuous effects
- temporary rule modifiers such as hand-size or Arena Collapse changes
- pending deterministic resolution context only when resolution cannot be completed atomically

No renderer-specific coordinates, animation flags, DOM references, network sockets, Supabase objects, or visual timing belong in `GameState`.

## 4. Player State

Each player owns a serializable `PlayerState` containing only game-authoritative data.

Minimum fields:

- player identifier
- deck card instance IDs in order
- hand card instance IDs
- VS card instance ID or null
- VS position or null
- Effect Zone card instance IDs in order
- Zone X card instance IDs
- Zone Tepi card instance IDs
- legal hand-size limit after active modifiers

Derived values such as available STA should be calculated from authoritative state and active modifiers, not stored redundantly unless a later performance need is proven.

## 5. Card Definitions and Card Instances

Cards are data first.

### Card Definition

Immutable card-set data should contain:

- stable card definition ID
- card name
- printed ATK
- printed DEF
- printed STA
- effect definition(s), optional — a card without one cannot be played into the Effect Zone
- rules/card-set version metadata

### Card Instance

A match uses card instances with:

- unique instance ID
- card definition ID
- owner
- current controller if a future explicit rule requires it
- current zone
- mutable match-local state only when a rule explicitly requires it

Printed card data must not be overwritten to represent temporary buffs/debuffs. Current values are derived from printed data plus active legal modifiers.

## 6. Commands

All player actions enter the engine as commands.

Initial command vocabulary:

- `DEPLOY_VS`
- `CHANGE_VS_POSITION`
- `REPLACE_VS`
- `REMOVE_OWN_EFFECT`
- `PLAY_EFFECT`
- `KEEP_VS`
- `ATTACK`
- `PASS`
- `DISCARD_FOR_HAND_LIMIT` (GAME_RULES.md §3: the player chooses which cards to discard when over the hand limit after drawing)

Automatic engine operations such as draw, round cleanup, capture, Arena Collapse, scoring, and match-end checks are internal transitions, not client-authoritative results.

Every command contains:

- command type
- acting player
- required card/target identifiers
- any explicit choices demanded by the rule or card text
- command sequence/idempotency identifier when networking is added later

## 7. Command Processing Contract

Command processing follows one route:

1. receive command;
2. verify match is in a state where commands are accepted;
3. verify acting player owns the turn/action;
4. verify timing window;
5. verify source/target/card legality;
6. verify STA / zone / hand / battle constraints;
7. reject deterministically with a defined reason if invalid;
8. if valid, resolve the command through engine rules;
9. complete automatic consequences in deterministic order;
10. return the new authoritative state plus structured transition events.

The engine must never partially accept an illegal command.

## 8. Result Contract

A processed command returns one of:

### Accepted

- updated canonical state
- deterministic event list describing committed transitions

### Rejected

- unchanged canonical state
- stable rejection code
- optional human-readable explanation outside the rules core

UI animation and sound react to accepted events. They do not determine outcomes.

## 9. Deterministic Resolution Order

For the same initial state, rules/card-set versions, RNG seed, and command sequence, the engine must return the same result.

Core order:

1. validate command;
2. apply explicit action/effect in written order;
3. process immediate destruction/capture consequences;
4. enforce Zone X untouchability immediately after entry;
5. recalculate continuous modifiers and STA capacity;
6. move forced excess Effect cards to Zone Tepi when required, using the choice supplied by the player entitled to choose;
7. complete remaining legal instructions;
8. process battle/round-end cleanup if triggered;
9. process Arena Collapse when applicable;
10. process deck-exhaustion end check only at the established timing;
11. score match if ended;
12. emit committed events.

No generic chain/stack is introduced.

## 10. Turn State Machine

The engine should model turn legality explicitly rather than relying on UI sequence.

Logical stages:

- `TURN_START_DRAW`
- `HAND_LIMIT_ENFORCEMENT`
- `REQUIRED_VS_DEPLOYMENT` (only when the player has no VS)
- `START_OF_TURN_VS_ACTION` (only when the player has a surviving VS)
- `EFFECT_ACTIONS`
- `COMBAT_OR_PASS`
- `ARENA_COLLAPSE_CHECK`
- `POST_COLLAPSE_DEPLOYMENT` (only when collapse triggered; no Effects or attacks follow)
- `TURN_END`

Important rule lock:

At `START_OF_TURN_VS_ACTION`, a player may choose at most one normal VS action:
- keep it as-is;
- change the surviving VS position; **or**
- voluntarily replace the current VS.

The player does not perform both as separate normal start-of-turn actions.

Opening deployment is handled as setup/required deployment state rather than pretending a surviving VS already exists.

## 11. STA Capacity

STA is calculated as capacity, never as spendable mana.

For a VS with effective STA `N`:

`occupied capacity = 1 VS + number of Effect cards`

Legal occupancy requires:

`occupied capacity <= effective STA`

Normal Effect Zone count is additionally capped at 5 unless explicit card text changes that limit.

If effective STA becomes lower than occupancy, excess Effect cards are moved to Zone Tepi according to the established chooser rule.

If effective STA becomes 0, the VS is immediately destroyed and captured into the opponent's Zone X before later instructions continue.

## 12. Zones as Engine-Owned Containers

Zone transitions occur only through engine functions that enforce rule semantics.

Required zones:

- Deck
- Hand
- VS Zone
- Effect Zone
- Zone X
- Zone Tepi

Zone X uses a special invariant:

**once a card enters Zone X, no effect or pending instruction may target, move, retrieve, destroy, alter, steal, or copy from that card.**

This invariant is enforced in the engine, not left to individual card handlers.

### Round end is engine-driven (D-014)

Every card movement goes through `moveCard` or `moveCardsSimultaneously` in `zones.ts`. Whenever a VS leaves the VS Zone, for any reason, those functions end the round immediately (clear both Effect Zones to Zone Tepi, expire round-bound modifiers, advance the round number, emit `ROUND_ENDED`).

Battle, VS replacement and card effects never call round end themselves, and round end is not exported. Simultaneous VS removals (ATK = ATK, BLACK HOLE) use `moveCardsSimultaneously`, so the round ends once.

Every move emits a `CARD_MOVED` event with an engine-set reason.

### Public API

The engine's public entry point exports only: match setup, `advance`, `applyCommand`, read-only derived values (effective stats, capacity, hand limit) and types. Card movement, battle and RNG functions are internal. Tests import them from `src/` directly.

## 13. Battle Resolver

Battle resolution is a pure rules subsystem driven by current effective stats and positions.

It must implement exactly the matrix in `GAME_RULES.md`:

- ATK vs ATK
- ATK vs DEF
- DEF vs DEF attack prohibition

Battle resolver returns transitions; it does not manipulate UI.

Multiple attacks, when explicitly granted, call the same battle resolver one attack at a time with full resolution between attacks.

## 14. Effect Resolver

Effect resolution is sequential and explicit-text-first.

The engine needs a reusable mechanic vocabulary for the rules X actually uses, such as:

- draw
- discard
- move
- capture
- destroy
- stat modification
- STA modification
- hand-limit modification
- Arena Collapse counter modification
- position change
- attack permission/restriction
- forced attack
- deck look/reorder/search/shuffle
- Zone Tepi retrieval/movement
- effect copy

No mechanic may silently imply destruction, capture, targeting, duration, destination, or reveal behavior not present in card text/rules.

### One effect vocabulary (D-016)

`src/effect-spec.ts` (`parseEffectSpec`) is the single definition of which effects the engine can run. Card data is input to it, not a second definition. Setup parses every deck card's raw `effect` JSON; an unknown family or any unexpected field rejects the deck with the card's name. An unsupported card can never enter a match and silently do nothing.

The match snapshot holds only the card definitions the decks use, with parsed effects. A card can be played as an Effect only if it has one.

### Resolution order

Instructions apply in written order. STA reaching 0 destroys the VS immediately, mid-effect. STA capacity is recalculated once, after every instruction has applied; any excess is chosen by the player whose effect caused it (GAME_RULES.md §5, §18A KAPORES).

### Real-card tests

Engine tests load the real card data from `@x/cards` (a test-only dev dependency; engine source never imports it). Every card in `engine-proof.json` has an executable test matching `card-effect-cases`, and a coverage test fails if one is missing.

One-shot Effects resolve once then remain in Effect Zone occupying STA until removed or round end.

Continuous Effects derive their current impact from active Effect Zone state.

## 15. Randomness

All gameplay randomness must route through one deterministic RNG abstraction owned by the engine.

Initial required random use:

- deck shuffle
- tie-breaker pool shuffle (all owned cards not in Zone X)
- future card effects only when explicitly defined

No gameplay module may call uncontrolled random functions directly.

The RNG is pure: each call returns the value and the next RNG state. It never mutates the RNG it is given, so an earlier `GameState` is never changed by later commands.

## 16. Versioning

Every `GameState` must identify:

- `rulesVersion`
- `cardSetVersion`

Future balance/rule changes must not make historical serialized matches uninterpretable.

## 17. Test Architecture

Tests are part of X1, not a later cleanup step.

Required layers:

### Unit rules tests

Test isolated rules and invariants.

### Command validation tests

Every command requires legal and illegal cases.

### Transition tests

Verify exact zone/state changes after accepted commands.

### Regression tests

Every fixed engine bug receives a test.

### Golden matches

Fixed deck lists + fixed seed + fixed command sequence + exact expected final state/winner.

Golden-match and engine-test decks may be below 30 cards (D-010). That exception lives only in test code: production deck validation has no switch, flag or parameter that disables the 30–50 / max-2 limits. Test fixtures build match state through a test-only helper instead.

## 18. Initial X1 Implementation Order

Implement in this order unless a real dependency requires a small adjustment:

1. types / serializable state model
2. card definition and instance model
3. deterministic RNG abstraction
4. match setup and initial draw
5. turn-state machine
6. hand-cap enforcement
7. VS deployment / position / replacement
8. Effect Zone and STA capacity
9. zone-transition invariants including Zone X
10. battle resolver
11. round end
12. Arena Collapse
13. effect resolver primitives
14. deck exhaustion / scoring / tie-breaker
15. legal command enumeration
16. golden match fixtures

Do not jump to UI, Supabase, networking, or 3D during this sequence.

## 19. Engine Boundary

The engine may know:

- rules
- card definitions
- canonical state
- deterministic RNG
- commands
- rule validation
- transition events

The engine must not know:

- React/DOM
- Phaser/Three/Unity
- CSS
- animation timelines
- sound playback
- Supabase
- Vercel
- HTTP/WebSocket transports
- user account/session UI
- monetization

## 20. X1 Exit Gate

X1 remains open until all of these are true:

- complete legal match can run headlessly from setup to winner;
- all core `GAME_RULES.md` rules are implemented;
- illegal commands reject deterministically;
- canonical state serializes and restores;
- same seed + same commands = same result;
- unit/transition/regression tests pass;
- golden matches pass;
- no uncaught engine exception remains in the test suite.

When this gate passes, X1 closes. Optional engine polish must not prevent transition to X2.

X1.1 (D-017, D-018) corrected the §19 end-of-match timing and added per-player views before X2 began.

## 21. X2 Renderer Boundary (D-018)

The 2.5D client has three inputs and nothing else:

| Input | Source | Used for |
|---|---|---|
| What to draw | `viewFor(state, viewerId)` → `PlayerView` | the six zones, stats, turn/round/Arena Collapse/score/status |
| What the player may do | `enumerateLegalCommands(state)` | the only clickable actions; the chosen command goes to `applyCommand` |
| What to animate | `eventsFor(events, viewerId)` → ordered `ViewEvent[]` | the animation queue |

Rules:

- The renderer never receives `GameState`. The opponent's hand and both deck orders do not exist in its input, so no UI can depend on them. X5 (online) then changes the transport, not the renderer.
- Animations play the event queue in order. When the queue finishes, the renderer snaps to the latest `PlayerView`.
- The renderer never compares an old state with a new state to work out what happened. Events are the only description of change.
- A thin local match host (outside `render/`) owns the `GameState`, calls `applyCommand`, and hands the renderer `viewFor` + `enumerateLegalCommands` + `eventsFor`. Local hot-seat play switches `viewerId`.

Enforced as part of `pnpm boundaries`:

- dependency-cruiser (`.dependency-cruiser.cjs`) checks every import: `render/` imports engine **types only** and never `host/`; `host/` never imports `three`, `render/`, `@x/cards` or `config/` (tests excepted for `config/`); no import may be unresolvable; no relative import may reach into another package's source;
- `scripts/check-renderer-boundary.mjs` checks what imports cannot show: no mention of `GameState` and no previous-state copies in `render/`.

## 22. X2 Local Match Host (D-019)

`apps/client/src/host/createLocalMatchHost(input, initialViewer)`:

- owns the `GameState` privately; its public interface has no state getter;
- receives all setup data (seed, card definitions, both decks, match id, card-set version) from the caller. The default X2 setup is `apps/client/src/config/default-match.ts` (two copies of each of the 15 supported real cards); the host never creates a seed;
- `getOutput()` returns `{ viewerId, stateVersion, view, legalCommands, events, eventStartIndex, eventEndIndex }` and has no side effects;
- `legalCommands` is empty unless the viewer is the active player (who also owns every pending choice); it is cached per `stateVersion`;
- `pickLegalCommand(stateVersion, index)` is the only way to act. Rejections, in order: `MATCH_RESOLVED`, `NOT_ACTING_VIEWER`, `STALE_VERSION`, `INVALID_INDEX`, `ENGINE_REJECTED`. Rejections change nothing;
- one append-only event log, with an independent acknowledged position per viewer. `acknowledgeEvents(upToIndex)` moves only the current viewer's position and throws on an invalid index;
- `setViewer` changes only the projection, never game state, RNG progression or `stateVersion`;
- `HostOutput` and `HostResult` are JSON-safe;
- `host/` compiles with no DOM library (`tsconfig.host.json`) and is included in the determinism scan.
