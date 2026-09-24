# X2 Local Match Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browser-independent X2 local match host that owns `GameState`, exposes only per-player views/legal picks/filtered events, and proves the boundary with real-card full-match tests.

**Architecture:** `apps/client/src/host/` owns the authoritative engine state and event log but exposes only JSON-safe projections. Match construction inputs come from `apps/client/src/config/default-match.ts`, command submission is `(stateVersion, legalCommandIndex)`, and event reading is side-effect free with explicit per-viewer acknowledgement. CI enforces no DOM/Three/render imports in the host and scans the host for uncontrolled time/randomness.

**Tech Stack:** TypeScript 5.x, Vitest 2.x, pnpm workspace, `@x/engine`, `@x/cards`, Node-only host typecheck, existing dependency-cruiser/boundary scripts.

**Spec:** `docs/superpowers/specs/2026-09-24-x2-local-match-host-design.md`

## Global Constraints

- X2 step 1 only: no renderer drawing, input widgets, animation implementation, pass-device UI, backend, networking, AI, persistence, or presentation polish.
- `apps/client/src/host/` is the only client-side owner of authoritative `GameState`; its public interface exposes no state getter.
- The host receives `seed`, `cardDefinitions`, `player1Deck`, `player2Deck`, match ID, and card-set version from outside; it never generates a seed.
- Consumers never submit `Command` objects; they submit `(stateVersion, index)` from the current host output.
- `getOutput()` is read-only and never advances event cursors.
- P1 and P2 have independent acknowledged-event cursors over one append-only authoritative event log.
- `HostOutput` and `HostResult` must survive `JSON.parse(JSON.stringify(value))` unchanged.
- Stable host rejection codes are exactly: `INVALID_INDEX`, `STALE_VERSION`, `NOT_ACTING_VIEWER`, `MATCH_RESOLVED`, `ENGINE_REJECTED`.
- `host/` has no DOM library, no `three`, no `render/`, no clock/random APIs, and no `@x/cards` import.
- The default local deck is 2 copies each of X001, X002, X004, X005, X006, X008, X011, X012, X013, X016, X019, X020, X021, X025, X030 and lives outside `host/`.
- Full repository acceptance remains `pnpm check` with the frozen lockfile.

## Review Focus

- Repeated `getOutput()` before acknowledgement must return the identical unseen event range; no render/test read may consume animations.
- A legal-command index captured from an older `stateVersion` must reject as `STALE_VERSION` even if that index is valid in the new list.
- During pending Effect choices, only `activePlayerId` receives legal commands; the other viewer receives `[]`.
- `MATCH_ENDED` must remain readable independently by both viewers until each acknowledges through that event.
- Viewer switching and event acknowledgement must never change gameplay progression, RNG state, or `stateVersion`.

---

### Task 1: Extend real-card engine coverage to all 15 currently supported cards

**Files:**
- Modify: `packages/engine/test/proof-cards.test.ts`
- Read: `packages/cards/data/card-effect-cases.0.2.0.json`
- Read: `packages/engine/test/helpers/real-cards.ts`

**Interfaces:**
- Consumes: existing `fullSet`, `playCard`, `standoff`-style setup helpers, `effectiveStat`, and real card effect cases.
- Produces: executable regression coverage for X011, X012, X016, X020, X025 through `applyCommand` without adding new engine mechanics.

- [ ] **Step 1: Add failing real-card tests for the five supported cards**

Add five `card(...)` cases using the same helper style as the existing proof cards:

