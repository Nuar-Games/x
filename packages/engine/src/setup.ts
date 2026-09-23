import { buildInitialState, type MatchSetupInput, type SetupCardDefinition } from "./internal/setup-core.ts";
import type { GameState } from "./state.ts";

export type { MatchSetupInput, SetupCardDefinition };

export const MIN_DECK_SIZE = 30;
export const MAX_DECK_SIZE = 50;

function assertProductionDeckSize(deck: readonly string[], label: string): void {
  if (deck.length < MIN_DECK_SIZE || deck.length > MAX_DECK_SIZE) {
    throw new Error(`${label} must contain ${MIN_DECK_SIZE} to ${MAX_DECK_SIZE} cards`);
  }
}

/**
 * Production match setup. Always enforces 30–50 cards, max 2 copies per
 * name, known definitions, and no deferred cards. Has no option to relax them.
 *
 * Returns the state at TURN_START_DRAW. Call `startTurn` to run the draw.
 */
export function setupMatch(input: MatchSetupInput): GameState {
  assertProductionDeckSize(input.player1Deck, "Player 1 deck");
  assertProductionDeckSize(input.player2Deck, "Player 2 deck");
  return buildInitialState(input);
}
