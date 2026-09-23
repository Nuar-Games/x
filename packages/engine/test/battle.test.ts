import { describe, expect, it } from "vitest";
import { moveCard, resolveBattle, type GameState, type StatModifier } from "../src/index.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

function battleState(defenderPosition: "ATK" | "DEF", attackerAtk: number, defenderValue: number): GameState {
  let state = setupTestMatch(testInput(321));
  const attacker = state.players.P1.hand[0]!;
  const defender = state.players.P2.hand[0]!;

  state = moveCard(state, {
    instanceId: attacker,
    fromPlayerId: "P1",
    from: "HAND",
    toPlayerId: "P1",
    to: "VS",
    toVsPosition: "ATK"
  });
  state = moveCard(state, {
    instanceId: defender,
    fromPlayerId: "P2",
    from: "HAND",
    toPlayerId: "P2",
    to: "VS",
    toVsPosition: defenderPosition
  });

  const modifiers: StatModifier[] = [
    { id: "attacker-atk", sourceInstanceId: attacker, targetInstanceId: attacker, order: 1, duration: "UNTIL_ROUND_END", kind: "SET", stat: "ATK", value: attackerAtk },
    { id: "defender-value", sourceInstanceId: defender, targetInstanceId: defender, order: 2, duration: "UNTIL_ROUND_END", kind: "SET", stat: defenderPosition === "ATK" ? "ATK" : "DEF", value: defenderValue }
  ];
  return { ...state, statModifiers: modifiers };
}

describe("battle resolver", () => {
  it("ATK vs ATK: higher attacker destroys and captures defender", () => {
    const state = battleState("ATK", 900, 700);
    const defender = state.players.P2.vs!;
    const result = resolveBattle(state, "P1");

    expect(result.outcome).toBe("ATTACKER_WINS_ATK_VS_ATK");
    expect(result.roundEnded).toBe(true);
    expect(result.state.players.P2.vs).toBeNull();
    expect(result.state.players.P1.zoneX).toContain(defender);
    expect(result.state.cardInstances[defender]?.zone).toBe("ZONE_X");
  });

  it("ATK vs ATK: lower attacker is destroyed and captured", () => {
    const state = battleState("ATK", 500, 700);
    const attacker = state.players.P1.vs!;
    const result = resolveBattle(state, "P1");

    expect(result.outcome).toBe("DEFENDER_WINS_ATK_VS_ATK");
    expect(result.roundEnded).toBe(true);
    expect(result.state.players.P1.vs).toBeNull();
    expect(result.state.players.P2.zoneX).toContain(attacker);
  });

  it("ATK vs ATK: equal values destroy and capture both VS cards", () => {
    const state = battleState("ATK", 700, 700);
    const attacker = state.players.P1.vs!;
    const defender = state.players.P2.vs!;
    const result = resolveBattle(state, "P1");

    expect(result.outcome).toBe("BOTH_DESTROYED_ATK_VS_ATK");
    expect(result.roundEnded).toBe(true);
    expect(result.state.players.P1.zoneX).toContain(defender);
    expect(result.state.players.P2.zoneX).toContain(attacker);
    expect(result.state.players.P1.vs).toBeNull();
    expect(result.state.players.P2.vs).toBeNull();
  });

  it("ATK vs DEF: higher attacker captures the defender's top deck card without ending the round", () => {
    const state = battleState("DEF", 900, 700);
    const top = state.players.P2.deck[0]!;
    const result = resolveBattle(state, "P1");

    expect(result.outcome).toBe("ATTACKER_PIERCES_DEF");
    expect(result.roundEnded).toBe(false);
    expect(result.state.players.P2.vs).not.toBeNull();
    expect(result.state.players.P1.zoneX).toContain(top);
    expect(result.state.players.P2.deck).not.toContain(top);
  });

  it("ATK vs DEF: equal values discard both players' top deck cards", () => {
    const state = battleState("DEF", 700, 700);
    const p1Top = state.players.P1.deck[0]!;
    const p2Top = state.players.P2.deck[0]!;
    const result = resolveBattle(state, "P1");

    expect(result.outcome).toBe("ATK_EQUALS_DEF");
    expect(result.roundEnded).toBe(false);
    expect(result.state.players.P1.zoneTepi).toContain(p1Top);
    expect(result.state.players.P2.zoneTepi).toContain(p2Top);
  });

  it("ATK vs DEF: lower attacker discards only its own top deck card", () => {
    const state = battleState("DEF", 500, 700);
    const p1Top = state.players.P1.deck[0]!;
    const p2Top = state.players.P2.deck[0]!;
    const result = resolveBattle(state, "P1");

    expect(result.outcome).toBe("ATTACKER_BLOCKED_BY_DEF");
    expect(result.roundEnded).toBe(false);
    expect(result.state.players.P1.zoneTepi).toContain(p1Top);
    expect(result.state.players.P2.deck).toContain(p2Top);
  });

  it("rejects a DEF-position attacker", () => {
    let state = battleState("ATK", 700, 600);
    state = { ...state, players: { ...state.players, P1: { ...state.players.P1, vsPosition: "DEF" } } };
    expect(() => resolveBattle(state, "P1")).toThrow("ATTACKER_NOT_IN_ATK_POSITION");
  });
});
