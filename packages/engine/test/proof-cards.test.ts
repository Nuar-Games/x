/**
 * The 10 real engine-proof cards (packages/cards/data/engine-proof.json),
 * each played through applyCommand, checked against
 * card-effect-cases.0.2.0.json and GAME_RULES.md §18A.
 */
import { describe, expect, it } from "vitest";
import { effectiveStat, type GameState } from "../src/index.ts";
import {
  engineProofSet,
  must,
  playCard,
  PROOF_IDS,
  proofMatch,
  setVs,
  SUPPORTED_REAL_IDS,
  supportedMatch,
  take,
  vsOf,
  withActive
} from "./helpers/real-cards.ts";

const tested = new Set<string>();
const supportedTested = new Set<string>();
function card(id: string, name: string, body: () => void) {
  tested.add(id);
  supportedTested.add(id);
  describe(`${id} ${name}`, () => it("resolves as ruled", body));
}
function supportedCard(id: string, name: string, body: () => void) {
  supportedTested.add(id);
  describe(`${id} ${name}`, () => it("resolves as ruled", body));
}

function standoff(p1Vs: string, p2Vs: string): GameState {
  return setVs(setVs(proofMatch(), "P1", p1Vs), "P2", p2Vs);
}

function standoffSupported(p1Vs: string, p2Vs: string): GameState {
  return setVs(setVs(supportedMatch(), "P1", p1Vs), "P2", p2Vs);
}

card("X001", "XANDER SI TUKANG CANGKUL — draw 1", () => {
  const [state, xander] = take(withActive(standoff("X002", "X013"), "P1"), "P1", "X001");
  const hand = state.players.P1.hand;
  const topCard = state.players.P1.deck[0]!;
  const result = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: xander });
  expect(result.state.players.P1.hand).toEqual([...hand.filter((id) => id !== xander), topCard]);
  expect(result.state.players.P1.deck).toHaveLength(state.players.P1.deck.length - 1);
  expect(result.events.map((e) => e.type)).toContain("EFFECT_RESOLVED");
});

card("X002", "SINGAU — opponent VS ATK becomes 0", () => {
  const { state } = playCard(standoff("X002", "X013"), "P1", "X002");
  expect(effectiveStat(state, vsOf(state, "P2"), "ATK")).toBe(0);
});

card("X004", "TABUAN BARA — opponent VS ATK −100, floor 0", () => {
  const onNaga = playCard(standoff("X002", "X013"), "P1", "X004").state;
  expect(effectiveStat(onNaga, vsOf(onNaga, "P2"), "ATK")).toBe(700);
  const onUlar = playCard(standoff("X002", "X021"), "P1", "X004").state;
  expect(effectiveStat(onUlar, vsOf(onUlar, "P2"), "ATK")).toBe(0);
});

card("X005", "ARASHMAN SI PENENUN BAYANG — destroy all opponent Effects, their effects end", () => {
  let state = standoff("X013", "X002");
  const tabuan = playCard(state, "P2", "X004");
  const naga = playCard(tabuan.state, "P2", "X013");
  state = naga.state;
  expect(effectiveStat(state, vsOf(state, "P1"), "ATK")).toBe(700);
  expect(state.ruleModifiers.some((m) => m.kind === "ATTACK_RESTRICTION" && m.affectedPlayerId === "P1")).toBe(true);

  state = playCard(state, "P1", "X005").state;
  expect(state.players.P2.effectZone).toEqual([]);
  expect(state.players.P1.zoneX).toEqual(expect.arrayContaining([tabuan.instanceId, naga.instanceId]));
  expect(effectiveStat(state, vsOf(state, "P1"), "ATK")).toBe(800);
  expect(state.ruleModifiers.some((m) => m.kind === "ATTACK_RESTRICTION")).toBe(false);
});

card("X006", "BARA NANDEZ — opponent VS forced to DEF", () => {
  const { state } = playCard(standoff("X002", "X013"), "P1", "X006");
  expect(state.players.P2.vsPosition).toBe("DEF");
});

card("X008", "RATU TABUAN LANGIT — opponent VS STA −3 and its consequences", () => {
  let state = standoff("X002", "X013");
  state = playCard(state, "P2", "X006").state;
  state = playCard(state, "P2", "X004").state;
  const p2Effects = [...state.players.P2.effectZone];
  const played = playCard(state, "P1", "X008");
  expect(played.state.pendingResolution).toMatchObject({ choiceKind: "REMOVE_EXCESS_EFFECTS", actingPlayerId: "P1", affectedPlayerId: "P2", choiceCount: 2 });
  const resolved = must(played.state, { type: "RESOLVE_EFFECT_CHOICE", playerId: "P1", cardInstanceIds: p2Effects }).state;
  expect(resolved.players.P2.effectZone).toEqual([]);
  expect(resolved.players.P2.zoneTepi).toEqual(expect.arrayContaining(p2Effects));

  const small = standoff("X002", "X021");
  const ularVs = vsOf(small, "P2");
  const destroyed = playCard(small, "P1", "X008");
  expect(destroyed.state.players.P2.vs).toBeNull();
  expect(destroyed.state.players.P1.zoneX).toContain(ularVs);
  expect(destroyed.state.roundNumber).toBe(small.roundNumber + 1);
});

