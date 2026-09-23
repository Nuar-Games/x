/**
 * @x/engine — the headless X rules engine.
 *
 * Boundary (enforced by CI):
 * - no dependencies of any kind;
 * - no DOM, browser, Node, renderer, network or backend APIs
 *   (tsconfig has no DOM or Node types);
 * - no uncontrolled randomness or clock reads (scripts/check-determinism.mjs).
 *
 * Public API: set up a match, advance it, apply commands, and read derived
 * values. Nothing here lets a caller move cards or change state directly;
 * all changes go through applyCommand. Tests import internals from src/.
 */

export { RULES_VERSION } from "./version.ts";

export type * from "./state.ts";
export type * from "./commands.ts";
export type { RngState, RngResult } from "./rng.ts";
export { setupMatch, MIN_DECK_SIZE, MAX_DECK_SIZE, type MatchSetupInput, type SetupCardDefinition } from "./setup.ts";
export { advance, applyCommand, handLimitFor, isOpeningTurn, opponentOf, HAND_LIMIT, OPENING_TURN_HAND_LIMIT } from "./turn.ts";
export { effectiveStats, effectiveStat, effectCapacity, effectSlotLimit, NORMAL_EFFECT_ZONE_LIMIT } from "./effects.ts";
export { parseEffectSpec, type ParseResult } from "./effect-spec.ts";
