import { fullSet } from "@x/cards";
import type { MatchSetupInput } from "@x/engine";

export const SUPPORTED_LOCAL_CARD_IDS = [
  "X001", "X002", "X004", "X005", "X006", "X008", "X011", "X012",
  "X013", "X016", "X019", "X020", "X021", "X025", "X030"
] as const;

export const DEFAULT_LOCAL_DECK: readonly string[] = SUPPORTED_LOCAL_CARD_IDS.flatMap((id) => [id, id]);

const supportedDefinitions = fullSet.cards.filter((card) =>
  SUPPORTED_LOCAL_CARD_IDS.includes(card.id as (typeof SUPPORTED_LOCAL_CARD_IDS)[number])
);

export function createDefaultLocalMatchInput(seed: number, matchId: string): MatchSetupInput {
  return {
    matchId,
    seed,
    cardSetVersion: fullSet.cardSetVersion,
    cardDefinitions: supportedDefinitions,
    player1Deck: DEFAULT_LOCAL_DECK,
    player2Deck: DEFAULT_LOCAL_DECK
  };
}
