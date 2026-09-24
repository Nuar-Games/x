# X2 Local Match Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browser-independent X2 local match host that privately owns `GameState`, exposes only per-viewer projections/legal picks/filtered events, and proves the boundary with real-card full-match tests.

**Architecture:** `apps/client/src/host/` owns engine state, `stateVersion`, one append-only `EngineEvent[]` log, and one acknowledged-event cursor per viewer. Setup data comes from `apps/client/src/config/default-match.ts`; consumers submit only `(stateVersion, legalCommandIndex)`. `getOutput()` never consumes events; acknowledgement is explicit. CI enforces no DOM/Three/render/card-data imports in `host/` and scans it for uncontrolled time/randomness.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, `@x/engine`, `@x/cards`, Vite/Three.js client package, existing dependency/boundary scripts.

**Spec:** `docs/superpowers/specs/2026-09-24-x2-local-match-host-design.md`

## Global Constraints

- X2 step 1 only. No renderer drawing, input widgets, animations, pass-device UI, backend, networking, AI, persistence, or polish.
- `host/` is the only client-side owner of authoritative `GameState`; no public state getter exists.
- Host setup receives seed, definitions, both decks, match ID, and card-set version externally; host code never creates a seed.
- Consumers never submit a `Command`; they submit `(stateVersion, index)` from current output.
- Host rejection codes are exactly `INVALID_INDEX`, `STALE_VERSION`, `NOT_ACTING_VIEWER`, `MATCH_RESOLVED`, `ENGINE_REJECTED`.
- `getOutput()` is side-effect free. P1 and P2 event acknowledgement is independent.
- `HostOutput` and `HostResult` must survive a JSON round trip.
- `host/` must compile without DOM types and may not import `three`, `render/`, or `@x/cards`.
- Determinism scanning must include `apps/client/src/host/`.
- Default X2 deck: two copies each of X001, X002, X004, X005, X006, X008, X011, X012, X013, X016, X019, X020, X021, X025, X030.
- Full acceptance: clean `pnpm install --frozen-lockfile` and `pnpm check`.

## Review Focus

- Repeated `getOutput()` before acknowledgement returns the same event range.
- Old `(stateVersion, index)` picks reject as `STALE_VERSION` before the index is interpreted.
- Pending choices remain active-player-owned; non-active viewer gets no legal commands.
- `MATCH_ENDED` remains unread independently for each viewer until acknowledged.
- Viewer switching and event acknowledgement never change gameplay state, RNG progression, or `stateVersion`.

---

### Task 1: Extend real-card coverage to all 15 currently supported cards

**Files:**
- Modify: `packages/engine/test/proof-cards.test.ts`
- Read: `packages/engine/test/helpers/real-cards.ts`
- Read: `packages/cards/data/card-effect-cases.0.2.0.json`

**Interfaces:**
- Consumes: existing real-card helpers (`take`, `playCard`, `must`, `vsOf`, `withActive`) and `effectiveStat`.
- Produces: executable tests for X011, X012, X016, X020, X025 without changing engine mechanics.

- [ ] **Step 1: Add the five card tests**

Add these cases beside the existing ten:

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
  const [state, id] = take(withActive(standoff("X002", "X013"), "P1"), "P1", "X016");
  const handBefore = state.players.P1.hand.length;
  const deckBefore = state.players.P1.deck.length;
  const result = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: id });
  expect(result.state.players.P1.hand).toHaveLength(handBefore - 1 + 3);
  expect(result.state.players.P1.deck).toHaveLength(deckBefore - 3);
});

card("X020", "TINFORGE — own VS ATK +600", () => {
  const state = playCard(standoff("X002", "X013"), "P1", "X020").state;
  expect(effectiveStat(state, vsOf(state, "P1"), "ATK")).toBe(1200);
});

card("X025", "KELAJUAN TANPA NAMA — draw 5", () => {
  const [state, id] = take(withActive(standoff("X002", "X013"), "P1"), "P1", "X025");
  const deckBefore = state.players.P1.deck.length;
  const result = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: id });
  expect(result.state.players.P1.deck).toHaveLength(deckBefore - 5);
});
```

- [ ] **Step 2: Preserve proof-set identity and add supported-card coverage**

Keep the existing 10-card `PROOF_IDS` assertion. Add:

```ts
const SUPPORTED_REAL_IDS = [
  "X001", "X002", "X004", "X005", "X006", "X008", "X011", "X012",
  "X013", "X016", "X019", "X020", "X021", "X025", "X030"
] as const;

