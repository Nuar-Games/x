// Constitution Rule 5 / ARCHITECTURE.md §15:
// gameplay randomness and time must not leak into the engine.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["packages/engine/src", "packages/ai/src"];
const BANNED = [
  { pattern: /\bMath\.random\b/, why: "use the engine's seeded RNG" },
  { pattern: /\bDate\.now\b/, why: "time must not affect game results" },
  { pattern: /\bnew Date\s*\(/, why: "time must not affect game results" },
  { pattern: /\bperformance\.now\b/, why: "time must not affect game results" },
  { pattern: /\bcrypto\.(getRandomValues|randomUUID)\b/, why: "use the engine's seeded RNG" }
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const failures = [];
for (const root of ROOTS) {
  for (const file of walk(root).filter((f) => /\.(ts|js|mjs)$/.test(f))) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const { pattern, why } of BANNED) {
        if (pattern.test(line)) failures.push(`${file}:${i + 1}  ${line.trim()}  → ${why}`);
      }
    });
  }
}

if (failures.length) {
  console.error("Determinism check failed:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Determinism check passed.");
