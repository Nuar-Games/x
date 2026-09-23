import { describe, expect, it } from "vitest";
import { advance, applyCommand, type Command, type EngineEvent, type GameState } from "../src/index.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

/** A simple deterministic player: always the first legal-looking choice. */
function nextCommand(state: GameState): Command {
  const playerId = state.activePlayerId;
  const player = state.players[playerId];
  const opponent = state.players[playerId === "P1" ? "P2" : "P1"];
  switch (state.turnStage) {
    case "HAND_LIMIT_ENFORCEMENT":
      return { type: "DISCARD_FOR_HAND_LIMIT", playerId, cardInstanceIds: player.hand.slice(0, player.hand.length - 5) };
    case "REQUIRED_VS_DEPLOYMENT":
      return { type: "DEPLOY_VS", playerId, cardInstanceId: player.hand[0]!, position: "ATK" };
    case "START_OF_TURN_VS_ACTION":
      return { type: "KEEP_VS", playerId };
    case "EFFECT_ACTIONS":
      return player.vsPosition === "ATK" && opponent.vs !== null ? { type: "ATTACK", playerId } : { type: "PASS", playerId };
    default:
      throw new Error(`no scripted command for ${state.turnStage}`);
  }
}

function play(seed: number, turns: number) {
  let state = advance(setupTestMatch(testInput(seed))).state;
  const log: EngineEvent[] = [];
  const zoneXSizes: number[] = [];
  while (state.turnNumber <= turns) {
    const result = applyCommand(state, nextCommand(state));
    if (!result.accepted) throw new Error(`rejected ${result.code} at turn ${state.turnNumber}`);
    state = result.state;
    log.push(...result.events);
    zoneXSizes.push(state.players.P1.zoneX.length + state.players.P2.zoneX.length);
  }
  return { state, log, zoneXSizes };
}

function assertZonesConsistent(state: GameState): void {
  let total = 0;
  for (const playerId of ["P1", "P2"] as const) {
    const p = state.players[playerId];
    const zones: [string, readonly string[]][] = [
      ["DECK", p.deck],
      ["HAND", p.hand],
      ["VS", p.vs ? [p.vs] : []],
      ["EFFECT", p.effectZone],
      ["ZONE_X", p.zoneX],
      ["ZONE_TEPI", p.zoneTepi]
    ];
    for (const [zone, ids] of zones) {
      total += ids.length;
      for (const id of ids) expect(state.cardInstances[id]?.zone).toBe(zone);
    }
  }
  expect(total).toBe(Object.keys(state.cardInstances).length);
}

describe("full turn flow through commands only", () => {
  it("plays 10 turns with draws, deployments, attacks, round ends and discards", () => {
    const { state, log } = play(2024, 10);
    expect(state.turnNumber).toBe(11);
    expect(log.some((e) => e.type === "BATTLE_RESOLVED")).toBe(true);
    expect(log.some((e) => e.type === "ROUND_ENDED")).toBe(true);
    assertZonesConsistent(state);
  });

  it("Zone X totals never go down", () => {
    const { zoneXSizes } = play(2024, 10);
    for (let i = 1; i < zoneXSizes.length; i += 1) expect(zoneXSizes[i]!).toBeGreaterThanOrEqual(zoneXSizes[i - 1]!);
  });

  it("is fully deterministic for the same seed", () => {
    expect(play(2024, 10)).toEqual(play(2024, 10));
  });

  it("stays consistent across many seeds", () => {
    for (let seed = 1; seed <= 25; seed += 1) assertZonesConsistent(play(seed, 8).state);
  });
});
