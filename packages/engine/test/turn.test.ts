import { describe, expect, it } from "vitest";
import { advance, applyCommand, handLimitFor, type GameState } from "../src/index.ts";
import { moveTopDeckToHand, setupTestMatch, withPlayer, withState } from "./helpers/setup-test-match.ts";
import { testInput } from "./fixtures.ts";

function freshMatch(seed = 99): GameState {
  return setupTestMatch(testInput(seed));
}

/** Ends the current turn directly. Real turn endings arrive with PASS/ATTACK (X1 step 10). */
function endTurn(state: GameState): GameState {
  return advance(withState(state, { turnStage: "TURN_END" })).state;
}

function snapshot(state: GameState): string {
  return JSON.stringify(state);
}

describe("turn-start draw", () => {
  it("Player 1 opening turn: draws 5 → 6, no discard, moves to required VS deployment", () => {
    const result = advance(freshMatch());
    const p1 = result.state.players.P1;

    expect(p1.hand).toHaveLength(6);
    expect(p1.turnsStarted).toBe(1);
    expect(result.state.turnStage).toBe("REQUIRED_VS_DEPLOYMENT");
    expect(result.events.map((e) => e.type)).toEqual(["TURN_STARTED", "CARD_MOVED", "CARD_DRAWN", "STAGE_CHANGED", "STAGE_CHANGED"]);
    expect(result.events[0]).toMatchObject({ type: "TURN_STARTED", playerId: "P1", isOpeningTurn: true });

    const drawn = result.events[2];
    if (drawn?.type !== "CARD_DRAWN") throw new Error("expected CARD_DRAWN");
    expect(result.state.cardInstances[drawn.instanceId]?.zone).toBe("HAND");
    expect(p1.hand.at(-1)).toBe(drawn.instanceId);
  });

  it("Player 2 opening turn: also draws 5 → 6 with no discard", () => {
    const p2Turn = endTurn(advance(freshMatch()).state);
    expect(p2Turn.activePlayerId).toBe("P2");
    expect(p2Turn.turnNumber).toBe(2);
    expect(p2Turn.players.P2.hand).toHaveLength(6);
    expect(p2Turn.players.P2.turnsStarted).toBe(1);
    expect(p2Turn.turnStage).toBe("REQUIRED_VS_DEPLOYMENT");
  });

  it("moves to the start-of-turn VS action when the player already has a VS", () => {
    const start = freshMatch();
    const vsCard = start.players.P1.hand[0]!;
    const withVs = withPlayer(start, "P1", { vs: vsCard, vsPosition: "ATK", hand: start.players.P1.hand.slice(1) });
    expect(advance(withVs).state.turnStage).toBe("START_OF_TURN_VS_ACTION");
  });
});

describe("hand limit", () => {
  it("is 6 on a player's opening turn and 5 from their second turn", () => {
    const opening = advance(freshMatch()).state;
    expect(handLimitFor(opening, "P1")).toBe(6);

    const p1Second = endTurn(endTurn(opening));
    expect(p1Second.activePlayerId).toBe("P1");
    expect(p1Second.players.P1.turnsStarted).toBe(2);
    expect(handLimitFor(p1Second, "P1")).toBe(5);
  });

  it("second turn: 6 → 7 after drawing, must discard 2 before anything else", () => {
    const opening = advance(freshMatch()).state;
    const result = advance(withState(endTurn(opening), { turnStage: "TURN_END" }));
    const state = result.state;

    expect(state.activePlayerId).toBe("P1");
    expect(state.players.P1.hand).toHaveLength(7);
    expect(state.turnStage).toBe("HAND_LIMIT_ENFORCEMENT");
    expect(result.events.at(-1)).toEqual({
      type: "HAND_LIMIT_EXCEEDED",
      playerId: "P1",
      handSize: 7,
      handLimit: 5,
      discardCount: 2
    });
  });

  it("opening turn: a player holding 6 before drawing must discard down to 6", () => {
    const state = advance(moveTopDeckToHand(freshMatch(), "P1", 1)).state;
    expect(state.players.P1.hand).toHaveLength(7);
    expect(state.turnStage).toBe("HAND_LIMIT_ENFORCEMENT");
    expect(handLimitFor(state, "P1")).toBe(6);
  });

  it("stays at 5 exactly with no discard on a later turn", () => {
    const opening = advance(freshMatch()).state;
    const trimmed = withPlayer(opening, "P1", { hand: opening.players.P1.hand.slice(0, 4) });
    const second = endTurn(endTurn(trimmed));
    expect(second.players.P1.hand).toHaveLength(5);
    expect(second.turnStage).toBe("REQUIRED_VS_DEPLOYMENT");
  });
});

