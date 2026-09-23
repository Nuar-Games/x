import { effectiveStat } from "./effects.ts";
import type { CardInstanceId, GameState, PlayerId, VsPosition } from "./state.ts";
import { moveCard } from "./zones.ts";

export type BattleOutcome =
  | "ATTACKER_WINS_ATK_VS_ATK"
  | "DEFENDER_WINS_ATK_VS_ATK"
  | "BOTH_DESTROYED_ATK_VS_ATK"
  | "ATTACKER_PIERCES_DEF"
  | "ATK_EQUALS_DEF"
  | "ATTACKER_BLOCKED_BY_DEF";

export type BattleEvent =
  | { readonly type: "VS_DESTROYED"; readonly instanceId: CardInstanceId; readonly ownerId: PlayerId; readonly capturedBy: PlayerId }
  | { readonly type: "TOP_DECK_CAPTURED"; readonly instanceId: CardInstanceId; readonly ownerId: PlayerId; readonly capturedBy: PlayerId }
  | { readonly type: "TOP_DECK_DISCARDED"; readonly instanceId: CardInstanceId; readonly playerId: PlayerId };

export interface BattleResult {
  readonly state: GameState;
  readonly outcome: BattleOutcome;
  readonly roundEnded: boolean;
  readonly events: readonly BattleEvent[];
}

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function requireVs(state: GameState, playerId: PlayerId): { id: CardInstanceId; position: VsPosition } {
  const player = state.players[playerId];
  if (player.vs === null || player.vsPosition === null) throw new Error("NO_VS");
  return { id: player.vs, position: player.vsPosition };
}

function topDeckCard(state: GameState, playerId: PlayerId): CardInstanceId {
  const id = state.players[playerId].deck[0];
  if (id === undefined) throw new Error("TOP_DECK_REQUIRED_BUT_EMPTY");
  return id;
}

/** Pure battle-matrix resolver. Round cleanup is a separate X1 step. */
export function resolveBattle(state: GameState, attackerId: PlayerId): BattleResult {
  const defenderId = opponentOf(attackerId);
  const attacker = requireVs(state, attackerId);
  const defender = requireVs(state, defenderId);
  if (attacker.position !== "ATK") throw new Error("ATTACKER_NOT_IN_ATK_POSITION");

  const attackerAtk = effectiveStat(state, attacker.id, "ATK");
  const events: BattleEvent[] = [];

  if (defender.position === "ATK") {
    const defenderAtk = effectiveStat(state, defender.id, "ATK");
    if (attackerAtk > defenderAtk) {
      const next = moveCard(state, {
        instanceId: defender.id,
        fromPlayerId: defenderId,
        from: "VS",
        toPlayerId: attackerId,
        to: "ZONE_X"
      });
      events.push({ type: "VS_DESTROYED", instanceId: defender.id, ownerId: defenderId, capturedBy: attackerId });
      return { state: next, outcome: "ATTACKER_WINS_ATK_VS_ATK", roundEnded: true, events };
    }
    if (attackerAtk < defenderAtk) {
      const next = moveCard(state, {
        instanceId: attacker.id,
        fromPlayerId: attackerId,
        from: "VS",
        toPlayerId: defenderId,
        to: "ZONE_X"
      });
      events.push({ type: "VS_DESTROYED", instanceId: attacker.id, ownerId: attackerId, capturedBy: defenderId });
      return { state: next, outcome: "DEFENDER_WINS_ATK_VS_ATK", roundEnded: true, events };
    }

    let next = moveCard(state, {
      instanceId: attacker.id,
      fromPlayerId: attackerId,
      from: "VS",
      toPlayerId: defenderId,
      to: "ZONE_X"
    });
    next = moveCard(next, {
      instanceId: defender.id,
      fromPlayerId: defenderId,
      from: "VS",
      toPlayerId: attackerId,
      to: "ZONE_X"
    });
    events.push(
      { type: "VS_DESTROYED", instanceId: attacker.id, ownerId: attackerId, capturedBy: defenderId },
      { type: "VS_DESTROYED", instanceId: defender.id, ownerId: defenderId, capturedBy: attackerId }
    );
    return { state: next, outcome: "BOTH_DESTROYED_ATK_VS_ATK", roundEnded: true, events };
  }

  const defenderDef = effectiveStat(state, defender.id, "DEF");
  if (attackerAtk > defenderDef) {
    const captured = topDeckCard(state, defenderId);
    const next = moveCard(state, {
      instanceId: captured,
      fromPlayerId: defenderId,
      from: "DECK",
      toPlayerId: attackerId,
      to: "ZONE_X"
    });
    events.push({ type: "TOP_DECK_CAPTURED", instanceId: captured, ownerId: defenderId, capturedBy: attackerId });
    return { state: next, outcome: "ATTACKER_PIERCES_DEF", roundEnded: false, events };
  }

  if (attackerAtk === defenderDef) {
    const attackerTop = topDeckCard(state, attackerId);
    const defenderTop = topDeckCard(state, defenderId);
    let next = moveCard(state, {
      instanceId: attackerTop,
      fromPlayerId: attackerId,
      from: "DECK",
      toPlayerId: attackerId,
      to: "ZONE_TEPI"
    });
    next = moveCard(next, {
      instanceId: defenderTop,
      fromPlayerId: defenderId,
      from: "DECK",
      toPlayerId: defenderId,
      to: "ZONE_TEPI"
    });
    events.push(
      { type: "TOP_DECK_DISCARDED", instanceId: attackerTop, playerId: attackerId },
      { type: "TOP_DECK_DISCARDED", instanceId: defenderTop, playerId: defenderId }
    );
    return { state: next, outcome: "ATK_EQUALS_DEF", roundEnded: false, events };
  }

  const discarded = topDeckCard(state, attackerId);
  const next = moveCard(state, {
    instanceId: discarded,
    fromPlayerId: attackerId,
    from: "DECK",
    toPlayerId: attackerId,
    to: "ZONE_TEPI"
  });
  events.push({ type: "TOP_DECK_DISCARDED", instanceId: discarded, playerId: attackerId });
  return { state: next, outcome: "ATTACKER_BLOCKED_BY_DEF", roundEnded: false, events };
}
