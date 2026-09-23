import type {
  CardDefinitionSnapshot,
  CardInstanceId,
  GameState,
  PlayerId,
  Stat,
  StatModifier
} from "./state.ts";
import { moveCard } from "./zones.ts";

export const NORMAL_EFFECT_ZONE_LIMIT = 5;

function definitionForInstance(state: GameState, instanceId: CardInstanceId): CardDefinitionSnapshot {
  const instance = state.cardInstances[instanceId];
  if (!instance) throw new Error(`missing card instance: ${instanceId}`);
  const definition = state.cardDefinitions[instance.definitionId];
  if (!definition) throw new Error(`missing card definition: ${instance.definitionId}`);
  return definition;
}

function sortedModifiers(state: GameState, instanceId: CardInstanceId): StatModifier[] {
  return state.statModifiers.filter((modifier) => modifier.targetInstanceId === instanceId).sort((a, b) => a.order - b.order);
}

/** GAME_RULES.md §15: printed → set → swap → +/− → multiply, then floor at 0. */
export function effectiveStats(state: GameState, instanceId: CardInstanceId): Readonly<Record<Stat, number>> {
  const definition = definitionForInstance(state, instanceId);
  let atk = definition.atk;
  let def = definition.def;
  let sta = definition.sta;
  const modifiers = sortedModifiers(state, instanceId);

  for (const modifier of modifiers) {
    if (modifier.kind !== "SET") continue;
    if (modifier.stat === "ATK") atk = modifier.value;
    if (modifier.stat === "DEF") def = modifier.value;
    if (modifier.stat === "STA") sta = modifier.value;
  }
  for (const modifier of modifiers) {
    if (modifier.kind !== "SWAP_ATK_DEF") continue;
    [atk, def] = [def, atk];
  }
  for (const modifier of modifiers) {
    if (modifier.kind !== "ADD") continue;
    if (modifier.stat === "ATK") atk += modifier.value;
    if (modifier.stat === "DEF") def += modifier.value;
    if (modifier.stat === "STA") sta += modifier.value;
  }
  for (const modifier of modifiers) {
    if (modifier.kind !== "MULTIPLY") continue;
    if (modifier.stat === "ATK") atk *= modifier.factor;
    if (modifier.stat === "DEF") def *= modifier.factor;
    if (modifier.stat === "STA") sta *= modifier.factor;
  }

  return { ATK: Math.max(0, atk), DEF: Math.max(0, def), STA: Math.max(0, sta) };
}

export function effectiveStat(state: GameState, instanceId: CardInstanceId, stat: Stat): number {
  return effectiveStats(state, instanceId)[stat];
}

/** Normal five slots minus active slot locks; existing cards are not removed by the lock. */
export function effectSlotLimit(state: GameState, playerId: PlayerId): number {
  const locked = state.ruleModifiers
    .filter((modifier) => modifier.affectedPlayerId === playerId && modifier.kind === "EFFECT_SLOT_LOCK")
    .reduce((total, modifier) => total + modifier.value, 0);
  return Math.max(0, NORMAL_EFFECT_ZONE_LIMIT - locked);
}

/** Max number of Effect cards allowed by both current VS STA and slot limit. */
export function effectCapacity(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  if (player.vs === null) return 0;
  const sta = effectiveStat(state, player.vs, "STA");
  return Math.min(effectSlotLimit(state, playerId), Math.max(0, sta - 1));
}

export function requiredExcessEffectCount(state: GameState, playerId: PlayerId): number {
  return Math.max(0, state.players[playerId].effectZone.length - effectCapacity(state, playerId));
}

/**
 * Applies the established forced-excess rule after effective STA changes.
 * The effect resolver supplies the exact cards chosen by the player entitled to choose.
 */
export function removeExcessEffects(
  state: GameState,
  affectedPlayerId: PlayerId,
  chosenIds: readonly CardInstanceId[]
): GameState {
  const required = requiredExcessEffectCount(state, affectedPlayerId);
  if (chosenIds.length !== required) throw new Error(`expected ${required} excess Effect card(s)`);
  if (new Set(chosenIds).size !== chosenIds.length) throw new Error("duplicate excess Effect choice");
  if (!chosenIds.every((id) => state.players[affectedPlayerId].effectZone.includes(id))) {
    throw new Error("excess Effect choice is not in Effect Zone");
  }

  let next = state;
  for (const id of chosenIds) {
    next = moveCard(next, {
      instanceId: id,
      fromPlayerId: affectedPlayerId,
      from: "EFFECT",
      toPlayerId: affectedPlayerId,
      to: "ZONE_TEPI"
    });
  }
  return next;
}

/** Backward-compatible helper for tests/resolvers that only need source-bound cleanup. */
export function removeEffectSourceState(state: GameState, sourceInstanceId: CardInstanceId): GameState {
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
