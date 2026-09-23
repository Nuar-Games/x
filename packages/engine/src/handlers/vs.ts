/** VS commands (GAME_RULES.md §6, §8). */
import type { ChangeVsPositionCommand, DeployVsCommand, EngineEvent, KeepVsCommand, ReplaceVsCommand } from "../commands.ts";
import { accept, opponentOf, reject, setStage, type HandlerResult } from "../internal/turn-helpers.ts";
import type { GameState } from "../state.ts";
import { moveCard } from "../zones.ts";

export function deployVs(state: GameState, command: DeployVsCommand): HandlerResult {
  if (state.turnStage !== "REQUIRED_VS_DEPLOYMENT") return reject("WRONG_STAGE");
  if (!state.players[command.playerId].hand.includes(command.cardInstanceId)) return reject("CARD_NOT_IN_HAND");

  const events: EngineEvent[] = [];
  let next = moveCard(
    state,
    {
      instanceId: command.cardInstanceId,
      fromPlayerId: command.playerId,
      from: "HAND",
      toPlayerId: command.playerId,
      to: "VS",
      toVsPosition: command.position,
      reason: "DEPLOY_VS"
    },
    events
  );
  events.push({ type: "VS_DEPLOYED", playerId: command.playerId, instanceId: command.cardInstanceId, position: command.position });
  next = setStage(next, "EFFECT_ACTIONS", events);
  return accept(next, events);
}

export function keepVs(state: GameState, command: KeepVsCommand): HandlerResult {
  if (state.turnStage !== "START_OF_TURN_VS_ACTION") return reject("WRONG_STAGE");
  const player = state.players[command.playerId];
  if (player.vs === null || player.vsPosition === null) return reject("NO_VS");
  const events: EngineEvent[] = [{ type: "VS_KEPT", playerId: command.playerId, instanceId: player.vs }];
  return accept(setStage(state, "EFFECT_ACTIONS", events), events);
}

export function changeVsPosition(state: GameState, command: ChangeVsPositionCommand): HandlerResult {
  if (state.turnStage !== "START_OF_TURN_VS_ACTION") return reject("WRONG_STAGE");
  const player = state.players[command.playerId];
  if (player.vs === null || player.vsPosition === null) return reject("NO_VS");
  if (player.vsPosition === command.position) return reject("POSITION_UNCHANGED");

  const events: EngineEvent[] = [
    { type: "VS_POSITION_CHANGED", playerId: command.playerId, instanceId: player.vs, from: player.vsPosition, to: command.position }
  ];
  const next: GameState = { ...state, players: { ...state.players, [command.playerId]: { ...player, vsPosition: command.position } } };
  return accept(setStage(next, "EFFECT_ACTIONS", events), events);
}

/**
 * GAME_RULES.md §6 / §12 (D-013): the old VS is captured into the opponent's
 * Zone X, which ends the round (both Effect Zones cleared, round modifiers
 * expire) inside moveCard. Then the replacement VS is deployed.
 */
export function replaceVs(state: GameState, command: ReplaceVsCommand): HandlerResult {
  if (state.turnStage !== "START_OF_TURN_VS_ACTION") return reject("WRONG_STAGE");
  const player = state.players[command.playerId];
  if (player.vs === null || player.vsPosition === null) return reject("NO_VS");
  if (!player.hand.includes(command.cardInstanceId)) return reject("CARD_NOT_IN_HAND");

  const oldVs = player.vs;
  const events: EngineEvent[] = [];
  let next = moveCard(
    state,
    {
      instanceId: oldVs,
      fromPlayerId: command.playerId,
      from: "VS",
      toPlayerId: opponentOf(command.playerId),
      to: "ZONE_X",
      reason: "VOLUNTARY_VS_REPLACEMENT"
    },
    events
  );
  next = moveCard(
    next,
    {
      instanceId: command.cardInstanceId,
      fromPlayerId: command.playerId,
      from: "HAND",
      toPlayerId: command.playerId,
      to: "VS",
      toVsPosition: command.position,
      reason: "DEPLOY_VS"
    },
    events
  );
  events.push({ type: "VS_REPLACED", playerId: command.playerId, oldInstanceId: oldVs, newInstanceId: command.cardInstanceId, position: command.position });
  return accept(setStage(next, "EFFECT_ACTIONS", events), events);
}
