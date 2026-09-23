import { describe, expect, it } from "vitest";
import {
  applyCommand,
  effectCapacity,
  effectSlotLimit,
  effectiveStats,
  removeExcessEffects,
  requiredExcessEffectCount,
  type GameState,
  type StatModifier
} from "../src/index.ts";
import { setupTestMatch, withPlayer } from "./helpers/setup-test-match.ts";
import { testInput } from "./fixtures.ts";

function effectStage(sta = 3): GameState {
  const start = setupTestMatch(testInput(909));
  const vs = start.players.P1.hand[0]!;
  const definitionId = start.cardInstances[vs]!.definitionId;
  return {
    ...withPlayer(start, "P1", { hand: start.players.P1.hand.slice(1), vs, vsPosition: "ATK" }),
    turnStage: "EFFECT_ACTIONS",
    cardDefinitions: { ...start.cardDefinitions, [definitionId]: { ...start.cardDefinitions[definitionId]!, sta } },
    cardInstances: { ...start.cardInstances, [vs]: { ...start.cardInstances[vs]!, zone: "VS" } }
  };
}

function placeEffects(state: GameState, count: number): GameState {
  const ids = state.players.P1.hand.slice(0, count);
  const cardInstances = { ...state.cardInstances };
  for (const id of ids) cardInstances[id] = { ...cardInstances[id]!, zone: "EFFECT" };
  return {
    ...withPlayer(state, "P1", { hand: state.players.P1.hand.filter((id) => !ids.includes(id)), effectZone: ids }),
    cardInstances
  };
}

describe("effective stats", () => {
  it("uses printed → set → swap → add → multiply and floors at zero", () => {
    const state = effectStage(4);
    const vs = state.players.P1.vs!;
    const defId = state.cardInstances[vs]!.definitionId;
    const cardDefinitions = { ...state.cardDefinitions, [defId]: { ...state.cardDefinitions[defId]!, atk: 100, def: 300, sta: 4 } };
    const base = { sourceInstanceId: state.players.P1.hand[0]!, targetInstanceId: vs, duration: "WHILE_SOURCE_ACTIVE" as const };
    const statModifiers: StatModifier[] = [
      { ...base, id: "set", order: 1, kind: "SET", stat: "ATK", value: 50 },
      { ...base, id: "swap", order: 2, kind: "SWAP_ATK_DEF" },
      { ...base, id: "add", order: 3, kind: "ADD", stat: "ATK", value: -400 },
      { ...base, id: "mul", order: 4, kind: "MULTIPLY", stat: "DEF", factor: 2 }
    ];
    expect(effectiveStats({ ...state, cardDefinitions, statModifiers }, vs)).toEqual({ ATK: 0, DEF: 100, STA: 4 });
  });
});

describe("Effect Zone capacity", () => {
  it("VS STA N permits N-1 Effect cards, capped at five", () => {
    expect(effectCapacity(effectStage(1), "P1")).toBe(0);
    expect(effectCapacity(effectStage(3), "P1")).toBe(2);
    expect(effectCapacity(effectStage(9), "P1")).toBe(5);
  });

  it("slot locks reduce usable slots without removing existing cards", () => {
    const state = effectStage(9);
    const locked = {
      ...state,
      ruleModifiers: [{ id: "lock", sourceInstanceId: state.players.P2.hand[0]!, affectedPlayerId: "P1" as const, kind: "EFFECT_SLOT_LOCK" as const, value: 3, expiry: "SOURCE_LEAVES_EFFECT_ZONE" as const }]
    };
    expect(effectSlotLimit(locked, "P1")).toBe(2);
    expect(effectCapacity(locked, "P1")).toBe(2);
  });
});

