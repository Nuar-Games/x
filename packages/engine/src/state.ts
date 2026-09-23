import type { RngState } from "./rng.ts";

export type PlayerId = "P1" | "P2";
export type CardDefinitionId = string;
export type CardInstanceId = string;
export type MatchId = string;

export type Zone = "DECK" | "HAND" | "VS" | "EFFECT" | "ZONE_X" | "ZONE_TEPI";
export type VsPosition = "ATK" | "DEF";
export type MatchStatus = "ACTIVE" | "RESOLVED";
export type Winner = PlayerId | "DRAW" | null;

export type TurnStage =
  | "TURN_START_DRAW"
  | "HAND_LIMIT_ENFORCEMENT"
  | "REQUIRED_VS_DEPLOYMENT"
  | "START_OF_TURN_VS_ACTION"
  | "EFFECT_ACTIONS"
  | "COMBAT_OR_PASS"
  | "ARENA_COLLAPSE_CHECK"
  | "POST_COLLAPSE_DEPLOYMENT"
  | "TURN_END";

export interface PlayerState {
  readonly playerId: PlayerId;
  readonly deck: readonly CardInstanceId[];
  readonly hand: readonly CardInstanceId[];
  readonly vs: CardInstanceId | null;
  readonly vsPosition: VsPosition | null;
  readonly effectZone: readonly CardInstanceId[];
  readonly zoneX: readonly CardInstanceId[];
  readonly zoneTepi: readonly CardInstanceId[];
  /** Turns this player has started. 1 during their opening turn (GAME_RULES.md §3). */
  readonly turnsStarted: number;
}

export interface CardInstance {
  readonly instanceId: CardInstanceId;
  readonly definitionId: CardDefinitionId;
  readonly ownerId: PlayerId;
  readonly controllerId: PlayerId;
  readonly zone: Zone;
}

export type Stat = "ATK" | "DEF" | "STA";
export type ModifierDuration = "WHILE_SOURCE_ACTIVE" | "UNTIL_ROUND_END" | "UNTIL_TURN_END";

interface StatModifierBase {
  readonly id: string;
  readonly sourceInstanceId: CardInstanceId;
  readonly targetInstanceId: CardInstanceId;
  readonly order: number;
  readonly duration: ModifierDuration;
}

export type StatModifier =
  | (StatModifierBase & { readonly kind: "SET"; readonly stat: Stat; readonly value: number })
  | (StatModifierBase & { readonly kind: "SWAP_ATK_DEF" })
  | (StatModifierBase & { readonly kind: "ADD"; readonly stat: Stat; readonly value: number })
  | (StatModifierBase & { readonly kind: "MULTIPLY"; readonly stat: Stat; readonly factor: number });

export type RuleModifierKind =
  | "HAND_SIZE_LIMIT"
  | "ARENA_COLLAPSE"
  | "EFFECT_SLOT_LOCK"
  | "ATTACK_RESTRICTION";

export type RuleModifierExpiry =
  | "SOURCE_LEAVES_EFFECT_ZONE"
  | "ROUND_END"
  | "TURN_END"
  | "CONSUMED";

export interface RuleModifierState {
  readonly id: string;
  readonly sourceInstanceId: CardInstanceId;
  readonly affectedPlayerId: PlayerId;
  readonly kind: RuleModifierKind;
  readonly value: number;
  readonly expiry: RuleModifierExpiry;
}

export interface PendingResolutionState {
  readonly kind: string;
  readonly sourceInstanceId: CardInstanceId;
  readonly actingPlayerId: PlayerId;
  readonly remainingChoiceIds: readonly string[];
}

export interface GameState {
  readonly rulesVersion: string;
  readonly cardSetVersion: string;
  readonly matchId: MatchId;
  readonly rng: RngState;
  readonly activePlayerId: PlayerId;
  readonly turnNumber: number;
  readonly turnStage: TurnStage;
  readonly roundNumber: number;
  readonly arenaCollapseInactiveTurns: number;
  readonly status: MatchStatus;
  readonly winner: Winner;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly cardInstances: Readonly<Record<CardInstanceId, CardInstance>>;
  readonly statModifiers: readonly StatModifier[];
  readonly activeContinuousEffectIds: readonly CardInstanceId[];
  readonly ruleModifiers: readonly RuleModifierState[];
  readonly pendingResolution: PendingResolutionState | null;
}