it("every currently supported real card has an executable card test", () => {
  expect([...tested].sort()).toEqual([...SUPPORTED_REAL_IDS].sort());
});
```

Do not alter `engine-proof.json`.

- [ ] **Step 3: Run the focused engine test**

```bash
pnpm --filter @x/engine test -- proof-cards.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/test/proof-cards.test.ts
git commit -m "test: cover all supported real cards"
```

---

### Task 2: Add deterministic local-match config and enforce host purity

**Files:**
- Create: `apps/client/src/config/default-match.ts`
- Create: `apps/client/src/config/default-match.test.ts`
- Create: `apps/client/tsconfig.host.json`
- Modify: `apps/client/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/check-determinism.mjs`
- Modify: `scripts/check-renderer-boundary.mjs`

**Interfaces:**
- Consumes: `fullSet` from `@x/cards`, `MatchSetupInput`/`setupMatch` from `@x/engine`.
- Produces: `SUPPORTED_LOCAL_CARD_IDS`, `DEFAULT_LOCAL_DECK`, `createDefaultLocalMatchInput(seed, matchId)` outside `host/`.

- [ ] **Step 1: Write the failing config tests**

Create `apps/client/src/config/default-match.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { setupMatch } from "@x/engine";
import { DEFAULT_LOCAL_DECK, SUPPORTED_LOCAL_CARD_IDS, createDefaultLocalMatchInput } from "./default-match.ts";

