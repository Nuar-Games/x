# X2 Local Match Host — Design

Date: 2026-09-24

## Scope

This is X2 step 1 only. It adds a browser-independent local match host under `apps/client/src/host/` and the tests/tooling needed to prove that boundary. It does not add renderer drawing, input widgets, animation, hot-seat hand-over UI, backend, networking, AI, persistence, or presentation polish.

The host is the only client-side owner of authoritative `GameState`. Consumers never receive `GameState` and never construct engine commands.

## Goals

The host must:

- own the authoritative `GameState`;
- receive the match seed, card definitions and both deck lists from outside the host, create matches through `setupMatch`, complete automatic setup/turn transitions through `advance`, and mutate matches only through `applyCommand`;
- never generate a seed from time, `Math.random`, or any other uncontrolled source;
- expose per-viewer output as `{ stateVersion, view, legalCommands, events }`;
- derive `view` with `viewFor(state, viewerId)`;
- derive viewer-visible events with `eventsFor(events, viewerId)`;
- expose legal commands only to the player currently being asked to act;
- accept a command only by selecting an entry from the host's current legal-command list, never by accepting a newly constructed `Command` object;
- retain one authoritative event log with an independent acknowledged-event cursor for P1 and P2;
- make output reads side-effect free: reading events never acknowledges or consumes them;
- switch viewer identity without changing authoritative game state;
- remain usable and testable in Node with no DOM, Three.js, renderer, browser, clock, or uncontrolled-randomness dependency;
- expose only plain JSON-round-trippable data so the same host/result contract can later cross an X5 network boundary unchanged.

## Public Host Interface

The consumer-facing host interface exposes no `GameState` getter.

Conceptually:

```ts
interface LocalMatchHost {
  getOutput(): HostOutput;
  setViewer(viewerId: PlayerId): HostOutput;
  pickLegalCommand(stateVersion: number, index: number): HostResult;
  acknowledgeEvents(upToIndex: number): HostResult;
}

interface HostOutput {
  viewerId: PlayerId;
  stateVersion: number;
  view: PlayerView;
  legalCommands: readonly Command[];
  events: readonly ViewEvent[];
  eventStartIndex: number;
  eventEndIndex: number;
}
```

`HostOutput` and `HostResult` are plain data and must survive a JSON round trip without hidden references, methods, browser objects, or class instances.

Exact names may follow existing repository conventions, but the information boundary is fixed.

### State version

The host owns a monotonically increasing `stateVersion`:

- it starts at `0` after initial setup/`advance` completes;
- it increments by exactly `1` after every accepted command;
- viewer switches, output reads, event acknowledgement, and rejected command picks do not change it.

`pickLegalCommand(stateVersion, index)` must compare the caller's version to the host's current version before resolving the index. A version mismatch returns `STALE_VERSION` and must not call `applyCommand`.

### Legal-command visibility

`enumerateLegalCommands(state)` describes only the active player's legal actions and can contain private instance IDs from that player's hand. Therefore:

- if `viewerId === state.activePlayerId`, `legalCommands` is the current legal list;
- otherwise `legalCommands` is `[]`.

The engine currently creates pending choices only for the active player, so the player being asked to act remains `activePlayerId` during pending choice resolution. Host tests must assert this; if a future card creates a non-active-player choice, the host contract must be deliberately revised rather than silently leaking or misrouting commands.

After the match resolves, both viewers receive `legalCommands: []`.

### Command submission

The host never accepts arbitrary command objects from the client.

`pickLegalCommand(stateVersion, index)` resolves the index against the host's current legal list for the current viewer only after the version check passes. Invalid indexes, stale selections, selections made while the viewer is not the acting player, or picks after match resolution are rejected by the host before `applyCommand` is called.

The renderer/input layer therefore selects from engine-authorized commands rather than constructing commands.

After an accepted command, the host appends the emitted `EngineEvent[]` to its event log, increments `stateVersion`, and refreshes output from the new engine state.

Host-level rejections use fixed codes:

- `INVALID_INDEX`
- `STALE_VERSION`
- `NOT_ACTING_VIEWER`
- `MATCH_RESOLVED`
- `ENGINE_REJECTED`

Tests assert exact rejection codes.

## Event Delivery and Hot-Seat Cursors

The host maintains one append-only in-memory engine event log for the current local match and an independent acknowledged-event cursor for each viewer:

```text
P1 -> authoritative event index acknowledged by P1
P2 -> authoritative event index acknowledged by P2
```

The events emitted by the first `advance()` immediately after `setupMatch` — including P1's opening-turn draw — are appended to this same event log before the first output is returned, so both viewers can receive them through their own cursors.

### Reading events is side-effect free

`getOutput()` only reads. For the current viewer it:

