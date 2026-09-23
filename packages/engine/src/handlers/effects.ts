/** Effect Zone commands (GAME_RULES.md §5, §6, §15). */
import type { EngineEvent, PlayEffectCommand, RemoveOwnEffectCommand, ResolveEffectChoiceCommand } from "../commands.ts";
import { resolveCardEffect, resolveEffectChoice as continueEffectChoice } from "../effect-resolver.ts";
import { effectCapacity, effectSlotLimit } from "../effects.ts";
import { accept, opponentOf, reject, type HandlerResult } from "../internal/turn-helpers.ts";
import type { GameState } from "../state.ts";
import { moveCard } from "../zones.ts";

/** Places the card in the Effect Zone, then resolves its engine-owned Effect spec. */
export function playEffect(state: GameState, command: PlayEffectCommand): HandlerResult {
  if (state.turnStage !== "EFFECT_ACTIONS") return reject("WRONG_STAGE");
  if (state.pendingResolution !== null) return reject("RESOLUTION_PENDING");
  const player = state.players[command.playerId];
  if (player.vs === null) return reject("NO_VS");
  if (!player.hand.includes(command.cardInstanceId)) return reject("CARD_NOT_IN_HAND");
  const instance = state.cardInstances[command.cardInstanceId];
  const definition = instance ? state.cardDefinitions[instance.definitionId] : undefined;
  if (definition?.effect === undefined) return reject("CARD_HAS_NO_EFFECT");
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
  next = resolveCardEffect(next, command.cardInstanceId, command.playerId, events);
  return accept(next, events);
}

export function resolveEffectChoice(state: GameState, command: ResolveEffectChoiceCommand): HandlerResult {
  if (state.turnStage !== "EFFECT_ACTIONS") return reject("WRONG_STAGE");
  const pending = state.pendingResolution;
  if (pending === null) return reject("NO_PENDING_RESOLUTION");
  if (pending.actingPlayerId !== command.playerId) return reject("NOT_ACTIVE_PLAYER");
  if (command.cardInstanceIds.length !== pending.choiceCount) return reject("WRONG_EFFECT_CHOICE_COUNT");
  if (new Set(command.cardInstanceIds).size !== command.cardInstanceIds.length) return reject("INVALID_EFFECT_CHOICE");

  const sourceZone = pending.choiceKind === "DISCARD_OWN_HAND"
    ? state.players[pending.affectedPlayerId].hand
    : state.players[pending.affectedPlayerId].effectZone;
  if (!command.cardInstanceIds.every((id) => sourceZone.includes(id))) return reject("INVALID_EFFECT_CHOICE");

  const events: EngineEvent[] = [];
  const next = continueEffectChoice(state, command.cardInstanceIds, events);
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
