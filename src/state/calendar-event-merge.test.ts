import { describe, expect, it } from "vitest";
import { mergeDailyEventOutputs, registerDailyHook, runDailyTick } from "./calendar";
import type { EventLogEntry, GameState } from "./types";
import "./events-engine";

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

  it("keeps event-engine archival while merging other hook updates and additions", () => {
    const oldEvent = { ...event("old", "old event"), date: "2026-01-01" };
    const recentEvent = event("recent", "recent event");
    const appendedEvent = event("appended", "appended event");
    const state = {
      time: { date: "2026-08-01", day: 1, week: 1, season: "2026/27" },
      events: [oldEvent, recentEvent],
      players: {},
      clubs: { club: { id: "club", playerIds: [] } },
      currentClub: { id: "club", playerIds: [] },
      manager: { id: "manager" },
    } as unknown as GameState;

    registerDailyHook("events", (current) => ({
      ...current,
      events: [
        oldEvent,
        { ...recentEvent, description: "updated recent event" },
        appendedEvent,
      ],
    }));

    const next = runDailyTick(state, state.time);

    expect(next.events.map((item) => item.id)).toEqual(["recent", "appended"]);
    expect(next.events.find((item) => item.id === "recent")?.description).toBe(
      "updated recent event",
    );
    expect(next.events.some((item) => item.id === "old")).toBe(false);
  });

  it("preserves unrelated events when an incremental hook returns a partial slice", () => {
    const retained = event("retained", "retained event");
    const updated = { ...retained, description: "updated retained event" };
    const authoritative = [retained, event("other", "other event")];

    expect(mergeDailyEventOutputs(authoritative, [[updated]], authoritative)).toEqual([
      updated,
      authoritative[1],
    ]);
  });
});