# X — Phases and Workflow

This document defines the mandatory development sequence, the hard exit condition for every phase, and the rule that prevents X from becoming an endless development loop.

## Global Rule — Every Phase Must End

No phase may remain open indefinitely.

A phase ends when its listed exit criteria are met.

Once a phase is closed:
- do not keep expanding it with optional work;
- do not reopen it merely because a new hypothetical edge case is imaginable;
- do not block the next phase with non-blocking improvements;
- record later optional improvements in `BACKLOG.md` or `DECISIONS.md` as appropriate.

A closed phase may only be reopened if a real contradiction, regression, or implementation blocker proves that its exit criteria were not actually satisfied.

---

## X0 — Establishment / Rulebook

### Purpose
Define X clearly enough that implementation can proceed deterministically without inventing core rules.

### Required Work
- establish project identity;
- establish non-negotiable development constraints;
- consolidate the creator's gameplay rules into `GAME_RULES.md`;
- document the working protocol;
- define phases and workflow;
- record the current project state;
- resolve only contradictions that actually block implementation.

### Exit Criteria
X0 is complete when all of the following are true:
- `PROJECT_CONSTITUTION.md` exists;
- `GAME_RULES.md` contains the established base rules;
- `WORKING_PROTOCOL.md` exists;
- `PHASES_AND_WORKFLOW.md` exists;
- `PROJECT_STATE.md` records the current phase and next task;
- no known contradiction prevents implementation of the base engine.

### Hard Stop
Once the exit criteria are met, X0 is closed. Do not continue establishment questioning. Move to X1.

---

## X1 — Headless Game Engine

### Purpose
Build the complete rules engine without UI, backend, networking, or presentation dependencies.

### Required Work
- define canonical serializable `GameState`;
- define validated player command model;
- implement turn flow;
- implement VS deployment and replacement;
- implement ATK/DEF position rules;
- implement Mega X-style STA capacity rules as established for X;
- implement Effect Zone occupancy and removal rules;
- implement Zone X capture scoring and absolute protection;
- implement Zone Tepi behavior;
- implement battle matrix;
- implement Arena Collapse;
- implement draw, discard, deck exhaustion, scoring, and tie-breaker behavior;
- implement explicit-text effect resolution;
- implement deterministic seeded randomness where randomness is required;
- implement automated rule tests and golden-match fixtures.

### Exit Criteria
X1 is complete when:
- a legal match can run from setup to final winner entirely through the engine;
- all core rules in `GAME_RULES.md` are represented;
- illegal commands are rejected deterministically;
- authoritative state is serializable;
- repeated runs with the same seed and commands produce the same result;
- all engine tests pass;
- golden matches pass;
- no uncaught engine exception remains in the test suite.

### Hard Stop
Do not add UI, Supabase, accounts, online multiplayer, 3D, cosmetics, progression, or monetization before X1 passes.

---

## X2 — Local 2D Arena

Per D-007, the arena uses the greybox 2.5D Three.js renderer.

### Purpose
Make the proven engine playable by two humans locally through a simple 2D interface.

### Required Work
- render authoritative engine state;
- provide hand, deck, VS Zone, Effect Zone, Zone X, and Zone Tepi views;
- expose only legal actions supplied by the engine;
- implement ATK/DEF position controls;
- implement clear turn, round, Arena Collapse, STA, and scoring feedback;
- add basic non-authoritative animation and audio only after state transitions are committed.

### Exit Criteria
X2 is complete when:
- two local players can complete full matches repeatedly;
- UI cannot directly mutate authoritative state;
- refresh/re-render does not change game truth;
- all X1 tests still pass;
- no core rule requires UI-specific logic.

### Hard Stop
Do not start online systems or 3D presentation merely because the local UI looks simple.

---

## X3 — AI Opponent

### Purpose
Add a bot that plays through the exact same legal-command interface as a human player.

### Required Work
- legal action enumeration;
- baseline decision model;
- deterministic test mode;
- regression matches against fixed seeds.

