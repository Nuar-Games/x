import { describe, expect, it } from "vitest";
import { advance, applyCommand, type GameState } from "../src/index.ts";
import { setupTestMatch, withPlayer, withState } from "./helpers/setup-test-match.ts";
import { testInput } from "./fixtures.ts";

function requiredDeployment(): GameState {
  return advance(setupTestMatch(testInput(123))).state;
}

function withSurvivingVs(position: "ATK" | "DEF" = "ATK"): GameState {
  const start = setupTestMatch(testInput(123));
  const instanceId = start.players.P1.hand[0]!;
  const state = withPlayer(start, "P1", {
    hand: start.players.P1.hand.slice(1),
    vs: instanceId,
    vsPosition: position
  });
  return advance({
    ...state,
    cardInstances: {
      ...state.cardInstances,
      [instanceId]: { ...state.cardInstances[instanceId]!, zone: "VS" }
    }
  }).state;
}

describe("DEPLOY_VS", () => {
  it("deploys a hand card in the chosen position and advances to Effect actions", () => {
    const state = requiredDeployment();
    const card = state.players.P1.hand[0]!;
    const result = applyCommand(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: card, position: "DEF" });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.players.P1.vs).toBe(card);
    expect(result.state.players.P1.vsPosition).toBe("DEF");
    expect(result.state.players.P1.hand).not.toContain(card);
    expect(result.state.cardInstances[card]?.zone).toBe("VS");
    expect(result.state.turnStage).toBe("EFFECT_ACTIONS");
    expect(result.events).toContainEqual({ type: "VS_DEPLOYED", playerId: "P1", instanceId: card, position: "DEF" });
  });

  it("rejects deployment outside REQUIRED_VS_DEPLOYMENT without changing state", () => {
    const state = withSurvivingVs();
    const card = state.players.P1.hand[0]!;
    const result = applyCommand(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: card, position: "ATK" });
    expect(result).toEqual({ accepted: false, state, code: "WRONG_STAGE" });
  });

  it("rejects a card that is not in the active player's hand", () => {
    const state = requiredDeployment();
    const card = state.players.P2.hand[0]!;
    const result = applyCommand(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: card, position: "ATK" });
    expect(result).toEqual({ accepted: false, state, code: "CARD_NOT_IN_HAND" });
  });
});

describe("start-of-turn VS choice", () => {
  it("KEEP_VS keeps position and advances to Effect actions", () => {
    const state = withSurvivingVs("DEF");
    const result = applyCommand(state, { type: "KEEP_VS", playerId: "P1" });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.players.P1.vsPosition).toBe("DEF");
    expect(result.state.turnStage).toBe("EFFECT_ACTIONS");
    expect(result.events).toContainEqual({ type: "VS_KEPT", playerId: "P1", instanceId: state.players.P1.vs! });
  });

  it("CHANGE_VS_POSITION changes ATK to DEF and consumes the VS choice", () => {
    const state = withSurvivingVs("ATK");
    const result = applyCommand(state, { type: "CHANGE_VS_POSITION", playerId: "P1", position: "DEF" });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.players.P1.vsPosition).toBe("DEF");
    expect(result.state.turnStage).toBe("EFFECT_ACTIONS");
    expect(result.events).toContainEqual({
      type: "VS_POSITION_CHANGED",
      playerId: "P1",
      instanceId: state.players.P1.vs!,
      from: "ATK",
      to: "DEF"
    });
  });

  it("rejects a position change that does not actually change position", () => {
    const state = withSurvivingVs("ATK");
    const result = applyCommand(state, { type: "CHANGE_VS_POSITION", playerId: "P1", position: "ATK" });
    expect(result).toEqual({ accepted: false, state, code: "POSITION_UNCHANGED" });
  });

  it("REPLACE_VS captures the old VS into the opponent's Zone X and deploys the chosen replacement", () => {
    const state = withSurvivingVs("ATK");
    const oldVs = state.players.P1.vs!;
    const replacement = state.players.P1.hand[0]!;
    const result = applyCommand(state, {
      type: "REPLACE_VS",
      playerId: "P1",
      cardInstanceId: replacement,
      position: "DEF"
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.players.P1.vs).toBe(replacement);
    expect(result.state.players.P1.vsPosition).toBe("DEF");
    expect(result.state.players.P1.hand).not.toContain(replacement);
    expect(result.state.players.P2.zoneX.at(-1)).toBe(oldVs);
    expect(result.state.cardInstances[oldVs]?.zone).toBe("ZONE_X");
    expect(result.state.cardInstances[replacement]?.zone).toBe("VS");
    expect(result.state.turnStage).toBe("EFFECT_ACTIONS");
  });

  it("does not permit a second normal VS action after keep/change/replacement", () => {
    const state = withSurvivingVs("ATK");
    const first = applyCommand(state, { type: "CHANGE_VS_POSITION", playerId: "P1", position: "DEF" });
    if (!first.accepted) throw new Error("expected first command to be accepted");
    const second = applyCommand(first.state, { type: "KEEP_VS", playerId: "P1" });
    expect(second).toEqual({ accepted: false, state: first.state, code: "WRONG_STAGE" });
  });
});
