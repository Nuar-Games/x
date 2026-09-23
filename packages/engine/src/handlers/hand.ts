import type { DiscardForHandLimitCommand, EngineEvent } from "../commands.ts";
import { accept, reject, type HandlerResult } from "../internal/turn-helpers.ts";
import type { GameState } from "../state.ts";
import { handLimitFor } from "../hand-limit.ts";
import { moveCard } from "../zones.ts";

/** GAME_RULES.md §3: discard down to the hand limit after drawing. */
export function discardForHandLimit(state: GameState, command: DiscardForHandLimitCommand): HandlerResult {
  if (state.turnStage !== "HAND_LIMIT_ENFORCEMENT") return reject("WRONG_STAGE");

  const player = state.players[command.playerId];
  const required = player.hand.length - handLimitFor(state, command.playerId);
  if (required <= 0 || command.cardInstanceIds.length !== required) return reject("WRONG_DISCARD_COUNT");
  if (new Set(command.cardInstanceIds).size !== command.cardInstanceIds.length) return reject("DUPLICATE_CARD");
  if (!command.cardInstanceIds.every((id) => player.hand.includes(id))) return reject("CARD_NOT_IN_HAND");

  const events: EngineEvent[] = [];
  let next = state;
  for (const instanceId of command.cardInstanceIds) {
    next = moveCard(
      next,
      { instanceId, fromPlayerId: command.playerId, from: "HAND", toPlayerId: command.playerId, to: "ZONE_TEPI", reason: "HAND_LIMIT_DISCARD" },
      events
    );
  }
  return accept(next, events);
}
