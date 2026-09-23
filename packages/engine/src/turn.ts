/**
 * Turn-state machine (ARCHITECTURE.md §10) and the single command pipeline
 * (ARCHITECTURE.md §7).
 *
 * `advance` runs automatic engine transitions until a player decision is
 * needed. `applyCommand` validates and applies one player command through a
 * handler, applies engine-owned consequences, then advances. Both are pure.
 */
import type { Command, CommandResult, EngineEvent, TransitionResult } from "./commands.ts";
import { changeVsPosition, deployVs, keepVs, replaceVs } from "./handlers/vs.ts";
import { attack, pass } from "./handlers/combat.ts";
import { playEffect, removeOwnEffect, resolveEffectChoice } from "./handlers/effects.ts";
import { discardForHandLimit } from "./handlers/hand.ts";
import { handLimitFor, isOpeningTurn } from "./hand-limit.ts";
import { opponentOf, setStage, type HandlerResult } from "./internal/turn-helpers.ts";
import type { GameState, PlayerState, TurnStage } from "./state.ts";
import { moveCard, moveCardsSimultaneously, type MoveCardInput } from "./zones.ts";

export { handLimitFor, isOpeningTurn, HAND_LIMIT, OPENING_TURN_HAND_LIMIT } from "./hand-limit.ts";
export { opponentOf } from "./internal/turn-helpers.ts";

/** §6 step 3: required deployment with no VS, otherwise the start-of-turn VS action. */
function stageAfterHandLimit(player: PlayerState): TurnStage {
  return player.vs === null ? "REQUIRED_VS_DEPLOYMENT" : "START_OF_TURN_VS_ACTION";
}

function runTurnStartDraw(state: GameState, events: EngineEvent[]): GameState {
  const playerId = state.activePlayerId;
  const started: PlayerState = { ...state.players[playerId], turnsStarted: state.players[playerId].turnsStarted + 1 };
  let next: GameState = { ...state, effectCardsPlayedThisTurn: 0, attacksThisTurn: 0, players: { ...state.players, [playerId]: started } };
  events.push({ type: "TURN_STARTED", playerId, turnNumber: state.turnNumber, isOpeningTurn: isOpeningTurn(started) });

  const drawnId = started.deck[0];
  if (drawnId === undefined) {
    // GAME_RULES.md §19: an empty deck at the normal draw ends the match. X1 step 14.
    throw new Error("deck exhaustion at turn-start draw is not implemented yet (X1 step 14)");
  }

  next = moveCard(next, { instanceId: drawnId, fromPlayerId: playerId, from: "DECK", toPlayerId: playerId, to: "HAND", reason: "DRAW" }, events);
  events.push({ type: "CARD_DRAWN", playerId, instanceId: drawnId });
  return setStage(next, "HAND_LIMIT_ENFORCEMENT", events);
}

function runHandLimitCheck(state: GameState, events: EngineEvent[]): GameState | null {
  const playerId = state.activePlayerId;
  const player = state.players[playerId];
  const handLimit = handLimitFor(state, playerId);
  if (player.hand.length <= handLimit) return setStage(state, stageAfterHandLimit(player), events);

  events.push({ type: "HAND_LIMIT_EXCEEDED", playerId, handSize: player.hand.length, handLimit, discardCount: player.hand.length - handLimit });
  return null;
}

/** GAME_RULES.md §13: the third consecutive inactive individual turn collapses the Arena. */
function runArenaCollapseCheck(state: GameState, events: EngineEvent[]): GameState {
  const meaningfulAction = state.attacksThisTurn > 0 || state.effectCardsPlayedThisTurn > 0;
  if (meaningfulAction) {
    return setStage({ ...state, arenaCollapseInactiveTurns: 0 }, "TURN_END", events);
  }

  const inactiveTurns = state.arenaCollapseInactiveTurns + 1;
  if (inactiveTurns < 3) {
    return setStage({ ...state, arenaCollapseInactiveTurns: inactiveTurns }, "TURN_END", events);
  }

  events.push({ type: "ARENA_COLLAPSED", triggeringPlayerId: state.activePlayerId, inactiveTurns });
  const moves: MoveCardInput[] = [];
  for (const playerId of ["P1", "P2"] as const) {
    const player = state.players[playerId];
    if (player.vs !== null) {
      moves.push({
        instanceId: player.vs,
        fromPlayerId: playerId,
        from: "VS",
        toPlayerId: playerId,
        to: "ZONE_TEPI",
        reason: "ARENA_COLLAPSE"
      });
    }
  }
  for (const playerId of ["P1", "P2"] as const) {
    for (const instanceId of state.players[playerId].effectZone) {
      moves.push({ instanceId, fromPlayerId: playerId, from: "EFFECT", toPlayerId: playerId, to: "ZONE_TEPI", reason: "ARENA_COLLAPSE" });
    }
  }

  const next = moveCardsSimultaneously({ ...state, arenaCollapseInactiveTurns: 0 }, moves, events);

  // GAME_RULES.md §13 step 6 (D-015): no card in hand means the deployment is skipped and the turn ends.
  if (next.players[state.activePlayerId].hand.length === 0) {
    events.push({ type: "POST_COLLAPSE_DEPLOYMENT_SKIPPED", playerId: state.activePlayerId });
    return setStage(next, "TURN_END", events);
  }
  return setStage(next, "POST_COLLAPSE_DEPLOYMENT", events);
}

