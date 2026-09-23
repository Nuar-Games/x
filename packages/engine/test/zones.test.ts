import { describe, expect, it } from "vitest";
import type { GameState } from "../src/index.ts";
import { moveCard } from "../src/zones.ts";
import { testInput } from "./fixtures.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

function baseState(): GameState {
  return setupTestMatch(testInput(123));
}

describe("zone transitions", () => {
  it("moves a card between engine-owned zone containers and updates its zone", () => {
    const state = baseState();
    const id = state.players.P1.hand[0]!;
    const result = moveCard(state, {
      instanceId: id,
      fromPlayerId: "P1",
      from: "HAND",
      toPlayerId: "P1",
      to: "ZONE_TEPI",
      reason: "PLAY_EFFECT"
    }, []);

    expect(result.players.P1.hand).not.toContain(id);
    expect(result.players.P1.zoneTepi).toContain(id);
    expect(result.cardInstances[id]?.zone).toBe("ZONE_TEPI");
  });

  it("rejects any attempt to move a card out of Zone X", () => {
    const state = baseState();
    const id = state.players.P1.hand[0]!;
    const inZoneX = moveCard(state, {
      instanceId: id,
      fromPlayerId: "P1",
      from: "HAND",
      toPlayerId: "P2",
      to: "ZONE_X",
      reason: "PLAY_EFFECT"
    }, []);

    expect(() =>
      moveCard(inZoneX, {
        instanceId: id,
        fromPlayerId: "P2",
        from: "ZONE_X",
        toPlayerId: "P1",
        to: "HAND",
        reason: "PLAY_EFFECT"
      }, [])
    ).toThrow("ZONE_X_IMMUTABLE");
  });

  it("rejects a transition when the claimed source container does not contain the card", () => {
    const state = baseState();
    const id = state.players.P1.hand[0]!;
    expect(() =>
      moveCard(state, {
        instanceId: id,
        fromPlayerId: "P1",
        from: "EFFECT",
        toPlayerId: "P1",
        to: "ZONE_TEPI",
        reason: "PLAY_EFFECT"
      }, [])
    ).toThrow("SOURCE_ZONE_MISMATCH");
  });

  it("cleans source-bound state when an Effect card leaves the Effect Zone", () => {
    const state = baseState();
    const sourceId = state.players.P1.hand[0]!;
    const targetId = state.players.P2.hand[0]!;
    const inEffect = moveCard(state, {
      instanceId: sourceId,
      fromPlayerId: "P1",
      from: "HAND",
      toPlayerId: "P1",
      to: "EFFECT",
      reason: "PLAY_EFFECT"
    }, []);
    const withModifiers: GameState = {
      ...inEffect,
      statModifiers: [
        {
          id: "m1",
          sourceInstanceId: sourceId,
          targetInstanceId: targetId,
          order: 1,
          duration: "WHILE_SOURCE_ACTIVE",
          kind: "ADD",
          stat: "ATK",
          value: 100
        }
      ],
      ruleModifiers: [
        {
          id: "r1",
          sourceInstanceId: sourceId,
          affectedPlayerId: "P2",
          kind: "ATTACK_RESTRICTION",
          value: 1,
          expiresOn: ["SOURCE_LEAVES_EFFECT_ZONE"]
        }
      ],
      activeContinuousEffectIds: [sourceId]
    };

    const moved = moveCard(withModifiers, {
      instanceId: sourceId,
      fromPlayerId: "P1",
      from: "EFFECT",
      toPlayerId: "P1",
      to: "ZONE_TEPI",
      reason: "PLAY_EFFECT"
    }, []);
    expect(moved.statModifiers).toHaveLength(0);
    expect(moved.ruleModifiers).toHaveLength(0);
    expect(moved.activeContinuousEffectIds).toHaveLength(0);
  });
});
