# X — The Card Game: Project Constitution

This document is the non-negotiable development authority for **X — The Card Game**.

It exists specifically to prevent the architectural drift, recovery cycles, rewrite loops, deployment instability, and coupling failures experienced during Mega X development.

## Authority

For all work on this repository:

1. This file overrides convenience, speed, improvisation, and conversational assumptions.
2. Repository documentation is authoritative over chat memory.
3. If a requested implementation conflicts with this constitution, the conflict must be identified before implementation.
4. Unspecified game behavior must never be silently invented. The missing rule must be documented first.
5. Stable working systems must not be destroyed in order to build replacements.
6. Production must never be used as an experimentation environment.

---

## Development Order

The project must advance in this order:

1. Rules
2. Tested headless game engine
3. Local 2D arena (local UI)
4. AI
5. Persistence
6. Accounts
7. Online multiplayer
8. Presentation polish
9. Progression
10. Monetization

Later stages must not dictate or destabilize earlier stages.

---

## Rule 1 — Rules Before Code

A canonical `GAME_RULES.md` must define the game before serious implementation.

It must cover at minimum:

- objective
- starting state
- deck construction
- hand size
- turn structure
- phases
- card roles / playable modes
- resource system
- targeting
- combat
- destruction
- discard
- draw
- win conditions
- simultaneous effects
- triggered effects
- timing priority
- illegal actions
- tie situations
- terminology

If a deterministic rules answer does not exist, implementation of that behavior stops until the rule is defined.

No developer, tool, AI, UI component, backend service, or test may invent game rules ad hoc.

---

## Rule 2 — Engine Before UI

The game must have a headless engine independent of rendering technology.

The engine must not depend on:

- DOM state
- animation state
- Phaser
- Three.js
- Unity
- Supabase
- Vercel
- browser-specific presentation state

The UI consumes engine state. The UI does not own game truth.

A future renderer must be replaceable without rewriting the game engine.

---

## Rule 3 — One Canonical Game State

There must be exactly one authoritative match state.

UI components, animations, network clients, local storage, and backend records must not maintain competing versions of game truth.

All required match state must be serializable so a match can be restored deterministically.

---

## Rule 4 — Commands, Not Direct Mutation

Player actions must be represented as validated commands such as:

- PLAY_CARD
- ATTACK
- ACTIVATE_EFFECT
- END_PHASE
- END_TURN

UI code must never directly mutate authoritative game state.

The engine validates every command and returns either an accepted transition or a defined rejection reason.

---

## Rule 5 — Deterministic Gameplay

Given the same:

- initial state
- rules version
- card-set version
- random seed
- ordered command sequence

The engine must produce the same result.

Gameplay randomness must use a controlled seeded random source. Randomness must not be scattered through gameplay code using uncontrolled calls.

---

## Rule 6 — Cards Are Data First

Cards should be represented primarily as structured definitions interpreted by reusable engine mechanics.

Do not create a growing chain of card-name-specific conditionals as the normal implementation model.

Reusable mechanic vocabulary should be established before large card-set expansion.

Examples include:

- DRAW
- DISCARD
- DAMAGE
- HEAL
- BUFF
- DEBUFF
- DESTROY
- SUMMON
- RETURN
- SEARCH
- COPY
- TRANSFORM
- ATTACH
- DETACH
- EXHAUST
- READY

Custom handlers are permitted only where a card genuinely cannot be expressed through established mechanics.

---

## Rule 7 — Small Card Pool Before Expansion

Engineering begins with a minimal card pool sufficient to prove the rules and engine.

Target sequence:

- 8–12 cards for the first engine proof
- approximately 20 cards after mechanics are stable
- larger launch set only after engine reliability is demonstrated

Content quantity must never outrun engine reliability.

---

## Rule 8 — Tests Before Expansion

Every mechanic requires automated tests.

Tests must cover:

- legal actions
- illegal actions
- resource validation
- targeting
- phase restrictions
- state transitions
- destruction
- draw/discard
- triggered effects
- simultaneous effects
- edge cases
- win conditions

Previously fixed bugs require regression tests.

A failing core test blocks progression.

---

## Rule 9 — Golden Match Tests

The repository must contain deterministic end-to-end match fixtures with fixed:

- decks
- shuffle seed
- command sequence
- expected final state

These matches are regression locks.

A change that unexpectedly alters a golden match result is treated as a breaking change until explained and deliberately approved.

---

## Rule 10 — UI Is Replaceable

Architecture direction:

ENGINE → STATE → UI ADAPTER → VISUAL COMPONENTS

Never:

UI EVENT → DIRECT GAME-RULE MUTATION

Animations and sounds react to committed state transitions. They do not determine game results.

A visual failure must not corrupt authoritative match state.

---

## Rule 11 — No 3D Before the Game Works

3D presentation is blocked until the following are proven:

- complete matches work
- card mechanics work
- core UI works
- AI works
- online matches work
- reconnect works

A functional 2D implementation comes first.

Presentation must never become the foundation of gameplay correctness.

---

## Rule 12 — X Is Separate From Mega X

X is a separate project and must not inherit Mega X architecture by default.

Mega X systems, mechanics, schemas, UI, networking, progression, or assumptions are not automatically carried over.

Anything reused from Mega X must be deliberately reviewed and justified first.

---

## Rule 13 — Independent Supabase Project

X must not use the Mega X Supabase project as its production backend.

When backend work begins, X receives its own independent Supabase project with its own:

- Auth
- database
- RLS
- Storage
- Realtime
- Edge Functions
- migrations

Backend work begins only after the local engine, local match flow, UI, and AI have been proven.

---

