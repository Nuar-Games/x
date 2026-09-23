import { describe, expect, it } from "vitest";
import { createRng, nextInt, nextUint32, shuffle, type RngState } from "../src/index.ts";

function sequence(seed: number, length: number): number[] {
  let rng: RngState = createRng(seed);
  return Array.from({ length }, () => {
    const step = nextUint32(rng);
    rng = step.rng;
    return step.value;
  });
}

describe("seeded RNG", () => {
  it("produces the same sequence from the same seed", () => {
    expect(sequence(123456789, 8)).toEqual(sequence(123456789, 8));
    expect(new Set(sequence(123456789, 8)).size).toBeGreaterThan(1);
  });

  it("produces different sequences from different seeds", () => {
    expect(sequence(1, 8)).not.toEqual(sequence(2, 8));
  });

  it("never mutates the RNG it is given", () => {
    const rng = createRng(42);
    const snapshot = { ...rng };
    nextUint32(rng);
    nextInt(rng, 7);
    shuffle(rng, [1, 2, 3, 4]);
    expect(rng).toEqual(snapshot);
  });

  it("produces bounded integers", () => {
    let rng = createRng(42);
    for (let i = 0; i < 200; i += 1) {
      const step = nextInt(rng, 7);
      rng = step.rng;
      expect(Number.isInteger(step.value)).toBe(true);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(7);
    }
  });

  it("shuffles deterministically without mutating the input", () => {
    const input = ["a", "b", "c", "d", "e"] as const;
    const a = shuffle(createRng(99), input);
    const b = shuffle(createRng(99), input);
    expect(a).toEqual(b);
    expect([...a.value].sort()).toEqual([...input]);
    expect(input).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("rejects seed zero and invalid seeds", () => {
    expect(() => createRng(0)).toThrow(/seed/i);
    expect(() => createRng(-1)).toThrow(/seed/i);
    expect(() => createRng(1.5)).toThrow(/seed/i);
  });
});
