import { describe, expect, it } from "vitest";
import { setupMatch } from "@x/engine";
import { DEFAULT_LOCAL_DECK, SUPPORTED_LOCAL_CARD_IDS, createDefaultLocalMatchInput } from "./default-match.ts";

describe("default local match config", () => {
  it("contains two copies of all 15 supported real cards", () => {
    expect(SUPPORTED_LOCAL_CARD_IDS).toHaveLength(15);
    expect(DEFAULT_LOCAL_DECK).toHaveLength(30);
    for (const id of SUPPORTED_LOCAL_CARD_IDS) {
      expect(DEFAULT_LOCAL_DECK.filter((candidate) => candidate === id)).toHaveLength(2);
    }
  });

  it("passes production setup with an externally supplied seed", () => {
    expect(() => setupMatch(createDefaultLocalMatchInput(4242, "x2-config"))).not.toThrow();
  });
});
