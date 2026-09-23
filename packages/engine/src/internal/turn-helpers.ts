import type { EngineEvent, RejectionCode } from "../commands.ts";
import type { GameState, PlayerId, TurnStage } from "../state.ts";

/** What a command handler returns. The pipeline in turn.ts turns it into a CommandResult. */
export type HandlerResult =
  | { readonly accepted: true; readonly state: GameState; readonly events: readonly EngineEvent[] }
  | { readonly accepted: false; readonly code: RejectionCode };

export function reject(code: RejectionCode): HandlerResult {
  return { accepted: false, code };
}

export function accept(state: GameState, events: readonly EngineEvent[]): HandlerResult {
  return { accepted: true, state, events };
}

export function setStage(state: GameState, to: TurnStage, events: EngineEvent[]): GameState {
  events.push({ type: "STAGE_CHANGED", playerId: state.activePlayerId, from: state.turnStage, to });
  return { ...state, turnStage: to };
}

export function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}
