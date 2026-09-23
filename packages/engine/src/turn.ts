/**
 * Turn-state machine (ARCHITECTURE.md §10) and hand-limit enforcement
 * (GAME_RULES.md §3).
 *
 * `advance` runs automatic engine transitions until the match needs a player
 * decision. `applyCommand` validates a player command, applies it, then
 * advances. Both are pure: the input state is never modified.
 */
import type {
  ChangeVsPositionCommand,
  Command,
  CommandResult,
  DeployVsCommand,
  DiscardForHandLimitCommand,
  EngineEvent,
  KeepVsCommand,
  PlayEffectCommand,
  RemoveOwnEffectCommand,
  ReplaceVsCommand,
  TransitionResult
} from "./commands.ts";
import { effectCapacity, removeEffectSourceState } from "./effects.ts";
import type { CardInstance, CardInstanceId, GameState, PlayerId, PlayerState, TurnStage } from "./state.ts";

export const OPENING_TURN_HAND_LIMIT = 6;
export const HAND_LIMIT = 5;

export function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

/** A player's opening turn is their first turn of the match (GAME_RULES.md §3). */
export function isOpeningTurn(player: PlayerState): boolean {
  return player.turnsStarted === 1;
}

/** 6 during the player's opening turn, 5 from their second turn onward. */
export function handLimitFor(state: GameState, playerId: PlayerId): number {
  return isOpeningTurn(state.players[playerId]) ? OPENING_TURN_HAND_LIMIT : HAND_LIMIT;
}

/** §6 step 3: required deployment with no VS, otherwise the start-of-turn VS action. */
function stageAfterHandLimit(player: PlayerState): TurnStage {
  return player.vs === null ? "REQUIRED_VS_DEPLOYMENT" : "START_OF_TURN_VS_ACTION";
}

function setStage(state: GameState, to: TurnStage, events: EngineEvent[]): GameState {
  events.push({ type: "STAGE_CHANGED", playerId: state.activePlayerId, from: state.turnStage, to });
  return { ...state, turnStage: to };
}

function withPlayer(state: GameState, player: PlayerState): GameState {
  return { ...state, players: { ...state.players, [player.playerId]: player } };
}

function withInstances(state: GameState, updates: readonly CardInstance[]): GameState {
  const cardInstances = { ...state.cardInstances };
  for (const instance of updates) cardInstances[instance.instanceId] = instance;
  return { ...state, cardInstances };
}

function runTurnStartDraw(state: GameState, events: EngineEvent[]): GameState {
  const playerId = state.activePlayerId;
  const started: PlayerState = { ...state.players[playerId], turnsStarted: state.players[playerId].turnsStarted + 1 };
  state = { ...state, effectCardsPlayedThisTurn: 0 };
  events.push({ type: "TURN_STARTED", playerId, turnNumber: state.turnNumber, isOpeningTurn: isOpeningTurn(started) });

  const drawnId = started.deck[0];
  if (drawnId === undefined) {
    throw new Error("deck exhaustion at turn-start draw is not implemented yet (X1 step 14)");
  }

  const drawn = state.cardInstances[drawnId];
  if (!drawn) throw new Error(`missing card instance: ${drawnId}`);

  let next = withPlayer(state, { ...started, deck: started.deck.slice(1), hand: [...started.hand, drawnId] });
  next = withInstances(next, [{ ...drawn, zone: "HAND" }]);
  events.push({ type: "CARD_DRAWN", playerId, instanceId: drawnId });
  return setStage(next, "HAND_LIMIT_ENFORCEMENT", events);
}

function runHandLimitCheck(state: GameState, events: EngineEvent[]): GameState | null {
  const playerId = state.activePlayerId;
  const player = state.players[playerId];
  const handLimit = handLimitFor(state, playerId);
  if (player.hand.length <= handLimit) return setStage(state, stageAfterHandLimit(player), events);

  events.push({
    type: "HAND_LIMIT_EXCEEDED",
    playerId,
    handSize: player.hand.length,
    handLimit,
    discardCount: player.hand.length - handLimit
  });
  return null;
}

