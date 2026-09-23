import type { MatchSetupInput, SetupCardDefinition } from "../src/index.ts";

/** A playable effect with no gameplay result, so generic fixture cards can be played as Effects. */
export const NEUTRAL_EFFECT = { family: "MODIFY_STAT", target: "OWN_VS", stat: "ATK", delta: 0 } as const;

export const definitions: readonly SetupCardDefinition[] = Array.from({ length: 20 }, (_, index) => ({
  id: `X${String(index + 1).padStart(3, "0")}`,
  name: `Card ${index + 1}`,
  atk: 500 + index,
  def: 400 + index,
  sta: (index % 5) + 1,
  effect: NEUTRAL_EFFECT
}));

/** 30 cards: two copies of the first 15 definitions. */
export function legalDeck(): string[] {
  return definitions.slice(0, 15).flatMap((card) => [card.id, card.id]);
}

/** 20 cards: two copies of 10 definitions. Only valid through the test-only setup. */
export function testDeck(): string[] {
  return definitions.slice(0, 10).flatMap((card) => [card.id, card.id]);
}

export function testInput(seed = 99, overrides: Partial<MatchSetupInput> = {}): MatchSetupInput {
  return {
    matchId: `m-${seed}`,
    seed,
    cardSetVersion: "0.2.0",
    cardDefinitions: definitions,
    player1Deck: testDeck(),
    player2Deck: testDeck(),
    ...overrides
  };
}
