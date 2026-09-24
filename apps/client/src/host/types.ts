import type { Command, PlayerId, PlayerView, ViewEvent } from "@x/engine";

export type HostRejectionCode =
  | "INVALID_INDEX"
  | "STALE_VERSION"
  | "NOT_ACTING_VIEWER"
  | "MATCH_RESOLVED"
  | "ENGINE_REJECTED";

export interface HostOutput {
  readonly viewerId: PlayerId;
  readonly stateVersion: number;
  readonly view: PlayerView;
  readonly legalCommands: readonly Command[];
  readonly events: readonly ViewEvent[];
  /** Event-log slice is [eventStartIndex, eventEndIndex). */
  readonly eventStartIndex: number;
  readonly eventEndIndex: number;
}

export type HostResult =
  | { readonly accepted: true; readonly output: HostOutput }
  | { readonly accepted: false; readonly code: HostRejectionCode; readonly output: HostOutput };

export interface LocalMatchHost {
  getOutput(): HostOutput;
  setViewer(viewerId: PlayerId): HostOutput;
  pickLegalCommand(stateVersion: number, index: number): HostResult;
  acknowledgeEvents(upToIndex: number): HostOutput;
}
