import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RULES_VERSION } from "../src/index.ts";

describe("rules version", () => {
  it("matches GAME_RULES.md", () => {
    const rulesPath = fileURLToPath(new URL("../../../GAME_RULES.md", import.meta.url));
    const rules = readFileSync(rulesPath, "utf8");
    const match = rules.match(/Rules version: \*\*(\d+\.\d+\.\d+)\*\*/);
    expect(match?.[1]).toBe(RULES_VERSION);
  });
});
