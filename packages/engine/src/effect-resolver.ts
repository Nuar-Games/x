import type { EngineEvent } from "./commands.ts";
import { effectiveStat, removeExcessEffects, requiredExcessEffectCount } from "./effects.ts";
import { opponentOf } from "./internal/turn-helpers.ts";
import { scoreIfDeckExhausted } from "./scoring.ts";
import type {
  CardInstanceId,
  EffectSpec,
  GameState,
  ModifierDuration,
  PlayerId,
  StatModifier
} from "./state.ts";
import { moveCard, moveCardsSimultaneously, type MoveCardInput } from "./zones.ts";

function targetVs(state: GameState, actingPlayerId: PlayerId, target: "OWN_VS" | "OPPONENT_VS"): CardInstanceId | null {
  return target === "OWN_VS" ? state.players[actingPlayerId].vs : state.players[opponentOf(actingPlayerId)].vs;
}

function playerForVs(state: GameState, instanceId: CardInstanceId): PlayerId | null {
  for (const playerId of ["P1", "P2"] as const) {
    if (state.players[playerId].vs === instanceId) return playerId;
  }
  return null;
}

/** Takes the next modifier number. Ids and stat order are never reused, even after removal. */
function takeSequence(state: GameState): { state: GameState; sequence: number } {
  const sequence = state.modifierSequence + 1;
  return { state: { ...state, modifierSequence: sequence }, sequence };
}

function markSourceContinuous(state: GameState, sourceInstanceId: CardInstanceId): GameState {
  if (state.activeContinuousEffectIds.includes(sourceInstanceId)) return state;
  return { ...state, activeContinuousEffectIds: [...state.activeContinuousEffectIds, sourceInstanceId] };
}

/** Flatten SEQUENCE while carrying its duration down to contained stat steps. */
function normalizeSteps(spec: EffectSpec, inheritedDuration?: ModifierDuration): EffectSpec[] {
  if (spec.family === "SEQUENCE") {
    const duration = spec.duration ?? inheritedDuration;
    return spec.steps.flatMap((step) => normalizeSteps(step, duration));
  }
  if (spec.family === "SET_STAT" || spec.family === "MODIFY_STAT") {
    return [{ ...spec, duration: spec.duration ?? inheritedDuration ?? "WHILE_SOURCE_ACTIVE" }];
  }
  return [spec];
}

function pauseForChoice(
  state: GameState,
  sourceInstanceId: CardInstanceId,
  actingPlayerId: PlayerId,
  choiceKind: "DISCARD_OWN_HAND" | "REMOVE_EXCESS_EFFECTS",
  choiceCount: number,
  affectedPlayerId: PlayerId,
  remainingSteps: readonly EffectSpec[],
  events: EngineEvent[]
): GameState {
  events.push({ type: "EFFECT_CHOICE_REQUIRED", playerId: actingPlayerId, sourceInstanceId, count: choiceCount });
  return {
    ...state,
    pendingResolution: {
      kind: "EFFECT_CHOICE",
      sourceInstanceId,
      actingPlayerId,
      choiceKind,
      choiceCount,
      affectedPlayerId,
      remainingSteps
    }
  };
}

/** GAME_RULES.md §5: a VS whose STA reaches 0 is destroyed immediately, mid-effect. */
function destroyVsAtZeroSta(state: GameState, targetInstanceId: CardInstanceId, events: EngineEvent[]): GameState {
  const affectedPlayerId = playerForVs(state, targetInstanceId);
  if (affectedPlayerId === null || effectiveStat(state, targetInstanceId, "STA") !== 0) return state;
  return moveCard(
    state,
    {
      instanceId: targetInstanceId,
      fromPlayerId: affectedPlayerId,
      from: "VS",
      toPlayerId: opponentOf(affectedPlayerId),
      to: "ZONE_X",
      reason: "EFFECT_DESTROYED"
    },
    events
  );
}

/**
 * GAME_RULES.md §5 / §18A (KAPORES): STA capacity is recalculated once, after
 * every instruction of the effect has been applied. If a player now holds
 * more Effect cards than their VS allows, the player whose effect caused it
 * chooses which cards go to Zone Tepi.
 */