/** Ends the turn: "this turn" modifiers expire, then the other player's turn starts. */
function runTurnEnd(state: GameState, events: EngineEvent[]): GameState {
  const endingPlayer = state.activePlayerId;
  events.push({ type: "TURN_ENDED", playerId: endingPlayer, turnNumber: state.turnNumber });
  const next: GameState = {
    ...state,
    statModifiers: state.statModifiers.filter((modifier) => modifier.duration !== "UNTIL_TURN_END"),
    ruleModifiers: state.ruleModifiers.filter((modifier) => !modifier.expiresOn.includes("TURN_END")),
    activePlayerId: opponentOf(endingPlayer),
    turnNumber: state.turnNumber + 1
  };
  return setStage(next, "TURN_START_DRAW", events);
}

/**
 * Runs automatic transitions until a player decision is needed or the match ends.
 * Waits at: HAND_LIMIT_ENFORCEMENT (over limit), REQUIRED_VS_DEPLOYMENT,
 * START_OF_TURN_VS_ACTION, EFFECT_ACTIONS.
 */
export function advance(state: GameState): TransitionResult {
  const events: EngineEvent[] = [];
  let current = state;

  for (;;) {
    if (current.status !== "ACTIVE") return { state: current, events };

    switch (current.turnStage) {
      case "TURN_START_DRAW":
        current = runTurnStartDraw(current, events);
        continue;
      case "HAND_LIMIT_ENFORCEMENT": {
        const next = runHandLimitCheck(current, events);
        if (next === null) return { state: current, events };
        current = next;
        continue;
      }
      case "ARENA_COLLAPSE_CHECK":
        current = runArenaCollapseCheck(current, events);
        continue;
      case "TURN_END":
        current = runTurnEnd(current, events);
        continue;
      case "REQUIRED_VS_DEPLOYMENT":
      case "START_OF_TURN_VS_ACTION":
      case "EFFECT_ACTIONS":
      case "COMBAT_OR_PASS":
      case "POST_COLLAPSE_DEPLOYMENT":
        return { state: current, events };
    }
  }
}

/** GAME_RULES.md §6: losing your own VS during your turn (after the VS step) ends the turn. */
function endTurnIfActivePlayerLostVs(state: GameState, events: EngineEvent[]): GameState {
  const midTurn = state.turnStage === "EFFECT_ACTIONS" || state.turnStage === "COMBAT_OR_PASS";
  if (midTurn && state.players[state.activePlayerId].vs === null) return setStage(state, "TURN_END", events);
  return state;
}

function runHandler(state: GameState, command: Command): HandlerResult {
  switch (command.type) {
    case "DISCARD_FOR_HAND_LIMIT": return discardForHandLimit(state, command);
    case "DEPLOY_VS": return deployVs(state, command);
    case "KEEP_VS": return keepVs(state, command);
    case "CHANGE_VS_POSITION": return changeVsPosition(state, command);
    case "REPLACE_VS": return replaceVs(state, command);
    case "PLAY_EFFECT": return playEffect(state, command);
    case "RESOLVE_EFFECT_CHOICE": return resolveEffectChoice(state, command);
    case "REMOVE_OWN_EFFECT": return removeOwnEffect(state, command);
    case "ATTACK": return attack(state, command);
    case "PASS": return pass(state, command);
  }
}

/**
 * The single command route (ARCHITECTURE.md §7). Every command goes:
 * common checks → handler → engine-owned consequences → automatic transitions.
 * A rejected command returns the exact input state.
 */
export function applyCommand(state: GameState, command: Command): CommandResult {
  if (state.status !== "ACTIVE") return { accepted: false, state, code: "MATCH_NOT_ACTIVE" };
  if (command.playerId !== state.activePlayerId) return { accepted: false, state, code: "NOT_ACTIVE_PLAYER" };

  const handled = runHandler(state, command);
  if (!handled.accepted) return { accepted: false, state, code: handled.code };

  const events: EngineEvent[] = [...handled.events];
  const settled = endTurnIfActivePlayerLostVs(handled.state, events);
  const advanced = advance(settled);
  return { accepted: true, state: advanced.state, events: [...events, ...advanced.events] };
}
