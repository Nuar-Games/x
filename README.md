# X — The Card Game

A 2-player capture-and-score TCG built around short turns and direct back-and-forth play.

X is a separate project from Mega X.

## Status

Current phase: **X1 — Headless Game Engine**. Rules version: **0.2.0**.

See `PROJECT_STATE.md` for current status and next task.

## Documents

| File | Purpose |
|---|---|
| `PROJECT_CONSTITUTION.md` | Non-negotiable development rules |
| `GAME_RULES.md` | Authoritative game rules |
| `ARCHITECTURE.md` | Engine boundaries, state, commands |
| `PHASES_AND_WORKFLOW.md` | Phases, exit gates, work cycle |
| `DECISIONS.md` | Decision log |
| `PROJECT_STATE.md` | Current milestone and next task |
| `WORKING_PROTOCOL.md` | Working rules for contributors and AI tools |
| `BACKLOG.md` | Out-of-scope ideas for later phases |

## Layout

| Folder | What it is | Allowed to use |
|---|---|---|
| `packages/engine` | Game rules. The only source of game truth. | Nothing |
| `packages/cards` | Card data + validation | zod |
| `packages/ai` | Bot player (X3) | engine public API |
| `apps/client` | 2.5D renderer (Three.js) | engine public API, three |

These limits are enforced by CI (see `DECISIONS.md` D-008).

## Running it

Requires Node 22 and pnpm 9.

```
pnpm install
pnpm check     # everything CI runs
pnpm dev       # open the greybox client
```

## Workflow

1. Create a branch.
2. Make one focused change (engine OR cards OR ai OR client).
3. Open a pull request. CI must pass.
4. Merge into `main`. `main` is production-quality only.
5. Tag stable milestones (`v0.1.0`, …).

## One-time GitHub setup (branch protection)

Settings → Branches → Add branch ruleset (or "Add rule") for `main`:

- Require a pull request before merging
- Require status checks to pass → select **check** (appears after CI runs once)
- Block force pushes
- Restrict deletions
