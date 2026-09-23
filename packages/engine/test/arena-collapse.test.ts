import { describe, expect, it } from "vitest";
import { advance, applyCommand, type Command, type EngineEvent, type GameState } from "../src/index.ts";
import { moveCard } from "../src/zones.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

function must(state: GameState, command: Command): { state: GameState; events: readonly EngineEvent[] } {
  const result = applyCommand(state, command);
  if (!result.accepted) throw new Error(`${command.type} rejected: ${result.code}`);
  return result;
}

function openingState(seed = 1234): GameState {
  return advance(setupTestMatch(testInput(seed))).state;
}

function deployAndPass(state: GameState): { state: GameState; events: readonly EngineEvent[] } {
  const playerId = state.activePlayerId;
  let current = state;
  if (current.turnStage === "HAND_LIMIT_ENFORCEMENT") {
    const limit = current.players[playerId].turnsStarted === 1 ? 6 : 5;
    current = must(current, {
      type: "DISCARD_FOR_HAND_LIMIT",
      playerId,
      cardInstanceIds: current.players[playerId].hand.slice(0, current.players[playerId].hand.length - limit)
    }).state;
  }
  if (current.turnStage === "REQUIRED_VS_DEPLOYMENT") {
    current = must(current, {
      type: "DEPLOY_VS",
      playerId,
      cardInstanceId: current.players[playerId].hand[0]!,
      position: "ATK"
    }).state;
  } else if (current.turnStage === "START_OF_TURN_VS_ACTION") {
    current = must(current, { type: "KEEP_VS", playerId }).state;
  }
  return must(current, { type: "PASS", playerId });
}

function afterTwoInactiveTurns(): GameState {
  let state = openingState();
  state = deployAndPass(state).state;
  state = deployAndPass(state).state;
  return state;
}

describe("Arena Collapse counter (GAME_RULES.md §13)", () => {
  it("increments after an inactive turn and reaches 2 after two consecutive inactive turns", () => {
    let state = openingState();
    state = deployAndPass(state).state;
    expect(state.arenaCollapseInactiveTurns).toBe(1);
    state = deployAndPass(state).state;
    expect(state.arenaCollapseInactiveTurns).toBe(2);
  });

  it("playing an Effect resets the inactivity counter", () => {
    let state = afterTwoInactiveTurns();
    const playerId = state.activePlayerId;
    if (state.turnStage === "HAND_LIMIT_ENFORCEMENT") {
      state = must(state, {
        type: "DISCARD_FOR_HAND_LIMIT",
        playerId,
        cardInstanceIds: state.players[playerId].hand.slice(0, state.players[playerId].hand.length - 5)
      }).state;
    }
    state = must(state, { type: "KEEP_VS", playerId }).state;
    const effect = state.players[playerId].hand[0]!;
    state = must(state, { type: "PLAY_EFFECT", playerId, cardInstanceId: effect }).state;
    state = must(state, { type: "PASS", playerId }).state;
    expect(state.arenaCollapseInactiveTurns).toBe(0);
  });

  it("an attack resets the inactivity counter", () => {
    let state = afterTwoInactiveTurns();
    const playerId = state.activePlayerId;
    if (state.turnStage === "HAND_LIMIT_ENFORCEMENT") {
      state = must(state, {
        type: "DISCARD_FOR_HAND_LIMIT",
        playerId,
        cardInstanceIds: state.players[playerId].hand.slice(0, state.players[playerId].hand.length - 5)
      }).state;
    }
    state = must(state, { type: "KEEP_VS", playerId }).state;
    const result = must(state, { type: "ATTACK", playerId });
    expect(result.state.arenaCollapseInactiveTurns).toBe(0);
  });
});

