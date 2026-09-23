import { describe, expect, it } from "vitest";
import { advance, applyCommand, type GameState } from "../src/index.ts";
import { resolveBattle } from "../src/battle.ts";
import { scoreAndResolveMatch } from "../src/scoring.ts";
import { moveCard } from "../src/zones.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch, withPlayer } from "./helpers/setup-test-match.ts";

function moveAllDeckToTepi(state: GameState, playerId: "P1" | "P2"): GameState {
  let next = state;
  for (const id of [...next.players[playerId].deck]) {
    next = moveCard(next, {
      instanceId: id,
      fromPlayerId: playerId,
      from: "DECK",
      toPlayerId: playerId,
      to: "ZONE_TEPI",
      reason: "HAND_LIMIT_DISCARD"
    }, []);
  }
  return next;
}

function putVs(state: GameState, playerId: "P1" | "P2", position: "ATK" | "DEF"): GameState {
  const id = state.players[playerId].hand[0]!;
  return moveCard(state, {
    instanceId: id,
    fromPlayerId: playerId,
    from: "HAND",
    toPlayerId: playerId,
    to: "VS",
    toVsPosition: position,
    reason: "DEPLOY_VS"
  }, []);
}

describe("deck exhaustion and match end (GAME_RULES.md §19–20)", () => {
  it("normal turn draw from an empty deck ends and scores the match instead of throwing", () => {
    let state = setupTestMatch(testInput(1401));
    state = moveAllDeckToTepi(state, "P1");
    state = { ...state, activePlayerId: "P1", turnStage: "TURN_START_DRAW" };
    const result = advance(state);
    expect(result.state.status).toBe("RESOLVED");
    expect(result.state.winner).not.toBeNull();
    expect(result.events).toContainEqual(expect.objectContaining({ type: "MATCH_ENDED", reason: "DECK_EXHAUSTED" }));
  });

  it("an Effect draws as many cards as remain, finishes, then scores when the deck is empty", () => {
    let state = setupTestMatch(testInput(1402));
    state = putVs(state, "P1", "ATK");
    state = putVs(state, "P2", "ATK");
    const source = state.players.P1.hand[0]!;
    const sourceDefinition = state.cardInstances[source]!.definitionId;
    const keep = state.players.P1.deck[0]!;
    for (const id of [...state.players.P1.deck].filter((id) => id !== keep)) {
      state = moveCard(state, { instanceId: id, fromPlayerId: "P1", from: "DECK", toPlayerId: "P1", to: "ZONE_TEPI", reason: "HAND_LIMIT_DISCARD" }, []);
    }
    state = {
      ...state,
      activePlayerId: "P1",
      turnStage: "EFFECT_ACTIONS",
      cardDefinitions: {
        ...state.cardDefinitions,
        [sourceDefinition]: { ...state.cardDefinitions[sourceDefinition]!, effect: { family: "DRAW", count: 5, from: "OWN_DECK" } }
      }
    };
    const result = applyCommand(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: source });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.state.players.P1.hand).toContain(keep);
    expect(result.state.players.P1.deck).toHaveLength(0);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "EFFECT_RESOLVED", sourceInstanceId: source }));
    expect(result.state.status).toBe("RESOLVED");
  });

  it("battle top-deck exhaustion resolves the battle result, then ends and scores", () => {
    let state = setupTestMatch(testInput(1403));
    state = putVs(state, "P1", "ATK");
    state = putVs(state, "P2", "DEF");
    state = moveAllDeckToTepi(state, "P2");
    const p1Vs = state.players.P1.vs!;
    const p2Vs = state.players.P2.vs!;
    const p1Def = state.cardInstances[p1Vs]!.definitionId;
    const p2Def = state.cardInstances[p2Vs]!.definitionId;
    state = {
      ...state,
      cardDefinitions: {
        ...state.cardDefinitions,
        [p1Def]: { ...state.cardDefinitions[p1Def]!, atk: 999 },
        [p2Def]: { ...state.cardDefinitions[p2Def]!, def: 1 }
      }
    };
    const events: Parameters<typeof resolveBattle>[2] = [];
    const result = resolveBattle(state, "P1", events);
    expect(events).toContainEqual(expect.objectContaining({ type: "BATTLE_RESOLVED", outcome: "ATTACKER_PIERCES_DEF" }));
    expect(result.status).toBe("RESOLVED");
  });
});

describe("Zone X scoring and tie-breaker (GAME_RULES.md §20)", () => {
  it("higher Zone X card count wins without a tie-break", () => {
    let state = setupTestMatch(testInput(1410));
    const p1 = state.players.P1.hand.slice(0, 2);
    const p2 = state.players.P2.hand.slice(0, 1);
    for (const id of p1) state = moveCard(state, { instanceId: id, fromPlayerId: "P1", from: "HAND", toPlayerId: "P1", to: "ZONE_X", reason: "BATTLE_TOP_DECK_CAPTURE" }, []);
    for (const id of p2) state = moveCard(state, { instanceId: id, fromPlayerId: "P2", from: "HAND", toPlayerId: "P2", to: "ZONE_X", reason: "BATTLE_TOP_DECK_CAPTURE" }, []);
    const events: Parameters<typeof scoreAndResolveMatch>[1] = [];
    const resolved = scoreAndResolveMatch(state, events, "DECK_EXHAUSTED");
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.winner).toBe("P1");
    expect(events).toContainEqual(expect.objectContaining({ type: "SCORE_CALCULATED", p1: 2, p2: 1 }));
  });

  it("a tied Zone X score uses deterministic shuffled non-Zone-X pools and printed ATK", () => {
    const state = setupTestMatch(testInput(1411));
    const boostedTarget = state.players.P1.hand[0]!;
    const withTemporaryBoost: GameState = {
      ...state,
      statModifiers: [{
        id: "temporary",
        sourceInstanceId: state.players.P1.hand[1]!,
        targetInstanceId: boostedTarget,
        order: 1,
        duration: "UNTIL_ROUND_END",
        kind: "ADD",
        stat: "ATK",
        value: 100000
      }]
    };
    const eventsA: Parameters<typeof scoreAndResolveMatch>[1] = [];
    const eventsB: Parameters<typeof scoreAndResolveMatch>[1] = [];
    const a = scoreAndResolveMatch(withTemporaryBoost, eventsA, "DECK_EXHAUSTED");
    const b = scoreAndResolveMatch(withTemporaryBoost, eventsB, "DECK_EXHAUSTED");
    expect(a.winner).toBe(b.winner);
    expect(a.rng).toEqual(b.rng);
    expect(eventsA).toEqual(eventsB);
    expect(eventsA.some((event) => event.type === "TIE_BREAK_REVEALED")).toBe(true);
  });

  it("an unbreakable tie is a draw", () => {
    let state = setupTestMatch(testInput(1412));
    state = {
      ...state,
      players: {
        P1: { ...state.players.P1, deck: [], hand: [], vs: null, vsPosition: null, effectZone: [], zoneTepi: [] },
        P2: { ...state.players.P2, deck: [], hand: [], vs: null, vsPosition: null, effectZone: [], zoneTepi: [] }
      },
      cardInstances: {}
    };
    const events: Parameters<typeof scoreAndResolveMatch>[1] = [];
    const resolved = scoreAndResolveMatch(state, events, "DECK_EXHAUSTED");
    expect(resolved.winner).toBe("DRAW");
    expect(resolved.status).toBe("RESOLVED");
  });
});
