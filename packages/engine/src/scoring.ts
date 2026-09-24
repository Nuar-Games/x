import type { EngineEvent, MatchEndReason } from "./commands.ts";
import { shuffle } from "./rng.ts";
import type { CardInstanceId, GameState, PlayerId } from "./state.ts";

type ResolvedWinner = PlayerId | "DRAW";

function ownedTieBreakPool(state: GameState, playerId: PlayerId): CardInstanceId[] {
  return Object.values(state.cardInstances)
    .filter((instance) => instance.ownerId === playerId && instance.zone !== "ZONE_X")
    .map((instance) => instance.instanceId)
    .sort();
}

function printedAtk(state: GameState, instanceId: CardInstanceId): number {
  const instance = state.cardInstances[instanceId];
  if (!instance) throw new Error(`missing card instance: ${instanceId}`);
  const definition = state.cardDefinitions[instance.definitionId];
  if (!definition) throw new Error(`missing card definition: ${instance.definitionId}`);
  return definition.atk;
}

function tieBreak(state: GameState, events: EngineEvent[]): { state: GameState; winner: ResolvedWinner } {
  const p1 = shuffle(state.rng, ownedTieBreakPool(state, "P1"));
  const p2 = shuffle(p1.rng, ownedTieBreakPool(state, "P2"));
  const next: GameState = { ...state, rng: p2.rng };

  for (let index = 0; ; index += 1) {
    const p1Card = p1.value[index];
    const p2Card = p2.value[index];
    if (p1Card === undefined || p2Card === undefined) return { state: next, winner: "DRAW" };

    const p1Atk = printedAtk(next, p1Card);
    const p2Atk = printedAtk(next, p2Card);
    events.push({ type: "TIE_BREAK_REVEALED", index: index + 1, p1InstanceId: p1Card, p1Atk, p2InstanceId: p2Card, p2Atk });
    if (p1Atk > p2Atk) return { state: next, winner: "P1" };
    if (p2Atk > p1Atk) return { state: next, winner: "P2" };
  }
}

/** GAME_RULES.md §20: score Zone X, then use the deterministic printed-ATK tie-break if needed. */
export function scoreAndResolveMatch(state: GameState, events: EngineEvent[], reason: MatchEndReason): GameState {
  if (state.status === "RESOLVED") return state;

  const p1 = state.players.P1.zoneX.length;
  const p2 = state.players.P2.zoneX.length;
  events.push({ type: "SCORE_CALCULATED", p1, p2 });

  let next = state;
  let winner: ResolvedWinner;
  if (p1 > p2) winner = "P1";
  else if (p2 > p1) winner = "P2";
  else {
    const broken = tieBreak(next, events);
    next = broken.state;
    winner = broken.winner;
  }

  events.push({ type: "MATCH_ENDED", reason, winner, p1Score: p1, p2Score: p2 });
  return { ...next, status: "RESOLVED", winner };
}