function runTurnEnd(state: GameState, events: EngineEvent[]): GameState {
  const endingPlayer = state.activePlayerId;
  events.push({ type: "TURN_ENDED", playerId: endingPlayer, turnNumber: state.turnNumber });
  const next: GameState = { ...state, activePlayerId: opponentOf(endingPlayer), turnNumber: state.turnNumber + 1 };
  return setStage(next, "TURN_START_DRAW", events);
}

export function advance(state: GameState): TransitionResult {
  const events: EngineEvent[] = [];
  let current = state;

  for (;;) {
    if (current.status !== "ACTIVE") return { state: current, events };

    switch (current.turnStage) {
      case "TURN_START_DRAW":
        current = runTurnStartDraw(current, events);
        continue;
      case "HAND_LIMIT_ENFORCEMENT": {
        const next = runHandLimitCheck(current, events);
        if (next === null) return { state: current, events };
        current = next;
        continue;
      }
      case "TURN_END":
        current = runTurnEnd(current, events);
        continue;
      default:
        return { state: current, events };
    }
  }
}

function reject(state: GameState, code: Extract<CommandResult, { accepted: false }>["code"]): CommandResult {
  return { accepted: false, state, code };
}

function applyDiscardForHandLimit(state: GameState, command: DiscardForHandLimitCommand): CommandResult {
  if (state.turnStage !== "HAND_LIMIT_ENFORCEMENT") return reject(state, "WRONG_STAGE");

  const player = state.players[command.playerId];
  const required = player.hand.length - handLimitFor(state, command.playerId);
  if (required <= 0 || command.cardInstanceIds.length !== required) return reject(state, "WRONG_DISCARD_COUNT");
  if (new Set(command.cardInstanceIds).size !== command.cardInstanceIds.length) return reject(state, "DUPLICATE_CARD");
  if (!command.cardInstanceIds.every((id) => player.hand.includes(id))) return reject(state, "CARD_NOT_IN_HAND");

  const events: EngineEvent[] = [];
  const discarded = new Set<CardInstanceId>(command.cardInstanceIds);
  const nextPlayer: PlayerState = {
    ...player,
    hand: player.hand.filter((id) => !discarded.has(id)),
    zoneTepi: [...player.zoneTepi, ...command.cardInstanceIds]
  };
  let next = withPlayer(state, nextPlayer);
  next = withInstances(next, command.cardInstanceIds.map((id) => ({ ...state.cardInstances[id]!, zone: "ZONE_TEPI" as const })));
  for (const instanceId of command.cardInstanceIds) {
    events.push({ type: "CARD_MOVED", playerId: command.playerId, instanceId, from: "HAND", to: "ZONE_TEPI", reason: "HAND_LIMIT_DISCARD" });
  }

  const advanced = advance(next);
  return { accepted: true, state: advanced.state, events: [...events, ...advanced.events] };
}

function moveToEffectActions(state: GameState, events: EngineEvent[]): GameState {
  return setStage(state, "EFFECT_ACTIONS", events);
}

function applyDeployVs(state: GameState, command: DeployVsCommand): CommandResult {
  if (state.turnStage !== "REQUIRED_VS_DEPLOYMENT") return reject(state, "WRONG_STAGE");
  const player = state.players[command.playerId];
  if (!player.hand.includes(command.cardInstanceId)) return reject(state, "CARD_NOT_IN_HAND");
  const events: EngineEvent[] = [];
  const nextPlayer: PlayerState = { ...player, hand: player.hand.filter((id) => id !== command.cardInstanceId), vs: command.cardInstanceId, vsPosition: command.position };
  let next = withPlayer(state, nextPlayer);
  next = withInstances(next, [{ ...state.cardInstances[command.cardInstanceId]!, zone: "VS" }]);
  events.push({ type: "VS_DEPLOYED", playerId: command.playerId, instanceId: command.cardInstanceId, position: command.position });
  next = moveToEffectActions(next, events);
  return { accepted: true, state: next, events };
}

