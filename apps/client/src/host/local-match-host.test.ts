import { describe, expect, it } from "vitest";
import { createDefaultLocalMatchInput } from "../config/default-match.ts";
import { createLocalMatchHost } from "./local-match-host.ts";
import type { HostRejectionCode, HostResult } from "./types.ts";

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("local match host", () => {
  it("does not consume events when output is read twice and caches legal commands by state version", () => {
    const host = createLocalMatchHost(createDefaultLocalMatchInput(7, "reads"));
    const first = host.getOutput();
    const second = host.getOutput();
    expect(second.events).toEqual(first.events);
    expect(second.eventStartIndex).toBe(first.eventStartIndex);
    expect(second.eventEndIndex).toBe(first.eventEndIndex);
    expect(second.legalCommands).toBe(first.legalCommands);
    expect(second.stateVersion).toBe(first.stateVersion);
  });

  it("opening advance events are visible to both viewers", () => {
    const host = createLocalMatchHost(createDefaultLocalMatchInput(8, "opening"));
    expect(host.getOutput().events.some((e) => e.type === "CARD_DRAWN")).toBe(true);
    expect(host.setViewer("P2").events.some((e) => e.type === "CARD_DRAWN")).toBe(true);
  });

  it("acknowledges independently per viewer", () => {
    const host = createLocalMatchHost(createDefaultLocalMatchInput(9, "acks"));
    const p1 = host.getOutput();
    host.acknowledgeEvents(p1.eventEndIndex);
    expect(host.getOutput().events).toEqual([]);
    expect(host.setViewer("P2").events.length).toBeGreaterThan(0);
  });

  it("throws on invalid acknowledgement indices", () => {
    const host = createLocalMatchHost(createDefaultLocalMatchInput(91, "bad-acks"));
    const first = host.getOutput();
    expect(() => host.acknowledgeEvents(0.5)).toThrow(RangeError);
    expect(() => host.acknowledgeEvents(first.eventEndIndex + 1)).toThrow(RangeError);
    host.acknowledgeEvents(first.eventEndIndex);
    expect(() => host.acknowledgeEvents(first.eventEndIndex - 1)).toThrow(RangeError);
  });

  it("rejects a stale pick before reinterpreting its index", () => {
    const host = createLocalMatchHost(createDefaultLocalMatchInput(10, "stale"));
    const old = host.getOutput();
    expect(host.pickLegalCommand(old.stateVersion, 0).accepted).toBe(true);
    expect(host.pickLegalCommand(old.stateVersion, 0)).toMatchObject({ accepted: false, code: "STALE_VERSION" });
  });

  it("rejects non-acting viewer and invalid index exactly", () => {
    const host = createLocalMatchHost(createDefaultLocalMatchInput(11, "reject"));
    const p1 = host.getOutput();
    host.setViewer("P2");
    expect(host.pickLegalCommand(p1.stateVersion, 0)).toMatchObject({ accepted: false, code: "NOT_ACTING_VIEWER" });
    host.setViewer("P1");
    expect(host.pickLegalCommand(p1.stateVersion, -1)).toMatchObject({ accepted: false, code: "INVALID_INDEX" });
  });

  it("only an accepted pick increments stateVersion", () => {
    const host = createLocalMatchHost(createDefaultLocalMatchInput(12, "version"));
    const initial = host.getOutput();
    host.getOutput();
    host.setViewer("P2");
    expect(host.getOutput().stateVersion).toBe(initial.stateVersion);
    host.setViewer("P1");
    expect(host.pickLegalCommand(initial.stateVersion, -1).output.stateVersion).toBe(initial.stateVersion);
    const accepted = host.pickLegalCommand(initial.stateVersion, 0);
    expect(accepted.accepted).toBe(true);
    expect(accepted.output.stateVersion).toBe(initial.stateVersion + 1);
    const end = accepted.output.eventEndIndex;
    host.acknowledgeEvents(end);
    expect(host.getOutput().stateVersion).toBe(initial.stateVersion + 1);
  });

  it("HostOutput and HostResult values are JSON-safe", () => {
    const host = createLocalMatchHost(createDefaultLocalMatchInput(13, "json"));
    const output = host.getOutput();
    expect(roundTrip(output)).toEqual(output);
    const accepted = host.pickLegalCommand(output.stateVersion, 0);
    expect(accepted.accepted).toBe(true);
    expect(roundTrip(accepted)).toEqual(accepted);

    const rejectionCodes: readonly HostRejectionCode[] = [
      "INVALID_INDEX", "STALE_VERSION", "NOT_ACTING_VIEWER", "MATCH_RESOLVED", "ENGINE_REJECTED"
    ];
    for (const code of rejectionCodes) {
      const value: HostResult = { accepted: false, code, output: accepted.output };
      expect(roundTrip(value)).toEqual(value);
    }
  });
});
