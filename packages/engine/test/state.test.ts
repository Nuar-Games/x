import { describe, expect, it } from "vitest";
import { createRng, type GameState } from "../src/index.ts";

function emptyPlayer(playerId: "P1" | "P2") {
  return {
    playerId,
    deck: [],
    hand: [],
    vs: null,
    vsPosition: null,
    effectZone: [],
    zoneX: [],
    zoneTepi: [],
    turnsStarted: 0
  } as const;
}

describe("canonical GameState", () => {
  it("round-trips through JSON without hidden state", () => {
    const state: GameState = {
      rulesVersion: "0.2.0",
      cardSetVersion: "0.2.0",
      matchId: "match-1",
      rng: createRng(123),
      activePlayerId: "P1",
      turnNumber: 1,
      turnStage: "TURN_START_DRAW",
      roundNumber: 1,
      arenaCollapseInactiveTurns: 0,
      status: "ACTIVE",
      winner: null,
      players: { P1: emptyPlayer("P1"), P2: emptyPlayer("P2") },
      cardDefinitions: {},
      cardInstances: {},
      statModifiers: [],
      activeContinuousEffectIds: [],
      ruleModifiers: [],
      pendingResolution: null,
      effectCardsPlayedThisTurn: 0
    };

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