function applyKeepVs(state: GameState, command: KeepVsCommand): CommandResult {
  if (state.turnStage !== "START_OF_TURN_VS_ACTION") return reject(state, "WRONG_STAGE");
  const player = state.players[command.playerId];
  if (player.vs === null || player.vsPosition === null) return reject(state, "NO_VS");
  const events: EngineEvent[] = [{ type: "VS_KEPT", playerId: command.playerId, instanceId: player.vs }];
  const next = moveToEffectActions(state, events);
  return { accepted: true, state: next, events };
}

function applyChangeVsPosition(state: GameState, command: ChangeVsPositionCommand): CommandResult {
  if (state.turnStage !== "START_OF_TURN_VS_ACTION") return reject(state, "WRONG_STAGE");
  const player = state.players[command.playerId];
  if (player.vs === null || player.vsPosition === null) return reject(state, "NO_VS");
  if (player.vsPosition === command.position) return reject(state, "POSITION_UNCHANGED");
  const events: EngineEvent[] = [{ type: "VS_POSITION_CHANGED", playerId: command.playerId, instanceId: player.vs, from: player.vsPosition, to: command.position }];
  let next = withPlayer(state, { ...player, vsPosition: command.position });
  next = moveToEffectActions(next, events);
  return { accepted: true, state: next, events };
}

function applyReplaceVs(state: GameState, command: ReplaceVsCommand): CommandResult {
  if (state.turnStage !== "START_OF_TURN_VS_ACTION") return reject(state, "WRONG_STAGE");
  const player = state.players[command.playerId];
  if (player.vs === null || player.vsPosition === null) return reject(state, "NO_VS");
  if (!player.hand.includes(command.cardInstanceId)) return reject(state, "CARD_NOT_IN_HAND");

  const oldVs = player.vs;
  const opponentId = opponentOf(command.playerId);
  const opponent = state.players[opponentId];
  const nextPlayer: PlayerState = { ...player, hand: player.hand.filter((id) => id !== command.cardInstanceId), vs: command.cardInstanceId, vsPosition: command.position };
  const nextOpponent: PlayerState = { ...opponent, zoneX: [...opponent.zoneX, oldVs] };
  const events: EngineEvent[] = [
    { type: "CARD_MOVED", playerId: command.playerId, instanceId: oldVs, from: "VS", to: "ZONE_X", reason: "VOLUNTARY_VS_REPLACEMENT" },
    { type: "VS_REPLACED", playerId: command.playerId, oldInstanceId: oldVs, newInstanceId: command.cardInstanceId, position: command.position }
  ];
  let next: GameState = { ...state, players: { ...state.players, [command.playerId]: nextPlayer, [opponentId]: nextOpponent } };
  next = withInstances(next, [{ ...state.cardInstances[oldVs]!, zone: "ZONE_X" }, { ...state.cardInstances[command.cardInstanceId]!, zone: "VS" }]);
  next = moveToEffectActions(next, events);
  return { accepted: true, state: next, events };
}