```ts
card("X011", "JENAKA FARISH — opponent VS STA −2", () => {
  const state = playCard(standoff("X002", "X013"), "P1", "X011").state;
  expect(effectiveStat(state, vsOf(state, "P2"), "STA")).toBe(2);
});

card("X012", "IMP BARA BERTOPENG — opponent VS ATK −200", () => {
  const state = playCard(standoff("X002", "X013"), "P1", "X012").state;
  expect(effectiveStat(state, vsOf(state, "P2"), "ATK")).toBe(600);
});

card("X016", "PENGANGKAT RIMBA — draw 3", () => {
  const [state, instanceId] = take(withActive(standoff("X002", "X013"), "P1"), "P1", "X016");
  const beforeHand = state.players.P1.hand.length;
  const beforeDeck = state.players.P1.deck.length;
  const result = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: instanceId });
  expect(result.state.players.P1.hand).toHaveLength(beforeHand - 1 + 3);
  expect(result.state.players.P1.deck).toHaveLength(beforeDeck - 3);
});

card("X020", "TINFORGE — own VS ATK +600", () => {
  const state = playCard(standoff("X002", "X013"), "P1", "X020").state;
  expect(effectiveStat(state, vsOf(state, "P1"), "ATK")).toBe(1200);
});

card("X025", "KELAJUAN TANPA NAMA — draw 5", () => {
  const [state, instanceId] = take(withActive(standoff("X002", "X013"), "P1"), "P1", "X025");
  const beforeDeck = state.players.P1.deck.length;
  const result = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: instanceId });
  expect(result.state.players.P1.deck).toHaveLength(beforeDeck - 5);
});
```

Use the actual expected values from the card definitions/effect cases when wiring the assertions; do not alter card data or effect semantics.

- [ ] **Step 2: Run the focused engine test and verify coverage is incomplete before updating the coverage assertion**

Run:

```bash
pnpm --filter @x/engine test -- proof-cards.test.ts
```

Expected before the coverage-set update: the five new card cases pass, while the existing proof-only coverage assertion still reflects the 10-card proof subset.

- [ ] **Step 3: Split proof-set coverage from supported-real-card coverage**

Keep the existing `engine-proof.json` assertion intact, and add a second explicit set for all 15 supported IDs:

```ts
const SUPPORTED_REAL_IDS = [
  "X001", "X002", "X004", "X005", "X006", "X008", "X011", "X012",
  "X013", "X016", "X019", "X020", "X021", "X025", "X030"
] as const;

it("every currently supported real card has an executable card test", () => {
  expect([...tested].sort()).toEqual([...SUPPORTED_REAL_IDS].sort());
});
```

Do not redefine the 10-card engine-proof subset as 15 cards; this is additional real-card coverage only.

- [ ] **Step 4: Run the focused test**

Run:

```bash
pnpm --filter @x/engine test -- proof-cards.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/test/proof-cards.test.ts
git commit -m "test: cover all supported real cards"
```

---

### Task 2: Add deterministic client match configuration and host purity tooling

**Files:**
- Create: `apps/client/src/config/default-match.ts`
- Create: `apps/client/tsconfig.host.json`
- Modify: `apps/client/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/check-determinism.mjs`
- Modify: `scripts/check-renderer-boundary.mjs`
- Modify: root `package.json` only if a separate host-boundary script is preferred over extending the existing boundary script.

**Interfaces:**
- Consumes: `fullSet` from `@x/cards`, `MatchSetupInput` from `@x/engine`.
- Produces: `SUPPORTED_LOCAL_CARD_IDS`, `DEFAULT_LOCAL_DECK`, and `createDefaultLocalMatchInput(seed, matchId)` outside `host/`; CI-enforced host purity.

- [ ] **Step 1: Add a failing config test or compile target proving the default deck is production-valid**

Create `apps/client/src/config/default-match.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { setupMatch } from "@x/engine";
import { DEFAULT_LOCAL_DECK, SUPPORTED_LOCAL_CARD_IDS, createDefaultLocalMatchInput } from "./default-match.ts";

describe("default local X2 match config", () => {
  it("uses exactly two copies of each of the 15 supported real cards", () => {
    expect(SUPPORTED_LOCAL_CARD_IDS).toHaveLength(15);
    expect(DEFAULT_LOCAL_DECK).toHaveLength(30);
    for (const id of SUPPORTED_LOCAL_CARD_IDS) {
      expect(DEFAULT_LOCAL_DECK.filter((candidate) => candidate === id)).toHaveLength(2);
    }
  });

  it("passes the production setup path with an externally supplied seed", () => {
    expect(() => setupMatch(createDefaultLocalMatchInput(4242, "x2-local-test"))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the focused client test and verify it fails because the config module does not exist**

Run:

```bash
pnpm --filter @x/client test -- src/config/default-match.test.ts
```

Expected: FAIL resolving `./default-match.ts`.

- [ ] **Step 3: Add `@x/cards` as a client dependency and create deterministic default config**

In `apps/client/package.json`, add:

```json
"@x/cards": "workspace:*"
```

Create `apps/client/src/config/default-match.ts`:

```ts
import { fullSet } from "@x/cards";
import type { MatchSetupInput } from "@x/engine";

