/**
 * The engine's effect vocabulary parser — the single definition of which
 * card effects the engine can execute.
 *
 * Card data (packages/cards) is input, not a second definition: setup runs
 * every deck card's raw `effect` through `parseEffectSpec`. Anything the
 * engine does not implement, or any unexpected field, is rejected at setup
 * instead of silently doing nothing in a match.
 */
import type { EffectSpec, ModifierDuration, Stat, VsPosition } from "./state.ts";

export type ParseResult = { readonly ok: true; readonly spec: EffectSpec } | { readonly ok: false; readonly reason: string };

type Raw = Record<string, unknown>;

const STATS: readonly Stat[] = ["ATK", "DEF", "STA"];
const POSITIONS: readonly VsPosition[] = ["ATK", "DEF"];
const DURATIONS: readonly ModifierDuration[] = ["WHILE_SOURCE_ACTIVE", "UNTIL_ROUND_END", "UNTIL_TURN_END"];
const VS_TARGETS = ["OWN_VS", "OPPONENT_VS"] as const;

class SpecError extends Error {}

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(raw: Raw, required: readonly string[], optional: readonly string[] = []): void {
  for (const key of required) if (!(key in raw)) throw new SpecError(`${String(raw.family)}: missing "${key}"`);
  for (const key of Object.keys(raw)) {
    if (!required.includes(key) && !optional.includes(key)) throw new SpecError(`${String(raw.family)}: unsupported field "${key}"`);
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new SpecError(`${label} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function positiveInt(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) throw new SpecError(`${label} must be a positive integer`);
  return value as number;
}

function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value)) throw new SpecError(`${label} must be an integer`);
  return value as number;
}

function optionalDuration(raw: Raw): { duration?: ModifierDuration } {
  return raw.duration === undefined ? {} : { duration: oneOf(raw.duration, DURATIONS, "duration") };
}

function parse(raw: unknown): EffectSpec {
  if (!isRecord(raw)) throw new SpecError("effect must be an object");
  switch (raw.family) {
    case "DRAW":
      exactKeys(raw, ["family", "count", "from"]);
      return { family: "DRAW", count: positiveInt(raw.count, "DRAW.count"), from: oneOf(raw.from, ["OWN_DECK"] as const, "DRAW.from") };
    case "SET_STAT":
      exactKeys(raw, ["family", "target", "stat", "value"], ["duration"]);
      return {
        family: "SET_STAT",
        target: oneOf(raw.target, VS_TARGETS, "SET_STAT.target"),
        stat: oneOf(raw.stat, STATS, "SET_STAT.stat"),
        value: integer(raw.value, "SET_STAT.value"),
        ...optionalDuration(raw)
      };
    case "MODIFY_STAT":
      exactKeys(raw, ["family", "target", "stat", "delta"], ["duration"]);
      return {
        family: "MODIFY_STAT",
        target: oneOf(raw.target, VS_TARGETS, "MODIFY_STAT.target"),
        stat: oneOf(raw.stat, STATS, "MODIFY_STAT.stat"),
        delta: integer(raw.delta, "MODIFY_STAT.delta"),
        ...optionalDuration(raw)
      };
    case "DESTROY_ALL":
      exactKeys(raw, ["family", "target"]);
      return { family: "DESTROY_ALL", target: oneOf(raw.target, ["OPPONENT_EFFECT_ZONE"] as const, "DESTROY_ALL.target") };
    case "SET_POSITION":
      exactKeys(raw, ["family", "target", "position"]);
      return {
        family: "SET_POSITION",
        target: oneOf(raw.target, ["OPPONENT_VS"] as const, "SET_POSITION.target"),
        position: oneOf(raw.position, POSITIONS, "SET_POSITION.position")
      };
    case "BLOCK_ATTACKS":
      exactKeys(raw, ["family", "target", "count"]);
      return {
        family: "BLOCK_ATTACKS",
        target: oneOf(raw.target, ["OPPONENT"] as const, "BLOCK_ATTACKS.target"),
        count: positiveInt(raw.count, "BLOCK_ATTACKS.count")
      };
    case "DISCARD_CHOSEN":
      exactKeys(raw, ["family", "count", "from", "to"]);
      return {
        family: "DISCARD_CHOSEN",
        count: positiveInt(raw.count, "DISCARD_CHOSEN.count"),
        from: oneOf(raw.from, ["OWN_HAND"] as const, "DISCARD_CHOSEN.from"),
        to: oneOf(raw.to, ["OWN_ZONE_TEPI"] as const, "DISCARD_CHOSEN.to")
      };
    case "SEQUENCE": {
      exactKeys(raw, ["family", "steps"], ["duration"]);
      if (!Array.isArray(raw.steps) || raw.steps.length === 0) throw new SpecError("SEQUENCE.steps must be a non-empty array");
      return { family: "SEQUENCE", steps: raw.steps.map(parse), ...optionalDuration(raw) };
    }
    default:
      throw new SpecError(`unsupported effect family "${String(raw.family)}"`);
  }
}

/** Parses raw card-data effect JSON into an engine EffectSpec, or explains why it cannot run. */
export function parseEffectSpec(raw: unknown): ParseResult {
  try {
    return { ok: true, spec: parse(raw) };
  } catch (error) {
    if (error instanceof SpecError) return { ok: false, reason: error.message };
    throw error;
  }
}
