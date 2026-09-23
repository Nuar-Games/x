/**
 * Engine-owned deterministic PRNG (xorshift32).
 *
 * Pure: every function returns the next RNG state instead of mutating the
 * one it was given. An old GameState is never changed by later commands,
 * which keeps replays and golden matches exact.
 */
export interface RngState {
  readonly seed: number;
  readonly state: number;
}

export interface RngResult<T> {
  readonly value: T;
  readonly rng: RngState;
}

const UINT32_RANGE = 0x1_0000_0000;

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer`);
  }
}

/** Seed 0 is rejected because zero is the absorbing state of xorshift32. */
export function createRng(seed: number): RngState {
  assertUint32(seed, "seed");
  if (seed === 0) throw new RangeError("seed must be non-zero");
  return { seed, state: seed };
}

/** Returns the next unsigned 32-bit value and the advanced RNG. */
export function nextUint32(rng: RngState): RngResult<number> {
  let x = rng.state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0;
  return { value: next, rng: { seed: rng.seed, state: next } };
}

/** Returns an unbiased integer in [0, maxExclusive) and the advanced RNG. */
export function nextInt(rng: RngState, maxExclusive: number): RngResult<number> {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError("maxExclusive must be an integer from 1 to 2^32");
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let step = nextUint32(rng);
  while (step.value >= limit) step = nextUint32(step.rng);
  return { value: step.value % maxExclusive, rng: step.rng };
}

/** Deterministic Fisher-Yates shuffle. Neither the input array nor the RNG is mutated. */
export function shuffle<T>(rng: RngState, values: readonly T[]): RngResult<T[]> {
  const result = [...values];
  let current = rng;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const step = nextInt(current, i + 1);
    current = step.rng;
    const j = step.value;
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return { value: result, rng: current };
}