describe("default local match config", () => {
  it("contains two copies of all 15 supported real cards", () => {
    expect(SUPPORTED_LOCAL_CARD_IDS).toHaveLength(15);
    expect(DEFAULT_LOCAL_DECK).toHaveLength(30);
    for (const id of SUPPORTED_LOCAL_CARD_IDS) {
      expect(DEFAULT_LOCAL_DECK.filter((candidate) => candidate === id)).toHaveLength(2);
    }
  });

  it("passes production setup with an externally supplied seed", () => {
    expect(() => setupMatch(createDefaultLocalMatchInput(4242, "x2-config"))).not.toThrow();
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @x/client test -- src/config/default-match.test.ts
```

Expected: FAIL because `default-match.ts` does not exist.

- [ ] **Step 3: Implement deterministic config outside host**

Add `@x/cards: "workspace:*"` to client dependencies and create:

```ts
import { fullSet } from "@x/cards";
import type { MatchSetupInput } from "@x/engine";

export const SUPPORTED_LOCAL_CARD_IDS = [
  "X001", "X002", "X004", "X005", "X006", "X008", "X011", "X012",
  "X013", "X016", "X019", "X020", "X021", "X025", "X030"
] as const;

export const DEFAULT_LOCAL_DECK: readonly string[] = SUPPORTED_LOCAL_CARD_IDS.flatMap((id) => [id, id]);

const supportedDefinitions = fullSet.cards.filter((card) =>
  SUPPORTED_LOCAL_CARD_IDS.includes(card.id as (typeof SUPPORTED_LOCAL_CARD_IDS)[number])
);

export function createDefaultLocalMatchInput(seed: number, matchId: string): MatchSetupInput {
  return {
    matchId,
    seed,
    cardSetVersion: fullSet.cardSetVersion,
    cardDefinitions: supportedDefinitions,
    player1Deck: DEFAULT_LOCAL_DECK,
    player2Deck: DEFAULT_LOCAL_DECK
  };
}
```

Run `pnpm install --lockfile-only` so frozen installation remains valid.

- [ ] **Step 4: Add no-DOM host typecheck**

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

Change client script to:

```json
"typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.host.json"
```

- [ ] **Step 5: Extend determinism scan**

Change:

```js
const ROOTS = ["packages/engine/src", "packages/ai/src", "apps/client/src/host"];
```

Guard nonexistent roots with `existsSync(root)` until Task 3 creates `host/`.

- [ ] **Step 6: Extend boundary script**

Add host rules to `scripts/check-renderer-boundary.mjs`:

```js
const HOST_ROOT = "apps/client/src/host";
const HOST_RULES = [
  { pattern: /from\s+["']three["']/, why: "host must not import Three.js" },
  { pattern: /from\s+["'][^"']*\/render\//, why: "host must not import renderer code" },
  { pattern: /from\s+["']@x\/cards["']/, why: "card/config data stays outside host" }
];
```

Add a renderer rule rejecting imports from `/host/`. Preserve the existing renderer bans on `GameState`, runtime engine imports, and old-state diff naming.

- [ ] **Step 7: Prove the tooling rejects violations**

Create an uncommitted probe `apps/client/src/host/__boundary-probe.ts`:

```ts
import "three";
document.body;
Math.random();
```

Run:

```bash
pnpm --filter @x/client typecheck
pnpm boundaries
pnpm determinism
```

Expected: each relevant check fails. Delete the probe and rerun after Task 3 creates the host; expected PASS. Never commit the probe.

- [ ] **Step 8: Run config test**

```bash
pnpm --filter @x/client test -- src/config/default-match.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/client/package.json apps/client/tsconfig.host.json apps/client/src/config/default-match.ts apps/client/src/config/default-match.test.ts scripts/check-determinism.mjs scripts/check-renderer-boundary.mjs pnpm-lock.yaml
git commit -m "build: enforce X2 host purity"
```

---

### Task 3: Implement the complete local-match host contract

**Files:**
- Create: `apps/client/src/host/types.ts`
- Create: `apps/client/src/host/local-match-host.ts`
- Create: `apps/client/src/host/local-match-host.test.ts`

**Interfaces:**
- Consumes: `setupMatch`, `advance`, `applyCommand`, `enumerateLegalCommands`, `viewFor`, `eventsFor`.
- Produces:
  - `createLocalMatchHost(input: MatchSetupInput, initialViewer?: PlayerId): LocalMatchHost`
  - `getOutput(): HostOutput`
  - `setViewer(viewerId): HostOutput`
  - `pickLegalCommand(stateVersion, index): HostResult`
  - `acknowledgeEvents(upToIndex): HostOutput`

- [ ] **Step 1: Write unit tests for the public contract**

Create tests covering these exact behaviors:

```ts
it("does not consume events when output is read twice", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(7, "reads"));
  const first = host.getOutput();
  const second = host.getOutput();
  expect(second.events).toEqual(first.events);
  expect(second.eventStartIndex).toBe(first.eventStartIndex);
  expect(second.eventEndIndex).toBe(first.eventEndIndex);
});

it("opening advance events are visible to both viewers", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(8, "opening"));
  expect(host.getOutput().events.some((e) => e.type === "CARD_DRAWN")).toBe(true);
  expect(host.setViewer("P2").events.some((e) => e.type === "CARD_DRAWN")).toBe(true);
});

it("acknowledges independently per viewer", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(9, "acks"));
  const p1 = host.getOutput();
  host.acknowledgeEvents(p1.eventEndIndex);
  expect(host.getOutput().events).toEqual([]);
  expect(host.setViewer("P2").events.length).toBeGreaterThan(0);
});

it("rejects a stale pick before reinterpreting its index", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(10, "stale"));
  const old = host.getOutput();
  expect(host.pickLegalCommand(old.stateVersion, 0).accepted).toBe(true);
  expect(host.pickLegalCommand(old.stateVersion, 0)).toMatchObject({ accepted: false, code: "STALE_VERSION" });
});

it("rejects non-acting viewer and invalid index exactly", () => {
  const host = createLocalMatchHost(createDefaultLocalMatchInput(11, "reject"));
  const p1 = host.getOutput();
  host.setViewer("P2");
  expect(host.pickLegalCommand(p1.stateVersion, 0)).toMatchObject({ accepted: false, code: "NOT_ACTING_VIEWER" });
  host.setViewer("P1");
  expect(host.pickLegalCommand(p1.stateVersion, -1)).toMatchObject({ accepted: false, code: "INVALID_INDEX" });
});
```

Also test that reads, switches, acknowledgements, and rejections do not increment `stateVersion`, while one accepted pick increments it exactly once.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @x/client test -- src/host/local-match-host.test.ts
```

Expected: FAIL because host modules do not exist.

- [ ] **Step 3: Define JSON-safe public types**

`apps/client/src/host/types.ts`:

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
  /** Event-log slice is [eventStartIndex, eventEndIndex). */
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

No `GameState` appears in public types.

- [ ] **Step 4: Implement the full host**

`apps/client/src/host/local-match-host.ts`:

```ts
import {
  advance,
  applyCommand,
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
    const eventStartIndex = acknowledged[viewerId];
    const eventEndIndex = eventLog.length;
    return {
      viewerId,
      stateVersion,
      view: viewFor(state, viewerId),
      legalCommands: state.status === "ACTIVE" && viewerId === state.activePlayerId ? enumerateLegalCommands(state) : [],
      events: eventsFor(eventLog.slice(eventStartIndex, eventEndIndex), viewerId),
      eventStartIndex,
      eventEndIndex
    };
  }

  function reject(code: "INVALID_INDEX" | "STALE_VERSION" | "NOT_ACTING_VIEWER" | "MATCH_RESOLVED" | "ENGINE_REJECTED"): HostResult {
    return { accepted: false, code, output: output() };
  }

  return {
    getOutput: output,
    setViewer(nextViewerId) {
      viewerId = nextViewerId;
      return output();
    },
    acknowledgeEvents(upToIndex) {
      const current = acknowledged[viewerId];
      if (Number.isInteger(upToIndex) && upToIndex >= current && upToIndex <= eventLog.length) acknowledged[viewerId] = upToIndex;
      return output();
    },
    pickLegalCommand(candidateVersion, index) {
      if (state.status !== "ACTIVE") return reject("MATCH_RESOLVED");
      if (viewerId !== state.activePlayerId) return reject("NOT_ACTING_VIEWER");
      if (candidateVersion !== stateVersion) return reject("STALE_VERSION");
      const legal = enumerateLegalCommands(state);
      if (!Number.isInteger(index) || index < 0 || index >= legal.length) return reject("INVALID_INDEX");
      const result = applyCommand(state, legal[index]!);
      if (!result.accepted) return reject("ENGINE_REJECTED");
      state = result.state;
      eventLog.push(...result.events);
      stateVersion += 1;
      return { accepted: true, output: output() };
    }
  };
}
```

Do not auto-switch viewers after commands.

- [ ] **Step 5: Add plain-data assertions**

Round-trip `HostOutput`, one accepted `HostResult`, and each rejection variant:

```ts
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
expect(roundTrip(value)).toEqual(value);
```

- [ ] **Step 6: Run unit tests and purity tooling**

```bash
pnpm --filter @x/client test -- src/host/local-match-host.test.ts
pnpm --filter @x/client typecheck
pnpm boundaries
pnpm determinism
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/host/types.ts apps/client/src/host/local-match-host.ts apps/client/src/host/local-match-host.test.ts
git commit -m "feat: add X2 local match host"
```

---

### Task 4: Prove full real-card host play, privacy, pending-choice routing, and determinism

**Files:**
- Create: `apps/client/src/host/local-match-host.integration.test.ts`

**Interfaces:**
- Consumes: `createLocalMatchHost`, `createDefaultLocalMatchInput`, plus a test-only mirrored engine state for privacy/oracle comparison.
- Produces: complete 30-card real-card match proof through host picks only.

- [ ] **Step 1: Add deterministic legal-index selection**

```ts
function chooseIndex(output: HostOutput): number {
  const priority = [
    "RESOLVE_EFFECT_CHOICE",
    "DISCARD_FOR_HAND_LIMIT",
    "DEPLOY_VS",
    "KEEP_VS",
    "PLAY_EFFECT",
    "ATTACK",
    "PASS"
  ];
  for (const type of priority) {
    const index = output.legalCommands.findIndex((command) => command.type === type);
    if (index >= 0) return index;
  }
  if (output.legalCommands.length === 0) throw new Error(`no legal command at ${output.view.turnStage}`);
  return 0;
}
```

The test submits only the resulting index and current `stateVersion`.

- [ ] **Step 2: Build an exact privacy oracle with a mirrored engine state**

Create the same setup twice:

```ts
const input = createDefaultLocalMatchInput(seed, matchId);
const host = createLocalMatchHost(input);
let mirror = advance(setupMatch(input)).state;
```

After a host pick at index `i`, apply the same engine-authorized index to the mirror:

```ts
const mirrorLegal = enumerateLegalCommands(mirror);
const mirrorResult = applyCommand(mirror, mirrorLegal[i]!);
if (!mirrorResult.accepted) throw new Error(`mirror rejected ${mirrorLegal[i]!.type}`);
mirror = mirrorResult.state;
```

For each viewer after every accepted command, compute hidden IDs from the post-command mirror:

```ts
const opponentId = viewerId === "P1" ? "P2" : "P1";
const hiddenIds = new Set([
  ...mirror.players[opponentId].hand,
  ...mirror.players.P1.deck,
  ...mirror.players.P2.deck
]);
const output = host.setViewer(viewerId);
const serialized = JSON.stringify(output);
for (const id of hiddenIds) expect(serialized).not.toContain(id);
for (const event of output.events) {
  if (event.type === "CARD_DRAWN" && event.playerId !== viewerId) expect(event.instanceId).toBeNull();
}
```

This permits IDs of cards that have become public because those IDs are no longer in the mirror's hidden zones.

- [ ] **Step 3: Play a full production-valid 30-card match**

Use a fixed seed and a 1000-command safety cap. On every iteration:

1. run the privacy oracle for P1 and P2;
2. switch host to `host.getOutput().view.activePlayerId`;
3. choose an exposed index;
4. submit `pickLegalCommand(output.stateVersion, index)`;
5. apply the same index to the mirrored engine state;
6. assert accepted.

At resolution, for both viewers assert:

```ts
expect(output.legalCommands).toEqual([]);
expect(output.events.some((event) => event.type === "MATCH_ENDED")).toBe(true);
expect(host.pickLegalCommand(output.stateVersion, 0)).toMatchObject({ accepted: false, code: "MATCH_RESOLVED" });
```

Acknowledge P1 through its final event range and prove P2 still has `MATCH_ENDED` until P2 separately acknowledges.

- [ ] **Step 4: Assert pending-choice ownership during the real match**

Whenever `pendingChoice !== null`:

```ts
const active = host.getOutput().view.activePlayerId;
for (const viewerId of ["P1", "P2"] as const) {
  const output = host.setViewer(viewerId);
  expect(output.view.pendingChoice!.actingPlayerId).toBe(active);
  expect(output.legalCommands.length > 0).toBe(viewerId === active);
}
```

Freeze a seed for which the deterministic picker reaches at least one pending choice; assert a boolean `sawPendingChoice` is true at match end.

- [ ] **Step 5: Add deterministic replay**

Run two hosts from the same fixed seed. At each step choose the index from run A and submit the same `(stateVersion, index)` to run B after switching both to their public active player. After every accepted command:

```ts
expect(JSON.parse(JSON.stringify(runB.getOutput()))).toEqual(JSON.parse(JSON.stringify(runA.getOutput())));
```

At resolution compare winner, turn, round, both scores, and final outputs.

- [ ] **Step 6: Add viewer-switch invariance**

Run two more same-seed hosts with identical picks. Before each command on run B insert P1→read→P2→read→active-player switches without acknowledging. Return both to the same active viewer and assert equivalent output and identical terminal result.

- [ ] **Step 7: Run integration tests**

```bash
pnpm --filter @x/client test -- src/host/local-match-host.integration.test.ts src/host/local-match-host.test.ts
```

Expected: PASS with a resolved real-card match, privacy checks after every step, at least one pending choice, deterministic replay, and switch invariance.

- [ ] **Step 8: Commit**

```bash
git add apps/client/src/host/local-match-host.integration.test.ts
git commit -m "test: prove local host with real matches"
```

---

### Task 5: Record X2 step 1 and run the merge gate

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `DECISIONS.md`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- Consumes: passing implementation/tests/tooling from Tasks 1–4.
- Produces: durable X2 step-1 record; next task is static renderer step 2 and the agreed renderer audit checkpoint.

- [ ] **Step 1: Record implemented host facts only**

Document:

```text
- host owns GameState privately;
- setup data/seed are externally supplied;
- consumer actions are stateVersion + legal-command index;
- getOutput is non-consuming;
- event acknowledgement is explicit and per viewer;
- HostOutput/HostResult are JSON-safe;
- host purity is enforced by no-DOM typecheck, dependency boundaries, and determinism scan.
```

Do not claim renderer/input/animation/pass-device work is implemented.

- [ ] **Step 2: Advance `PROJECT_STATE.md` to X2 step 2**

Set next concrete task to:

```text
X2 step 2 — static renderer: render both players' six zones plus turn, round, score, STA and Arena Collapse information from HostOutput/PlayerView only, with no animation yet; then run the agreed renderer-boundary audit checkpoint.
```

- [ ] **Step 3: Run focused checks**

```bash
pnpm --filter @x/engine test -- proof-cards.test.ts
pnpm --filter @x/client test
pnpm --filter @x/client typecheck
pnpm boundaries
pnpm determinism
```

Expected: PASS.

- [ ] **Step 4: Run frozen-install gate**

```bash
pnpm install --frozen-lockfile
pnpm check
```

Expected: frozen install, typecheck, all tests, boundaries, determinism, and build all pass.

- [ ] **Step 5: Verify scope and commit docs**

```bash
git diff --stat main...HEAD
git status --short
git add ARCHITECTURE.md DECISIONS.md PROJECT_STATE.md
git commit -m "docs: record X2 local host boundary"
```

Expected diff: only host/config/tests/tooling/docs/lockfile files named in this plan.

- [ ] **Step 6: Open one PR into `main` and wait for GitHub CI**

Require the GitHub `check` job to finish `success`. Do not merge queued, in-progress, cancelled, or red CI.

- [ ] **Step 7: Merge and verify `main`**

After merge, verify the merge commit is on `main` and its CI is green. Start X2 step 2 only from that merge commit.
