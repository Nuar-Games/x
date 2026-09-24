import type { Command } from "./commands.ts";
import { handLimitFor } from "./hand-limit.ts";
import type { CardInstanceId, GameState, PlayerId, VsPosition } from "./state.ts";
import { applyCommand } from "./turn.ts";

const POSITIONS: readonly VsPosition[] = ["ATK", "DEF"];

function combinations<T>(values: readonly T[], count: number): T[][] {
  if (count < 0 || count > values.length) return [];
  if (count === 0) return [[]];
  const result: T[][] = [];
  const current: T[] = [];

  const visit = (start: number): void => {
    if (current.length === count) {
      result.push([...current]);
      return;
    }
    const remainingNeeded = count - current.length;
    for (let index = start; index <= values.length - remainingNeeded; index += 1) {
      current.push(values[index]!);
      visit(index + 1);
      current.pop();
    }
  };

  visit(0);
  return result;
}

function deployCommands(playerId: PlayerId, hand: readonly CardInstanceId[]): Command[] {
  return hand.flatMap((cardInstanceId) =>
    POSITIONS.map((position) => ({ type: "DEPLOY_VS", playerId, cardInstanceId, position }) as const)
  );
}

function candidateCommands(state: GameState): Command[] {
  if (state.status !== "ACTIVE") return [];

  const playerId = state.activePlayerId;
  const player = state.players[playerId];

  switch (state.turnStage) {
    case "TURN_START_DRAW":
    case "ARENA_COLLAPSE_CHECK":
    case "TURN_END":
    case "COMBAT_OR_PASS":
      return [];

    case "HAND_LIMIT_ENFORCEMENT": {
      const discardCount = player.hand.length - handLimitFor(state, playerId);
      if (discardCount <= 0) return [];
      return combinations(player.hand, discardCount).map((cardInstanceIds) => ({
        type: "DISCARD_FOR_HAND_LIMIT",
        playerId,
        cardInstanceIds
      }));
    }

    case "REQUIRED_VS_DEPLOYMENT":
    case "POST_COLLAPSE_DEPLOYMENT":
      return deployCommands(playerId, player.hand);

    case "START_OF_TURN_VS_ACTION": {
      const commands: Command[] = [{ type: "KEEP_VS", playerId }];
      if (player.vsPosition !== null) {
        const opposite: VsPosition = player.vsPosition === "ATK" ? "DEF" : "ATK";
        commands.push({ type: "CHANGE_VS_POSITION", playerId, position: opposite });
      }
      for (const cardInstanceId of player.hand) {
        for (const position of POSITIONS) commands.push({ type: "REPLACE_VS", playerId, cardInstanceId, position });
      }
      return commands;
    }

    case "EFFECT_ACTIONS": {
      const pending = state.pendingResolution;
      if (pending !== null) {
        const source = pending.choiceKind === "DISCARD_OWN_HAND"
          ? state.players[pending.affectedPlayerId].hand
          : state.players[pending.affectedPlayerId].effectZone;
        return combinations(source, pending.choiceCount).map((cardInstanceIds) => ({
          type: "RESOLVE_EFFECT_CHOICE",
          playerId,
          cardInstanceIds
        }));
      }

      const commands: Command[] = [];
      for (const instanceId of player.effectZone) {
        commands.push({ type: "REMOVE_OWN_EFFECT", playerId, cardInstanceId: instanceId });
      }
      for (const instanceId of player.hand) {
        commands.push({ type: "PLAY_EFFECT", playerId, cardInstanceId: instanceId });
      }
      commands.push({ type: "ATTACK", playerId });
      commands.push({ type: "PASS", playerId });
      return commands;
    }
  }
}

/**
 * Returns every concrete player command currently accepted by the engine.
 *
 * Candidate generation is stage-local and deterministic. Final legality is
 * delegated to applyCommand so validation has one source of truth: adding or
 * tightening a command rule cannot make this enumerator silently disagree.
 */
export function enumerateLegalCommands(state: GameState): readonly Command[] {
  return candidateCommands(state).filter((command) => applyCommand(state, command).accepted);
}
