/**
 * Zone transitions (ARCHITECTURE.md §12) and engine-driven round end (GAME_RULES.md §12).
 *
 * Every card movement in the engine goes through `moveCard` or
 * `moveCardsSimultaneously`. They:
 * - enforce Zone X immutability and source-zone validity;
 * - clean up state owned by an Effect card when it leaves the Effect Zone;
 * - emit a CARD_MOVED event for every move;
 * - END THE ROUND AUTOMATICALLY whenever a VS leaves the VS Zone, for any
 *   reason (destruction, capture, voluntary replacement, return to deck,
 *   any card effect). Callers never trigger round end themselves.
 */
import type { EngineEvent, MoveReason } from "./commands.ts";
import type { CardInstanceId, GameState, PlayerId, PlayerState, VsPosition, Zone } from "./state.ts";

export interface MoveCardInput {
  readonly instanceId: CardInstanceId;
  readonly fromPlayerId: PlayerId;
  readonly from: Zone;
  readonly toPlayerId: PlayerId;
  readonly to: Zone;
  readonly toVsPosition?: VsPosition;
  readonly reason: MoveReason;
}

function zoneContains(player: PlayerState, zone: Zone, instanceId: CardInstanceId): boolean {
  switch (zone) {
    case "DECK": return player.deck.includes(instanceId);
    case "HAND": return player.hand.includes(instanceId);
    case "VS": return player.vs === instanceId;
    case "EFFECT": return player.effectZone.includes(instanceId);
    case "ZONE_X": return player.zoneX.includes(instanceId);
    case "ZONE_TEPI": return player.zoneTepi.includes(instanceId);
  }
}

function removeFromZone(player: PlayerState, zone: Zone, instanceId: CardInstanceId): PlayerState {
  switch (zone) {
    case "DECK": return { ...player, deck: player.deck.filter((id) => id !== instanceId) };
    case "HAND": return { ...player, hand: player.hand.filter((id) => id !== instanceId) };
    case "VS": return { ...player, vs: null, vsPosition: null };
    case "EFFECT": return { ...player, effectZone: player.effectZone.filter((id) => id !== instanceId) };
    case "ZONE_X": throw new Error("ZONE_X_IMMUTABLE");
    case "ZONE_TEPI": return { ...player, zoneTepi: player.zoneTepi.filter((id) => id !== instanceId) };
  }
}

function addToZone(player: PlayerState, zone: Zone, instanceId: CardInstanceId, toVsPosition?: VsPosition): PlayerState {
  switch (zone) {
    case "DECK": return { ...player, deck: [...player.deck, instanceId] };
    case "HAND": return { ...player, hand: [...player.hand, instanceId] };
    case "VS": {
      if (player.vs !== null) throw new Error("VS_ZONE_OCCUPIED");
      if (toVsPosition === undefined) throw new Error("VS_POSITION_REQUIRED");
      return { ...player, vs: instanceId, vsPosition: toVsPosition };
    }
    case "EFFECT": return { ...player, effectZone: [...player.effectZone, instanceId] };
    case "ZONE_X": return { ...player, zoneX: [...player.zoneX, instanceId] };
    case "ZONE_TEPI": return { ...player, zoneTepi: [...player.zoneTepi, instanceId] };
  }
}

/** The single place that removes state owned by an Effect card that left the Effect Zone. */
function cleanEffectSourceState(state: GameState, sourceInstanceId: CardInstanceId): GameState {
  return {
    ...state,
    statModifiers: state.statModifiers.filter(
      (modifier) => !(modifier.sourceInstanceId === sourceInstanceId && modifier.duration === "WHILE_SOURCE_ACTIVE")
    ),
    ruleModifiers: state.ruleModifiers.filter(
      (modifier) => !(modifier.sourceInstanceId === sourceInstanceId && modifier.expiresOn.includes("SOURCE_LEAVES_EFFECT_ZONE"))
    ),
    activeContinuousEffectIds: state.activeContinuousEffectIds.filter((id) => id !== sourceInstanceId)
  };
}

/** One move, no round-end handling. Private: callers use moveCard / moveCardsSimultaneously. */
function applyMove(state: GameState, input: MoveCardInput, events: EngineEvent[]): GameState {
  if (input.from === "ZONE_X") throw new Error("ZONE_X_IMMUTABLE");

  const instance = state.cardInstances[input.instanceId];
  if (!instance) throw new Error(`missing card instance: ${input.instanceId}`);
  if (instance.zone !== input.from) throw new Error("SOURCE_ZONE_MISMATCH");

  const fromPlayer = state.players[input.fromPlayerId];
  if (!zoneContains(fromPlayer, input.from, input.instanceId)) throw new Error("SOURCE_ZONE_MISMATCH");

  const removedFromSource = removeFromZone(fromPlayer, input.from, input.instanceId);
  const samePlayer = input.fromPlayerId === input.toPlayerId;
  const destinationBase = samePlayer ? removedFromSource : state.players[input.toPlayerId];
  const addedToDestination = addToZone(destinationBase, input.to, input.instanceId, input.toVsPosition);

  let next: GameState = {
    ...state,
    players: samePlayer
      ? { ...state.players, [input.fromPlayerId]: addedToDestination }
      : { ...state.players, [input.fromPlayerId]: removedFromSource, [input.toPlayerId]: addedToDestination },
    cardInstances: { ...state.cardInstances, [input.instanceId]: { ...instance, zone: input.to } }
  };

  if (input.from === "EFFECT" && input.to !== "EFFECT") next = cleanEffectSourceState(next, input.instanceId);

  events.push({
    type: "CARD_MOVED",
    instanceId: input.instanceId,
    fromPlayerId: input.fromPlayerId,
    from: input.from,
    toPlayerId: input.toPlayerId,
    to: input.to,
    reason: input.reason
  });
  return next;
}

/**
 * GAME_RULES.md §12 round-end cleanup. Private: it runs only because a VS left
 * the VS Zone inside moveCard / moveCardsSimultaneously.
 */
function endRound(state: GameState, events: EngineEvent[]): GameState {
  let next = state;
  for (const playerId of ["P1", "P2"] as const) {
    for (const instanceId of [...next.players[playerId].effectZone]) {
      next = applyMove(
        next,
        { instanceId, fromPlayerId: playerId, from: "EFFECT", toPlayerId: playerId, to: "ZONE_TEPI", reason: "ROUND_END_CLEAR" },
        events
      );
    }
  }
  events.push({ type: "ROUND_ENDED", roundNumber: state.roundNumber });
  return {
    ...next,
    roundNumber: state.roundNumber + 1,
    statModifiers: next.statModifiers.filter((modifier) => modifier.duration !== "UNTIL_ROUND_END"),
    ruleModifiers: next.ruleModifiers.filter((modifier) => !modifier.expiresOn.includes("ROUND_END"))
  };
}

/** Moves one card. If it leaves the VS Zone, the round ends immediately afterwards. */
export function moveCard(state: GameState, input: MoveCardInput, events: EngineEvent[]): GameState {
  const next = applyMove(state, input, events);
  return input.from === "VS" ? endRound(next, events) : next;
}

/**
 * Moves several cards as one simultaneous event (for example, both VS destroyed
 * in an ATK = ATK battle). The round ends at most once, after all moves.
 */
export function moveCardsSimultaneously(state: GameState, inputs: readonly MoveCardInput[], events: EngineEvent[]): GameState {
  let next = state;
  for (const input of inputs) next = applyMove(next, input, events);
  return inputs.some((input) => input.from === "VS") ? endRound(next, events) : next;
}
