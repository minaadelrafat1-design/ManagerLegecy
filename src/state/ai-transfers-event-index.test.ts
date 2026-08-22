import { describe, expect, it } from "vitest";
import { appendUniqueEvent, createEventIdentityIndex } from "./ai-transfers";
import type { EventLogEntry, GameState } from "./types";

function makeEvent(id: string, eventKey?: string): EventLogEntry {
  return {
    id,
    date: "2031-08-02",
    type: "transfer",
    description: id,
    ...(eventKey ? { meta: { eventKey } } : {}),
  };
}

function makeState(events: EventLogEntry[]): GameState {
  return { events } as GameState;
}

describe("AI transfer event identity index", () => {
  it("preserves no-op behavior for an existing event ID", () => {
    const existing = makeEvent("event-1");
    const state = makeState([existing]);
    const next = appendUniqueEvent(
      state,
      makeEvent("event-1", "different-key"),
      createEventIdentityIndex(state.events),
    );
    expect(next).toBe(state);
  });

  it("preserves no-op behavior for an existing event key", () => {
    const existing = makeEvent("event-1", "listing-1");
    const state = makeState([existing]);
    const next = appendUniqueEvent(
      state,
      makeEvent("event-2", "listing-1"),
      createEventIdentityIndex(state.events),
    );
    expect(next).toBe(state);
  });

  it("appends new events in deterministic order and updates the index", () => {
    const state = makeState([makeEvent("event-1")]);
    const index = createEventIdentityIndex(state.events);
    const first = makeEvent("event-2", "listing-2");
    const second = makeEvent("event-3", "listing-3");
    const afterFirst = appendUniqueEvent(state, first, index);
    const afterSecond = appendUniqueEvent(afterFirst, second, index);

    expect(afterSecond.events).toEqual([state.events[0], first, second]);
    expect(index.ids.has("event-2")).toBe(true);
    expect(index.keys.has("listing-3")).toBe(true);
  });

  it("keeps repeated calls idempotent", () => {
    const state = makeState([]);
    const index = createEventIdentityIndex(state.events);
    const event = makeEvent("event-1", "listing-1");
    const first = appendUniqueEvent(state, event, index);
    const second = appendUniqueEvent(first, event, index);

    expect(first.events).toEqual([event]);
    expect(second).toBe(first);
  });

  it("preserves duplicate IDs in the source as a no-op", () => {
    const first = makeEvent("duplicate", "key-1");
    const second = makeEvent("duplicate", "key-2");
    const state = makeState([first, second]);
    const next = appendUniqueEvent(
      state,
      makeEvent("duplicate", "key-3"),
      createEventIdentityIndex(state.events),
    );

    expect(next).toBe(state);
    expect(next.events[1]).toBe(second);
  });
});