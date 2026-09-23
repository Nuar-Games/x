/** Effect Zone commands (GAME_RULES.md §5, §6). */
import type { EngineEvent, PlayEffectCommand, RemoveOwnEffectCommand } from "../commands.ts";
import { effectCapacity, effectSlotLimit } from "../effects.ts";
import { accept, opponentOf, reject, type HandlerResult } from "../internal/turn-helpers.ts";
import type { GameState } from "../state.ts";
import { moveCard } from "../zones.ts";

/**
 * Places the card in the Effect Zone. The card's effect itself is resolved by
 * the effect resolver (X1 step 13). Until then, playing an Effect only
 * occupies capacity; it does not leave a pending resolution that would block
 * the rest of the turn.
 */
export function playEffect(state: GameState, command: PlayEffectCommand): HandlerResult {
  if (state.turnStage !== "EFFECT_ACTIONS") return reject("WRONG_STAGE");
  if (state.pendingResolution !== null) return reject("RESOLUTION_PENDING");
  const player = state.players[command.playerId];
  if (player.vs === null) return reject("NO_VS");
  if (!player.hand.includes(command.cardInstanceId)) return reject("CARD_NOT_IN_HAND");
  const instance = state.cardInstances[command.cardInstanceId];
  const definition = instance ? state.cardDefinitions[instance.definitionId] : undefined;
  if (!definition?.hasPlayableEffect) return reject("CARD_HAS_NO_EFFECT");
  if (player.effectZone.length >= effectCapacity(state, command.playerId)) {
    return reject(player.effectZone.length >= effectSlotLimit(state, command.playerId) ? "EFFECT_ZONE_FULL" : "INSUFFICIENT_STA");
  }

  const events: EngineEvent[] = [];
  let next = moveCard(
    state,
    { instanceId: command.cardInstanceId, fromPlayerId: command.playerId, from: "HAND", toPlayerId: command.playerId, to: "EFFECT", reason: "PLAY_EFFECT" },
    events
  );
  events.push({ type: "EFFECT_PLAYED", playerId: command.playerId, instanceId: command.cardInstanceId });
  next = { ...next, effectCardsPlayedThisTurn: state.effectCardsPlayedThisTurn + 1 };
  return accept(next, events);
}

/** GAME_RULES.md §6: before playing new Effects, a removed own Effect is captured by the opponent. */
export function removeOwnEffect(state: GameState, command: RemoveOwnEffectCommand): HandlerResult {
  if (state.turnStage !== "EFFECT_ACTIONS") return reject("WRONG_STAGE");
  if (state.pendingResolution !== null) return reject("RESOLUTION_PENDING");
  if (state.effectCardsPlayedThisTurn > 0) return reject("EFFECT_REMOVAL_WINDOW_CLOSED");
  if (!state.players[command.playerId].effectZone.includes(command.cardInstanceId)) return reject("CARD_NOT_IN_EFFECT_ZONE");

  const events: EngineEvent[] = [];
  const next = moveCard(
    state,
    {
      instanceId: command.cardInstanceId,
      fromPlayerId: command.playerId,
      from: "EFFECT",
      toPlayerId: opponentOf(command.playerId),
      to: "ZONE_X",
      reason: "VOLUNTARY_EFFECT_REMOVAL"
    },
    events
  );
  events.push({ type: "EFFECT_REMOVED", playerId: command.playerId, instanceId: command.cardInstanceId });
  return accept(next, events);
}
