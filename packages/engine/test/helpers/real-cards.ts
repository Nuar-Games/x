/**
 * Test-only bridge to the real card data. Engine source never imports
 * @x/cards; tests do, so the actual proof cards run through the engine.
 */
import { engineProofSet, fullSet } from "@x/cards";
import { applyCommand, type Command, type GameState, type PlayerId, type VsPosition } from "../../src/index.ts";
import { moveCard } from "../../src/zones.ts";
import { setupTestMatch } from "./setup-test-match.ts";

export { engineProofSet, fullSet };

export const PROOF_IDS = engineProofSet.cards.map((card) => card.id);
export const SUPPORTED_REAL_IDS = [
  "X001", "X002", "X004", "X005", "X006", "X008", "X011", "X012",
  "X013", "X016", "X019", "X020", "X021", "X025", "X030"
] as const;

/** Both players get two copies of every proof card (20-card test decks, D-010). */
export function proofMatch(seed = 1): GameState {
  const deck = PROOF_IDS.flatMap((id) => [id, id]);
  const state = setupTestMatch({
    matchId: `proof-${seed}`,
    seed,
    cardSetVersion: engineProofSet.cardSetVersion,
    cardDefinitions: engineProofSet.cards,
    player1Deck: deck,
    player2Deck: deck
  });
  return withActive(state, "P1");
}

/** Both players get two copies of every currently supported real card. */
export function supportedMatch(seed = 1): GameState {
  const deck = SUPPORTED_REAL_IDS.flatMap((id) => [id, id]);
  const supportedDefinitions = fullSet.cards.filter((card) =>
    SUPPORTED_REAL_IDS.includes(card.id as (typeof SUPPORTED_REAL_IDS)[number])
  );
  const state = setupTestMatch({
    matchId: `supported-${seed}`,
    seed,
    cardSetVersion: fullSet.cardSetVersion,
    cardDefinitions: supportedDefinitions,
    player1Deck: deck,
    player2Deck: deck
  });
  return withActive(state, "P1");
}

/** Makes `playerId` the active player at the Effect step of a non-opening turn. */
export function withActive(state: GameState, playerId: PlayerId): GameState {
  return {
    ...state,
    activePlayerId: playerId,
    turnStage: "EFFECT_ACTIONS",
    effectCardsPlayedThisTurn: 0,
    attacksThisTurn: 0,
    players: { ...state.players, [playerId]: { ...state.players[playerId], turnsStarted: Math.max(2, state.players[playerId].turnsStarted) } }
  };
}

/** Finds an unused copy of a card (hand first, then deck) and puts it in the player's hand. */
export function take(state: GameState, playerId: PlayerId, cardId: string): [GameState, string] {
  const player = state.players[playerId];
  const isCard = (id: string) => state.cardInstances[id]!.definitionId === cardId;
  const inHand = player.hand.find(isCard);
  if (inHand) return [state, inHand];
  const inDeck = player.deck.find(isCard);
  if (!inDeck) throw new Error(`no unused copy of ${cardId} for ${playerId}`);
  const next = moveCard(state, { instanceId: inDeck, fromPlayerId: playerId, from: "DECK", toPlayerId: playerId, to: "HAND", reason: "DRAW" }, []);
  return [next, inDeck];
}

/** Puts a copy of `cardId` into the player's VS Zone. */
export function setVs(state: GameState, playerId: PlayerId, cardId: string, position: VsPosition = "ATK"): GameState {
  const [withCard, id] = take(state, playerId, cardId);
  return moveCard(
    withCard,
    { instanceId: id, fromPlayerId: playerId, from: "HAND", toPlayerId: playerId, to: "VS", toVsPosition: position, reason: "DEPLOY_VS" },
    []
  );
}

export function must(state: GameState, command: Command) {
  const result = applyCommand(state, command);
  if (!result.accepted) throw new Error(`${command.type} rejected: ${result.code}`);
  return result;
}

/** Plays a copy of `cardId` as an Effect for `playerId` (made active first). */
export function playCard(state: GameState, playerId: PlayerId, cardId: string) {
  const [withCard, id] = take(withActive(state, playerId), playerId, cardId);
  return { ...must(withCard, { type: "PLAY_EFFECT", playerId, cardInstanceId: id }), instanceId: id };
}

export function vsOf(state: GameState, playerId: PlayerId): string {
  const vs = state.players[playerId].vs;
  if (vs === null) throw new Error(`${playerId} has no VS`);
  return vs;
}
