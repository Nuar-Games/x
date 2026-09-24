import { describe, expect, it } from "vitest";
import {
  advance,
  applyCommand,
  enumerateLegalCommands,
  setupMatch,
  type Command,
  type GameState,
  type MatchSetupInput,
  type SetupCardDefinition
} from "../src/index.ts";

const definitions: readonly SetupCardDefinition[] = Array.from({ length: 15 }, (_, index) => ({
  id: `E${String(index + 1).padStart(3, "0")}`,
  name: `Exit Gate ${index + 1}`,
  atk: 500,
  def: 500,
  sta: 3
}));

function legalThirtyCardDeck(): string[] {
  return definitions.flatMap((definition) => [definition.id, definition.id]);
}

function input(seed: number): MatchSetupInput {
  return {
    matchId: `x1-exit-${seed}`,
    seed,
    cardSetVersion: "exit-gate-0.1.0",
    cardDefinitions: definitions,
    player1Deck: legalThirtyCardDeck(),
    player2Deck: legalThirtyCardDeck()
  };
}

function chooseCommand(state: GameState): Command {
  const commands = enumerateLegalCommands(state);
  if (commands.length === 0) throw new Error(`no legal command at turn ${state.turnNumber}/${state.turnStage}`);

  const priority = ["DISCARD_FOR_HAND_LIMIT", "DEPLOY_VS", "KEEP_VS", "PASS"] as const;
  for (const type of priority) {
    const command = commands.find((candidate) => candidate.type === type && (candidate.type !== "DEPLOY_VS" || candidate.position === "ATK"));
    if (command) return command;
  }
  return commands[0]!;
}

function playFrom(start: GameState, maxCommands = 500): { state: GameState; commands: number } {
  let state = start;
  let commands = 0;
  while (state.status === "ACTIVE") {
    if (commands >= maxCommands) throw new Error(`match did not finish within ${maxCommands} commands`);
    const result = applyCommand(state, chooseCommand(state));
    if (!result.accepted) throw new Error(`enumerated command rejected: ${result.code}`);
    state = result.state;
    commands += 1;
  }
  return { state, commands };
}

describe("X1 exit gate", () => {
  it("runs a production-valid 30-card match setup-to-winner and resumes identically from serialized state", () => {
    let state = advance(setupMatch(input(1701))).state;

    for (let index = 0; index < 20 && state.status === "ACTIVE"; index += 1) {
      const result = applyCommand(state, chooseCommand(state));
      expect(result.accepted).toBe(true);
      if (!result.accepted) return;
      state = result.state;
    }

    expect(state.status).toBe("ACTIVE");
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    expect(restored).toEqual(state);

    const originalFinish = playFrom(state);
    const restoredFinish = playFrom(restored);

    expect(originalFinish.state).toEqual(restoredFinish.state);
    expect(originalFinish.commands).toBe(restoredFinish.commands);
    expect(originalFinish.state.status).toBe("RESOLVED");
    expect(originalFinish.state.winner).toBe("DRAW");
    expect(originalFinish.state.turnNumber).toBeGreaterThan(1);
  });
});