describe("third inactive turn collapse", () => {
  it("moves both VS and all existing Effects to Zone Tepi, awards no Zone X points, resets the counter, and ends the round once", () => {
    let state = afterTwoInactiveTurns();
    const playerId = state.activePlayerId;
    if (state.turnStage === "HAND_LIMIT_ENFORCEMENT") {
      state = must(state, {
        type: "DISCARD_FOR_HAND_LIMIT",
        playerId,
        cardInstanceIds: state.players[playerId].hand.slice(0, state.players[playerId].hand.length - 5)
      }).state;
    }
    state = must(state, { type: "KEEP_VS", playerId }).state;

    const p1Effect = state.players.P1.hand[0]!;
    const p2Effect = state.players.P2.hand[0]!;
    state = moveCard(state, { instanceId: p1Effect, fromPlayerId: "P1", from: "HAND", toPlayerId: "P1", to: "EFFECT", reason: "PLAY_EFFECT" }, []);
    state = moveCard(state, { instanceId: p2Effect, fromPlayerId: "P2", from: "HAND", toPlayerId: "P2", to: "EFFECT", reason: "PLAY_EFFECT" }, []);

    const p1Vs = state.players.P1.vs!;
    const p2Vs = state.players.P2.vs!;
    const p1ZoneX = state.players.P1.zoneX.length;
    const p2ZoneX = state.players.P2.zoneX.length;
    const round = state.roundNumber;

    const result = must(state, { type: "PASS", playerId });
    expect(result.state.activePlayerId).toBe(playerId);
    expect(result.state.turnStage).toBe("POST_COLLAPSE_DEPLOYMENT");
    expect(result.state.arenaCollapseInactiveTurns).toBe(0);
    expect(result.state.players.P1.vs).toBeNull();
    expect(result.state.players.P2.vs).toBeNull();
    expect(result.state.players.P1.effectZone).toEqual([]);
    expect(result.state.players.P2.effectZone).toEqual([]);
    expect(result.state.players.P1.zoneTepi).toEqual(expect.arrayContaining([p1Vs, p1Effect]));
    expect(result.state.players.P2.zoneTepi).toEqual(expect.arrayContaining([p2Vs, p2Effect]));
    expect(result.state.players.P1.zoneX).toHaveLength(p1ZoneX);
    expect(result.state.players.P2.zoneX).toHaveLength(p2ZoneX);
    expect(result.state.roundNumber).toBe(round + 1);
    expect(result.events.filter((event) => event.type === "ROUND_ENDED")).toHaveLength(1);
    expect(result.events.filter((event) => event.type === "ARENA_COLLAPSED")).toHaveLength(1);
    expect(result.events.filter((event) => event.type === "CARD_MOVED" && event.reason === "ARENA_COLLAPSE")).toHaveLength(4);
  });

  it("post-collapse deployment is the only continuation and then the turn ends", () => {
    let state = afterTwoInactiveTurns();
    const playerId = state.activePlayerId;
    if (state.turnStage === "HAND_LIMIT_ENFORCEMENT") {
      state = must(state, {
        type: "DISCARD_FOR_HAND_LIMIT",
        playerId,
        cardInstanceIds: state.players[playerId].hand.slice(0, state.players[playerId].hand.length - 5)
      }).state;
    }
    state = must(state, { type: "KEEP_VS", playerId }).state;
    state = must(state, { type: "PASS", playerId }).state;
    expect(state.turnStage).toBe("POST_COLLAPSE_DEPLOYMENT");

    const replacement = state.players[playerId].hand[0]!;
    const deployed = must(state, { type: "DEPLOY_VS", playerId, cardInstanceId: replacement, position: "DEF" });
    expect(deployed.state.activePlayerId).not.toBe(playerId);
    expect(deployed.events.some((event) => event.type === "TURN_ENDED" && event.playerId === playerId)).toBe(true);
    expect(deployed.state.players[playerId].vs).toBe(replacement);
  });
});

describe("no card to deploy after collapse (GAME_RULES.md §13 step 6, D-015)", () => {
  it("skips the post-collapse deployment and ends the turn instead of waiting forever", () => {
    let state = afterTwoInactiveTurns();
    const playerId = state.activePlayerId;
    if (state.turnStage === "HAND_LIMIT_ENFORCEMENT") {
      state = must(state, {
        type: "DISCARD_FOR_HAND_LIMIT",
        playerId,
        cardInstanceIds: state.players[playerId].hand.slice(0, state.players[playerId].hand.length - 5)
      }).state;
    }
    state = must(state, { type: "KEEP_VS", playerId }).state;
    // Empty the hand (test setup) so there is nothing to deploy after the collapse.
    for (const id of [...state.players[playerId].hand]) {
      state = moveCard(state, { instanceId: id, fromPlayerId: playerId, from: "HAND", toPlayerId: playerId, to: "ZONE_TEPI", reason: "HAND_LIMIT_DISCARD" }, []);
    }

    const result = must(state, { type: "PASS", playerId });
    const types = result.events.map((event) => event.type);
    expect(types).toContain("ARENA_COLLAPSED");
    expect(types).toContain("POST_COLLAPSE_DEPLOYMENT_SKIPPED");
    expect(types.indexOf("POST_COLLAPSE_DEPLOYMENT_SKIPPED")).toBeLessThan(types.indexOf("TURN_ENDED"));
    expect(result.state.activePlayerId).not.toBe(playerId);
    expect(result.state.players[playerId].vs).toBeNull();
  });

  it("that player deploys normally on their next turn after drawing", () => {
    let state = afterTwoInactiveTurns();
    const playerId = state.activePlayerId;
    if (state.turnStage === "HAND_LIMIT_ENFORCEMENT") {
      state = must(state, {
        type: "DISCARD_FOR_HAND_LIMIT",
        playerId,
        cardInstanceIds: state.players[playerId].hand.slice(0, state.players[playerId].hand.length - 5)
      }).state;
    }
    state = must(state, { type: "KEEP_VS", playerId }).state;
    for (const id of [...state.players[playerId].hand]) {
      state = moveCard(state, { instanceId: id, fromPlayerId: playerId, from: "HAND", toPlayerId: playerId, to: "ZONE_TEPI", reason: "HAND_LIMIT_DISCARD" }, []);
    }
    state = must(state, { type: "PASS", playerId }).state;
    // Opponent (no VS after collapse) deploys and passes.
    state = deployAndPass(state).state;
    expect(state.activePlayerId).toBe(playerId);
    expect(state.players[playerId].hand).toHaveLength(1);
    expect(state.turnStage).toBe("REQUIRED_VS_DEPLOYMENT");
  });
});