export const SUPPORTED_LOCAL_CARD_IDS = [
  "X001", "X002", "X004", "X005", "X006", "X008", "X011", "X012",
  "X013", "X016", "X019", "X020", "X021", "X025", "X030"
] as const;

export const DEFAULT_LOCAL_DECK: readonly string[] = SUPPORTED_LOCAL_CARD_IDS.flatMap((id) => [id, id]);

const definitions = fullSet.cards.filter((card) => SUPPORTED_LOCAL_CARD_IDS.includes(card.id as (typeof SUPPORTED_LOCAL_CARD_IDS)[number]));

export function createDefaultLocalMatchInput(seed: number, matchId: string): MatchSetupInput {
  return {
    matchId,
    seed,
    cardSetVersion: fullSet.cardSetVersion,
    cardDefinitions: definitions,
    player1Deck: DEFAULT_LOCAL_DECK,
    player2Deck: DEFAULT_LOCAL_DECK
  };
}
```

Run `pnpm install --lockfile-only` if needed to update the workspace importer while preserving the frozen lockfile.

- [ ] **Step 4: Add a dedicated host TypeScript config with no DOM**

Create `apps/client/tsconfig.host.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": []
  },
  "include": ["src/host/**/*.ts"]
}
```

Update the client typecheck script to run both configs:

```json
"typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.host.json"
```

The normal client tsconfig keeps DOM/Vite types for entry/render code; only host code is compiled under the no-DOM config.

- [ ] **Step 5: Extend determinism scanning to host code**

Change `scripts/check-determinism.mjs`:

```js
const ROOTS = ["packages/engine/src", "packages/ai/src", "apps/client/src/host"];
```

Make `walk` skip a root only if it does not yet exist, or create the host directory in Task 3 before running the full check.

- [ ] **Step 6: Extend boundary enforcement for host/render separation**

In `scripts/check-renderer-boundary.mjs`, add host scanning with rules equivalent to:

```js
const HOST_ROOT = "apps/client/src/host";
const HOST_RULES = [
  { pattern: /from\s+["']three["']/, why: "host code must not import Three.js" },
  { pattern: /from\s+["'][^"']*\/render\//, why: "host code must not import renderer modules" },
  { pattern: /from\s+["']@x\/cards["']/, why: "real card/config data belongs outside host/" }
];

const RENDER_HOST_RULE = {
  pattern: /from\s+["'][^"']*\/host\//,
  why: "renderer receives plain host output from the entry point; it must not import the host"
};
```

Keep all existing renderer restrictions (`GameState`, non-type engine imports, old-state diff names).

- [ ] **Step 7: Prove tooling rejects violations**

Temporarily create a local uncommitted `apps/client/src/host/__boundary-probe.ts` containing `document.body; Math.random(); import "three";`, run:

```bash
pnpm --filter @x/client typecheck
pnpm boundaries
pnpm determinism
```

Expected: host typecheck/boundary/determinism checks fail for the probe. Delete the probe, rerun all three, and expect PASS. Do not commit the probe.

- [ ] **Step 8: Run focused config test and tooling**

Run:

```bash
pnpm --filter @x/client test -- src/config/default-match.test.ts
pnpm --filter @x/client typecheck
pnpm boundaries
pnpm determinism
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/client/package.json apps/client/tsconfig.host.json apps/client/src/config/default-match.ts apps/client/src/config/default-match.test.ts scripts/check-determinism.mjs scripts/check-renderer-boundary.mjs pnpm-lock.yaml
git commit -m "build: enforce X2 host purity"
```

---

### Task 3: Implement read-only host output and explicit per-viewer event acknowledgement

**Files:**
- Create: `apps/client/src/host/types.ts`
- Create: `apps/client/src/host/local-match-host.ts`
- Create: `apps/client/src/host/local-match-host.test.ts`

**Interfaces:**
- Consumes: `setupMatch(input)`, `advance(state)`, `viewFor(state, viewerId)`, `eventsFor(events, viewerId)`, `enumerateLegalCommands(state)`.
- Produces:
  - `createLocalMatchHost(input: MatchSetupInput, initialViewer?: PlayerId): LocalMatchHost`
  - `LocalMatchHost.getOutput(): HostOutput`
  - `LocalMatchHost.setViewer(viewerId: PlayerId): HostOutput`
  - `LocalMatchHost.acknowledgeEvents(upToIndex: number): HostOutput`
  - public JSON-safe host types with no `GameState` field.

- [ ] **Step 1: Define failing tests for opening events, side-effect-free reads, independent acknowledgement, viewer switching, and JSON shape**

Start `apps/client/src/host/local-match-host.test.ts` with tests equivalent to:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultLocalMatchInput } from "../config/default-match.ts";
import { createLocalMatchHost } from "./local-match-host.ts";

it("includes opening advance events for both viewers without consuming them on read", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(7, "opening-events"));
  const p1a = host.getOutput();
  const p1b = host.getOutput();
  expect(p1b.events).toEqual(p1a.events);
  expect(p1a.events.some((event) => event.type === "CARD_DRAWN")).toBe(true);

  const p2 = host.setViewer("P2");
  expect(p2.events).toHaveLength(p1a.events.length);
});

it("acknowledges events independently per viewer", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(8, "event-cursors"));
  const p1 = host.getOutput();
  host.acknowledgeEvents(p1.eventEndIndex);
  expect(host.getOutput().events).toEqual([]);
  const p2 = host.setViewer("P2");
  expect(p2.events.length).toBeGreaterThan(0);
});

it("viewer switching changes projection only", () => {
  const baseline = createLocalMatchHost(createDefaultLocalMatchInput(9, "switch-baseline"));
  const switched = createLocalMatchHost(createDefaultLocalMatchInput(9, "switch-baseline"));
  switched.setViewer("P2");
  switched.setViewer("P1");
  expect(switched.getOutput()).toEqual(baseline.getOutput());
});

it("returns JSON-round-trippable output", () => {
  const output = createLocalMatchHost(createDefaultLocalMatchInput(10, "json-output")).getOutput();
  expect(JSON.parse(JSON.stringify(output))).toEqual(output);
});
```

- [ ] **Step 2: Run the host test and verify it fails because the host does not exist**

Run:

```bash
pnpm --filter @x/client test -- src/host/local-match-host.test.ts
```

Expected: FAIL resolving `./local-match-host.ts`.

- [ ] **Step 3: Define the public plain-data types**

Create `apps/client/src/host/types.ts`:

```ts
import type { Command, PlayerId, PlayerView, ViewEvent } from "@x/engine";

export type HostRejectionCode =
  | "INVALID_INDEX"
  | "STALE_VERSION"
  | "NOT_ACTING_VIEWER"
  | "MATCH_RESOLVED"
  | "ENGINE_REJECTED";

export interface HostOutput {
  readonly viewerId: PlayerId;
  readonly stateVersion: number;
  readonly view: PlayerView;
  readonly legalCommands: readonly Command[];
  readonly events: readonly ViewEvent[];
  /** Inclusive acknowledged-count start / exclusive end over the authoritative engine-event log. */
  readonly eventStartIndex: number;
  readonly eventEndIndex: number;
}

export type HostResult =
  | { readonly accepted: true; readonly output: HostOutput }
  | { readonly accepted: false; readonly code: HostRejectionCode; readonly output: HostOutput };

export interface LocalMatchHost {
  getOutput(): HostOutput;
  setViewer(viewerId: PlayerId): HostOutput;
  pickLegalCommand(stateVersion: number, index: number): HostResult;
  acknowledgeEvents(upToIndex: number): HostOutput;
}
```

The `Command[]` exists only as output data selected by index; no public method accepts a `Command` input.

- [ ] **Step 4: Implement setup, opening `advance`, projection, and event log**

Create `apps/client/src/host/local-match-host.ts` with private closure state:

```ts
import {
  advance,
  enumerateLegalCommands,
  eventsFor,
  setupMatch,
  viewFor,
  type EngineEvent,
  type GameState,
  type MatchSetupInput,
  type PlayerId
} from "@x/engine";
import type { HostOutput, HostResult, LocalMatchHost } from "./types.ts";

export function createLocalMatchHost(input: MatchSetupInput, initialViewer: PlayerId = "P1"): LocalMatchHost {
  let state: GameState = setupMatch(input);
  const opening = advance(state);
  state = opening.state;
  const eventLog: EngineEvent[] = [...opening.events];
  const acknowledged: Record<PlayerId, number> = { P1: 0, P2: 0 };
  let viewerId: PlayerId = initialViewer;
  let stateVersion = 0;

  function output(): HostOutput {
    const start = acknowledged[viewerId];
    const end = eventLog.length;
    return {
      viewerId,
      stateVersion,
      view: viewFor(state, viewerId),
      legalCommands: state.status === "ACTIVE" && viewerId === state.activePlayerId ? enumerateLegalCommands(state) : [],
      events: eventsFor(eventLog.slice(start, end), viewerId),
      eventStartIndex: start,
      eventEndIndex: end
    };
  }

  return {
    getOutput: output,
    setViewer(nextViewerId) {
      viewerId = nextViewerId;
      return output();
    },
    acknowledgeEvents(upToIndex) {
      const current = acknowledged[viewerId];
      if (Number.isInteger(upToIndex) && upToIndex >= current && upToIndex <= eventLog.length) {
        acknowledged[viewerId] = upToIndex;
      }
      return output();
    },
    pickLegalCommand() {
      throw new Error("pickLegalCommand is implemented in Task 4");
    }
  };
}
```

Do not commit the temporary throw: Task 3 and Task 4 must be completed on the same branch before a review/PR. For the Task 3 test cycle, define `pickLegalCommand` as a typed method that returns a deterministic `ENGINE_REJECTED` result without state mutation, then replace it in Task 4.

- [ ] **Step 5: Run host read/cursor tests**

Run:

```bash
pnpm --filter @x/client test -- src/host/local-match-host.test.ts
pnpm --filter @x/client typecheck
```

Expected: PASS for opening events, repeated reads, independent acknowledgements, viewer switching, and JSON output.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/host/types.ts apps/client/src/host/local-match-host.ts apps/client/src/host/local-match-host.test.ts
git commit -m "feat: add read-only local match host output"
```

---

### Task 4: Implement versioned legal-command picks and fixed rejection codes

**Files:**
- Modify: `apps/client/src/host/local-match-host.ts`
- Modify: `apps/client/src/host/local-match-host.test.ts`

**Interfaces:**
- Consumes: the host's current `stateVersion`, active viewer, `enumerateLegalCommands(state)`, and engine `applyCommand`.
- Produces: `pickLegalCommand(stateVersion, index): HostResult`, exact rejection codes, accepted-command event append/version increment.

- [ ] **Step 1: Add failing tests for all host rejection codes and stale-list behavior**

Add tests equivalent to:

```ts
it("rejects a stale legal-command list before interpreting its index", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(20, "stale-pick"));
  const old = host.getOutput();
  const accepted = host.pickLegalCommand(old.stateVersion, 0);
  expect(accepted.accepted).toBe(true);

  const stale = host.pickLegalCommand(old.stateVersion, 0);
  expect(stale).toMatchObject({ accepted: false, code: "STALE_VERSION" });
});

it("rejects command picks from a non-acting viewer", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(21, "wrong-viewer"));
  const p1 = host.getOutput();
  host.setViewer("P2");
  expect(host.pickLegalCommand(p1.stateVersion, 0)).toMatchObject({ accepted: false, code: "NOT_ACTING_VIEWER" });
});

it("rejects out-of-range indexes exactly", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(22, "bad-index"));
  const output = host.getOutput();
  expect(host.pickLegalCommand(output.stateVersion, -1)).toMatchObject({ accepted: false, code: "INVALID_INDEX" });
  expect(host.pickLegalCommand(output.stateVersion, output.legalCommands.length)).toMatchObject({ accepted: false, code: "INVALID_INDEX" });
});
```

Add a resolved-match test later in Task 5 once a complete host-play helper exists, asserting `MATCH_RESOLVED`.

- [ ] **Step 2: Run focused tests and verify they fail against the Task 3 stub**

Run:

```bash
pnpm --filter @x/client test -- src/host/local-match-host.test.ts
```

Expected: FAIL on stale/wrong-viewer/invalid-index behavior.

- [ ] **Step 3: Implement validation order and accepted-command transition**

Replace the stub with logic in this exact order:

```ts
pickLegalCommand(candidateVersion, index): HostResult {
  if (state.status !== "ACTIVE") return { accepted: false, code: "MATCH_RESOLVED", output: output() };
  if (viewerId !== state.activePlayerId) return { accepted: false, code: "NOT_ACTING_VIEWER", output: output() };
  if (candidateVersion !== stateVersion) return { accepted: false, code: "STALE_VERSION", output: output() };

  const legalCommands = enumerateLegalCommands(state);
  if (!Number.isInteger(index) || index < 0 || index >= legalCommands.length) {
    return { accepted: false, code: "INVALID_INDEX", output: output() };
  }

  const result = applyCommand(state, legalCommands[index]!);
  if (!result.accepted) {
    return { accepted: false, code: "ENGINE_REJECTED", output: output() };
  }

  state = result.state;
  eventLog.push(...result.events);
  stateVersion += 1;
  return { accepted: true, output: output() };
}
```

Do not auto-switch viewers after commands; viewer identity is controlled only by `setViewer`/the later hot-seat layer.

- [ ] **Step 4: Add state-version invariants**

Add tests proving:

```ts
const before = host.getOutput();
host.getOutput();
host.acknowledgeEvents(before.eventEndIndex);
host.setViewer("P2");
host.setViewer("P1");
expect(host.getOutput().stateVersion).toBe(before.stateVersion);

const after = host.pickLegalCommand(before.stateVersion, 0);
expect(after.accepted && after.output.stateVersion).toBe(before.stateVersion + 1);
```

Also assert rejected picks leave `stateVersion`, `events`, and projection unchanged.

- [ ] **Step 5: Run focused host tests**

Run:

```bash
pnpm --filter @x/client test -- src/host/local-match-host.test.ts
pnpm --filter @x/client typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/host/local-match-host.ts apps/client/src/host/local-match-host.test.ts
git commit -m "feat: validate versioned local command picks"
```

---

### Task 5: Prove pending-choice ownership, privacy, determinism, and a complete real-card host match

**Files:**
- Create: `apps/client/src/host/local-match-host.integration.test.ts`
- Modify: `apps/client/src/host/local-match-host.test.ts` if shared helpers are small; otherwise create `apps/client/src/host/test-helpers.ts` used only by host tests.

**Interfaces:**
- Consumes: `createDefaultLocalMatchInput`, `createLocalMatchHost`, `HostOutput`.
- Produces: a deterministic command-pick driver that uses only host output indexes; full real-deck proof through the production setup path.

- [ ] **Step 1: Add a helper that chooses only from exposed legal commands**

In the integration test, define a deterministic picker from command data already exposed by the host:

```ts
function chooseIndex(output: HostOutput): number {
  const priorities = [
    "RESOLVE_EFFECT_CHOICE",
    "DISCARD_FOR_HAND_LIMIT",
    "DEPLOY_VS",
    "KEEP_VS",
    "PLAY_EFFECT",
    "ATTACK",
    "PASS"
  ];
  for (const type of priorities) {
    const index = output.legalCommands.findIndex((command) => command.type === type);
    if (index >= 0) return index;
  }
  if (output.legalCommands.length === 0) throw new Error(`no legal commands for active match at ${output.view.turnStage}`);
  return 0;
}
```

The test may inspect the public command list to choose an index; it must never construct a command object and pass it to the host.

- [ ] **Step 2: Add a privacy assertion used after every command for both viewers**

Define:

```ts
function assertNoHiddenIds(output: HostOutput): void {
  const serialized = JSON.stringify(output);
  const opponentPrefix = output.viewerId === "P1" ? "P2-" : "P1-";
  for (const hiddenCard of output.view.opponent.handCount === 0 ? [] : [opponentPrefix]) {
    // Do not use a blanket prefix ban: public opponent cards legitimately use the prefix.
  }
  expect("deck" in output.view.you && Array.isArray((output.view.you as { deck?: unknown }).deck)).toBe(false);
  expect("deck" in output.view.opponent && Array.isArray((output.view.opponent as { deck?: unknown }).deck)).toBe(false);
  for (const event of output.events) {
    if (event.type === "CARD_DRAWN" && event.playerId !== output.viewerId) expect(event.instanceId).toBeNull();
  }
  expect(serialized).not.toContain('"cardInstances"');
}
```

Strengthen this using the actual `PlayerView` shape: collect the opponent's current private hand/deck IDs only inside a test oracle that has no host API access by running a mirrored engine fixture, or reuse the existing X1.1 whole-match leak strategy if already available. The assertion must specifically prove private opponent hand/deck IDs never appear while allowing IDs of public opponent VS/Effect/Zone X/Zone Tepi cards.

- [ ] **Step 3: Add the full 30-card real match test**

Run until resolution with a hard safety cap:

```ts
it("plays a production-valid real-card match to resolution through host picks only", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(23001, "x2-host-full-match"));

  for (let step = 0; step < 1000; step += 1) {
    for (const viewerId of ["P1", "P2"] as const) {
      const view = host.setViewer(viewerId);
      assertNoHiddenIds(view);
    }

    let output = host.getOutput();
    if (output.view.status === "RESOLVED") {
      for (const viewerId of ["P1", "P2"] as const) {
        const resolved = host.setViewer(viewerId);
        expect(resolved.legalCommands).toEqual([]);
        expect(resolved.events.some((event) => event.type === "MATCH_ENDED")).toBe(true);
      }
      return;
    }

    host.setViewer(output.view.activePlayerId);
    output = host.getOutput();
    const index = chooseIndex(output);
    const result = host.pickLegalCommand(output.stateVersion, index);
    expect(result.accepted).toBe(true);
  }

  throw new Error("real-card host match did not resolve within 1000 accepted-command opportunities");
});
```

If the priority policy gets stuck because it repeatedly chooses legal Effects/VS replacement paths, refine the deterministic priority using only `HostOutput` data; do not bypass host commands or read `GameState`.

- [ ] **Step 4: Add pending-choice active-player ownership test**

Use a deterministic seed/pick sequence that plays X030 PIPIT or triggers a forced STA-removal choice. At the pending state:

```ts
const active = host.getOutput().view.activePlayerId;
for (const viewerId of ["P1", "P2"] as const) {
  const output = host.setViewer(viewerId);
  expect(output.view.pendingChoice).not.toBeNull();
  expect(output.view.pendingChoice!.actingPlayerId).toBe(active);
  expect(output.legalCommands.length > 0).toBe(viewerId === active);
}
```

This intentionally freezes the current engine invariant that pending choices are active-player-owned.

- [ ] **Step 5: Add deterministic replay test**

Record `(stateVersion, index)` choices from a first run while selecting with `chooseIndex`; replay the same indexes against a second host created with the same seed and input, switching to each run's public `activePlayerId` before the pick. Assert after every accepted step:

```ts
expect(JSON.parse(JSON.stringify(second.getOutput()))).toEqual(JSON.parse(JSON.stringify(first.getOutput())));
```

At termination assert identical winner/status/turn/round/score views.

- [ ] **Step 6: Add viewer-switch invariance test**

Run two same-seed hosts with the same chooser. Before every pick on the second host, insert:

```ts
second.setViewer("P1");
second.getOutput();
second.setViewer("P2");
second.getOutput();
second.setViewer(activePlayerId);
```

Do not acknowledge events in either run. Assert both runs remain equivalent after every accepted command and terminate identically.

- [ ] **Step 7: Add explicit `MATCH_RESOLVED` rejection and independent final-event acknowledgement**

After the full match resolves:

```ts
for (const viewerId of ["P1", "P2"] as const) {
  const output = host.setViewer(viewerId);
  expect(output.legalCommands).toEqual([]);
  expect(output.events.some((event) => event.type === "MATCH_ENDED")).toBe(true);
  const rejected = host.pickLegalCommand(output.stateVersion, 0);
  expect(rejected).toMatchObject({ accepted: false, code: "MATCH_RESOLVED" });
  host.acknowledgeEvents(output.eventEndIndex);
  expect(host.getOutput().events).toEqual([]);
}
```

P1 acknowledgement must not clear P2's final event before P2 acknowledges.

- [ ] **Step 8: Run host integration tests**

Run:

```bash
pnpm --filter @x/client test -- src/host/local-match-host.integration.test.ts src/host/local-match-host.test.ts
```

Expected: PASS, including a resolved 30-card real-card match.

- [ ] **Step 9: Commit**

```bash
git add apps/client/src/host/local-match-host.integration.test.ts apps/client/src/host/local-match-host.test.ts apps/client/src/host/test-helpers.ts
git commit -m "test: prove X2 local host boundary end to end"
```

If `test-helpers.ts` was not needed, omit it from `git add`.

---

### Task 6: Record the completed host boundary and run the full X2 step-1 gate

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `DECISIONS.md`
- Modify: `PROJECT_STATE.md`
- Review: `docs/superpowers/specs/2026-09-24-x2-local-match-host-design.md`

**Interfaces:**
- Consumes: the implemented host contract and passing test/tooling evidence.
- Produces: durable X2 step-1 record; next task explicitly becomes static renderer step 2 and its renderer audit checkpoint.

- [ ] **Step 1: Update architecture/decision records only with implemented facts**

Add a short X2 host subsection/decision recording:

```text
- host owns GameState privately;
- setup seed/decks/definitions are supplied externally;
- consumer command submission is stateVersion + legal-command index;
- getOutput is non-consuming; event acknowledgement is explicit and per viewer;
- host output/results are JSON-safe;
- host purity is enforced by no-DOM typecheck, dependency boundary, and determinism scan.
```

Do not document renderer implementation as complete.

- [ ] **Step 2: Update `PROJECT_STATE.md`**

Record X2 step 1 as complete only after tests are green. Set the next concrete task to:

```text
X2 step 2 — static renderer: render both players' six zones and turn/round/score/STA/Arena Collapse information from HostOutput/PlayerView only, with no animation yet; then perform the agreed renderer-boundary audit checkpoint.
```

- [ ] **Step 3: Run focused validation**

Run:

```bash
pnpm --filter @x/engine test -- proof-cards.test.ts
pnpm --filter @x/client test
pnpm --filter @x/client typecheck
pnpm boundaries
pnpm determinism
```

Expected: PASS.

- [ ] **Step 4: Run the complete frozen-install gate**

Run from a clean dependency state:

```bash
rm -rf node_modules apps/client/node_modules packages/engine/node_modules packages/cards/node_modules packages/ai/node_modules
pnpm install --frozen-lockfile
pnpm check
```

Expected: frozen install succeeds; typecheck, all tests, architecture/renderer/host boundaries, determinism, and build all pass.

- [ ] **Step 5: Verify branch diff scope**

Run:

```bash
git diff --stat main...HEAD
git status --short
```

Expected: only host/config/test/tooling/docs/lockfile files from this plan are changed; working tree is clean after commits.

- [ ] **Step 6: Commit documentation**

```bash
git add ARCHITECTURE.md DECISIONS.md PROJECT_STATE.md
git commit -m "docs: record X2 local host boundary"
```

- [ ] **Step 7: Open PR and use CI as merge gate**

Push `x2/local-match-host`, open one PR into `main`, and require the GitHub `check` job to finish `success` before merge. Do not merge on a queued/in-progress/red run.

- [ ] **Step 8: Merge and verify `main`**

After merge, verify the merge commit on `main` and the associated CI result. X2 step 2 starts only from that green merge commit.
