import type { CardInstanceId, GameState, PlayerId, Stat, TurnStage, VsPosition, Zone } from "./state.ts";

/**
 * Player commands (ARCHITECTURE.md §6). Types are added here only as each
 * subsystem is implemented, so a client can never send a command the engine
 * does not handle yet.
 */
export type Command =
  | DiscardForHandLimitCommand
  | DeployVsCommand
  | KeepVsCommand
  | ChangeVsPositionCommand
  | ReplaceVsCommand
  | PlayEffectCommand
  | RemoveOwnEffectCommand
  | AttackCommand
  | PassCommand;

/** GAME_RULES.md §3: over the hand limit after drawing, discard down before other actions. */
export interface DiscardForHandLimitCommand {
  readonly type: "DISCARD_FOR_HAND_LIMIT";
  readonly playerId: PlayerId;
  /** Exactly (hand size − hand limit) distinct cards from the player's hand. */
  readonly cardInstanceIds: readonly CardInstanceId[];
}

/** GAME_RULES.md §6: required deployment when the player has no VS. */
export interface DeployVsCommand {
  readonly type: "DEPLOY_VS";
  readonly playerId: PlayerId;
  readonly cardInstanceId: CardInstanceId;
  readonly position: VsPosition;
}

/** GAME_RULES.md §6: explicit keep-as-is choice for a surviving VS. */
export interface KeepVsCommand {
  readonly type: "KEEP_VS";
  readonly playerId: PlayerId;
}

/** GAME_RULES.md §8: one normal start-of-turn position change. */
export interface ChangeVsPositionCommand {
  readonly type: "CHANGE_VS_POSITION";
  readonly playerId: PlayerId;
  readonly position: VsPosition;
}

export interface PlayEffectCommand {
  readonly type: "PLAY_EFFECT";
  readonly playerId: PlayerId;
  readonly cardInstanceId: CardInstanceId;
}

export interface RemoveOwnEffectCommand {
  readonly type: "REMOVE_OWN_EFFECT";
  readonly playerId: PlayerId;
  readonly cardInstanceId: CardInstanceId;
}

/** GAME_RULES.md §6: voluntarily capture the current VS, then deploy a replacement. */
export interface ReplaceVsCommand {
  readonly type: "REPLACE_VS";
  readonly playerId: PlayerId;
  readonly cardInstanceId: CardInstanceId;
  readonly position: VsPosition;
}

/** GAME_RULES.md §9: attack with a VS in ATK position against the opponent's VS. Ends the Effect step. */
export interface AttackCommand {
  readonly type: "ATTACK";
  readonly playerId: PlayerId;
}

/** GAME_RULES.md §9: pass instead of attacking. Requires the player to have a VS. Ends the Effect step. */
export interface PassCommand {
  readonly type: "PASS";
  readonly playerId: PlayerId;
}

/** Why a card moved. Every move carries one, set by the engine (never by the client). */
export type MoveReason =
  | "DRAW"
  | "HAND_LIMIT_DISCARD"
  | "DEPLOY_VS"
  | "VOLUNTARY_VS_REPLACEMENT"
  | "PLAY_EFFECT"
  | "VOLUNTARY_EFFECT_REMOVAL"
  | "STA_EXCESS_REMOVAL"
  | "BATTLE_DESTROYED"
  | "BATTLE_TOP_DECK_CAPTURE"
  | "BATTLE_TOP_DECK_DISCARD"
  | "ROUND_END_CLEAR"
  | "ARENA_COLLAPSE";

export type RejectionCode =
  | "MATCH_NOT_ACTIVE"
  | "NOT_ACTIVE_PLAYER"
  | "WRONG_STAGE"
  | "WRONG_DISCARD_COUNT"
  | "DUPLICATE_CARD"
  | "CARD_NOT_IN_HAND"
  | "NO_VS"
  | "POSITION_UNCHANGED"
  | "CARD_NOT_IN_EFFECT_ZONE"
  | "CARD_HAS_NO_EFFECT"
  | "EFFECT_ZONE_FULL"
  | "INSUFFICIENT_STA"
  | "EFFECT_REMOVAL_WINDOW_CLOSED"
  | "RESOLUTION_PENDING"
  | "VS_NOT_IN_ATK_POSITION"
  | "NO_OPPONENT_VS";

