import { describe, expect, it } from "vitest";
import { applyCommand, effectiveStat, type EffectSpec, type GameState } from "../src/index.ts";
import { moveCard } from "../src/zones.ts";
import { setupTestMatch, withPlayer } from "./helpers/setup-test-match.ts";
import { testInput } from "./fixtures.ts";

function effectStage(): GameState {
  const start = setupTestMatch(testInput(1313));
  const p1Vs = start.players.P1.hand[0]!;
  const p2Vs = start.players.P2.hand[0]!;
  const p1Def = start.cardInstances[p1Vs]!.definitionId;
  let next: GameState = {
    ...start,
    activePlayerId: "P1",
    turnStage: "EFFECT_ACTIONS",
    players: {
      P1: { ...start.players.P1, hand: start.players.P1.hand.slice(1), vs: p1Vs, vsPosition: "ATK" },
      P2: { ...start.players.P2, hand: start.players.P2.hand.slice(1), vs: p2Vs, vsPosition: "ATK" }
    },
    cardDefinitions: {
      ...start.cardDefinitions,
      [p1Def]: { ...start.cardDefinitions[p1Def]!, sta: 6 }
    },
    cardInstances: {
      ...start.cardInstances,
      [p1Vs]: { ...start.cardInstances[p1Vs]!, zone: "VS" },
      [p2Vs]: { ...start.cardInstances[p2Vs]!, zone: "VS" }
    }
  };
  return next;
}

function effectCard(state: GameState): string {
  const occupiedDefinitions = new Set([
    state.cardInstances[state.players.P1.vs!]!.definitionId,
    state.cardInstances[state.players.P2.vs!]!.definitionId
  ]);
  return state.players.P1.hand.find((id) => !occupiedDefinitions.has(state.cardInstances[id]!.definitionId)) ?? state.players.P1.hand[0]!;
}

function withEffect(state: GameState, spec: EffectSpec): { state: GameState; card: string } {
  const card = effectCard(state);
  const definitionId = state.cardInstances[card]!.definitionId;
  return {
    card,
    state: {
      ...state,
      cardDefinitions: {
        ...state.cardDefinitions,
        [definitionId]: { ...state.cardDefinitions[definitionId]!, hasPlayableEffect: true, effect: spec }
      }
    }
  };
}

function play(state: GameState, spec: EffectSpec) {
  const prepared = withEffect(state, spec);
  const result = applyCommand(prepared.state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: prepared.card });
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(result.code);
  return { ...result, source: prepared.card };
}

