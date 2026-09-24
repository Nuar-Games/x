/**
 * Per-player views (D-018). The X2 renderer receives these, never GameState.
 *
 * A view contains only what `viewerId` is allowed to know:
 * - own hand: full card identities;
 * - opponent hand: count only;
 * - both decks: count only, never instance ids or order;
 * - VS, Effect Zones, Zone X, Zone Tepi, turn/round/score/status: public.
 *
 * `eventsFor` applies the same rule to the event stream, so animations
 * cannot leak a hidden card either. Both are pure, deterministic and return
 * plain JSON-serializable data.
 */
import type { EngineEvent } from "./commands.ts";
import { effectCapacity, effectiveStats, effectSlotLimit } from "./effects.ts";
import { handLimitFor } from "./hand-limit.ts";
import { opponentOf } from "./internal/turn-helpers.ts";
import type {
  CardDefinitionId,
  CardInstanceId,
  GameState,
  PendingEffectChoiceKind,
  PlayerId,
  RuleModifierKind,
  TurnStage,
  VsPosition,
  Winner,
  Zone,
  MatchStatus
} from "./state.ts";

export interface CardStatsView {
  readonly atk: number;
  readonly def: number;
  readonly sta: number;
}

export interface CardView {
  readonly instanceId: CardInstanceId;
  readonly definitionId: CardDefinitionId;
  readonly name: string;
  readonly ownerId: PlayerId;
  readonly printed: CardStatsView;
  /** After active modifiers (GAME_RULES.md §15). Equal to printed outside the VS Zone unless an effect targets it. */
  readonly effective: CardStatsView;
  readonly hasEffect: boolean;
}

interface PublicZonesView {
  readonly playerId: PlayerId;
  readonly deckCount: number;
  readonly vs: CardView | null;
  readonly vsPosition: VsPosition | null;
  readonly effectZone: readonly CardView[];
  readonly zoneX: readonly CardView[];
  readonly zoneTepi: readonly CardView[];
  readonly score: number;
  readonly effectCapacity: number;
  readonly effectSlotLimit: number;
  readonly turnsStarted: number;
}

export interface OwnPlayerView extends PublicZonesView {
  readonly hand: readonly CardView[];
  readonly handLimit: number;
}

export interface OpponentPlayerView extends PublicZonesView {
  readonly handCount: number;
}

export interface RuleModifierView {
  readonly kind: RuleModifierKind;
  readonly affectedPlayerId: PlayerId;
  readonly sourceInstanceId: CardInstanceId;
  readonly value: number;
}

export interface PendingChoiceView {
  readonly choiceKind: PendingEffectChoiceKind;
  readonly choiceCount: number;
  readonly actingPlayerId: PlayerId;
  readonly affectedPlayerId: PlayerId;
  readonly sourceInstanceId: CardInstanceId;
}

export interface PlayerView {
  readonly viewerId: PlayerId;
  readonly rulesVersion: string;
  readonly cardSetVersion: string;
  readonly matchId: string;
  readonly status: MatchStatus;
  readonly winner: Winner;
  readonly activePlayerId: PlayerId;
  readonly isViewerTurn: boolean;
  readonly turnNumber: number;
  readonly turnStage: TurnStage;
  readonly roundNumber: number;
  readonly arenaCollapseInactiveTurns: number;
  readonly you: OwnPlayerView;
  readonly opponent: OpponentPlayerView;
  readonly ruleModifiers: readonly RuleModifierView[];
  readonly pendingChoice: PendingChoiceView | null;
}

function cardView(state: GameState, instanceId: CardInstanceId): CardView {
  const instance = state.cardInstances[instanceId];
  if (!instance) throw new Error(`missing card instance: ${instanceId}`);
  const definition = state.cardDefinitions[instance.definitionId];
  if (!definition) throw new Error(`missing card definition: ${instance.definitionId}`);
  const effective = effectiveStats(state, instanceId);
  return {
    instanceId,
    definitionId: definition.id,
    name: definition.name,
    ownerId: instance.ownerId,
    printed: { atk: definition.atk, def: definition.def, sta: definition.sta },
    effective: { atk: effective.ATK, def: effective.DEF, sta: effective.STA },
    hasEffect: definition.effect !== undefined
  };
}

