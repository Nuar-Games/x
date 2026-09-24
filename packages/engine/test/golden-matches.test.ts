import { describe, expect, it } from "vitest";
import { advance, applyCommand, type Command, type GameState, type MatchSetupInput, type SetupCardDefinition } from "../src/index.ts";
import { setupTestMatch } from "./helpers/setup-test-match.ts";

const combatDefinitions: readonly SetupCardDefinition[] = Array.from({ length: 7 }, (_, index) => ({
  id: `G${index + 1}`,
  name: `Golden Combat ${index + 1}`,
  atk: index === 4 ? 100 : index === 6 ? 900 : 500,
  def: 500,
  sta: 3
}));

const drawDefinitions: readonly SetupCardDefinition[] = Array.from({ length: 8 }, (_, index) => ({
  id: `D${index + 1}`,
  name: `Golden Draw ${index + 1}`,
  atk: 500,
  def: 500,
  sta: 3
}));

function input(seed: number, definitions: readonly SetupCardDefinition[], prefix: string): MatchSetupInput {
  const deck = definitions.map((definition) => definition.id);
  return {
    matchId: `${prefix}-${seed}`,
    seed,
    cardSetVersion: "golden-0.1.0",
    cardDefinitions: definitions,
    player1Deck: deck,
    player2Deck: deck
  };
}

function runFixed(initial: GameState, commands: readonly Command[]): GameState {
  let state = advance(initial).state;
  for (const command of commands) {
    const result = applyCommand(state, command);
    if (!result.accepted) throw new Error(`golden command rejected: ${command.type} -> ${result.code}`);
    state = result.state;
  }
  return state;
}

function terminalSnapshot(state: GameState) {
  return {
    rulesVersion: state.rulesVersion,
    cardSetVersion: state.cardSetVersion,
    matchId: state.matchId,
    rng: state.rng,
    activePlayerId: state.activePlayerId,
    turnNumber: state.turnNumber,
    turnStage: state.turnStage,
    roundNumber: state.roundNumber,
    arenaCollapseInactiveTurns: state.arenaCollapseInactiveTurns,
    status: state.status,
    winner: state.winner,
    players: state.players,
    statModifiers: state.statModifiers,
    ruleModifiers: state.ruleModifiers,
    pendingResolution: state.pendingResolution,
    effectCardsPlayedThisTurn: state.effectCardsPlayedThisTurn,
    attacksThisTurn: state.attacksThisTurn,
    modifierSequence: state.modifierSequence,
    instanceZones: Object.fromEntries(Object.entries(state.cardInstances).sort(([a], [b]) => a.localeCompare(b)).map(([id, card]) => [id, card.zone]))
  };
}

describe("golden matches (ARCHITECTURE.md §17–18 step 16)", () => {
  it("golden A: ATK capture creates a Zone X lead that wins at deck exhaustion", () => {
    const commands: readonly Command[] = [
      { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: "P1-005", position: "ATK" },
      { type: "PASS", playerId: "P1" },
      { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: "P2-007", position: "ATK" },
      { type: "ATTACK", playerId: "P2" },
      { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: "P1-003", position: "DEF" },
      { type: "PASS", playerId: "P1" },
      { type: "KEEP_VS", playerId: "P2" },
      { type: "PASS", playerId: "P2" }
    ];
    const state = runFixed(setupTestMatch(input(1601, combatDefinitions, "golden-combat")), commands);
    expect(state.status).toBe("RESOLVED");
    expect(state.winner).toBe("P2");
    console.log("GOLDEN_A", JSON.stringify(terminalSnapshot(state)));
  });

  it("golden B: two Arena Collapses reach an unbreakable tie and DRAW", () => {
    const commands: readonly Command[] = [
      { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: "P1-008", position: "DEF" },
      { type: "PASS", playerId: "P1" },
      { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: "P2-002", position: "DEF" },
      { type: "PASS", playerId: "P2" },
      { type: "KEEP_VS", playerId: "P1" },
      { type: "PASS", playerId: "P1" },
      { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: "P1-006", position: "ATK" },
      { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: "P2-003", position: "DEF" },
      { type: "PASS", playerId: "P2" },
      { type: "KEEP_VS", playerId: "P1" },
      { type: "PASS", playerId: "P1" },
      { type: "KEEP_VS", playerId: "P2" },
      { type: "PASS", playerId: "P2" },
      { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: "P2-004", position: "ATK" }
    ];
    const state = runFixed(setupTestMatch(input(1602, drawDefinitions, "golden-draw")), commands);
    expect(state.status).toBe("RESOLVED");
    expect(state.winner).toBe("DRAW");
    console.log("GOLDEN_B", JSON.stringify(terminalSnapshot(state)));
  });
});