describe("PLAY_EFFECT", () => {
  it("moves a playable Effect from hand into the Effect Zone and opens pending resolution", () => {
    const state = effectStage(3);
    const card = state.players.P1.hand[0]!;
    const result = applyCommand(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: card });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.players.P1.effectZone).toEqual([card]);
    expect(result.state.cardInstances[card]?.zone).toBe("EFFECT");
    expect(result.state.effectCardsPlayedThisTurn).toBe(1);
    expect(result.state.pendingResolution).toEqual({ kind: "CARD_EFFECT", sourceInstanceId: card, actingPlayerId: "P1", remainingChoiceIds: [] });
  });

  it("rejects when STA has no Effect capacity", () => {
    const state = effectStage(1);
    const card = state.players.P1.hand[0]!;
    expect(applyCommand(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: card })).toMatchObject({ accepted: false, code: "INSUFFICIENT_STA" });
  });

  it("rejects a card with no playable Effect", () => {
    const state = effectStage(3);
    const card = state.players.P1.hand[0]!;
    const definitionId = state.cardInstances[card]!.definitionId;
    const noEffect = { ...state, cardDefinitions: { ...state.cardDefinitions, [definitionId]: { ...state.cardDefinitions[definitionId]!, hasPlayableEffect: false } } };
    expect(applyCommand(noEffect, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: card })).toMatchObject({ accepted: false, code: "CARD_HAS_NO_EFFECT" });
  });
});

describe("voluntary Effect removal", () => {
  it("captures the removed Effect into the opponent's Zone X and frees capacity", () => {
    const seeded = placeEffects(effectStage(3), 1);
    const card = seeded.players.P1.effectZone[0]!;
    const result = applyCommand(seeded, { type: "REMOVE_OWN_EFFECT", playerId: "P1", cardInstanceId: card });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.players.P1.effectZone).toEqual([]);
    expect(result.state.players.P2.zoneX).toContain(card);
    expect(result.state.cardInstances[card]?.zone).toBe("ZONE_X");
  });

  it("is closed after the player has played an Effect this turn", () => {
    const seeded = { ...placeEffects(effectStage(4), 1), effectCardsPlayedThisTurn: 1 };
    const card = seeded.players.P1.effectZone[0]!;
    expect(applyCommand(seeded, { type: "REMOVE_OWN_EFFECT", playerId: "P1", cardInstanceId: card })).toMatchObject({ accepted: false, code: "EFFECT_REMOVAL_WINDOW_CLOSED" });
  });
});

describe("forced excess Effect removal", () => {
  it("moves exactly the chosen excess cards to Zone Tepi", () => {
    const state = placeEffects(effectStage(3), 3);
    expect(requiredExcessEffectCount(state, "P1")).toBe(1);
    const chosen = state.players.P1.effectZone[1]!;
    const next = removeExcessEffects(state, "P1", [chosen]);
    expect(next.players.P1.effectZone).not.toContain(chosen);
    expect(next.players.P1.zoneTepi).toContain(chosen);
    expect(next.cardInstances[chosen]?.zone).toBe("ZONE_TEPI");
  });

  it("removes source-bound modifiers when the source leaves, but preserves UNTIL_ROUND_END", () => {
    const state = placeEffects(effectStage(2), 2);
    const source = state.players.P1.effectZone[0]!;
    const other = state.players.P1.effectZone[1]!;
    const vs = state.players.P1.vs!;
    const modifier = (id: string, duration: "WHILE_SOURCE_ACTIVE" | "UNTIL_ROUND_END"): StatModifier => ({ id, sourceInstanceId: source, targetInstanceId: vs, order: 1, duration, kind: "ADD", stat: "ATK", value: 100 });
    const withMods = { ...state, statModifiers: [modifier("active", "WHILE_SOURCE_ACTIVE"), modifier("round", "UNTIL_ROUND_END")], activeContinuousEffectIds: [source, other] };
    const next = removeExcessEffects(withMods, "P1", [source]);
    expect(next.statModifiers.map((m) => m.id)).toEqual(["round"]);
    expect(next.activeContinuousEffectIds).toEqual([other]);
  });

  it("rejects the wrong number of chosen cards", () => {
    const state = placeEffects(effectStage(3), 3);
    expect(() => removeExcessEffects(state, "P1", [])).toThrow(/expected 1/);
  });
});