describe("effect resolver primitives", () => {
  it("DRAW moves cards from own deck to hand in order", () => {
    const state = effectStage();
    const top = state.players.P1.deck[0]!;
    const result = play(state, { family: "DRAW", count: 1, from: "OWN_DECK" });
    expect(result.state.players.P1.hand).toContain(top);
    expect(result.state.players.P1.deck).not.toContain(top);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "CARD_MOVED", instanceId: top, reason: "EFFECT_DRAW" }));
  });

  it("SET_STAT and MODIFY_STAT create source-bound stat changes in written order", () => {
    const state = effectStage();
    const target = state.players.P2.vs!;
    const result = play(state, {
      family: "SEQUENCE",
      steps: [
        { family: "SET_STAT", target: "OPPONENT_VS", stat: "ATK", value: 0 },
        { family: "MODIFY_STAT", target: "OPPONENT_VS", stat: "ATK", delta: 1000 }
      ]
    });
    expect(effectiveStat(result.state, target, "ATK")).toBe(1000);
    expect(result.state.statModifiers).toHaveLength(2);
    expect(result.state.statModifiers.every((modifier) => modifier.sourceInstanceId === result.source)).toBe(true);
  });

  it("STA reaching 0 destroys the VS immediately, captures it, and ends the round once", () => {
    const state = effectStage();
    const target = state.players.P2.vs!;
    const beforeRound = state.roundNumber;
    const result = play(state, { family: "SET_STAT", target: "OPPONENT_VS", stat: "STA", value: 0 });
    expect(result.state.players.P2.vs).toBeNull();
    expect(result.state.players.P1.zoneX).toContain(target);
    expect(result.state.roundNumber).toBe(beforeRound + 1);
    expect(result.events.filter((event) => event.type === "ROUND_ENDED")).toHaveLength(1);
  });

  it("DESTROY_ALL opponent Effect cards captures each into the acting player's Zone X", () => {
    let state = effectStage();
    const opponentEffect = state.players.P2.hand[0]!;
    state = moveCard(state, {
      instanceId: opponentEffect,
      fromPlayerId: "P2",
      from: "HAND",
      toPlayerId: "P2",
      to: "EFFECT",
      reason: "PLAY_EFFECT"
    }, []);
    const result = play(state, { family: "DESTROY_ALL", target: "OPPONENT_EFFECT_ZONE" });
    expect(result.state.players.P2.effectZone).not.toContain(opponentEffect);
    expect(result.state.players.P1.zoneX).toContain(opponentEffect);
  });

  it("SET_POSITION forces the opponent VS to DEF", () => {
    const result = play(effectStage(), { family: "SET_POSITION", target: "OPPONENT_VS", position: "DEF" });
    expect(result.state.players.P2.vsPosition).toBe("DEF");
  });

  it("BLOCK_ATTACKS prevents and consumes the opponent's next legal attack attempt", () => {
    const blocked = play(effectStage(), { family: "BLOCK_ATTACKS", target: "OPPONENT", count: 1 });
    const opponentTurn: GameState = {
      ...blocked.state,
      activePlayerId: "P2",
      turnStage: "EFFECT_ACTIONS",
      players: {
        ...blocked.state.players,
        P2: { ...blocked.state.players.P2, vsPosition: "ATK" }
      }
    };
    const attack = applyCommand(opponentTurn, { type: "ATTACK", playerId: "P2" });
    expect(attack.accepted).toBe(true);
    if (!attack.accepted) return;
    expect(attack.events).toContainEqual(expect.objectContaining({ type: "ATTACK_PREVENTED", playerId: "P2" }));
    expect(attack.state.ruleModifiers.some((modifier) => modifier.kind === "ATTACK_RESTRICTION" && modifier.affectedPlayerId === "P2")).toBe(false);
  });

  it("DISCARD_CHOSEN pauses for a serialized player choice, then resumes and clears pending resolution", () => {
    const result = play(effectStage(), {
      family: "SEQUENCE",
      steps: [
        { family: "DRAW", count: 2, from: "OWN_DECK" },
        { family: "DISCARD_CHOSEN", count: 1, from: "OWN_HAND", to: "OWN_ZONE_TEPI" }
      ]
    });
    expect(result.state.pendingResolution).not.toBeNull();
    const chosen = result.state.players.P1.hand[0]!;
    const resolved = applyCommand(result.state, { type: "RESOLVE_EFFECT_CHOICE", playerId: "P1", cardInstanceIds: [chosen] });
    expect(resolved.accepted).toBe(true);
    if (!resolved.accepted) return;
    expect(resolved.state.pendingResolution).toBeNull();
    expect(resolved.state.players.P1.zoneTepi).toContain(chosen);
    expect(resolved.events).toContainEqual(expect.objectContaining({ type: "CARD_MOVED", instanceId: chosen, reason: "EFFECT_DISCARD" }));
  });

  it("rejects an invalid pending choice without mutating state", () => {
    const result = play(effectStage(), { family: "DISCARD_CHOSEN", count: 2, from: "OWN_HAND", to: "OWN_ZONE_TEPI" });
    const chosen = result.state.players.P1.hand[0]!;
    const rejected = applyCommand(result.state, { type: "RESOLVE_EFFECT_CHOICE", playerId: "P1", cardInstanceIds: [chosen] });
    expect(rejected).toEqual({ accepted: false, state: result.state, code: "WRONG_EFFECT_CHOICE_COUNT" });
  });
});
