import { describe, expect, it } from "vitest";
import { advance, applyCommand, enumerateLegalCommands, type Command, type GameState } from "../src/index.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch, withPlayer, withState } from "./helpers/setup-test-match.ts";

function commandKey(command: Command): string {
  return JSON.stringify(command);
}

function expectAllAccepted(state: GameState): void {
  for (const command of enumerateLegalCommands(state)) {
    const result = applyCommand(state, command);
    expect(result.accepted, commandKey(command)).toBe(true);
  }
}

describe("legal command enumeration (ARCHITECTURE.md §18 step 15)", () => {
  it("returns no commands for a resolved match", () => {
    const state = withState(setupTestMatch(testInput(1501)), { status: "RESOLVED", winner: "P1" });
    expect(enumerateLegalCommands(state)).toEqual([]);
  });

  it("enumerates both positions for every required VS deployment", () => {
    const state = advance(setupTestMatch(testInput(1502))).state;
    expect(state.turnStage).toBe("REQUIRED_VS_DEPLOYMENT");
    const commands = enumerateLegalCommands(state);
    expect(commands).toHaveLength(state.players.P1.hand.length * 2);
    for (const cardInstanceId of state.players.P1.hand) {
      expect(commands).toContainEqual({ type: "DEPLOY_VS", playerId: "P1", cardInstanceId, position: "ATK" });
      expect(commands).toContainEqual({ type: "DEPLOY_VS", playerId: "P1", cardInstanceId, position: "DEF" });
    }
    expectAllAccepted(state);
  });

  it("enumerates keep, one position change, and every replacement variant", () => {
    let state = advance(setupTestMatch(testInput(1503))).state;
    const deployed = state.players.P1.hand[0]!;
    const result = applyCommand(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: deployed, position: "ATK" });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    state = withState(result.state, { turnStage: "START_OF_TURN_VS_ACTION", activePlayerId: "P1" });
    const commands = enumerateLegalCommands(state);
    expect(commands).toContainEqual({ type: "KEEP_VS", playerId: "P1" });
    expect(commands).toContainEqual({ type: "CHANGE_VS_POSITION", playerId: "P1", position: "DEF" });
    expect(commands).not.toContainEqual({ type: "CHANGE_VS_POSITION", playerId: "P1", position: "ATK" });
    const replacements = commands.filter((command) => command.type === "REPLACE_VS");
    expect(replacements).toHaveLength(state.players.P1.hand.length * 2);
    expectAllAccepted(state);
  });

  it("enumerates Effect actions plus attack/pass, but filters commands the engine would reject", () => {
    let state = advance(setupTestMatch(testInput(1504))).state;
    const deployed = state.players.P1.hand[0]!;
    const deployedResult = applyCommand(state, { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: deployed, position: "ATK" });
    expect(deployedResult.accepted).toBe(true);
    if (!deployedResult.accepted) return;
    state = deployedResult.state;
    const p2Vs = state.players.P2.hand[0]!;
    state = withState(state, {
      players: {
        ...state.players,
        P2: { ...state.players.P2, hand: state.players.P2.hand.filter((id) => id !== p2Vs), vs: p2Vs, vsPosition: "ATK" }
      },
      cardInstances: { ...state.cardInstances, [p2Vs]: { ...state.cardInstances[p2Vs]!, zone: "VS" } }
    });

    const commands = enumerateLegalCommands(state);
    expect(commands).toContainEqual({ type: "ATTACK", playerId: "P1" });
    expect(commands).toContainEqual({ type: "PASS", playerId: "P1" });
    expect(commands.some((command) => command.type === "PLAY_EFFECT")).toBe(true);
    expectAllAccepted(state);
  });

  it("when an Effect choice is pending, enumerates only exact choice combinations", () => {
    let state = advance(setupTestMatch(testInput(1505))).state;
    const sourceInstanceId = state.players.P1.hand[0]!;
    state = withState(state, {
      turnStage: "EFFECT_ACTIONS",
      pendingResolution: {
        kind: "EFFECT_CHOICE",
        sourceInstanceId,
        actingPlayerId: "P1",
        choiceKind: "DISCARD_OWN_HAND",
        choiceCount: 2,
        affectedPlayerId: "P1",
        remainingSteps: []
      }
    });
    const commands = enumerateLegalCommands(state);
    expect(commands.every((command) => command.type === "RESOLVE_EFFECT_CHOICE")).toBe(true);
    expect(commands).toHaveLength((state.players.P1.hand.length * (state.players.P1.hand.length - 1)) / 2);
    expectAllAccepted(state);
  });

  it("enumerates every exact hand-limit discard combination", () => {
    let state = advance(setupTestMatch(testInput(1506))).state;
    const extra = state.players.P1.deck.slice(0, 2);
    const cardInstances = { ...state.cardInstances };
    for (const id of extra) cardInstances[id] = { ...cardInstances[id]!, zone: "HAND" };
    state = withState(state, {
      turnStage: "HAND_LIMIT_ENFORCEMENT",
      players: {
        ...state.players,
        P1: {
          ...state.players.P1,
          hand: [...state.players.P1.hand, ...extra],
          deck: state.players.P1.deck.slice(2),
          turnsStarted: 2
        }
      },
      cardInstances
    });
    const commands = enumerateLegalCommands(state);
    const discardCount = state.players.P1.hand.length - 5;
    expect(discardCount).toBeGreaterThan(0);
    expect(commands.every((command) => command.type === "DISCARD_FOR_HAND_LIMIT" && command.cardInstanceIds.length === discardCount)).toBe(true);
    expectAllAccepted(state);
  });

  it("is deterministic and does not mutate the input state", () => {
    const state = advance(setupTestMatch(testInput(1507))).state;
    const before = JSON.stringify(state);
    const first = enumerateLegalCommands(state);
    const second = enumerateLegalCommands(state);
    expect(second).toEqual(first);
    expect(JSON.stringify(state)).toBe(before);
  });
});
