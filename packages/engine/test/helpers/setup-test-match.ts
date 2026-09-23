import { buildInitialState, type MatchSetupInput } from "../../src/internal/setup-core.ts";
import type { GameState } from "../../src/index.ts";

/**
 * Test-only setup (GAME_RULES.md §2 / D-010): skips only the 30–50 deck-size
 * rule. Known definitions, no deferred cards and max 2 copies still apply.
 */
export function setupTestMatch(input: MatchSetupInput): GameState {
  return buildInitialState(input);
}

/** Test-only: overwrite part of a state to reach a scenario directly. */
export function withState(state: GameState, patch: Partial<GameState>): GameState {
  return { ...state, ...patch };
}

/** Test-only: overwrite part of one player's state. */
export function withPlayer(
  state: GameState,
  playerId: "P1" | "P2",
  patch: Partial<GameState["players"]["P1"]>
): GameState {
  return { ...state, players: { ...state.players, [playerId]: { ...state.players[playerId], ...patch } } };
}

/** Test-only: move the top N deck cards of a player into their hand (keeps instance zones consistent). */
export function moveTopDeckToHand(state: GameState, playerId: "P1" | "P2", count: number): GameState {
  const player = state.players[playerId];
  const moved = player.deck.slice(0, count);
  const cardInstances = { ...state.cardInstances };
  for (const id of moved) cardInstances[id] = { ...cardInstances[id]!, zone: "HAND" };
  return {
    ...withPlayer(state, playerId, { deck: player.deck.slice(count), hand: [...player.hand, ...moved] }),
    cardInstances
  };
}
