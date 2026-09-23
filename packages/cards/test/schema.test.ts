import { describe, expect, it } from "vitest";
import { CardSetSchema, effectCases, engineProofSet, fullSet } from "../src/index.ts";

const valid = { id: "X001", no: 1, name: "A", star: 1, atk: 1, def: 1, sta: 1 };
const set = (cards: unknown[]) => ({ cardSetVersion: "0.1.0", cards });

describe("full card set", () => {
  it("has 30 cards", () => {
    expect(fullSet.cards).toHaveLength(30);
  });

  it("only SPUDUR (X026) is deferred", () => {
    expect(fullSet.cards.filter((c) => c.status === "DEFERRED").map((c) => c.id)).toEqual(["X026"]);
  });
});

describe("engine-proof set", () => {
  it("has 8–12 cards (constitution Rule 7)", () => {
    expect(engineProofSet.cards.length).toBeGreaterThanOrEqual(8);
    expect(engineProofSet.cards.length).toBeLessThanOrEqual(12);
  });

  it("matches the full set exactly for every card (no drift)", () => {
    for (const card of engineProofSet.cards) {
      expect(fullSet.cards.find((c) => c.id === card.id)).toEqual(card);
    }
  });

  it("contains no deferred cards", () => {
    expect(engineProofSet.cards.filter((c) => c.status === "DEFERRED")).toEqual([]);
  });

  it("uses the same card-set version as the full set", () => {
    expect(engineProofSet.cardSetVersion).toBe(fullSet.cardSetVersion);
  });
});

describe("effect cases", () => {
  it("cover every card in the full set exactly once", () => {
    const caseIds = effectCases.cases.map((c) => c.cardId).sort();
    const cardIds = fullSet.cards.filter((c) => c.effect).map((c) => c.id).sort();
    expect(caseIds).toEqual(cardIds);
  });
});

describe("schema rejects bad data", () => {
  it("duplicate ids", () => {
    expect(() => CardSetSchema.parse(set([valid, { ...valid, name: "B" }]))).toThrow();
  });
  it("duplicate names", () => {
    expect(() => CardSetSchema.parse(set([valid, { ...valid, id: "X002" }]))).toThrow();
  });
  it("unknown fields", () => {
    expect(() => CardSetSchema.parse(set([{ ...valid, cost: 3 }]))).toThrow();
  });
  it("STA below 1", () => {
    expect(() => CardSetSchema.parse(set([{ ...valid, sta: 0 }]))).toThrow();
  });
  it("effect without effectText", () => {
    expect(() => CardSetSchema.parse(set([{ ...valid, effect: { family: "DRAW" } }]))).toThrow();
  });
  it("effect without a family", () => {
    expect(() => CardSetSchema.parse(set([{ ...valid, effectText: "x", effect: {} }]))).toThrow();
  });
});
