/**
 * Battle matrix (GAME_RULES.md §10). Round end is not handled here: it
 * happens automatically inside moveCard when a VS leaves the VS Zone.
 */
import type { EngineEvent } from "./commands.ts";
import { effectiveStat } from "./effects.ts";
import type { CardInstanceId, GameState, PlayerId, VsPosition } from "./state.ts";
import { moveCard, moveCardsSimultaneously } from "./zones.ts";

export type BattleOutcome =
  | "ATTACKER_WINS_ATK_VS_ATK"
  | "DEFENDER_WINS_ATK_VS_ATK"
  | "BOTH_DESTROYED_ATK_VS_ATK"
  | "ATTACKER_PIERCES_DEF"
  | "ATK_EQUALS_DEF"
  | "ATTACKER_BLOCKED_BY_DEF";

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
  // GAME_RULES.md §19: should end and score the match. Implemented in X1 step 14.
  if (id === undefined) throw new Error("TOP_DECK_REQUIRED_BUT_EMPTY");
  return id;
}

/** Resolves one attack. Callers validate legality first (see ATTACK in turn.ts). */
export function resolveBattle(state: GameState, attackerId: PlayerId, events: EngineEvent[]): GameState {
  const defenderId = opponentOf(attackerId);
  const attacker = requireVs(state, attackerId);
  const defender = requireVs(state, defenderId);
  if (attacker.position !== "ATK") throw new Error("ATTACKER_NOT_IN_ATK_POSITION");

  const attackerAtk = effectiveStat(state, attacker.id, "ATK");
  const defenderStat = defender.position === "ATK" ? "ATK" : "DEF";
  const defenderValue = effectiveStat(state, defender.id, defenderStat);

  const report = (outcome: BattleOutcome) =>
    events.push({ type: "BATTLE_RESOLVED", attackerId, defenderId, attackerAtk, defenderStat, defenderValue, outcome });

  const destroyVs = (ownerId: PlayerId, id: CardInstanceId) => ({
    instanceId: id,
    fromPlayerId: ownerId,
    from: "VS" as const,
    toPlayerId: opponentOf(ownerId),
    to: "ZONE_X" as const,
    reason: "BATTLE_DESTROYED" as const
  });

  if (defender.position === "ATK") {
    if (attackerAtk > defenderValue) {
      report("ATTACKER_WINS_ATK_VS_ATK");
      return moveCard(state, destroyVs(defenderId, defender.id), events);
    }
    if (attackerAtk < defenderValue) {
      report("DEFENDER_WINS_ATK_VS_ATK");
      return moveCard(state, destroyVs(attackerId, attacker.id), events);
    }
    report("BOTH_DESTROYED_ATK_VS_ATK");
    return moveCardsSimultaneously(state, [destroyVs(attackerId, attacker.id), destroyVs(defenderId, defender.id)], events);
  }

  if (attackerAtk > defenderValue) {
    report("ATTACKER_PIERCES_DEF");
    const captured = topDeckCard(state, defenderId);
    return moveCard(
      state,
      { instanceId: captured, fromPlayerId: defenderId, from: "DECK", toPlayerId: attackerId, to: "ZONE_X", reason: "BATTLE_TOP_DECK_CAPTURE" },
      events
    );
  }

  if (attackerAtk === defenderValue) {
    report("ATK_EQUALS_DEF");
    const attackerTop = topDeckCard(state, attackerId);
    const defenderTop = topDeckCard(state, defenderId);
    return moveCardsSimultaneously(
      state,
      [
        { instanceId: attackerTop, fromPlayerId: attackerId, from: "DECK", toPlayerId: attackerId, to: "ZONE_TEPI", reason: "BATTLE_TOP_DECK_DISCARD" },
        { instanceId: defenderTop, fromPlayerId: defenderId, from: "DECK", toPlayerId: defenderId, to: "ZONE_TEPI", reason: "BATTLE_TOP_DECK_DISCARD" }
      ],
      events
    );
  }

  report("ATTACKER_BLOCKED_BY_DEF");
  const discarded = topDeckCard(state, attackerId);
  return moveCard(
    state,
    { instanceId: discarded, fromPlayerId: attackerId, from: "DECK", toPlayerId: attackerId, to: "ZONE_TEPI", reason: "BATTLE_TOP_DECK_DISCARD" },
    events
  );
}
