# X2 Local Match Host — Design

Date: 2026-09-24

## Scope

This is X2 step 1 only. It adds a browser-independent local match host under `apps/client/src/host/` and the tests/tooling needed to prove that boundary. It does not add renderer drawing, input widgets, animation, hot-seat hand-over UI, backend, networking, AI, persistence, or presentation polish.

The host is the only client-side owner of authoritative `GameState`. Consumers never receive `GameState` and never construct engine commands.

## Goals

The host must:

- own the authoritative `GameState`;
- create matches through `setupMatch`, complete automatic setup/turn transitions through `advance`, and mutate matches only through `applyCommand`;
- expose per-viewer output as `{ view, legalCommands, events }`;
- derive `view` with `viewFor(state, viewerId)`;
- derive viewer-visible events with `eventsFor(events, viewerId)`;
- expose legal commands only to the player currently being asked to act;
- accept a command only by selecting an entry from the host's current legal-command list, never by accepting a newly constructed `Command` object;
- retain one authoritative event log with an independent read cursor for P1 and P2;
- switch viewer identity without changing authoritative game state;
- remain usable and testable in Node with no DOM, Three.js, renderer, or browser dependency.

## Public Host Interface

The consumer-facing host interface exposes no `GameState` getter.

Conceptually:

```ts
interface LocalMatchHost {
  getOutput(): HostOutput;
  setViewer(viewerId: PlayerId): HostOutput;
  pickLegalCommand(index: number): HostResult;
}

interface HostOutput {
  viewerId: PlayerId;
  view: PlayerView;
  legalCommands: readonly Command[];
  events: readonly ViewEvent[];
}
```

Exact names may follow existing repository conventions, but the information boundary is fixed.

### Legal-command visibility

`enumerateLegalCommands(state)` describes only the active player's legal actions and can contain private instance IDs from that player's hand. Therefore:

- if `viewerId === state.activePlayerId`, `legalCommands` is the current legal list;
- otherwise `legalCommands` is `[]`.

A non-active viewer never receives the active player's command list.

### Command submission

The host never accepts arbitrary command objects from the client.

`pickLegalCommand(index)` resolves the index against the host's current legal list for the current viewer. Invalid indexes, stale selections, or selections made while the viewer is not the acting player are rejected by the host before `applyCommand` is called.

The renderer/input layer therefore selects from engine-authorized commands rather than constructing commands.

After an accepted command, the host appends the emitted `EngineEvent[]` to its event log and refreshes output from the new engine state.

## Event Delivery and Hot-Seat Cursors

The host maintains one append-only in-memory engine event log for the current local match and an independent read cursor for each viewer:

```text
P1 -> event index last delivered to P1
P2 -> event index last delivered to P2
```

When output is requested for a viewer:

1. take events after that viewer's cursor;
2. filter them through `eventsFor(events, viewerId)`;
3. return the resulting ordered `ViewEvent[]`;
4. advance only that viewer's cursor to the end of the authoritative event log.

Switching from P1 to P2 therefore allows P2 to receive events that occurred while P1 was acting, without exposing events already consumed by P2 or advancing P1's cursor.

The event log is not renderer state and is not used to infer game truth. `GameState` remains authoritative.

## Viewer Switching

`setViewer(P1 | P2)` changes only which projection is returned.

It must not:

- call `applyCommand`;
- call gameplay RNG;
- advance the turn;
- alter zones, modifiers, pending choices, score, or event history;
- expose a `GameState` reference.

A test must compare authoritative behavior before and after viewer switches to prove state is unchanged.

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

Every action is selected from the host's currently exposed `legalCommands` list by index. Tests must not construct and submit arbitrary `Command` objects to the host.

### Deterministic host replay

Given the same seed and the same sequence of legal-command picks, two host runs must produce the same terminal result and equivalent viewer-visible outputs.

### Viewer-switch purity

Switching the current viewer repeatedly must not alter authoritative game progression. Running the same command-pick sequence with additional viewer switches inserted must end in the same match result as the baseline sequence.

### Event cursors

Verify P1 and P2 consume events independently. In particular, after P1 acts and the viewer changes to P2, P2 must receive the events that occurred since P2 last consumed output, filtered for P2.

### Rejection before engine

Verify invalid/stale indexes and attempts by a non-active viewer are rejected by the host without reaching an engine mutation.

## Files / Areas Expected to Change

Primary implementation:

- `apps/client/src/host/` — host implementation and host-local types;
- dedicated host tsconfig under the client package;
- client package scripts/tsconfig references as needed for host typechecking;
- boundary-check tooling/configuration;
- host tests;
- engine real-card tests for X011, X012, X016, X020 and X025;
- project/decision documentation only where required to record the completed X2 boundary.

No `apps/client/src/render/` product implementation is part of this PR.

## Data Flow

For the active viewer:

```text
GameState (host-private)
  ├─ viewFor(state, viewerId) ───────────> PlayerView
  ├─ enumerateLegalCommands(state) ──────> legalCommands (only if viewer is active)
  └─ event log[cursor..] -> eventsFor() ─> ViewEvent[]

renderer/input consumer
  └─ pick command index ─────────────────> host
                                             └─ applyCommand(selected legal command)
```

For the non-active viewer, the same projection/event flow applies, but `legalCommands` is empty.

## Error Handling

Host-level rejection is expected for:

- invalid command index;
- stale command index after state changed;
- command selection while viewer is not the active player;
- command selection after match resolution.

These rejections do not mutate game state or append gameplay events.

Engine command rejection should be unreachable when selecting from a freshly generated legal list. If it occurs, the host returns a deterministic failure rather than inventing a substitute command or mutating state.

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
2. output is `{ view, legalCommands, events }` for the selected viewer;
3. non-active viewers receive zero legal commands;
4. commands enter the host only as picks from the current legal list;
5. P1/P2 event cursors independently preserve unseen events across viewer switches;
6. host code typechecks with no DOM library and boundary checks prevent host/render/Three coupling;
7. the five previously untested supported real cards execute against their real effect cases;
8. a production-valid 30-card real-card match resolves entirely through the host;
9. privacy checks run after every host step for both viewers;
10. same seed + same picks is deterministic;
11. viewer switching does not affect game truth;
12. the full repository frozen-install `pnpm check` passes.
