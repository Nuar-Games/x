import {
  advance,
  applyCommand,
  enumerateLegalCommands,
  eventsFor,
  setupMatch,
  viewFor,
  type Command,
  type EngineEvent,
  type GameState,
  type MatchSetupInput,
  type PlayerId
} from "@x/engine";
import type { HostOutput, HostRejectionCode, HostResult, LocalMatchHost } from "./types.ts";

export function createLocalMatchHost(input: MatchSetupInput, initialViewer: PlayerId = "P1"): LocalMatchHost {
  let state: GameState = setupMatch(input);
  const opening = advance(state);
  state = opening.state;
  const eventLog: EngineEvent[] = [...opening.events];
  const acknowledged: Record<PlayerId, number> = { P1: 0, P2: 0 };
  let viewerId: PlayerId = initialViewer;
  let stateVersion = 0;
  let cachedLegalVersion = -1;
  let cachedLegal: readonly Command[] = [];

  function legalCommandsForState(): readonly Command[] {
    if (state.status !== "ACTIVE") return [];
    if (cachedLegalVersion !== stateVersion) {
      cachedLegal = enumerateLegalCommands(state);
      cachedLegalVersion = stateVersion;
    }
    return cachedLegal;
  }

  function output(): HostOutput {
    const eventStartIndex = acknowledged[viewerId];
    const eventEndIndex = eventLog.length;
    return {
      viewerId,
      stateVersion,
      view: viewFor(state, viewerId),
      legalCommands: state.status === "ACTIVE" && viewerId === state.activePlayerId ? legalCommandsForState() : [],
      events: eventsFor(eventLog.slice(eventStartIndex, eventEndIndex), viewerId),
      eventStartIndex,
      eventEndIndex
    };
  }

  function reject(code: HostRejectionCode): HostResult {
    return { accepted: false, code, output: output() };
  }

  return {
    getOutput: output,
    setViewer(nextViewerId) {
      viewerId = nextViewerId;
      return output();
    },
    acknowledgeEvents(upToIndex) {
      const current = acknowledged[viewerId];
      if (!Number.isInteger(upToIndex) || upToIndex < current || upToIndex > eventLog.length) {
        throw new RangeError(`invalid event acknowledgement index ${upToIndex}; expected integer in [${current}, ${eventLog.length}]`);
      }
      acknowledged[viewerId] = upToIndex;
      return output();
    },
    pickLegalCommand(candidateVersion, index) {
      if (state.status !== "ACTIVE") return reject("MATCH_RESOLVED");
      if (viewerId !== state.activePlayerId) return reject("NOT_ACTING_VIEWER");
      if (candidateVersion !== stateVersion) return reject("STALE_VERSION");
      const legal = legalCommandsForState();
      if (!Number.isInteger(index) || index < 0 || index >= legal.length) return reject("INVALID_INDEX");
      const result = applyCommand(state, legal[index]!);
      if (!result.accepted) return reject("ENGINE_REJECTED");
      state = result.state;
      eventLog.push(...result.events);
      stateVersion += 1;
      cachedLegalVersion = -1;
      cachedLegal = [];
      return { accepted: true, output: output() };
    }
  };
}
