import type { CardInstanceId, GameState, PlayerId, TurnStage, VsPosition, Zone } from "./state.ts";

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
  | RemoveOwnEffectCommand;

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
  | "RESOLUTION_PENDING";

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
      readonly playerId: PlayerId;
      readonly instanceId: CardInstanceId;
      readonly from: Zone;
      readonly to: Zone;
      readonly reason: "HAND_LIMIT_DISCARD" | "VOLUNTARY_VS_REPLACEMENT" | "PLAY_EFFECT" | "VOLUNTARY_EFFECT_REMOVAL" | "STA_EXCESS_REMOVAL";
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
