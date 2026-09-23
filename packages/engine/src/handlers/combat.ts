/** ATTACK and PASS (GAME_RULES.md §6 steps 6–7, §9). */
import { resolveBattle } from "../battle.ts";
import type { AttackCommand, EngineEvent, PassCommand } from "../commands.ts";
import { accept, opponentOf, reject, setStage, type HandlerResult } from "../internal/turn-helpers.ts";
import type { GameState } from "../state.ts";

export function attack(state: GameState, command: AttackCommand): HandlerResult {
  if (state.turnStage !== "EFFECT_ACTIONS") return reject("WRONG_STAGE");
  if (state.pendingResolution !== null) return reject("RESOLUTION_PENDING");
  const player = state.players[command.playerId];
  if (player.vs === null || player.vsPosition === null) return reject("NO_VS");
  if (player.vsPosition !== "ATK") return reject("VS_NOT_IN_ATK_POSITION");
  if (state.players[opponentOf(command.playerId)].vs === null) return reject("NO_OPPONENT_VS");

  const events: EngineEvent[] = [{ type: "ATTACK_DECLARED", playerId: command.playerId }];
  let next = setStage(state, "COMBAT_OR_PASS", events);
  next = resolveBattle(next, command.playerId, events);
  next = setStage(next, "ARENA_COLLAPSE_CHECK", events);
  return accept(next, events);
}

export function pass(state: GameState, command: PassCommand): HandlerResult {
  if (state.turnStage !== "EFFECT_ACTIONS") return reject("WRONG_STAGE");
  if (state.pendingResolution !== null) return reject("RESOLUTION_PENDING");
  if (state.players[command.playerId].vs === null) return reject("NO_VS");

  const events: EngineEvent[] = [{ type: "PASSED", playerId: command.playerId }];
  let next = setStage(state, "COMBAT_OR_PASS", events);
  next = setStage(next, "ARENA_COLLAPSE_CHECK", events);
  return accept(next, events);
}
