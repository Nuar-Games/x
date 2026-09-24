/**
 * X1.1 regression tests for GAME_RULES.md §19 (D-017): an already-empty deck
 * by itself never ends the match. Only a failed normal draw, an Effect that
 * empties a deck or needs a missing card, or a battle that empties a deck or
 * needs a missing top-deck card does.
 */
import { describe, expect, it } from "vitest";
import { advance, applyCommand, type EngineEvent, type GameState, type PlayerId, type VsPosition } from "../src/index.ts";
import { moveCard } from "../src/zones.ts";
import { must, proofMatch, setVs, take, withActive } from "./helpers/real-cards.ts";

/** Leaves exactly `keep` cards in the player's deck (the rest go to Zone Tepi). */
function trimDeck(state: GameState, playerId: PlayerId, keep: number): GameState {
  let next = state;
  for (const id of next.players[playerId].deck.slice(keep)) {
    next = moveCard(next, { instanceId: id, fromPlayerId: playerId, from: "DECK", toPlayerId: playerId, to: "ZONE_TEPI", reason: "HAND_LIMIT_DISCARD" }, []);
  }
  return next;
}

function ended(events: readonly EngineEvent[]): boolean {
  return events.some((event) => event.type === "MATCH_ENDED");
}

/** True if the match ended during the command's own turn, before its TURN_ENDED. */
function endedThisTurn(events: readonly EngineEvent[]): boolean {
  const turnEnd = events.findIndex((event) => event.type === "TURN_ENDED");
  const matchEnd = events.findIndex((event) => event.type === "MATCH_ENDED");
  return matchEnd !== -1 && (turnEnd === -1 || matchEnd < turnEnd);
}

function standoff(p1Vs: string, p2Vs: string, p2Position: VsPosition = "ATK"): GameState {
  return setVs(setVs(proofMatch(7), "P1", p1Vs), "P2", p2Vs, p2Position);
}

describe("§19 X1.1: an already-empty deck does not end the match by itself", () => {
  it("draw the last card normally → play SINGAU → match stays active", () => {
    let [state] = take(standoff("X001", "X013"), "P1", "X002");
    state = trimDeck(state, "P1", 1);
    state = { ...state, activePlayerId: "P1", turnStage: "TURN_START_DRAW" };

    state = advance(state).state; // normal draw takes the last card
    expect(state.players.P1.deck).toHaveLength(0);
    expect(state.status).toBe("ACTIVE");
    if (state.turnStage === "HAND_LIMIT_ENFORCEMENT") {
      const hand = state.players.P1.hand;
      const singau = hand.find((id) => state.cardInstances[id]!.definitionId === "X002")!;
      const discards = hand.filter((id) => id !== singau).slice(0, hand.length - 5);
      state = must(state, { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P1", cardInstanceIds: discards }).state;
    }
    state = must(state, { type: "KEEP_VS", playerId: "P1" }).state;

    const singau = state.players.P1.hand.find((id) => state.cardInstances[id]!.definitionId === "X002")!;
    const played = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: singau });
    expect(ended(played.events)).toBe(false);
    expect(played.state.status).toBe("ACTIVE");
  });

  it("already-empty defender deck + unrelated DEF battle (attacker blocked) → match stays active", () => {
    // XANDER (ATK 600) attacks NAGA RIBUT AIS in DEF... NAGA DEF 500 < 600 would need P2's top card,
    // so use SINGAU in DEF (DEF 900): the attacker discards its own top card instead.
    let state = trimDeck(standoff("X001", "X002", "DEF"), "P2", 0);
    state = withActive(state, "P1");
    expect(state.players.P2.deck).toHaveLength(0);
    const result = must(state, { type: "ATTACK", playerId: "P1" });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "BATTLE_RESOLVED", outcome: "ATTACKER_BLOCKED_BY_DEF" }));
    expect(endedThisTurn(result.events)).toBe(false);
    // P2's own next normal draw then fails, which does end the match (§19 normal draw).
    expect(result.events.at(-1)).toMatchObject({ type: "MATCH_ENDED" });
    const types = result.events.map((event) => event.type);
    expect(types.indexOf("TURN_STARTED")).toBeLessThan(types.indexOf("MATCH_ENDED"));
  });

  it("already-empty deck + ATK vs ATK battle (no top-deck operation) → match stays active", () => {
    let state = trimDeck(standoff("X002", "X001"), "P2", 0);
    state = withActive(state, "P1");
    const result = must(state, { type: "ATTACK", playerId: "P1" });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "BATTLE_RESOLVED", outcome: "ATTACKER_WINS_ATK_VS_ATK" }));
    expect(endedThisTurn(result.events)).toBe(false);
  });
});

