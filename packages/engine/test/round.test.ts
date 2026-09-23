import { describe, expect, it } from "vitest";
import { moveCard, resolveRoundEnd, type GameState } from "../src/index.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

function stateWithEffects(): GameState {
  let state = setupTestMatch(testInput(456));
  const p1Effect = state.players.P1.hand[0]!;
  const p2Effect = state.players.P2.hand[0]!;
  const p1Vs = state.players.P1.hand[1]!;

  state = moveCard(state, { instanceId: p1Vs, fromPlayerId: "P1", from: "HAND", toPlayerId: "P1", to: "VS", toVsPosition: "ATK" });
  state = moveCard(state, { instanceId: p1Effect, fromPlayerId: "P1", from: "HAND", toPlayerId: "P1", to: "EFFECT" });
  state = moveCard(state, { instanceId: p2Effect, fromPlayerId: "P2", from: "HAND", toPlayerId: "P2", to: "EFFECT" });

  return {
    ...state,
    statModifiers: [
      { id: "round", sourceInstanceId: p1Effect, targetInstanceId: p1Vs, order: 1, duration: "UNTIL_ROUND_END", kind: "ADD", stat: "ATK", value: 100 },
      { id: "turn", sourceInstanceId: p1Effect, targetInstanceId: p1Vs, order: 2, duration: "UNTIL_TURN_END", kind: "ADD", stat: "DEF", value: 50 }
    ],
    ruleModifiers: [
      { id: "round-rule", sourceInstanceId: p1Effect, affectedPlayerId: "P2", kind: "ARENA_COLLAPSE", value: 1, expiry: "ROUND_END" },
      { id: "turn-rule", sourceInstanceId: p1Effect, affectedPlayerId: "P2", kind: "HAND_SIZE_LIMIT", value: 1, expiry: "TURN_END" }
    ]
  };
}

describe("round end", () => {
  it("sends both players' Effect cards to Zone Tepi", () => {
    const state = stateWithEffects();
    const p1Effect = state.players.P1.effectZone[0]!;
    const p2Effect = state.players.P2.effectZone[0]!;
    const result = resolveRoundEnd(state);

    expect(result.players.P1.effectZone).toHaveLength(0);
    expect(result.players.P2.effectZone).toHaveLength(0);
    expect(result.players.P1.zoneTepi).toContain(p1Effect);
    expect(result.players.P2.zoneTepi).toContain(p2Effect);
  });

  it("keeps a surviving VS in place", () => {
    const state = stateWithEffects();
    const vs = state.players.P1.vs;
    const result = resolveRoundEnd(state);
    expect(result.players.P1.vs).toBe(vs);
    expect(result.players.P1.vsPosition).toBe("ATK");
  });

  it("expires round-bound modifiers while preserving other durations", () => {
    const state = stateWithEffects();
    const result = resolveRoundEnd(state);

    expect(result.statModifiers.map((modifier) => modifier.id)).toEqual(["turn"]);
    expect(result.ruleModifiers.map((modifier) => modifier.id)).toEqual(["turn-rule"]);
  });

  it("increments roundNumber exactly once", () => {
    const state = stateWithEffects();
    const result = resolveRoundEnd(state);
    expect(result.roundNumber).toBe(state.roundNumber + 1);
  });
});