## Rule 14 — Server-Authoritative Multiplayer

For online play, clients submit intent. They do not declare results.

The authoritative system validates at minimum:

- player identity
- turn ownership
- timing
- cost
- target legality
- card legality
- resulting state transition

Clients receive authoritative state/results after validation.

---

## Rule 15 — Reconnect Is Architectural, Not a Patch

A match must be restorable from authoritative serialized state.

No hidden UI state may be required to resume a valid match.

Reconnect capability must be designed into the state model before online release.

---

## Rule 16 — Version Rules and Card Sets

Every match must identify the rules and card-set versions used to create it.

Historical matches must remain understandable after balance or rules changes.

---

## Rule 17 — Database Changes Through Migrations

Once database development begins, schema changes must be reproducible and committed through migrations.

Do not casually edit production schema as the normal development process.

Security and RLS must be reviewed with every exposed data model.

---

## Rule 18 — Production Is Sacred

`main` represents production-quality code.

Development must occur through controlled branches and verified changes.

Normal flow:

feature branch → tests → preview → verification → merge → production

Branches should be short-lived and removed after successful integration.

Do not accumulate recovery, rewrite, and emergency branches as normal architecture.

---

## Rule 19 — Roll Back, Do Not Experiment on Production

Every production deployment must map to a known Git commit.

If production breaks, first restore a known-good version or isolate the failed change.

Do not repeatedly modify production until it appears to work.

---

## Rule 20 — Known-Good Releases

Stable milestones must be tagged with semantic versions or equivalent immutable release markers.

Examples:

- v0.1.0
- v0.2.0
- v0.3.0
- v1.0.0

Recovery should target known-good releases, not improvised recovery branches.

---

## Rule 21 — No Giant Rewrites

Working systems are replaced beside themselves.

Replacement process:

1. preserve current working system
2. build replacement independently
3. make both consume the same stable contracts where possible
4. verify replacement
5. switch deliberately
6. remove old system only after verification

Do not destroy a functioning subsystem before its replacement is proven.

---

## Rule 22 — Architecture Must Be Documented

`ARCHITECTURE.md` must define system boundaries and ownership.

Target separation:

- core game engine
- card definitions
- AI
- UI
- network layer
- backend/services
- tests

Cross-boundary dependencies must be deliberate, not accidental.

---

## Rule 23 — Repository State Is the Project Memory

`PROJECT_STATE.md` must describe:

- current stable version
- working systems
- incomplete systems
- known bugs
- current architecture state
- current milestone
- next milestone

Chat history is not authoritative project state.

If repository state and remembered conversation conflict, the repository wins.

---

## Rule 24 — Decision Log

Foundational architecture decisions must be recorded in `DECISIONS.md` before they become invisible assumptions.

Major architectural reversals must update the decision record and explain why the original decision no longer applies.

---

## Rule 25 — Scope-Locked Milestones

Development gates:

### X0 — Rulebook
Deliverable: complete rules specification.

### X1 — Engine
Deliverable: complete legal match without presentation dependency.

### X2 — Local Arena
Deliverable: two humans can complete a local match.

### X3 — AI
Deliverable: player vs bot completes matches through the same command interface.

### X4 — Persistence
Deliverable: independent X backend and persistent player data.

### X5 — Online
Deliverable: remote authoritative match with reconnection and validation.

### X6 — Presentation
Deliverable: production-quality effects, audio, arena presentation, and polish.

### X7 — Progression
Deliverable: collection, ranking, rewards, or related progression systems.

### X8 — Monetization
Deliverable: monetization only after the game and retention loop are stable.

A later milestone may not be used as justification to bypass an earlier gate.

---

## Rule 26 — Acceptance Gates Must Be Measurable

A milestone does not pass because it 'mostly works.'

Example engine gate:

- all unit tests pass
- all golden matches pass
- no uncaught exceptions
- no illegal state transitions
- deterministic simulations remain deterministic

Example online gate:

- reconnect works
- duplicate commands are rejected or safely idempotent
- illegal commands are rejected server-side
- refresh does not destroy authoritative match state
- simultaneous input is handled deterministically

If acceptance criteria fail, the milestone remains incomplete.

---

## Rule 27 — Exciting Features Go to the Backlog

Features outside the active milestone go to `BACKLOG.md` rather than entering implementation immediately.

Examples:

- animated arenas
- spectators
- guilds
- trading
- ranked seasons
- pets
- alternate card backs
- battle rewards
- 3D avatars

Scope discipline is mandatory.

---

## Rule 28 — AI and Tooling Must Not Improvise Project Truth

Any AI or automated development tool working on X must follow these rules:

1. Read this constitution before substantial implementation.
2. Read `GAME_RULES.md`, `ARCHITECTURE.md`, `PROJECT_STATE.md`, and `DECISIONS.md` when they exist.
3. Do not invent unspecified mechanics.
4. Do not reinterpret repository state from memory.
5. Do not silently change architecture to make an implementation easier.
6. Do not modify production data or deployment systems unless the task explicitly requires it.
7. Do not bypass failing tests to complete a feature.
8. Do not replace working systems destructively.
9. When a request conflicts with this constitution, surface the conflict before changing code.
10. When uncertain, preserve the known-working state and investigate rather than guessing.

---

## Core Development Law

1. **Rules before code.**
2. **Engine before UI.**
3. **Local before online.**
4. **Tests before expansion.**
5. **Stable systems are replaced beside themselves, never underneath themselves.**
6. **Git, not conversation memory, is the authoritative project record.**
7. **Gameplay correctness always outranks visual progress.**

These rules are not aspirational guidelines. They are project constraints.