function checkCapacityAfterEffect(
  state: GameState,
  sourceInstanceId: CardInstanceId,
  actingPlayerId: PlayerId,
  events: EngineEvent[]
): GameState {
  for (const playerId of [actingPlayerId, opponentOf(actingPlayerId)]) {
    const excess = requiredExcessEffectCount(state, playerId);
    if (excess > 0) {
      return pauseForChoice(state, sourceInstanceId, actingPlayerId, "REMOVE_EXCESS_EFFECTS", excess, playerId, [], events);
    }
  }
  return state;
}

function addStatModifier(
  state: GameState,
  sourceInstanceId: CardInstanceId,
  actingPlayerId: PlayerId,
  spec: Extract<EffectSpec, { family: "SET_STAT" | "MODIFY_STAT" }>,
  events: EngineEvent[]
): GameState {
  const targetInstanceId = targetVs(state, actingPlayerId, spec.target);
  if (targetInstanceId === null) return state;
  const taken = takeSequence(state);
  const order = taken.sequence;
  const duration = spec.duration ?? "WHILE_SOURCE_ACTIVE";
  const modifier: StatModifier = spec.family === "SET_STAT"
    ? {
        id: `${sourceInstanceId}:stat:${order}`,
        sourceInstanceId,
        targetInstanceId,
        order,
        duration,
        kind: "SET",
        stat: spec.stat,
        value: spec.value
      }
    : {
        id: `${sourceInstanceId}:stat:${order}`,
        sourceInstanceId,
        targetInstanceId,
        order,
        duration,
        kind: "ADD",
        stat: spec.stat,
        value: spec.delta
      };

  let next: GameState = { ...taken.state, statModifiers: [...taken.state.statModifiers, modifier] };
  if (duration === "WHILE_SOURCE_ACTIVE") next = markSourceContinuous(next, sourceInstanceId);
  if (spec.stat === "STA") next = destroyVsAtZeroSta(next, targetInstanceId, events);
  return next;
}

function resolveNormalizedSteps(
  state: GameState,
  sourceInstanceId: CardInstanceId,
  actingPlayerId: PlayerId,
  steps: readonly EffectSpec[],
  events: EngineEvent[]
): GameState {
  let next = state;

  for (let index = 0; index < steps.length; index += 1) {
    if (next.pendingResolution !== null) return next;
    const step = steps[index]!;
    const remainingSteps = steps.slice(index + 1);

    switch (step.family) {
      case "SEQUENCE":
        throw new Error("normalized Effect steps cannot contain SEQUENCE");

      case "DRAW": {
        for (let count = 0; count < step.count; count += 1) {
          const drawnId = next.players[actingPlayerId].deck[0];
          if (drawnId === undefined) break;
          next = moveCard(
            next,
            { instanceId: drawnId, fromPlayerId: actingPlayerId, from: "DECK", toPlayerId: actingPlayerId, to: "HAND", reason: "EFFECT_DRAW" },
            events
          );
          events.push({ type: "CARD_DRAWN", playerId: actingPlayerId, instanceId: drawnId });
        }
        break;
      }

      case "SET_STAT":
      case "MODIFY_STAT":
        next = addStatModifier(next, sourceInstanceId, actingPlayerId, step, events);
        break;

      case "DESTROY_ALL": {
        const opponentId = opponentOf(actingPlayerId);
        const moves: MoveCardInput[] = next.players[opponentId].effectZone.map((instanceId) => ({
          instanceId,
          fromPlayerId: opponentId,
          from: "EFFECT" as const,
          toPlayerId: actingPlayerId,
          to: "ZONE_X" as const,
          reason: "EFFECT_DESTROYED" as const
        }));
        if (moves.length > 0) next = moveCardsSimultaneously(next, moves, events);
        break;
      }

      case "SET_POSITION": {
        const opponentId = opponentOf(actingPlayerId);
        const vs = next.players[opponentId].vs;
        const from = next.players[opponentId].vsPosition;
        if (vs !== null && from !== null && from !== step.position) {
          next = {
            ...next,
            players: {
              ...next.players,
              [opponentId]: { ...next.players[opponentId], vsPosition: step.position }
            }
          };
          events.push({ type: "VS_POSITION_CHANGED", playerId: opponentId, instanceId: vs, from, to: step.position });
        }
        break;
      }

      case "BLOCK_ATTACKS": {
        const affectedPlayerId = opponentOf(actingPlayerId);
        const taken = takeSequence(next);
        next = {
          ...taken.state,
          ruleModifiers: [
            ...taken.state.ruleModifiers,
            {
              id: `${sourceInstanceId}:rule:${taken.sequence}`,
              sourceInstanceId,
              affectedPlayerId,
              kind: "ATTACK_RESTRICTION",
              value: step.count,
              expiresOn: ["CONSUMED", "SOURCE_LEAVES_EFFECT_ZONE"]
            }
          ]
        };
        next = markSourceContinuous(next, sourceInstanceId);
        break;
      }

      case "DISCARD_CHOSEN":
        next = pauseForChoice(
          next,
          sourceInstanceId,
          actingPlayerId,
          "DISCARD_OWN_HAND",
          step.count,
          actingPlayerId,
          remainingSteps,
          events
        );
        break;
    }
  }

  if (next.pendingResolution !== null) return next;
  next = checkCapacityAfterEffect(next, sourceInstanceId, actingPlayerId, events);
  if (next.pendingResolution !== null) return next;
  return scoreIfDeckExhausted(next, events);
}

