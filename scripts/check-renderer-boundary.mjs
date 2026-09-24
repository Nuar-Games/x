// X2 renderer boundary (ARCHITECTURE.md §21, D-018).
//
// Code under apps/client/src/render/ draws the game. It receives:
//   - a PlayerView (viewFor), never GameState;
//   - the legal commands as data (enumerateLegalCommands), never runs rules;
//   - ordered ViewEvents (eventsFor) to animate, never diffs states.
// So it may import ENGINE TYPES ONLY, and may not mention GameState.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "apps/client/src/render";
const RULES = [
  { pattern: /\bGameState\b/, why: "the renderer receives PlayerView from viewFor(), never GameState" },
  { pattern: /^\s*import\s+(?!type\b)[^;]*from\s+["']@x\/engine["']/m, why: "import engine types only (`import type`); engine functions run outside the renderer" },
  { pattern: /^\s*export\s+(?!type\b)[^;]*from\s+["']@x\/engine["']/m, why: "re-export engine types only" },
  { pattern: /\bprevState\b|\bpreviousState\b|\boldState\b/, why: "animate from ViewEvents, do not diff old/new states" }
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(ROOT)) {
  console.log("Renderer boundary check passed (no renderer code yet).");
  process.exit(0);
}

const failures = [];
for (const file of walk(ROOT).filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))) {
  const text = readFileSync(file, "utf8");
  for (const { pattern, why } of RULES) if (pattern.test(text)) failures.push(`${file}: ${why}`);
}

if (failures.length) {
  console.error("Renderer boundary check failed:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Renderer boundary check passed.");
