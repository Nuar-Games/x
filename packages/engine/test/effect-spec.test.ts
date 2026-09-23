import { describe, expect, it } from "vitest";
import { parseEffectSpec } from "../src/index.ts";
import { engineProofSet, fullSet, proofMatch } from "./helpers/real-cards.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

describe("effect vocabulary parser", () => {
  it("parses every proof card's effect", () => {
    for (const card of engineProofSet.cards) {
      const parsed = parseEffectSpec(card.effect);
      expect(parsed, `${card.id} ${card.name}`).toMatchObject({ ok: true });
    }
  });

  it("rejects effect families the engine does not implement", () => {
    const nagaAngin = fullSet.cards.find((card) => card.id === "X009")!;
    expect(parseEffectSpec(nagaAngin.effect)).toMatchObject({ ok: false, reason: expect.stringContaining("CAPTURE_CHOSEN") });
  });

  it("rejects unexpected fields instead of ignoring them", () => {
    expect(parseEffectSpec({ family: "DRAW", count: 1, from: "OWN_DECK", reveal: "ACTIVATING_PLAYER_ONLY" })).toMatchObject({ ok: false });
    expect(parseEffectSpec({ family: "SEQUENCE", steps: [{ family: "DRAW", count: 1, from: "OWN_DECK", chooser: "X" }] })).toMatchObject({ ok: false });
  });

  it("rejects malformed values", () => {
    expect(parseEffectSpec({ family: "DRAW", count: 0, from: "OWN_DECK" })).toMatchObject({ ok: false });
    expect(parseEffectSpec({ family: "MODIFY_STAT", target: "OPPONENT_VS", stat: "HP", delta: -1 })).toMatchObject({ ok: false });
    expect(parseEffectSpec({ family: "SEQUENCE", steps: [] })).toMatchObject({ ok: false });
  });
});

describe("setup rejects cards the engine cannot run", () => {
  it("a deck containing an unsupported card is rejected with the card's name", () => {
    const deck = ["X001", "X001", "X002", "X002", "X009"];
    expect(() =>
      setupTestMatch({ matchId: "m", seed: 1, cardSetVersion: fullSet.cardSetVersion, cardDefinitions: fullSet.cards, player1Deck: deck, player2Deck: deck })
    ).toThrow(/NAGA ANGIN.*cannot run/);
  });

  it("unsupported cards that are not in either deck do not block setup", () => {
    const deck = ["X001", "X001", "X002", "X002", "X004"];
    expect(() =>
      setupTestMatch({ matchId: "m", seed: 1, cardSetVersion: fullSet.cardSetVersion, cardDefinitions: fullSet.cards, player1Deck: deck, player2Deck: deck })
    ).not.toThrow();
  });

  it("the match snapshot holds only the cards the decks use, with parsed effects", () => {
    const state = proofMatch();
    expect(Object.keys(state.cardDefinitions).sort()).toEqual(engineProofSet.cards.map((c) => c.id).sort());
    expect(state.cardDefinitions.X013?.effect).toMatchObject({ family: "SEQUENCE" });
  });
});
