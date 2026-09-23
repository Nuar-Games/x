import { describe, expect, it } from "vitest";
import type { EngineEvent, GameState, StatModifier } from "../src/index.ts";
import { resolveBattle } from "../src/battle.ts";
import { moveCard } from "../src/zones.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

function battleState(defenderPosition: "ATK" | "DEF", attackerAtk: number, defenderValue: number): GameState {
  let state = setupTestMatch(testInput(321));
  const attacker = state.players.P1.hand[0]!;
  const defender = state.players.P2.hand[0]!;
  state = moveCard(state, { instanceId: attacker, fromPlayerId: "P1", from: "HAND", toPlayerId: "P1", to: "VS", toVsPosition: "ATK", reason: "DEPLOY_VS" }, []);
  state = moveCard(state, { instanceId: defender, fromPlayerId: "P2", from: "HAND", toPlayerId: "P2", to: "VS", toVsPosition: defenderPosition, reason: "DEPLOY_VS" }, []);
  const modifiers: StatModifier[] = [
    { id: "attacker-atk", sourceInstanceId: attacker, targetInstanceId: attacker, order: 1, duration: "UNTIL_ROUND_END", kind: "SET", stat: "ATK", value: attackerAtk },
    { id: "defender-value", sourceInstanceId: defender, targetInstanceId: defender, order: 2, duration: "UNTIL_ROUND_END", kind: "SET", stat: defenderPosition === "ATK" ? "ATK" : "DEF", value: defenderValue }
  ];
  return { ...state, statModifiers: modifiers };
}

function run(state: GameState) {
  const events: EngineEvent[] = [];
  const next = resolveBattle(state, "P1", events);
  const outcome = events.find((e) => e.type === "BATTLE_RESOLVED");
  return { next, events, outcome: outcome?.type === "BATTLE_RESOLVED" ? outcome.outcome : undefined };
}

describe("battle resolver (GAME_RULES.md §10)", () => {
  it("ATK vs ATK, attacker higher: defender VS captured by attacker, round ends", () => {
    const state = battleState("ATK", 900, 700);
    const defender = state.players.P2.vs!;
    const { next, outcome, events } = run(state);
    expect(outcome).toBe("ATTACKER_WINS_ATK_VS_ATK");
    expect(next.players.P2.vs).toBeNull();
    expect(next.players.P1.zoneX).toContain(defender);
    expect(next.players.P1.vs).toBe(state.players.P1.vs);
    expect(next.roundNumber).toBe(state.roundNumber + 1);
    expect(events.filter((e) => e.type === "ROUND_ENDED")).toHaveLength(1);
  });

  it("ATK vs ATK, defender higher: attacker VS captured by defender, round ends", () => {
    const state = battleState("ATK", 500, 800);
    const attacker = state.players.P1.vs!;
    const { next, outcome } = run(state);
    expect(outcome).toBe("DEFENDER_WINS_ATK_VS_ATK");
    expect(next.players.P1.vs).toBeNull();
    expect(next.players.P2.zoneX).toContain(attacker);
    expect(next.roundNumber).toBe(state.roundNumber + 1);
  });

  it("ATK vs ATK, equal: both captured by the opponent, round ends exactly once", () => {
    const state = battleState("ATK", 700, 700);
    const attacker = state.players.P1.vs!;
    const defender = state.players.P2.vs!;
    const { next, outcome, events } = run(state);
    expect(outcome).toBe("BOTH_DESTROYED_ATK_VS_ATK");
    expect(next.players.P1.zoneX).toContain(defender);
    expect(next.players.P2.zoneX).toContain(attacker);
    expect(next.roundNumber).toBe(state.roundNumber + 1);
    expect(events.filter((e) => e.type === "ROUND_ENDED")).toHaveLength(1);
  });

  it("ATK vs DEF, ATK higher: defender's top deck card captured, round continues", () => {
    const state = battleState("DEF", 900, 500);
    const top = state.players.P2.deck[0]!;
    const { next, outcome } = run(state);
    expect(outcome).toBe("ATTACKER_PIERCES_DEF");
    expect(next.players.P1.zoneX).toEqual([top]);
    expect(next.players.P2.vs).toBe(state.players.P2.vs);
    expect(next.roundNumber).toBe(state.roundNumber);
  });

  it("ATK vs DEF, equal: both players discard their top card to Zone Tepi", () => {
    const state = battleState("DEF", 600, 600);
    const p1Top = state.players.P1.deck[0]!;
    const p2Top = state.players.P2.deck[0]!;
    const { next, outcome } = run(state);
    expect(outcome).toBe("ATK_EQUALS_DEF");
    expect(next.players.P1.zoneTepi).toEqual([p1Top]);
    expect(next.players.P2.zoneTepi).toEqual([p2Top]);
    expect(next.roundNumber).toBe(state.roundNumber);
  });

  it("ATK vs DEF, ATK lower: attacker discards their top card", () => {
    const state = battleState("DEF", 300, 600);
    const p1Top = state.players.P1.deck[0]!;
    const { next, outcome } = run(state);
    expect(outcome).toBe("ATTACKER_BLOCKED_BY_DEF");
    expect(next.players.P1.zoneTepi).toEqual([p1Top]);
    expect(next.players.P2.zoneTepi).toEqual([]);
  });

  it("reports the compared values in the event stream", () => {
    const { events } = run(battleState("DEF", 900, 500));
    expect(events[0]).toEqual({
      type: "BATTLE_RESOLVED",
      attackerId: "P1",
      defenderId: "P2",
      attackerAtk: 900,
      defenderStat: "DEF",
      defenderValue: 500,
      outcome: "ATTACKER_PIERCES_DEF"
    });
  });
});