export function resolveCardEffect(
  state: GameState,
  sourceInstanceId: CardInstanceId,
  actingPlayerId: PlayerId,
  events: EngineEvent[]
): GameState {
  const instance = state.cardInstances[sourceInstanceId];
  const definition = instance ? state.cardDefinitions[instance.definitionId] : undefined;
  if (!definition?.effect) return state;

  const steps = normalizeSteps(definition.effect);
  const next = resolveNormalizedSteps(state, sourceInstanceId, actingPlayerId, steps, events);
  if (next.pendingResolution === null) events.push({ type: "EFFECT_RESOLVED", playerId: actingPlayerId, sourceInstanceId });
  return next;
}

export function resolveEffectChoice(
  state: GameState,
  cardInstanceIds: readonly CardInstanceId[],
  events: EngineEvent[]
): GameState {
  const pending = state.pendingResolution;
  if (pending === null) throw new Error("NO_PENDING_RESOLUTION");
  if (cardInstanceIds.length !== pending.choiceCount) throw new Error("WRONG_EFFECT_CHOICE_COUNT");
  if (new Set(cardInstanceIds).size !== cardInstanceIds.length) throw new Error("INVALID_EFFECT_CHOICE");

  let next: GameState = { ...state, pendingResolution: null };
  if (pending.choiceKind === "DISCARD_OWN_HAND") {
    if (!cardInstanceIds.every((id) => state.players[pending.affectedPlayerId].hand.includes(id))) throw new Error("INVALID_EFFECT_CHOICE");
    for (const instanceId of cardInstanceIds) {
      next = moveCard(
        next,
        {
          instanceId,
          fromPlayerId: pending.affectedPlayerId,
          from: "HAND",
          toPlayerId: pending.affectedPlayerId,
          to: "ZONE_TEPI",
          reason: "EFFECT_DISCARD"
        },
        events
      );
    }
  } else {
    if (!cardInstanceIds.every((id) => state.players[pending.affectedPlayerId].effectZone.includes(id))) throw new Error("INVALID_EFFECT_CHOICE");
    next = removeExcessEffects(next, pending.affectedPlayerId, cardInstanceIds, events);
  }

  next = resolveNormalizedSteps(next, pending.sourceInstanceId, pending.actingPlayerId, pending.remainingSteps, events);
  if (next.pendingResolution === null) {
    events.push({ type: "EFFECT_RESOLVED", playerId: pending.actingPlayerId, sourceInstanceId: pending.sourceInstanceId });
  }
  return next;
}