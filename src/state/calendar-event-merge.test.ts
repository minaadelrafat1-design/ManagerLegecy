import { describe, expect, it } from "vitest";
import { mergeDailyEventOutputs } from "./calendar";
import type { EventLogEntry } from "./types";

function event(id: string, description: string): EventLogEntry {
  return { id, date: "2026-08-22", type: "news", description };
}

describe("daily event output merge", () => {
  it("preserves snapshot order and replaces existing IDs in place", () => {
    const first = event("first", "original first");
    const second = event("second", "original second");
    const replacement = event("first", "replacement first");

    expect(mergeDailyEventOutputs([first, second], [[replacement]])).toEqual([
      replacement,
      second,
    ]);
  });

  it("appends new IDs in first-seen order and deduplicates duplicates", () => {
    const firstNew = event("new-1", "first");
    const duplicateNew = event("new-1", "duplicate");
    const secondNew = event("new-2", "second");

    expect(
      mergeDailyEventOutputs([], [[firstNew, duplicateNew], [secondNew, duplicateNew]]),
    ).toEqual([firstNew, secondNew]);
  });

  it("uses the first snapshot occurrence for duplicate existing IDs", () => {
    const first = event("duplicate", "first snapshot");
    const second = event("duplicate", "second snapshot");
    const replacement = event("duplicate", "replacement");

    expect(mergeDailyEventOutputs([first, second], [[replacement]])).toEqual([
      replacement,
      second,
    ]);
  });

  it("returns the original snapshot when outputs make no changes", () => {
    const existing = event("existing", "unchanged");
    const snapshot = [existing];

    expect(mergeDailyEventOutputs(snapshot, [[existing]])).toBe(snapshot);
  });
});