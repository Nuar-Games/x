import { describe, expect, it } from "vitest";
import * as engine from "../src/index.ts";
import { setupMatch } from "../src/index.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";
import { definitions, legalDeck, testDeck, testInput } from "./fixtures.ts";

const production = (overrides = {}) => testInput(12345, { player1Deck: legalDeck(), player2Deck: legalDeck(), ...overrides });

describe("production match setup", () => {
  it("rejects a deck below 30 cards", () => {
    expect(() => setupMatch(production({ player1Deck: testDeck() }))).toThrow(/30 to 50/);
  });

  it("rejects a deck above 50 cards", () => {
    const many = Array.from({ length: 26 }, (_, i) => ({ id: `Y${String(i + 1).padStart(3, "0")}`, name: `Big ${i + 1}`, atk: 100, def: 100, sta: 2, hasPlayableEffect: true }));
    const big = many.flatMap((c) => [c.id, c.id]).slice(0, 51);
    expect(big).toHaveLength(51);
    expect(() => setupMatch(production({ cardDefinitions: [...definitions, ...many], player2Deck: big }))).toThrow(/30 to 50/);
  });

  it("rejects more than two copies of the same card name", () => {
    const bad = legalDeck();
    bad[29] = definitions[0]!.id;
    expect(() => setupMatch(production({ player1Deck: bad }))).toThrow(/2 copies/i);
  });

  it("counts copies by name, not by id", () => {
    const sameName = [...definitions, { ...definitions[1]!, id: "X099", name: "Card 1" }];
    const deck = legalDeck();
    deck[29] = "X099";
    expect(() => setupMatch(production({ cardDefinitions: sameName, player1Deck: deck }))).toThrow(/2 copies/i);
  });

  it("rejects unknown card definitions", () => {
    const deck = legalDeck();
    deck[0] = "X999";
    expect(() => setupMatch(production({ player1Deck: deck }))).toThrow(/unknown/);
  });

  it("rejects deferred cards", () => {
    const withDeferred = definitions.map((c) => (c.id === "X001" ? { ...c, status: "DEFERRED" as const } : c));
    expect(() => setupMatch(production({ cardDefinitions: withDeferred }))).toThrow(/deferred/);
  });

  it("creates deterministic shuffled decks and five-card starting hands", () => {
    const a = setupMatch(production());
    const b = setupMatch(production());
    expect(a).toEqual(b);
    expect(a.players.P1.hand).toHaveLength(5);
    expect(a.players.P2.hand).toHaveLength(5);
    expect(a.players.P1.deck).toHaveLength(25);
    expect(a.players.P2.deck).toHaveLength(25);
    expect(a.players.P1.turnsStarted).toBe(0);
    expect(a.activePlayerId).toBe("P1");
    expect(a.turnStage).toBe("TURN_START_DRAW");
    expect(a.turnNumber).toBe(1);
    expect(a.roundNumber).toBe(1);
  });

  it("gives different shuffles for different seeds", () => {
    const a = setupMatch(production({ seed: 1 }));
    const b = setupMatch(production({ seed: 2 }));
    expect(a.players.P1.deck).not.toEqual(b.players.P1.deck);
  });

  it("keeps every card instance zone in sync with the player zones", () => {
    const state = setupMatch(production());
    for (const playerId of ["P1", "P2"] as const) {
      for (const id of state.players[playerId].hand) expect(state.cardInstances[id]?.zone).toBe("HAND");
      for (const id of state.players[playerId].deck) expect(state.cardInstances[id]?.zone).toBe("DECK");
    }
  });

  it("does not expose the test-only setup through the public API", () => {
    expect(Object.keys(engine)).not.toContain("buildInitialState");
    expect(Object.keys(engine)).not.toContain("setupTestMatch");
  });
});

describe("test-only match setup (D-010)", () => {
  it("allows a below-30-card fixture", () => {
    const state = setupTestMatch(testInput());
    expect(state.players.P1.hand).toHaveLength(5);
    expect(state.players.P1.deck).toHaveLength(15);
  });

  it("still enforces max 2 copies, known cards and no deferred cards", () => {
    expect(() => setupTestMatch(testInput(1, { player1Deck: ["X001", "X001", "X001", "X002", "X003"] }))).toThrow(/2 copies/);
    expect(() => setupTestMatch(testInput(1, { player1Deck: ["X999", "X001", "X002", "X003", "X004"] }))).toThrow(/unknown/);
    const withDeferred = definitions.map((c) => (c.id === "X001" ? { ...c, status: "DEFERRED" as const } : c));
    expect(() => setupTestMatch(testInput(1, { cardDefinitions: withDeferred }))).toThrow(/deferred/);
  });
});
