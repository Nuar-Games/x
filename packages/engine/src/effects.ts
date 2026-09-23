import type {
  CardDefinitionSnapshot,
  CardInstanceId,
  GameState,
  PlayerId,
  Stat,
  StatModifier
} from "./state.ts";
import type { EngineEvent } from "./commands.ts";
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

/**
 * GAME_RULES.md §15 order: printed → set → swap → +/− → multiply, in play order
 * within each step. GAME_RULES.md §5: any reduction that would push a stat
 * below 0 stops at 0, so the floor is applied after every single modifier,
 * not only to the final total.
 */
export function effectiveStats(state: GameState, instanceId: CardInstanceId): Readonly<Record<Stat, number>> {
  const definition = definitionForInstance(state, instanceId);
  const stats: Record<Stat, number> = { ATK: definition.atk, DEF: definition.def, STA: definition.sta };
  const floor = (stat: Stat) => {
    stats[stat] = Math.max(0, stats[stat]);
  };
  const modifiers = sortedModifiers(state, instanceId);

  for (const modifier of modifiers) {
    if (modifier.kind !== "SET") continue;
    stats[modifier.stat] = modifier.value;
    floor(modifier.stat);
  }
  for (const modifier of modifiers) {
    if (modifier.kind !== "SWAP_ATK_DEF") continue;
    [stats.ATK, stats.DEF] = [stats.DEF, stats.ATK];
  }
  for (const modifier of modifiers) {
    if (modifier.kind !== "ADD") continue;
    stats[modifier.stat] += modifier.value;
    floor(modifier.stat);
  }
  for (const modifier of modifiers) {
    if (modifier.kind !== "MULTIPLY") continue;
    stats[modifier.stat] *= modifier.factor;
    floor(modifier.stat);
  }
  return stats;
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
  chosenIds: readonly CardInstanceId[],
  events: EngineEvent[]
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
      to: "ZONE_TEPI",
      reason: "STA_EXCESS_REMOVAL"
    }, events);
  }
  return next;
}
