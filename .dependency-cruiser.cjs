/**
 * Architecture boundaries (constitution Rules 2, 10, 22; ARCHITECTURE.md §2, §19).
 * CI fails if any rule is broken.
 */
module.exports = {
  forbidden: [
    {
      name: "engine-is-pure",
      comment: "The engine may not import anything outside itself: no packages, no Node built-ins, no other workspace code.",
      severity: "error",
      from: { path: "^packages/engine/src" },
      to: { pathNot: "^packages/engine/src" }
    },
    {
      name: "cards-are-data",
      comment: "Card data may only depend on itself and zod (for validation).",
      severity: "error",
      from: { path: "^packages/cards/src" },
      to: { pathNot: ["^packages/cards/(src|data)", "node_modules/zod"] }
    },
    {
      name: "ai-uses-engine-only",
      comment: "AI may only use the engine's public API.",
      severity: "error",
      from: { path: "^packages/ai/src" },
      to: { pathNot: ["^packages/ai/src", "^packages/engine/src/index\.ts$"] }
    },
    {
      name: "client-uses-engine-public-api",
      comment: "The client may only use the engine's public entry point, never its internals.",
      severity: "error",
      from: { path: "^apps/client" },
      to: { path: "^packages/engine/src", pathNot: "^packages/engine/src/index\.ts$" }
    },
    {
      name: "nobody-imports-client",
      comment: "Nothing may depend on the renderer.",
      severity: "error",
      from: { pathNot: "^apps/client" },
      to: { path: "^apps/client" }
    },
    {
      name: "setup-core-is-private",
      comment: "Only setup.ts may use the shared setup core, so the test-only deck exception cannot reach production code (D-010).",
      severity: "error",
      from: { path: "^packages/engine/src", pathNot: "^packages/engine/src/(setup\.ts|internal/)" },
      to: { path: "^packages/engine/src/internal/setup-core\.ts$" }
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(test|dist)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".js", ".json"]
    }
  }
};
