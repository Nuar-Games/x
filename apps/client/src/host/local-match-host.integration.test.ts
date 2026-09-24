import { describe, expect, it } from "vitest";
import {
  advance,
  applyCommand,
  enumerateLegalCommands,
  setupMatch,
  type GameState,
  type PlayerId
} from "@x/engine";
import { createDefaultLocalMatchInput } from "../config/default-match.ts";
import { createLocalMatchHost } from "./local-match-host.ts";
import type { HostOutput, LocalMatchHost } from "./types.ts";

const FROZEN_PENDING_CHOICE_SEED = 424242;
const MAX_COMMANDS = 1000;

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

function expectPrivacy(host: LocalMatchHost, mirror: GameState): void {
  for (const viewerId of ["P1", "P2"] as const) {
    const opponentId: PlayerId = viewerId === "P1" ? "P2" : "P1";
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
  }
}

function assertPendingChoiceRouting(host: LocalMatchHost): boolean {
  const current = host.getOutput();
  if (current.view.pendingChoice === null) return false;
  const active = current.view.activePlayerId;
  for (const viewerId of ["P1", "P2"] as const) {
    const output = host.setViewer(viewerId);
    expect(output.view.pendingChoice!.actingPlayerId).toBe(active);
    expect(output.legalCommands.length > 0).toBe(viewerId === active);
  }
  return true;
}

function playFullMatch(seed: number, matchId: string) {
  const input = createDefaultLocalMatchInput(seed, matchId);
  const host = createLocalMatchHost(input);
  let mirror = advance(setupMatch(input)).state;
  let sawPendingChoice = false;
  let commands = 0;

  while (mirror.status === "ACTIVE" && commands < MAX_COMMANDS) {
    expectPrivacy(host, mirror);
    sawPendingChoice = assertPendingChoiceRouting(host) || sawPendingChoice;

    const active = host.getOutput().view.activePlayerId;
    const output = host.setViewer(active);
    const index = chooseIndex(output);
    const mirrorLegal = enumerateLegalCommands(mirror);
    expect(mirrorLegal[index]).toEqual(output.legalCommands[index]);

    const hostResult = host.pickLegalCommand(output.stateVersion, index);
    expect(hostResult.accepted).toBe(true);

    const mirrorResult = applyCommand(mirror, mirrorLegal[index]!);
    if (!mirrorResult.accepted) throw new Error(`mirror rejected ${mirrorLegal[index]!.type}: ${mirrorResult.code}`);
    mirror = mirrorResult.state;
    commands += 1;
  }

  expect(commands).toBeLessThan(MAX_COMMANDS);
  expect(mirror.status).toBe("RESOLVED");
  expectPrivacy(host, mirror);

  for (const viewerId of ["P1", "P2"] as const) {
    const output = host.setViewer(viewerId);
    expect(output.legalCommands).toEqual([]);
    expect(output.events.some((event) => event.type === "MATCH_ENDED")).toBe(true);
    expect(host.pickLegalCommand(output.stateVersion, 0)).toMatchObject({ accepted: false, code: "MATCH_RESOLVED" });
  }

  const p1 = host.setViewer("P1");
  host.acknowledgeEvents(p1.eventEndIndex);
  expect(host.getOutput().events).toEqual([]);
  const p2 = host.setViewer("P2");
  expect(p2.events.some((event) => event.type === "MATCH_ENDED")).toBe(true);
  host.acknowledgeEvents(p2.eventEndIndex);
  expect(host.getOutput().events).toEqual([]);

  return { host, mirror, sawPendingChoice, commands };
}

function terminalPublicState(host: LocalMatchHost) {
  const p1 = host.setViewer("P1");
  const p2 = host.setViewer("P2");
  return {
    winner: p1.view.winner,
    turn: p1.view.turnNumber,
    round: p1.view.roundNumber,
    p1Score: p1.view.you.score,
    p2Score: p2.view.you.score,
    p1: JSON.parse(JSON.stringify(p1)) as HostOutput,
    p2: JSON.parse(JSON.stringify(p2)) as HostOutput
  };
}

describe("local match host integration", () => {
  it("plays a complete real-card match privately and reaches a pending choice", () => {
    const result = playFullMatch(FROZEN_PENDING_CHOICE_SEED, "full-proof");
    expect(result.sawPendingChoice).toBe(true);
    expect(result.commands).toBeGreaterThan(0);
  });

  it("replays deterministically from the same seed and legal indices", () => {
    const input = createDefaultLocalMatchInput(FROZEN_PENDING_CHOICE_SEED, "replay");
    const runA = createLocalMatchHost(input);
    const runB = createLocalMatchHost(input);

    for (let step = 0; step < MAX_COMMANDS; step += 1) {
      const active = runA.getOutput().view.activePlayerId;
      const a = runA.setViewer(active);
      const b = runB.setViewer(active);
      expect(JSON.parse(JSON.stringify(b))).toEqual(JSON.parse(JSON.stringify(a)));
      if (a.view.status === "RESOLVED") break;

      const index = chooseIndex(a);
      const aResult = runA.pickLegalCommand(a.stateVersion, index);
      const bResult = runB.pickLegalCommand(b.stateVersion, index);
      expect(aResult.accepted).toBe(true);
      expect(bResult.accepted).toBe(true);
      expect(JSON.parse(JSON.stringify(runB.getOutput()))).toEqual(JSON.parse(JSON.stringify(runA.getOutput())));
    }

    expect(runA.getOutput().view.status).toBe("RESOLVED");
    expect(terminalPublicState(runB)).toEqual(terminalPublicState(runA));
  });

  it("viewer switching does not change gameplay or terminal output", () => {
    const input = createDefaultLocalMatchInput(FROZEN_PENDING_CHOICE_SEED, "switches");
    const runA = createLocalMatchHost(input);
    const runB = createLocalMatchHost(input);

    for (let step = 0; step < MAX_COMMANDS; step += 1) {
      const active = runA.getOutput().view.activePlayerId;
      const a = runA.setViewer(active);

      runB.setViewer("P1");
      runB.getOutput();
      runB.setViewer("P2");
      runB.getOutput();
      const b = runB.setViewer(active);
      expect(JSON.parse(JSON.stringify(b))).toEqual(JSON.parse(JSON.stringify(a)));
      if (a.view.status === "RESOLVED") break;

      const index = chooseIndex(a);
      expect(runA.pickLegalCommand(a.stateVersion, index).accepted).toBe(true);
      expect(runB.pickLegalCommand(b.stateVersion, index).accepted).toBe(true);
    }

    expect(runA.getOutput().view.status).toBe("RESOLVED");
    expect(terminalPublicState(runB)).toEqual(terminalPublicState(runA));
  });
});
