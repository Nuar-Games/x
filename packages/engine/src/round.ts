import type { GameState, PlayerId } from "./state.ts";
import { moveCard } from "./zones.ts";

function clearEffectsForPlayer(state: GameState, playerId: PlayerId): GameState {
  let next = state;
  for (const instanceId of [...next.players[playerId].effectZone]) {
    next = moveCard(next, {
      instanceId,
      fromPlayerId: playerId,
      from: "EFFECT",
      toPlayerId: playerId,
      to: "ZONE_TEPI"
    });
  }
  return next;
}

/** GAME_RULES.md §12 round-end cleanup. */
export function resolveRoundEnd(state: GameState): GameState {
  let next = clearEffectsForPlayer(state, "P1");
  next = clearEffectsForPlayer(next, "P2");

  return {
    ...next,
    roundNumber: state.roundNumber + 1,
    statModifiers: next.statModifiers.filter((modifier) => modifier.duration !== "UNTIL_ROUND_END"),
    ruleModifiers: next.ruleModifiers.filter((modifier) => modifier.expiry !== "ROUND_END")
  };
}
