import { describe, expect, it } from "vitest";
import {
  advance,
  applyCommand,
  enumerateLegalCommands,
  eventsFor,
  viewFor,
  type EngineEvent,
  type GameState,
  type PlayerId
} from "../src/index.ts";
import { playCard, proofMatch, setVs, vsOf } from "./helpers/real-cards.ts";

/** Instance ids `viewer` must never see: the opponent's hand and both decks. */
function hiddenIds(state: GameState, viewer: PlayerId): string[] {
  const opponent = viewer === "P1" ? "P2" : "P1";
  return [...state.players[opponent].hand, ...state.players.P1.deck, ...state.players.P2.deck];
}

function expectNoLeak(json: string, ids: readonly string[]): void {
  for (const id of ids) expect(json.includes(`"${id}"`), `leaked ${id}`).toBe(false);
}

describe("viewFor (D-018)", () => {
  const state = playCard(setVs(setVs(proofMatch(3), "P1", "X013"), "P2", "X001"), "P1", "X002").state;

  it("shows own hand identities and only counts for the opponent hand and both decks", () => {
    const view = viewFor(state, "P1");
    expect(view.you.hand.map((card) => card.instanceId)).toEqual(state.players.P1.hand);
    expect(view.you.hand[0]).toMatchObject({ definitionId: expect.any(String), name: expect.any(String) });
    expect(view.opponent.handCount).toBe(state.players.P2.hand.length);
    expect(view.you.deckCount).toBe(state.players.P1.deck.length);
    expect(view.opponent.deckCount).toBe(state.players.P2.deck.length);
    expect("hand" in view.opponent).toBe(false);
    expect("deck" in view.you).toBe(false);
  });

  it("never contains an opponent-hand or deck instance id anywhere", () => {
    expectNoLeak(JSON.stringify(viewFor(state, "P1")), hiddenIds(state, "P1"));
    expectNoLeak(JSON.stringify(viewFor(state, "P2")), hiddenIds(state, "P2"));
  });

  it("keeps public zones, effective stats, scores and turn information", () => {
    const view = viewFor(state, "P2");
    expect(view.you.vs?.instanceId).toBe(vsOf(state, "P2"));
    expect(view.you.vs?.effective.atk).toBe(0); // SINGAU set it to 0
    expect(view.you.vs?.printed.atk).toBe(600);
    expect(view.opponent.effectZone.map((card) => card.definitionId)).toEqual(["X002"]);
    expect(view.opponent.vs?.definitionId).toBe("X013");
    expect(view.you.score).toBe(state.players.P2.zoneX.length);
    expect(view).toMatchObject({
      viewerId: "P2",
      activePlayerId: state.activePlayerId,
      isViewerTurn: state.activePlayerId === "P2",
      turnNumber: state.turnNumber,
      turnStage: state.turnStage,
      roundNumber: state.roundNumber,
      status: "ACTIVE",
      winner: null
    });
  });

  it("is deterministic and JSON round-trips unchanged", () => {
    const view = viewFor(state, "P1");
    expect(viewFor(state, "P1")).toEqual(view);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("does not change the state it reads", () => {
    const before = JSON.stringify(state);
    viewFor(state, "P1");
    viewFor(state, "P2");
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("eventsFor (D-018)", () => {
  it("hides the opponent's drawn card but shows the viewer's own", () => {
    const start = { ...setVs(setVs(proofMatch(4), "P1", "X013"), "P2", "X001"), activePlayerId: "P2" as const, turnStage: "TURN_START_DRAW" as const };
    const { events } = advance(start);
    const drawn = events.find((event) => event.type === "CARD_DRAWN");
    if (drawn?.type !== "CARD_DRAWN") throw new Error("expected a draw");

    const forP1 = eventsFor(events, "P1");
    const forP2 = eventsFor(events, "P2");
    expect(forP1.find((event) => event.type === "CARD_DRAWN")).toMatchObject({ instanceId: null });
    expect(forP1.find((event) => event.type === "CARD_MOVED" && event.from === "DECK")).toMatchObject({ instanceId: null, to: "HAND" });
    expect(forP2.find((event) => event.type === "CARD_DRAWN")).toMatchObject({ instanceId: drawn.instanceId });
  });

  it("reveals a card once it becomes public (played from hand)", () => {
    const base = setVs(setVs(proofMatch(5), "P1", "X013"), "P2", "X001");
    const played = playCard(base, "P2", "X004");
    const moved = eventsFor(played.events, "P1").find((event) => event.type === "CARD_MOVED" && event.to === "EFFECT");
    expect(moved).toMatchObject({ instanceId: played.instanceId, from: "HAND" });
  });
});

describe("no hidden information leaks across a whole match", () => {
  it("every view and every filtered event batch stays clean for both players", () => {
    let state = advance(proofMatch(11)).state;
    // proofMatch parks P1 at EFFECT_ACTIONS; restart the turn properly through the engine.
    state = advance({ ...state, turnStage: "TURN_START_DRAW" }).state;
    let steps = 0;
    while (state.status === "ACTIVE" && steps < 400) {
      const legal = enumerateLegalCommands(state);
      const command = legal.find((c) => c.type === "ATTACK") ?? legal.find((c) => c.type === "PLAY_EFFECT") ?? legal[0];
      if (!command) throw new Error(`no legal command at ${state.turnStage}`);
      const result = applyCommand(state, command);
      if (!result.accepted) throw new Error(result.code);
      for (const viewer of ["P1", "P2"] as const) {
        expectNoLeak(JSON.stringify(viewFor(result.state, viewer)), hiddenIds(result.state, viewer));
        expectNoLeak(JSON.stringify(eventsFor(result.events as EngineEvent[], viewer)), hiddenIds(result.state, viewer));
      }
      state = result.state;
      steps += 1;
    }
    expect(state.status).toBe("RESOLVED");
  });
});
