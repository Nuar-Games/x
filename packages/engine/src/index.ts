/**
 * @x/engine — the headless X rules engine.
 *
 * Boundary (enforced by CI):
 * - no dependencies of any kind;
 * - no DOM, browser, Node, renderer, network or backend APIs
 *   (tsconfig has no DOM or Node types);
 * - no uncontrolled randomness or clock reads (scripts/check-determinism.mjs).
 *
 * All game truth lives here.
 */

export { RULES_VERSION } from "./version.ts";

export * from "./rng.ts";
export * from "./state.ts";
export * from "./commands.ts";
export * from "./effects.ts";
export * from "./zones.ts";
export * from "./battle.ts";
export * from "./round.ts";
export * from "./setup.ts";
export { advance, applyCommand, handLimitFor, isOpeningTurn, opponentOf, HAND_LIMIT, OPENING_TURN_HAND_LIMIT } from "./turn.ts";
