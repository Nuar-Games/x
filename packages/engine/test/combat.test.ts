import { describe, expect, it } from "vitest";
import { advance, applyCommand, type Command, type GameState } from "../src/index.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch, withState } from "./helpers/setup-test-match.ts";

function must(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command);
  if (!result.accepted) throw new Error(`${command.type} rejected: ${result.code}`);
  return result.state;
}

/** P1 opening turn → deploy → pass; P2 opening turn → deploy. Returns P2 at EFFECT_ACTIONS. */
function bothDeployed(p1Position: "ATK" | "DEF", p2Position: "ATK" | "DEF", seed = 777): GameState {
  let state = advance(setupTestMatch(testInput(seed))).state;
  state = must(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: state.players.P1.hand[0]!, position: p1Position });
  state = must(state, { type: "PASS", playerId: "P1" });
  state = must(state, { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: state.players.P2.hand[0]!, position: p2Position });
  return state;
}

describe("PASS", () => {
  it("ends the turn and starts the opponent's turn", () => {
    let state = advance(setupTestMatch(testInput(777))).state;
    state = must(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: state.players.P1.hand[0]!, position: "ATK" });
    const result = applyCommand(state, { type: "PASS", playerId: "P1" });
    if (!result.accepted) throw new Error(result.code);
    expect(result.state.activePlayerId).toBe("P2");
    expect(result.state.turnNumber).toBe(2);
    expect(result.state.turnStage).toBe("REQUIRED_VS_DEPLOYMENT");
    expect(result.events.map((e) => e.type)).toContain("TURN_ENDED");
  });

  it("is rejected without a VS", () => {
    const state = withState(advance(setupTestMatch(testInput(777))).state, { turnStage: "EFFECT_ACTIONS" });
    expect(applyCommand(state, { type: "PASS", playerId: "P1" })).toMatchObject({ accepted: false, code: "NO_VS" });
  });

  it("is rejected before the VS step is done", () => {
    const state = advance(setupTestMatch(testInput(777))).state;
    expect(applyCommand(state, { type: "PASS", playerId: "P1" })).toMatchObject({ accepted: false, code: "WRONG_STAGE" });
  });
});

describe("ATTACK", () => {
  it("is rejected while the opponent has no VS (Player 1 opening turn)", () => {
    let state = advance(setupTestMatch(testInput(777))).state;
    state = must(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: state.players.P1.hand[0]!, position: "ATK" });
    expect(applyCommand(state, { type: "ATTACK", playerId: "P1" })).toMatchObject({ accepted: false, code: "NO_OPPONENT_VS" });
  });

  it("is rejected from DEF position", () => {
    const state = bothDeployed("ATK", "DEF");
    expect(applyCommand(state, { type: "ATTACK", playerId: "P2" })).toMatchObject({ accepted: false, code: "VS_NOT_IN_ATK_POSITION" });
  });

  it("resolves the battle, then ends the turn", () => {
    const state = bothDeployed("DEF", "ATK");
    const result = applyCommand(state, { type: "ATTACK", playerId: "P2" });
    if (!result.accepted) throw new Error(result.code);
    const types = result.events.map((e) => e.type);
    expect(types.indexOf("ATTACK_DECLARED")).toBeLessThan(types.indexOf("BATTLE_RESOLVED"));
    expect(types.indexOf("BATTLE_RESOLVED")).toBeLessThan(types.indexOf("TURN_ENDED"));
    expect(result.state.activePlayerId).toBe("P1");
  });

  it("a destroyed VS ends the round without the handler calling round end", () => {
    const state = bothDeployed("ATK", "ATK");
    const p1Vs = state.players.P1.vs!;
    const p2Vs = state.players.P2.vs!;
    const defId = (id: string) => state.cardInstances[id]!.definitionId;
    const rigged: GameState = {
      ...state,
      cardDefinitions: {
        ...state.cardDefinitions,
        [defId(p2Vs)]: { ...state.cardDefinitions[defId(p2Vs)]!, atk: 900 },
        [defId(p1Vs)]: { ...state.cardDefinitions[defId(p1Vs)]!, atk: 100 }
      }
    };
    const result = applyCommand(rigged, { type: "ATTACK", playerId: "P2" });
    if (!result.accepted) throw new Error(result.code);
    expect(result.state.players.P2.zoneX).toContain(p1Vs);
    expect(result.state.roundNumber).toBe(state.roundNumber + 1);
    expect(result.events.filter((e) => e.type === "ROUND_ENDED")).toHaveLength(1);
    expect(result.state.activePlayerId).toBe("P1");
    expect(result.state.turnStage).toBe("HAND_LIMIT_ENFORCEMENT");
    const discarded = must(result.state, { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P1", cardInstanceIds: result.state.players.P1.hand.slice(0, 1) });
    expect(discarded.turnStage).toBe("REQUIRED_VS_DEPLOYMENT");
  });
});

describe("losing your own VS during your turn ends the turn (GAME_RULES.md §6)", () => {
  it("attacker whose VS is destroyed does not get further actions", () => {
    const state = bothDeployed("ATK", "ATK");
    const p1Vs = state.players.P1.vs!;
    const p2Vs = state.players.P2.vs!;
    const defId = (id: string) => state.cardInstances[id]!.definitionId;
    const rigged: GameState = {
      ...state,
      cardDefinitions: {
        ...state.cardDefinitions,
        [defId(p2Vs)]: { ...state.cardDefinitions[defId(p2Vs)]!, atk: 100 },
        [defId(p1Vs)]: { ...state.cardDefinitions[defId(p1Vs)]!, atk: 900 }
      }
    };
    const result = applyCommand(rigged, { type: "ATTACK", playerId: "P2" });
    if (!result.accepted) throw new Error(result.code);
    expect(result.state.players.P1.zoneX).toContain(p2Vs);
    expect(result.state.activePlayerId).toBe("P1");
  });
});

describe("turn-bound modifiers expire at turn end", () => {
  it("UNTIL_TURN_END stat modifiers and TURN_END rule modifiers are removed by PASS", () => {
    let state = advance(setupTestMatch(testInput(777))).state;
    state = must(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: state.players.P1.hand[0]!, position: "ATK" });
    const vs = state.players.P1.vs!;
    state = {
      ...state,
      statModifiers: [
        { id: "turn", sourceInstanceId: vs, targetInstanceId: vs, order: 1, duration: "UNTIL_TURN_END", kind: "ADD", stat: "ATK", value: 100 },
        { id: "round", sourceInstanceId: vs, targetInstanceId: vs, order: 2, duration: "UNTIL_ROUND_END", kind: "ADD", stat: "ATK", value: 100 }
      ],
      ruleModifiers: [
        { id: "turn-rule", sourceInstanceId: vs, affectedPlayerId: "P2", kind: "HAND_SIZE_LIMIT", value: 2, expiresOn: ["TURN_END"] },
        { id: "keep", sourceInstanceId: vs, affectedPlayerId: "P2", kind: "ATTACK_RESTRICTION", value: 1, expiresOn: ["CONSUMED", "SOURCE_LEAVES_EFFECT_ZONE"] }
      ]
    };
    const next = must(state, { type: "PASS", playerId: "P1" });
    expect(next.statModifiers.map((m) => m.id)).toEqual(["round"]);
    expect(next.ruleModifiers.map((m) => m.id)).toEqual(["keep"]);
  });
});