describe("DISCARD_FOR_HAND_LIMIT", () => {
  function overLimit(): GameState {
    const opening = advance(freshMatch()).state;
    return advance(withState(endTurn(opening), { turnStage: "TURN_END" })).state;
  }

  it("moves the chosen cards to Zone Tepi and continues the turn", () => {
    const state = overLimit();
    const chosen = state.players.P1.hand.slice(0, 2);
    const result = applyCommand(state, { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P1", cardInstanceIds: chosen });

    if (!result.accepted) throw new Error(`rejected: ${result.code}`);
    const p1 = result.state.players.P1;
    expect(p1.hand).toHaveLength(5);
    expect(p1.zoneTepi).toEqual(chosen);
    for (const id of chosen) expect(result.state.cardInstances[id]?.zone).toBe("ZONE_TEPI");
    expect(result.state.turnStage).toBe("REQUIRED_VS_DEPLOYMENT");
    expect(result.events.slice(0, 2)).toEqual(
      chosen.map((instanceId) => ({
        type: "CARD_MOVED",
        instanceId,
        fromPlayerId: "P1",
        from: "HAND",
        toPlayerId: "P1",
        to: "ZONE_TEPI",
        reason: "HAND_LIMIT_DISCARD"
      }))
    );
  });

  it.each([
    ["too few cards", (s: GameState) => s.players.P1.hand.slice(0, 1), "WRONG_DISCARD_COUNT"],
    ["too many cards", (s: GameState) => s.players.P1.hand.slice(0, 3), "WRONG_DISCARD_COUNT"],
    ["the same card twice", (s: GameState) => [s.players.P1.hand[0]!, s.players.P1.hand[0]!], "DUPLICATE_CARD"],
    ["a card not in hand", (s: GameState) => [s.players.P1.hand[0]!, s.players.P1.deck[0]!], "CARD_NOT_IN_HAND"]
  ] as const)("rejects %s and leaves the state unchanged", (_label, pick, code) => {
    const state = overLimit();
    const before = snapshot(state);
    const result = applyCommand(state, { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P1", cardInstanceIds: pick(state) });
    expect(result).toMatchObject({ accepted: false, code });
    expect(result.state).toBe(state);
    expect(snapshot(state)).toBe(before);
  });

  it("rejects the inactive player", () => {
    const state = overLimit();
    const result = applyCommand(state, {
      type: "DISCARD_FOR_HAND_LIMIT",
      playerId: "P2",
      cardInstanceIds: state.players.P2.hand.slice(0, 2)
    });
    expect(result).toMatchObject({ accepted: false, code: "NOT_ACTIVE_PLAYER" });
  });

  it("rejects a discard outside hand-limit enforcement", () => {
    const state = advance(freshMatch()).state;
    const result = applyCommand(state, {
      type: "DISCARD_FOR_HAND_LIMIT",
      playerId: "P1",
      cardInstanceIds: state.players.P1.hand.slice(0, 1)
    });
    expect(result).toMatchObject({ accepted: false, code: "WRONG_STAGE" });
  });

  it("rejects commands once the match is resolved", () => {
    const state = withState(overLimit(), { status: "RESOLVED" });
    const result = applyCommand(state, {
      type: "DISCARD_FOR_HAND_LIMIT",
      playerId: "P1",
      cardInstanceIds: state.players.P1.hand.slice(0, 2)
    });
    expect(result).toMatchObject({ accepted: false, code: "MATCH_NOT_ACTIVE" });
  });
});

describe("purity and determinism", () => {
  it("never mutates the input state", () => {
    const start = freshMatch();
    const before = snapshot(start);
    const opening = advance(start).state;
    const over = advance(withState(endTurn(opening), { turnStage: "TURN_END" })).state;
    const overBefore = snapshot(over);
    applyCommand(over, { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P1", cardInstanceIds: over.players.P1.hand.slice(0, 2) });
    expect(snapshot(start)).toBe(before);
    expect(snapshot(over)).toBe(overBefore);
  });

  it("same seed and same sequence give identical states and events", () => {
    function run() {
      const opening = advance(freshMatch(4242));
      const over = advance(withState(endTurn(opening.state), { turnStage: "TURN_END" }));
      const discard = applyCommand(over.state, {
        type: "DISCARD_FOR_HAND_LIMIT",
        playerId: "P1",
        cardInstanceIds: over.state.players.P1.hand.slice(-2)
      });
      return { opening, over, discard };
    }
    expect(run()).toEqual(run());
  });
});