### Exit Criteria
X3 is complete when:
- AI can complete full legal matches without privileged state mutation;
- AI uses the same engine commands as a human;
- AI cannot bypass rules;
- AI matches do not break X1/X2 tests.

### Hard Stop
Do not couple AI logic into UI or backend code.

---

## X4 — Persistence / Independent Backend

### Purpose
Add X-owned persistent player data without making the backend the game-rules engine.

### Required Work
- create a separate X Supabase project;
- define migrations;
- configure Auth if needed for this phase;
- define secure RLS policies;
- persist player/profile data required by the product;
- keep Mega X Supabase data isolated and untouched.

### Exit Criteria
X4 is complete when:
- X has its own backend project;
- migrations reproduce schema;
- security/RLS checks pass;
- local gameplay remains functional without backend authority over rules;
- no Mega X production resource is reused by default.

### Hard Stop
Do not use production database changes as experimentation.

---

## X5 — Online Authoritative Multiplayer

### Purpose
Allow two remote players to play the same proven engine through an authoritative match service.

### Required Work
- authoritative command validation;
- remote turn synchronization;
- duplicate/idempotent command protection;
- reconnect from serialized authoritative state;
- deterministic conflict handling;
- match persistence where required;
- anti-cheat validation based on authoritative state.

### Exit Criteria
X5 is complete when:
- two remote players can finish full matches;
- illegal client commands are rejected server-side;
- refresh/disconnect/reconnect does not destroy the match;
- duplicate commands cannot duplicate outcomes;
- both clients converge on the same authoritative state;
- all earlier phase tests remain green.

### Hard Stop
Do not use visual polish to hide networking/state defects.

---

## X6 — Presentation / Polish

### Purpose
Improve production presentation only after the game and online state are proven.

### Required Work
- premium 2D presentation;
- effects and transitions;
- audio;
- arena presentation;
- performance optimization;
- accessibility/responsiveness;
- optional 3D only if it can consume the proven engine without rewriting it.

### Exit Criteria
X6 is complete when:
- presentation does not own or mutate game truth;
- performance target is met on supported hardware;
- full matches remain stable under final presentation;
- previous tests continue to pass.

### Hard Stop
No destructive rewrite of the engine for visual convenience.

---

## X7 — Progression / Collection / Ranking

### Purpose
Add meta systems around the proven game.

### Required Work
Only systems explicitly approved for X, such as collection, ranking, rewards, or related progression.

### Exit Criteria
X7 is complete when approved progression features work without changing the established match rules unless the creator explicitly amends `GAME_RULES.md`.

---

## X8 — Monetization / Release Expansion

### Purpose
Add monetization and broader live-product systems only after the game is stable.

### Required Work
Only monetization explicitly approved for X.

### Exit Criteria
Defined per approved monetization scope, with no pay system allowed to compromise game-state integrity or bypass project constraints.

---

# Mandatory Work Cycle Inside Every Phase

Every substantial task follows this sequence:

1. Read the authoritative repo documents relevant to the task.
2. Identify the exact current phase and its exit criteria.
3. Implement only work required by the current phase or explicitly approved scope.
4. Run tests/verification appropriate to the change.
5. Fix failures before claiming completion.
6. Persist project-defining decisions in the repository.
7. Update `PROJECT_STATE.md` with what is complete and the next concrete task.
8. Stop when the phase exit criteria are met and move forward.

# Anti-Endless-Work Rules

- Do not manufacture new requirements after a phase gate is satisfied.
- Do not convert optional polish into a blocking requirement.
- Do not reopen settled rules without a real contradiction or implementation blocker.
- Do not ask speculative edge-case questions merely because they are imaginable.
- Do not drip-feed clarification questions; batch only genuine blockers.
- Do not keep a task open after its acceptance criteria pass.
- Do not claim progress without a corresponding repo change, verified test result, or documented decision.
- Do not require the creator to repeatedly prompt the assistant to continue a task already in progress.

# Current Phase

See `PROJECT_STATE.md` for the current phase and next task. This document does not track status.