describe("§19 X1.1: the match ends when this Effect or battle exhausts a deck", () => {
  it("an Effect that empties the deck scores after the Effect completes", () => {
    const [withXander, xander] = take(withActive(standoff("X002", "X013"), "P1"), "P1", "X001");
    const state = trimDeck(withXander, "P1", 1);
    const result = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: xander });
    const types = result.events.map((event) => event.type);
    expect(types.indexOf("EFFECT_RESOLVED")).toBeGreaterThan(-1);
    expect(types.indexOf("EFFECT_RESOLVED")).toBeLessThan(types.indexOf("MATCH_ENDED"));
    expect(result.state.status).toBe("RESOLVED");
  });

  it("an Effect that needs more cards than remain draws what exists, finishes its choice, then scores", () => {
    const [prepared, pipit] = take(withActive(standoff("X002", "X013"), "P1"), "P1", "X030");
    const state = trimDeck(prepared, "P1", 3);
    const played = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: pipit });
    expect(played.state.players.P1.deck).toHaveLength(0);
    expect(played.state.status).toBe("ACTIVE"); // still waiting for the discard choice
    expect(played.state.pendingResolution).toMatchObject({ choiceKind: "DISCARD_OWN_HAND", deckExhaustedByEffect: true });

    const chosen = played.state.players.P1.hand.slice(0, 2);
    const done = must(played.state, { type: "RESOLVE_EFFECT_CHOICE", playerId: "P1", cardInstanceIds: chosen });
    const types = done.events.map((event) => event.type);
    expect(types.indexOf("EFFECT_RESOLVED")).toBeLessThan(types.indexOf("MATCH_ENDED"));
    expect(done.state.status).toBe("RESOLVED");
  });

  it("a battle that needs a missing top-deck card scores", () => {
    // SINGAU (ATK 999) pierces NAGA RIBUT AIS in DEF (DEF 500): needs P2's top card, which is missing.
    let state = trimDeck(standoff("X002", "X013", "DEF"), "P2", 0);
    state = withActive(state, "P1");
    const result = must(state, { type: "ATTACK", playerId: "P1" });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "BATTLE_RESOLVED", outcome: "ATTACKER_PIERCES_DEF" }));
    expect(endedThisTurn(result.events)).toBe(true);
    expect(result.state.status).toBe("RESOLVED");
  });

  it("a battle whose top-deck operation takes the last card scores", () => {
    let state = trimDeck(standoff("X002", "X013", "DEF"), "P2", 1);
    state = withActive(state, "P1");
    const result = must(state, { type: "ATTACK", playerId: "P1" });
    expect(result.state.players.P2.deck).toHaveLength(0);
    expect(result.state.status).toBe("RESOLVED");
  });

  it("normal draw from an empty deck still ends and scores", () => {
    let state = trimDeck(standoff("X002", "X013"), "P1", 0);
    state = { ...state, activePlayerId: "P1", turnStage: "TURN_START_DRAW" };
    const result = advance(state);
    expect(ended(result.events)).toBe(true);
    expect(result.state.status).toBe("RESOLVED");
  });

  it("no command is accepted after the match resolves", () => {
    let state = trimDeck(standoff("X002", "X013", "DEF"), "P2", 0);
    state = must(withActive(state, "P1"), { type: "ATTACK", playerId: "P1" }).state;
    expect(applyCommand(state, { type: "PASS", playerId: state.activePlayerId })).toMatchObject({ accepted: false, code: "MATCH_NOT_ACTIVE" });
  });
});
