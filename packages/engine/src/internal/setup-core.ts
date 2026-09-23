/**
 * Shared match-construction core.
 *
 * Contains only the checks that apply to every match, including test
 * fixtures: known card definitions, no deferred cards, every deck card's
 * effect is one the engine implements (parseEffectSpec), max 2 copies per name.
 *
 * The 30–50 deck-size rule is NOT here. It lives only in `setupMatch`
 * (setup.ts), so there is no switch, flag or parameter anywhere in
 * production code that disables it (D-010).
 */
import { RULES_VERSION } from "../version.ts";
import { parseEffectSpec } from "../effect-spec.ts";
import { createRng, shuffle, type RngState } from "../rng.ts";
import type {
  CardDefinitionSnapshot,
  CardInstance,
  CardInstanceId,
  GameState,
  MatchId,
  PlayerId,
  PlayerState
} from "../state.ts";

/**
 * A card definition as it arrives from card data. Extra fields (e.g. `no`,
 * `star`, `effectText`) are ignored. `effect` is raw JSON: setup parses it.
 */
export interface SetupCardDefinition {
  readonly id: string;
  readonly name: string;
  readonly atk: number;
  readonly def: number;
  readonly sta: number;
  readonly effect?: unknown;
  /** "DEFERRED" cards are not implemented and can never enter a match (GAME_RULES.md §18A). */
  readonly status?: "DEFERRED" | undefined;
}

export interface MatchSetupInput {
  readonly matchId: MatchId;
  readonly seed: number;
  readonly cardSetVersion: string;
  readonly cardDefinitions: readonly SetupCardDefinition[];
  readonly player1Deck: readonly string[];
  readonly player2Deck: readonly string[];
}

export const MAX_COPIES_PER_NAME = 2;
export const OPENING_HAND_SIZE = 5;

function definitionMap(definitions: readonly SetupCardDefinition[]): Map<string, SetupCardDefinition> {
  const map = new Map<string, SetupCardDefinition>();
  for (const definition of definitions) {
    if (map.has(definition.id)) throw new Error(`duplicate card definition id: ${definition.id}`);
    if (!Number.isInteger(definition.atk) || definition.atk < 0) throw new Error(`invalid ATK for ${definition.name}`);
    if (!Number.isInteger(definition.def) || definition.def < 0) throw new Error(`invalid DEF for ${definition.name}`);
    if (!Number.isInteger(definition.sta) || definition.sta < 1) throw new Error(`invalid STA for ${definition.name}`);
    map.set(definition.id, definition);
  }
  return map;
}

function validateDeckContents(
  deck: readonly string[],
  definitions: ReadonlyMap<string, SetupCardDefinition>,
  label: string
): void {
  if (deck.length > 50) throw new Error(`${label} cannot contain more than 50 cards`);
  if (deck.length < OPENING_HAND_SIZE) throw new Error(`${label} needs at least ${OPENING_HAND_SIZE} cards to deal an opening hand`);

  const copiesByName = new Map<string, number>();
  for (const definitionId of deck) {
    const definition = definitions.get(definitionId);
    if (!definition) throw new Error(`${label} contains unknown card definition: ${definitionId}`);
    if (definition.status === "DEFERRED") throw new Error(`${label} contains deferred card: ${definition.name}`);
    if (definition.effect !== undefined) {
      const parsed = parseEffectSpec(definition.effect);
      if (!parsed.ok) throw new Error(`${label} contains ${definition.name}, whose effect the engine cannot run yet: ${parsed.reason}`);
    }
    const count = (copiesByName.get(definition.name) ?? 0) + 1;
    if (count > MAX_COPIES_PER_NAME) throw new Error(`${label} cannot contain more than 2 copies of ${definition.name}`);
    copiesByName.set(definition.name, count);
  }
}

function buildInstances(
  playerId: PlayerId,
  definitionIds: readonly string[],
  instances: Record<CardInstanceId, CardInstance>
): CardInstanceId[] {
  return definitionIds.map((definitionId, index) => {
    const instanceId = `${playerId}-${String(index + 1).padStart(3, "0")}`;
    instances[instanceId] = { instanceId, definitionId, ownerId: playerId, controllerId: playerId, zone: "DECK" };
    return instanceId;
  });
}

function dealOpeningHand(
  playerId: PlayerId,
  shuffledDeck: readonly CardInstanceId[],
  instances: Record<CardInstanceId, CardInstance>
): PlayerState {
  const hand = shuffledDeck.slice(0, OPENING_HAND_SIZE);
  for (const instanceId of hand) instances[instanceId] = { ...instances[instanceId]!, zone: "HAND" };
  return {
    playerId,
    deck: shuffledDeck.slice(OPENING_HAND_SIZE),
    hand,
    vs: null,
    vsPosition: null,
    effectZone: [],
    zoneX: [],
    zoneTepi: [],
    turnsStarted: 0
  };
}

/** Snapshots only the definitions the decks use, with parsed effects. */
function snapshotDefinitions(
  definitions: ReadonlyMap<string, SetupCardDefinition>,
  decks: readonly (readonly string[])[]
): Record<string, CardDefinitionSnapshot> {
  const used = [...new Set(decks.flat())].sort();
  const snapshot: Record<string, CardDefinitionSnapshot> = {};
  for (const id of used) {
    const definition = definitions.get(id)!;
    const base = { id: definition.id, name: definition.name, atk: definition.atk, def: definition.def, sta: definition.sta };
    if (definition.effect === undefined) {
      snapshot[id] = base;
    } else {
      const parsed = parseEffectSpec(definition.effect);
      if (!parsed.ok) throw new Error(parsed.reason);
      snapshot[id] = { ...base, effect: parsed.spec };
    }
  }
  return snapshot;
}

/** Builds the initial match state. Callers add any extra deck rules before calling. */
export function buildInitialState(input: MatchSetupInput): GameState {
  const definitions = definitionMap(input.cardDefinitions);
  validateDeckContents(input.player1Deck, definitions, "Player 1 deck");
  validateDeckContents(input.player2Deck, definitions, "Player 2 deck");

  const cardInstances: Record<CardInstanceId, CardInstance> = {};
  const p1Instances = buildInstances("P1", input.player1Deck, cardInstances);
  const p2Instances = buildInstances("P2", input.player2Deck, cardInstances);

  let rng: RngState = createRng(input.seed);
  const p1Shuffle = shuffle(rng, p1Instances);
  rng = p1Shuffle.rng;
  const p2Shuffle = shuffle(rng, p2Instances);
  rng = p2Shuffle.rng;

  return {
    rulesVersion: RULES_VERSION,
    cardSetVersion: input.cardSetVersion,
    matchId: input.matchId,
    rng,
    activePlayerId: "P1",
    turnNumber: 1,
    turnStage: "TURN_START_DRAW",
    roundNumber: 1,
    arenaCollapseInactiveTurns: 0,
    status: "ACTIVE",
    winner: null,
    players: {
      P1: dealOpeningHand("P1", p1Shuffle.value, cardInstances),
      P2: dealOpeningHand("P2", p2Shuffle.value, cardInstances)
    },
    cardDefinitions: snapshotDefinitions(definitions, [input.player1Deck, input.player2Deck]),
    cardInstances,
    statModifiers: [],
    activeContinuousEffectIds: [],
    ruleModifiers: [],
    pendingResolution: null,
    effectCardsPlayedThisTurn: 0,
    attacksThisTurn: 0,
    modifierSequence: 0
  };
}