1. takes authoritative events after that viewer's acknowledged cursor;
2. filters them through `eventsFor(events, viewerId)`;
3. returns the resulting ordered `ViewEvent[]` plus the authoritative event-index range represented by that output;
4. does **not** move either viewer's cursor.

Calling `getOutput()` repeatedly with no acknowledgement returns the same unseen event sequence.

### Acknowledging events is explicit

`acknowledgeEvents(upToIndex)` advances only the current viewer's acknowledged cursor, and only forward to a valid index at or before the current end of the authoritative log. The future X2 animation queue calls this once animations through that index have completed.

Switching from P1 to P2 therefore allows P2 to receive events that occurred while P1 was acting, without exposing events already acknowledged by P2 or advancing P1's cursor.

After match resolution, both viewers' unseen events still include `MATCH_ENDED` until each viewer explicitly acknowledges through that event.

The event log is not renderer state and is not used to infer game truth. `GameState` remains authoritative.

## Viewer Switching

`setViewer(P1 | P2)` changes only which projection is returned.

It must not:

- call `applyCommand`;
- call gameplay RNG;
- advance the turn;
- alter `stateVersion`;
- acknowledge events;
- alter zones, modifiers, pending choices, score, or event history;
- expose a `GameState` reference.

A test must compare authoritative behavior before and after viewer switches to prove state is unchanged.

## Deterministic Match Setup

The host receives all deterministic setup inputs from the application entry/config layer:

- `seed`;
- `cardDefinitions`;
- `player1Deck`;
- `player2Deck`;
- match/card-set identifiers required by `setupMatch`.

The host never chooses or derives a seed itself.

The default local X2 deck — two copies of each of the 15 currently engine-supported real cards — lives in a config module outside `host/` and is passed into the host. This preserves the host rule that it imports only the engine public API and host-local modules.

`scripts/check-determinism.mjs` must scan `apps/client/src/host/` in addition to engine sources so direct clock/random calls in host code fail CI.

## Host Purity and Dependency Enforcement

### TypeScript

`apps/client/src/host/` gets a dedicated tsconfig with no DOM library. Any use of browser globals or browser-only types in host code must fail typecheck.

### Dependency boundaries

Automated boundary enforcement must guarantee:

- `host/` may use the engine public API and host-local modules;
- `host/` may not import `three`;
- `host/` may not import from `render/`;
- `render/` may not import from `host/`;
- the application entry point is responsible for passing host output to renderer/input layers;
- the existing renderer rule remains: `render/` receives projections/events/types, not `GameState`.

The host public API must not expose `GameState`, including as a getter intended for convenience. Any future save/restore implementation must remain an internal/explicit persistence boundary rather than widening the renderer-facing host interface.

## Real-Card Coverage Added in This PR

The engine currently supports 15 real cards:

- X001
- X002
- X004
- X005
- X006
- X008
- X011
- X012
- X013
- X016
- X019
- X020
- X021
- X025
- X030

Five supported cards are not yet exercised as real cards against their effect cases:

- X011 JENAKA FARISH
- X012 IMP BARA BERTOPENG
- X016 PENGANGKAT RIMBA
- X020 TINFORGE
- X025 KELAJUAN TANPA NAMA

This PR adds real-card engine tests for those five. These are regression/coverage tests only; they do not reopen X1 mechanics or add new effect families.

## Production-Valid Real Deck

The local-host integration test uses a legal 30-card deck consisting of two copies of each of the 15 currently supported real cards.

The reusable default-deck definition lives outside `host/` and is supplied to the host by the application/config layer.

This satisfies production deck construction without synthetic card definitions and proves the X2 host can drive a real-card match through the production setup path.

## Host Test Matrix

### Output privacy

After every host step, inspect both viewers' outputs and confirm:

- neither player's `PlayerView` contains opponent-hand card IDs;
- neither player's `PlayerView` contains deck-order card IDs;
- filtered `ViewEvent[]` does not reveal hidden opponent-hand/deck identities;
- the non-acting viewer receives no legal commands.

### Full real-card match

Run a complete match from production-valid 30-card real decks through the host until `status === "RESOLVED"`.

Every action is selected from the host's currently exposed `legalCommands` list by `(stateVersion, index)`. Tests must not construct and submit arbitrary `Command` objects to the host.

After resolution, both viewers must have empty legal-command lists and both must still be able to read an unacknowledged `MATCH_ENDED` event.

### Deterministic host replay

Given the same externally supplied seed and the same sequence of `(stateVersion, legal-command index)` picks, two host runs must produce the same terminal result and equivalent viewer-visible outputs.

### Viewer-switch purity

Switching the current viewer repeatedly must not alter authoritative game progression. Running the same command-pick sequence with additional viewer switches inserted must end in the same match result as the baseline sequence.

