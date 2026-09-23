import { describe, expect, it } from "vitest";
import { applyCommand, type EngineEvent, type GameState } from "../src/index.ts";
import { moveCard, moveCardsSimultaneously } from "../src/zones.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

/** Both players have a VS and one Effect card, plus round- and turn-bound modifiers. */
function midRound(): GameState {
  let state = setupTestMatch(testInput(456));
  const [p1Vs, p1Effect] = state.players.P1.hand;
  const [p2Vs, p2Effect] = state.players.P2.hand;
  const place = (s: GameState, id: string, player: "P1" | "P2", to: "VS" | "EFFECT") =>
    moveCard(s, { instanceId: id, fromPlayerId: player, from: "HAND", toPlayerId: player, to, ...(to === "VS" ? { toVsPosition: "ATK" as const } : {}), reason: to === "VS" ? "DEPLOY_VS" : "PLAY_EFFECT" }, []);
  state = place(state, p1Vs!, "P1", "VS");
  state = place(state, p2Vs!, "P2", "VS");
  state = place(state, p1Effect!, "P1", "EFFECT");
  state = place(state, p2Effect!, "P2", "EFFECT");

  return {
    ...state,
    statModifiers: [
      { id: "round", sourceInstanceId: p1Vs!, targetInstanceId: p1Vs!, order: 1, duration: "UNTIL_ROUND_END", kind: "ADD", stat: "ATK", value: 100 },
      { id: "turn", sourceInstanceId: p1Vs!, targetInstanceId: p1Vs!, order: 2, duration: "UNTIL_TURN_END", kind: "ADD", stat: "DEF", value: 50 }
    ],
    ruleModifiers: [
      { id: "round-rule", sourceInstanceId: p1Vs!, affectedPlayerId: "P2", kind: "ARENA_COLLAPSE", value: 1, expiresOn: ["ROUND_END"] },
      { id: "turn-rule", sourceInstanceId: p1Vs!, affectedPlayerId: "P2", kind: "HAND_SIZE_LIMIT", value: 1, expiresOn: ["TURN_END"] }
    ]
  };
}

function captureP2Vs(state: GameState, events: EngineEvent[] = []): GameState {
  return moveCard(
    state,
    { instanceId: state.players.P2.vs!, fromPlayerId: "P2", from: "VS", toPlayerId: "P1", to: "ZONE_X", reason: "BATTLE_DESTROYED" },
    events
  );
}

describe("round end is engine-driven (GAME_RULES.md §12, D-013)", () => {
  it("a VS leaving the VS Zone clears both Effect Zones to Zone Tepi", () => {
    const state = midRound();
    const p1Effect = state.players.P1.effectZone[0]!;
    const p2Effect = state.players.P2.effectZone[0]!;
    const next = captureP2Vs(state);
    expect(next.players.P1.effectZone).toEqual([]);
    expect(next.players.P2.effectZone).toEqual([]);
    expect(next.players.P1.zoneTepi).toContain(p1Effect);
    expect(next.players.P2.zoneTepi).toContain(p2Effect);
  });

  it("the surviving VS stays in place", () => {
    const state = midRound();
    const next = captureP2Vs(state);
    expect(next.players.P1.vs).toBe(state.players.P1.vs);
    expect(next.players.P1.vsPosition).toBe("ATK");
  });

  it("round-bound modifiers expire; turn-bound ones stay", () => {
    const next = captureP2Vs(midRound());
    expect(next.statModifiers.map((m) => m.id)).toEqual(["turn"]);
    expect(next.ruleModifiers.map((m) => m.id)).toEqual(["turn-rule"]);
  });

  it("emits ROUND_ENDED and increments roundNumber exactly once", () => {
    const state = midRound();
    const events: EngineEvent[] = [];
    const next = captureP2Vs(state, events);
    expect(next.roundNumber).toBe(state.roundNumber + 1);
    expect(events.filter((e) => e.type === "ROUND_ENDED")).toEqual([{ type: "ROUND_ENDED", roundNumber: state.roundNumber }]);
  });

  it("two VS leaving together end the round once", () => {
    const state = midRound();
    const events: EngineEvent[] = [];
    const next = moveCardsSimultaneously(
      state,
      [
        { instanceId: state.players.P1.vs!, fromPlayerId: "P1", from: "VS", toPlayerId: "P2", to: "ZONE_X", reason: "BATTLE_DESTROYED" },
        { instanceId: state.players.P2.vs!, fromPlayerId: "P2", from: "VS", toPlayerId: "P1", to: "ZONE_X", reason: "BATTLE_DESTROYED" }
      ],
      events
    );
    expect(next.roundNumber).toBe(state.roundNumber + 1);
    expect(events.filter((e) => e.type === "ROUND_ENDED")).toHaveLength(1);
  });

  it("moves that do not involve a VS leaving never end the round", () => {
    const state = midRound();
    const next = moveCard(
      state,
      { instanceId: state.players.P1.hand[0]!, fromPlayerId: "P1", from: "HAND", toPlayerId: "P1", to: "ZONE_TEPI", reason: "HAND_LIMIT_DISCARD" },
      []
    );
    expect(next.roundNumber).toBe(state.roundNumber);
    expect(next.players.P1.effectZone).toHaveLength(1);
  });
});

describe("voluntary VS replacement ends the round (D-013)", () => {
  function replaceable(): GameState {
    return { ...midRound(), turnStage: "START_OF_TURN_VS_ACTION" };
  }

  it("captures the old VS, ends the round, then deploys the replacement", () => {
    const state = replaceable();
    const oldVs = state.players.P1.vs!;
    const replacement = state.players.P1.hand[0]!;
    const result = applyCommand(state, { type: "REPLACE_VS", playerId: "P1", cardInstanceId: replacement, position: "DEF" });
    if (!result.accepted) throw new Error(result.code);

    const next = result.state;
    expect(next.players.P2.zoneX).toContain(oldVs);
    expect(next.players.P1.vs).toBe(replacement);
    expect(next.players.P1.vsPosition).toBe("DEF");
    expect(next.players.P1.effectZone).toEqual([]);
    expect(next.players.P2.effectZone).toEqual([]);
    expect(next.roundNumber).toBe(state.roundNumber + 1);
    expect(next.statModifiers.map((m) => m.id)).toEqual(["turn"]);
    expect(next.turnStage).toBe("EFFECT_ACTIONS");
  });

  it("orders events: old VS captured → Effects cleared → ROUND_ENDED → replacement deployed", () => {
    const state = replaceable();
    const replacement = state.players.P1.hand[0]!;
    const result = applyCommand(state, { type: "REPLACE_VS", playerId: "P1", cardInstanceId: replacement, position: "ATK" });
    if (!result.accepted) throw new Error(result.code);
    const sequence = result.events.map((e) => (e.type === "CARD_MOVED" ? `${e.reason}` : e.type));
    expect(sequence).toEqual([
      "VOLUNTARY_VS_REPLACEMENT",
      "ROUND_END_CLEAR",
      "ROUND_END_CLEAR",
      "ROUND_ENDED",
      "DEPLOY_VS",
      "VS_REPLACED",
      "STAGE_CHANGED"
    ]);
  });
});