supportedCard("X011", "JENAKA FARISH — opponent VS STA −2", () => {
  const state = playCard(standoffSupported("X002", "X013"), "P1", "X011").state;
  expect(effectiveStat(state, vsOf(state, "P2"), "STA")).toBe(2);
});

supportedCard("X012", "IMP BARA BERTOPENG — opponent VS ATK −200", () => {
  const state = playCard(standoffSupported("X002", "X013"), "P1", "X012").state;
  expect(effectiveStat(state, vsOf(state, "P2"), "ATK")).toBe(600);
});

card("X013", "NAGA RIBUT AIS — DEF −200 and one prevented attack", () => {
  let state = standoff("X002", "X021");
  state = playCard(state, "P1", "X013").state;
  expect(effectiveStat(state, vsOf(state, "P2"), "DEF")).toBe(0);

  const counterBefore = state.arenaCollapseInactiveTurns;
  const attempt = must(withActive(state, "P2"), { type: "ATTACK", playerId: "P2" });
  expect(attempt.events.map((e) => e.type)).toEqual(expect.arrayContaining(["ATTACK_ATTEMPTED", "ATTACK_PREVENTED"]));
  expect(attempt.events.map((e) => e.type)).not.toContain("BATTLE_RESOLVED");
  expect(attempt.state.arenaCollapseInactiveTurns).toBe(counterBefore + 1);
  expect(attempt.state.ruleModifiers.some((m) => m.kind === "ATTACK_RESTRICTION")).toBe(false);
});

supportedCard("X016", "PENGANGKAT RIMBA — draw 3", () => {
  const [state, id] = take(withActive(standoffSupported("X002", "X013"), "P1"), "P1", "X016");
  const handBefore = state.players.P1.hand.length;
  const deckBefore = state.players.P1.deck.length;
  const result = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: id });
  expect(result.state.players.P1.hand).toHaveLength(handBefore - 1 + 3);
  expect(result.state.players.P1.deck).toHaveLength(deckBefore - 3);
});

card("X019", "KAPORES THE FIGHTER — STA −1, ATK +1000, then capacity; lasts until round end", () => {
  let state = standoff("X001", "X013");
  state = playCard(state, "P1", "X004").state;
  const kapores = playCard(state, "P1", "X019");
  const vs = vsOf(kapores.state, "P1");

  expect(effectiveStat(kapores.state, vs, "STA")).toBe(2);
  expect(effectiveStat(kapores.state, vs, "ATK")).toBe(1600);
  expect(kapores.state.pendingResolution).toMatchObject({ choiceKind: "REMOVE_EXCESS_EFFECTS", affectedPlayerId: "P1", choiceCount: 1 });

  const resolved = must(kapores.state, { type: "RESOLVE_EFFECT_CHOICE", playerId: "P1", cardInstanceIds: [kapores.instanceId] }).state;
  expect(resolved.players.P1.zoneTepi).toContain(kapores.instanceId);
  expect(effectiveStat(resolved, vs, "ATK")).toBe(1600);
  expect(effectiveStat(resolved, vs, "STA")).toBe(2);
});

supportedCard("X020", "TINFORGE — own VS ATK +600", () => {
  const state = playCard(standoffSupported("X002", "X013"), "P1", "X020").state;
  expect(effectiveStat(state, vsOf(state, "P1"), "ATK")).toBe(1599);
});

card("X021", "ULAR PELARI — opponent VS STA becomes 0, destroyed and captured", () => {
  const state = standoff("X002", "X002");
  const target = vsOf(state, "P2");
  const next = playCard(state, "P1", "X021").state;
  expect(next.players.P1.zoneX).toContain(target);
  expect(next.players.P2.vs).toBeNull();
  expect(next.roundNumber).toBe(state.roundNumber + 1);
});

supportedCard("X025", "KELAJUAN TANPA NAMA — draw 5", () => {
  const [state, id] = take(withActive(standoffSupported("X002", "X013"), "P1"), "P1", "X025");
  const deckBefore = state.players.P1.deck.length;
  const result = must(state, { type: "PLAY_EFFECT", playerId: "P1", cardInstanceId: id });
  expect(result.state.players.P1.deck).toHaveLength(deckBefore - 5);
});

card("X030", "PIPIT PEMBURU — draw 5, then discard exactly 2 chosen cards", () => {
  const state = standoff("X002", "X013");
  const played = playCard(state, "P1", "X030");
  const handAfterDraw = played.state.players.P1.hand;
  expect(played.state.pendingResolution).toMatchObject({ choiceKind: "DISCARD_OWN_HAND", choiceCount: 2 });
  const chosen = handAfterDraw.slice(0, 2);
  const done = must(played.state, { type: "RESOLVE_EFFECT_CHOICE", playerId: "P1", cardInstanceIds: chosen }).state;
  expect(done.players.P1.hand).toHaveLength(handAfterDraw.length - 2);
  expect(done.players.P1.zoneTepi).toEqual(expect.arrayContaining(chosen));
  expect(done.pendingResolution).toBeNull();
});

describe("coverage", () => {
  it("every card in engine-proof.json has a test above", () => {
    expect([...tested].sort()).toEqual([...PROOF_IDS].sort());
    expect(engineProofSet.cards).toHaveLength(10);
  });

  it("every currently supported real card has an executable card test", () => {
    expect([...supportedTested].sort()).toEqual([...SUPPORTED_REAL_IDS].sort());
  });
});
