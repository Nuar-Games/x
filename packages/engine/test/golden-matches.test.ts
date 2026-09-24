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
  for (const [index, command] of commands.entries()) {
    const result = applyCommand(state, command);
    if (!result.accepted) {
      throw new Error(`golden command ${index + 1} rejected at turn ${state.turnNumber}/${state.turnStage}: ${command.type} -> ${result.code}`);
    }
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

const GOLDEN_A = {
  rulesVersion: "0.2.2",
  cardSetVersion: "golden-0.1.0",
  matchId: "golden-combat-1601",
  rng: { seed: 1601, state: 3706452330 },
  activePlayerId: "P1",
  turnNumber: 5,
  turnStage: "TURN_START_DRAW",
  roundNumber: 2,
  arenaCollapseInactiveTurns: 2,
  status: "RESOLVED",
  winner: "P2",
  players: {
    P1: { playerId: "P1", deck: [], hand: ["P1-002", "P1-004", "P1-006", "P1-001"], vs: "P1-003", vsPosition: "DEF", effectZone: [], zoneX: [], zoneTepi: ["P1-007"], turnsStarted: 3 },
    P2: { playerId: "P2", deck: [], hand: ["P2-002", "P2-001", "P2-005", "P2-003", "P2-006"], vs: "P2-007", vsPosition: "ATK", effectZone: [], zoneX: ["P1-005"], zoneTepi: ["P2-004"], turnsStarted: 2 }
  },
  statModifiers: [],
  ruleModifiers: [],
  pendingResolution: null,
  effectCardsPlayedThisTurn: 0,
  attacksThisTurn: 0,
  modifierSequence: 0,
  instanceZones: {
    "P1-001": "HAND", "P1-002": "HAND", "P1-003": "VS", "P1-004": "HAND", "P1-005": "ZONE_X", "P1-006": "HAND", "P1-007": "ZONE_TEPI",
    "P2-001": "HAND", "P2-002": "HAND", "P2-003": "HAND", "P2-004": "ZONE_TEPI", "P2-005": "HAND", "P2-006": "HAND", "P2-007": "VS"
  }
} as const;

const GOLDEN_B = {
  rulesVersion: "0.2.2",
  cardSetVersion: "golden-0.1.0",
  matchId: "golden-draw-1602",
  rng: { seed: 1602, state: 3463825687 },
  activePlayerId: "P1",
  turnNumber: 7,
  turnStage: "TURN_START_DRAW",
  roundNumber: 3,
  arenaCollapseInactiveTurns: 0,
  status: "RESOLVED",
  winner: "DRAW",
  players: {
    P1: { playerId: "P1", deck: [], hand: ["P1-003", "P1-002", "P1-001", "P1-005", "P1-007"], vs: null, vsPosition: null, effectZone: [], zoneX: [], zoneTepi: ["P1-004", "P1-008", "P1-006"], turnsStarted: 4 },
    P2: { playerId: "P2", deck: [], hand: ["P2-008", "P2-006", "P2-007", "P2-001"], vs: "P2-004", vsPosition: "ATK", effectZone: [], zoneX: [], zoneTepi: ["P2-002", "P2-005", "P2-003"], turnsStarted: 3 }
  },
  statModifiers: [],
  ruleModifiers: [],
  pendingResolution: null,
  effectCardsPlayedThisTurn: 0,
  attacksThisTurn: 0,
  modifierSequence: 0,
  instanceZones: {
    "P1-001": "HAND", "P1-002": "HAND", "P1-003": "HAND", "P1-004": "ZONE_TEPI", "P1-005": "HAND", "P1-006": "ZONE_TEPI", "P1-007": "HAND", "P1-008": "ZONE_TEPI",
    "P2-001": "HAND", "P2-002": "ZONE_TEPI", "P2-003": "ZONE_TEPI", "P2-004": "VS", "P2-005": "ZONE_TEPI", "P2-006": "HAND", "P2-007": "HAND", "P2-008": "HAND"
  }
} as const;

describe("golden matches (ARCHITECTURE.md §17–18 step 16)", () => {
  it("golden A: ATK capture creates a Zone X lead that wins at deck exhaustion", () => {
    const commands: readonly Command[] = [
      { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: "P1-005", position: "ATK" },
      { type: "PASS", playerId: "P1" },
      { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: "P2-007", position: "ATK" },
      { type: "ATTACK", playerId: "P2" },
      { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P1", cardInstanceIds: ["P1-007"] },
      { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: "P1-003", position: "DEF" },
      { type: "PASS", playerId: "P1" },
      { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P2", cardInstanceIds: ["P2-004"] },
      { type: "KEEP_VS", playerId: "P2" },
      { type: "PASS", playerId: "P2" }
    ];
    const state = runFixed(setupTestMatch(input(1601, combatDefinitions, "golden-combat")), commands);
    expect(terminalSnapshot(state)).toEqual(GOLDEN_A);
  });

  it("golden B: two Arena Collapses reach an unbreakable tie and DRAW", () => {
    const commands: readonly Command[] = [
      { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: "P1-008", position: "DEF" },
      { type: "PASS", playerId: "P1" },
      { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: "P2-002", position: "DEF" },
      { type: "PASS", playerId: "P2" },
      { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P1", cardInstanceIds: ["P1-004"] },
      { type: "KEEP_VS", playerId: "P1" },
      { type: "PASS", playerId: "P1" },
      { type: "DEPLOY_VS", playerId: "P1", cardInstanceId: "P1-006", position: "ATK" },
      { type: "DISCARD_FOR_HAND_LIMIT", playerId: "P2", cardInstanceIds: ["P2-005"] },
      { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: "P2-003", position: "DEF" },
      { type: "PASS", playerId: "P2" },
      { type: "KEEP_VS", playerId: "P1" },
      { type: "PASS", playerId: "P1" },
      { type: "KEEP_VS", playerId: "P2" },
      { type: "PASS", playerId: "P2" },
      { type: "DEPLOY_VS", playerId: "P2", cardInstanceId: "P2-004", position: "ATK" }
    ];
    const state = runFixed(setupTestMatch(input(1602, drawDefinitions, "golden-draw")), commands);
    expect(terminalSnapshot(state)).toEqual(GOLDEN_B);
  });
});
