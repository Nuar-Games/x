import type { GameState, PlayerId, PlayerState } from "./state.ts";

export const OPENING_TURN_HAND_LIMIT = 6;
export const HAND_LIMIT = 5;

/** A player's opening turn is their first turn of the match (GAME_RULES.md §3). */
export function isOpeningTurn(player: PlayerState): boolean {
  return player.turnsStarted === 1;
}

/** 6 during the player's opening turn, 5 from their second turn onward. */
export function handLimitFor(state: GameState, playerId: PlayerId): number {
  return isOpeningTurn(state.players[playerId]) ? OPENING_TURN_HAND_LIMIT : HAND_LIMIT;
}