function publicZones(state: GameState, playerId: PlayerId): PublicZonesView {
  const player = state.players[playerId];
  const cards = (ids: readonly CardInstanceId[]) => ids.map((id) => cardView(state, id));
  return {
    playerId,
    deckCount: player.deck.length,
    vs: player.vs === null ? null : cardView(state, player.vs),
    vsPosition: player.vsPosition,
    effectZone: cards(player.effectZone),
    zoneX: cards(player.zoneX),
    zoneTepi: cards(player.zoneTepi),
    score: player.zoneX.length,
    effectCapacity: player.vs === null ? 0 : effectCapacity(state, playerId),
    effectSlotLimit: effectSlotLimit(state, playerId),
    turnsStarted: player.turnsStarted
  };
}

/** Everything `viewerId` may see, and nothing else. */
export function viewFor(state: GameState, viewerId: PlayerId): PlayerView {
  const opponentId = opponentOf(viewerId);
  const pending = state.pendingResolution;
  return {
    viewerId,
    rulesVersion: state.rulesVersion,
    cardSetVersion: state.cardSetVersion,
    matchId: state.matchId,
    status: state.status,
    winner: state.winner,
    activePlayerId: state.activePlayerId,
    isViewerTurn: state.activePlayerId === viewerId,
    turnNumber: state.turnNumber,
    turnStage: state.turnStage,
    roundNumber: state.roundNumber,
    arenaCollapseInactiveTurns: state.arenaCollapseInactiveTurns,
    you: {
      ...publicZones(state, viewerId),
      hand: state.players[viewerId].hand.map((id) => cardView(state, id)),
      handLimit: handLimitFor(state, viewerId)
    },
    opponent: {
      ...publicZones(state, opponentId),
      handCount: state.players[opponentId].hand.length
    },
    ruleModifiers: state.ruleModifiers.map((modifier) => ({
      kind: modifier.kind,
      affectedPlayerId: modifier.affectedPlayerId,
      sourceInstanceId: modifier.sourceInstanceId,
      value: modifier.value
    })),
    pendingChoice:
      pending === null
        ? null
        : {
            choiceKind: pending.choiceKind,
            choiceCount: pending.choiceCount,
            actingPlayerId: pending.actingPlayerId,
            affectedPlayerId: pending.affectedPlayerId,
            sourceInstanceId: pending.sourceInstanceId
          }
  };
}

type CardDrawnEvent = Extract<EngineEvent, { type: "CARD_DRAWN" }>;
type CardMovedEvent = Extract<EngineEvent, { type: "CARD_MOVED" }>;

/** An event as one player may see it. Hidden card identities are replaced by null. */
export type ViewEvent =
  | Exclude<EngineEvent, CardDrawnEvent | CardMovedEvent>
  | (Omit<CardDrawnEvent, "instanceId"> & { readonly instanceId: CardInstanceId | null })
  | (Omit<CardMovedEvent, "instanceId"> & { readonly instanceId: CardInstanceId | null });

function isHiddenFrom(viewerId: PlayerId, zone: Zone, zoneOwnerId: PlayerId): boolean {
  return zone === "DECK" || (zone === "HAND" && zoneOwnerId !== viewerId);
}

/**
 * The event stream as `viewerId` may see it. A card that stays hidden from the
 * viewer on both ends of a move (e.g. the opponent drawing) keeps its zones and
 * reason but loses its identity. A card that becomes public keeps its identity.
 */
export function eventsFor(events: readonly EngineEvent[], viewerId: PlayerId): ViewEvent[] {
  return events.map((event): ViewEvent => {
    if (event.type === "CARD_DRAWN") {
      return event.playerId === viewerId ? event : { ...event, instanceId: null };
    }
    if (event.type === "CARD_MOVED") {
      const hidden = isHiddenFrom(viewerId, event.from, event.fromPlayerId) && isHiddenFrom(viewerId, event.to, event.toPlayerId);
      return hidden ? { ...event, instanceId: null } : event;
    }
    return event;
  });
}
