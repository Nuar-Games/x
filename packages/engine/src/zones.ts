import type {
  CardInstanceId,
  GameState,
  PlayerId,
  PlayerState,
  VsPosition,
  Zone
} from "./state.ts";

export interface MoveCardInput {
  readonly instanceId: CardInstanceId;
  readonly fromPlayerId: PlayerId;
  readonly from: Zone;
  readonly toPlayerId: PlayerId;
  readonly to: Zone;
  readonly toVsPosition?: VsPosition;
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

function cleanEffectSourceState(state: GameState, sourceInstanceId: CardInstanceId): GameState {
  return {
    ...state,
    statModifiers: state.statModifiers.filter(
      (modifier) => !(modifier.sourceInstanceId === sourceInstanceId && modifier.duration === "WHILE_SOURCE_ACTIVE")
    ),
    ruleModifiers: state.ruleModifiers.filter(
      (modifier) => !(modifier.sourceInstanceId === sourceInstanceId && modifier.expiry === "SOURCE_LEAVES_EFFECT_ZONE")
    ),
    activeContinuousEffectIds: state.activeContinuousEffectIds.filter((id) => id !== sourceInstanceId)
  };
}

/**
 * The only normal engine primitive for moving an existing card between zones.
 * Zone X is absolute: once a card is there, no later transition can move it out.
 */
export function moveCard(state: GameState, input: MoveCardInput): GameState {
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
      : {
          ...state.players,
          [input.fromPlayerId]: removedFromSource,
          [input.toPlayerId]: addedToDestination
        },
    cardInstances: {
      ...state.cardInstances,
      [input.instanceId]: { ...instance, zone: input.to }
    }
  };

  if (input.from === "EFFECT" && input.to !== "EFFECT") {
    next = cleanEffectSourceState(next, input.instanceId);
  }
  return next;
}