### Event cursors

Verify P1 and P2 acknowledge events independently. In particular:

- repeated `getOutput()` calls before acknowledgement return the same events;
- acknowledging for one viewer changes only that viewer's unread range;
- after P1 acts and the viewer changes to P2, P2 receives the events that occurred since P2 last acknowledged, filtered for P2.

### Stale-list rejection

Capture a `HostOutput`, accept another command that increments the host `stateVersion`, then attempt to submit a pick using the old output's version. The host must return `STALE_VERSION`, leave state/event history unchanged, and never reinterpret the old index against the new command list.

### Pending-choice acting player

During a real pending Effect choice, assert that only `activePlayerId` receives legal choice commands and the non-active viewer receives `[]`.

### Rejection before engine

Verify exact host-level rejection codes for invalid indexes, stale versions, non-active viewers and resolved matches. These paths must reject before an engine mutation. If a current-list engine pick unexpectedly rejects, return `ENGINE_REJECTED` with no host-invented substitute action.

### Plain-data transport shape

JSON round-trip `HostOutput` and every `HostResult` variant and assert equality.

## Files / Areas Expected to Change

Primary implementation:

- `apps/client/src/host/` — host implementation and host-local types;
- dedicated host tsconfig under the client package;
- config module outside `host/` for the default supported real-card deck and deterministic match input construction;
- client package scripts/tsconfig references as needed for host typechecking;
- `scripts/check-determinism.mjs` — include `apps/client/src/host/`;
- boundary-check tooling/configuration;
- host tests;
- engine real-card tests for X011, X012, X016, X020 and X025;
- project/decision documentation only where required to record the completed X2 boundary.

No `apps/client/src/render/` product implementation is part of this PR.

## Data Flow

For the active viewer:

```text
externally supplied deterministic setup
  └─ seed + card definitions + both decks
       └─ local match host
            └─ GameState (host-private)
                 ├─ viewFor(state, viewerId) ───────────> PlayerView
                 ├─ enumerateLegalCommands(state) ──────> legalCommands (only if viewer is active)
                 └─ event log[cursor..] -> eventsFor() ─> ViewEvent[]

renderer/input consumer
  └─ (stateVersion, legal-command index) ───────────────> host
                                                           └─ applyCommand(selected legal command)

event animation consumer
  └─ acknowledgeEvents(upToIndex) ─────────────────────> host advances only current viewer cursor
```

For the non-active viewer, the same projection/event flow applies, but `legalCommands` is empty.

## Error Handling

Host-level rejection is expected for:

- invalid command index → `INVALID_INDEX`;
- stale command list/version → `STALE_VERSION`;
- command selection while viewer is not the active player → `NOT_ACTING_VIEWER`;
- command selection after match resolution → `MATCH_RESOLVED`;
- a supposedly legal current command rejected by the engine → `ENGINE_REJECTED`.

These rejections do not mutate game state, increment `stateVersion`, acknowledge events, or append gameplay events.

## Out of Scope

This PR does not implement:

- Three.js zone rendering;
- clickable card/button UI;
- animations;
- the hot-seat pass-device screen;
- save/restore UI;
- networking or backend transport;
- AI;
- additional unsupported card effect families.

Those remain later X2/X3+ work according to the agreed sequence.

## Acceptance Criteria

The PR is complete only when:

1. the host owns authoritative `GameState` and exposes no state getter;
2. output is `{ stateVersion, view, legalCommands, events }` plus event-index metadata for the selected viewer;
3. `getOutput()` is side-effect free and event acknowledgement is explicit;
4. non-active viewers receive zero legal commands, including during pending choices;
5. commands enter the host only as `(stateVersion, index)` picks from the current legal list;
6. stale picks reject with `STALE_VERSION` before index reinterpretation;
7. accepted commands increment `stateVersion` exactly once; reads/switches/acks/rejections do not;
8. P1/P2 event cursors independently preserve unacknowledged events across viewer switches;
9. opening-advance events are in the shared log, and resolved matches still expose `MATCH_ENDED` until acknowledged;
10. host setup is entirely externally seeded/configured; the default 30-card supported deck lives outside `host/`;
11. host code typechecks with no DOM library and boundary checks prevent host/render/Three coupling;
12. determinism tooling scans `apps/client/src/host/`;
13. the five previously untested supported real cards execute against their real effect cases;
14. a production-valid 30-card real-card match resolves entirely through the host;
15. privacy checks run after every host step for both viewers;
16. same seed + same picks is deterministic;
17. viewer switching does not affect game truth;
18. `HostOutput` and `HostResult` are JSON-round-trippable plain data;
19. host rejection codes are stable and tested exactly;
20. the full repository frozen-install `pnpm check` passes.