function applyPlayEffect(state: GameState, command: PlayEffectCommand): CommandResult {
  if (state.turnStage !== "EFFECT_ACTIONS") return reject(state, "WRONG_STAGE");
  if (state.pendingResolution !== null) return reject(state, "RESOLUTION_PENDING");
  const player = state.players[command.playerId];
  if (player.vs === null) return reject(state, "NO_VS");
  if (!player.hand.includes(command.cardInstanceId)) return reject(state, "CARD_NOT_IN_HAND");
  const instance = state.cardInstances[command.cardInstanceId];
  if (!instance) return reject(state, "CARD_NOT_IN_HAND");
  const definition = state.cardDefinitions[instance.definitionId];
  if (!definition?.hasPlayableEffect) return reject(state, "CARD_HAS_NO_EFFECT");
  if (player.effectZone.length >= effectCapacity(state, command.playerId)) {
    const slotCount = player.effectZone.length;
    const slotLimit = Math.max(0, 5 - state.ruleModifiers.filter((modifier) => modifier.affectedPlayerId === command.playerId && modifier.kind === "EFFECT_SLOT_LOCK").reduce((total, modifier) => total + modifier.value, 0));
    return reject(state, slotCount >= slotLimit ? "EFFECT_ZONE_FULL" : "INSUFFICIENT_STA");
  }

  const nextPlayer: PlayerState = { ...player, hand: player.hand.filter((id) => id !== command.cardInstanceId), effectZone: [...player.effectZone, command.cardInstanceId] };
  const events: EngineEvent[] = [
    { type: "CARD_MOVED", playerId: command.playerId, instanceId: command.cardInstanceId, from: "HAND", to: "EFFECT", reason: "PLAY_EFFECT" },
    { type: "EFFECT_PLAYED", playerId: command.playerId, instanceId: command.cardInstanceId }
  ];
  let next = withPlayer(state, nextPlayer);
  next = withInstances(next, [{ ...instance, zone: "EFFECT" }]);
  next = {
    ...next,
    effectCardsPlayedThisTurn: state.effectCardsPlayedThisTurn + 1,
    pendingResolution: { kind: "CARD_EFFECT", sourceInstanceId: command.cardInstanceId, actingPlayerId: command.playerId, remainingChoiceIds: [] }
  };
  return { accepted: true, state: next, events };
}

function applyRemoveOwnEffect(state: GameState, command: RemoveOwnEffectCommand): CommandResult {
  if (state.turnStage !== "EFFECT_ACTIONS") return reject(state, "WRONG_STAGE");
  if (state.pendingResolution !== null) return reject(state, "RESOLUTION_PENDING");
  if (state.effectCardsPlayedThisTurn > 0) return reject(state, "EFFECT_REMOVAL_WINDOW_CLOSED");
  const player = state.players[command.playerId];
  if (!player.effectZone.includes(command.cardInstanceId)) return reject(state, "CARD_NOT_IN_EFFECT_ZONE");

  const opponentId = opponentOf(command.playerId);
  const opponent = state.players[opponentId];
  const instance = state.cardInstances[command.cardInstanceId]!;
  const nextPlayer: PlayerState = { ...player, effectZone: player.effectZone.filter((id) => id !== command.cardInstanceId) };
  const nextOpponent: PlayerState = { ...opponent, zoneX: [...opponent.zoneX, command.cardInstanceId] };
  let next: GameState = {
    ...state,
    players: { ...state.players, [command.playerId]: nextPlayer, [opponentId]: nextOpponent },
    cardInstances: { ...state.cardInstances, [command.cardInstanceId]: { ...instance, zone: "ZONE_X" } }
  };
  next = removeEffectSourceState(next, command.cardInstanceId);
  const events: EngineEvent[] = [
    { type: "CARD_MOVED", playerId: command.playerId, instanceId: command.cardInstanceId, from: "EFFECT", to: "ZONE_X", reason: "VOLUNTARY_EFFECT_REMOVAL" },
    { type: "EFFECT_REMOVED", playerId: command.playerId, instanceId: command.cardInstanceId }
  ];
  return { accepted: true, state: next, events };
}

export function applyCommand(state: GameState, command: Command): CommandResult {
  if (state.status !== "ACTIVE") return reject(state, "MATCH_NOT_ACTIVE");
  if (command.playerId !== state.activePlayerId) return reject(state, "NOT_ACTIVE_PLAYER");

  switch (command.type) {
    case "DISCARD_FOR_HAND_LIMIT": return applyDiscardForHandLimit(state, command);
    case "DEPLOY_VS": return applyDeployVs(state, command);
    case "KEEP_VS": return applyKeepVs(state, command);
    case "CHANGE_VS_POSITION": return applyChangeVsPosition(state, command);
    case "REPLACE_VS": return applyReplaceVs(state, command);
    case "PLAY_EFFECT": return applyPlayEffect(state, command);
    case "REMOVE_OWN_EFFECT": return applyRemoveOwnEffect(state, command);
  }
}