/** Structured transition events (ARCHITECTURE.md §8). The UI animates these; it never decides outcomes. */
export type EngineEvent =
  | { readonly type: "TURN_STARTED"; readonly playerId: PlayerId; readonly turnNumber: number; readonly isOpeningTurn: boolean }
  | { readonly type: "CARD_DRAWN"; readonly playerId: PlayerId; readonly instanceId: CardInstanceId }
  | {
      readonly type: "HAND_LIMIT_EXCEEDED";
      readonly playerId: PlayerId;
      readonly handSize: number;
      readonly handLimit: number;
      readonly discardCount: number;
    }
  | {
      readonly type: "CARD_MOVED";
      readonly instanceId: CardInstanceId;
      readonly fromPlayerId: PlayerId;
      readonly from: Zone;
      readonly toPlayerId: PlayerId;
      readonly to: Zone;
      readonly reason: MoveReason;
    }
  | { readonly type: "ROUND_ENDED"; readonly roundNumber: number }
  | { readonly type: "ARENA_COLLAPSED"; readonly triggeringPlayerId: PlayerId; readonly inactiveTurns: number }
  | { readonly type: "ATTACK_DECLARED"; readonly playerId: PlayerId }
  | { readonly type: "PASSED"; readonly playerId: PlayerId }
  | {
      readonly type: "BATTLE_RESOLVED";
      readonly attackerId: PlayerId;
      readonly defenderId: PlayerId;
      readonly attackerAtk: number;
      readonly defenderStat: Extract<Stat, "ATK" | "DEF">;
      readonly defenderValue: number;
      readonly outcome:
        | "ATTACKER_WINS_ATK_VS_ATK"
        | "DEFENDER_WINS_ATK_VS_ATK"
        | "BOTH_DESTROYED_ATK_VS_ATK"
        | "ATTACKER_PIERCES_DEF"
        | "ATK_EQUALS_DEF"
        | "ATTACKER_BLOCKED_BY_DEF";
    }
  | { readonly type: "VS_DEPLOYED"; readonly playerId: PlayerId; readonly instanceId: CardInstanceId; readonly position: VsPosition }
  | { readonly type: "VS_KEPT"; readonly playerId: PlayerId; readonly instanceId: CardInstanceId }
  | {
      readonly type: "VS_POSITION_CHANGED";
      readonly playerId: PlayerId;
      readonly instanceId: CardInstanceId;
      readonly from: VsPosition;
      readonly to: VsPosition;
    }
  | {
      readonly type: "VS_REPLACED";
      readonly playerId: PlayerId;
      readonly oldInstanceId: CardInstanceId;
      readonly newInstanceId: CardInstanceId;
      readonly position: VsPosition;
    }
  | { readonly type: "EFFECT_PLAYED"; readonly playerId: PlayerId; readonly instanceId: CardInstanceId }
  | { readonly type: "EFFECT_REMOVED"; readonly playerId: PlayerId; readonly instanceId: CardInstanceId }
  | { readonly type: "STAGE_CHANGED"; readonly playerId: PlayerId; readonly from: TurnStage; readonly to: TurnStage }
  | { readonly type: "TURN_ENDED"; readonly playerId: PlayerId; readonly turnNumber: number };

export type CommandResult =
  | { readonly accepted: true; readonly state: GameState; readonly events: readonly EngineEvent[] }
  | { readonly accepted: false; readonly state: GameState; readonly code: RejectionCode };

export interface TransitionResult {
  readonly state: GameState;
  readonly events: readonly EngineEvent[];
}
