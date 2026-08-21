import type { EventLogEntry, EventRuntimeIndex, GameState } from "./types";

export function buildEventRuntimeIndex(events: EventLogEntry[] = []): EventRuntimeIndex {
  const byId: Record<string, EventLogEntry> = {};
  const byEventKey: Record<string, EventLogEntry> = {};
  const dueByDate: Record<string, EventLogEntry[]> = {};
  const byPlayer: Record<string, EventLogEntry[]> = {};
  const byClub: Record<string, EventLogEntry[]> = {};

  for (const event of events) {
    if (!event) continue;
    byId[event.id] = event;

    const eventKey = event.meta?.["eventKey"] ?? event.id;
    if (!byEventKey[eventKey]) {
      byEventKey[eventKey] = event;
    }

    const delayedUntil = event.meta?.["delayedUntil"] as string | undefined;
    if (delayedUntil && event.meta?.["applied"] !== true) {
      const bucket = dueByDate[delayedUntil] ?? [];
      bucket.push(event);
      dueByDate[delayedUntil] = bucket;
    }

    const playerId = event.meta?.["playerId"] as string | undefined;
    if (playerId) {
      const bucket = byPlayer[playerId] ?? [];
      bucket.push(event);
      byPlayer[playerId] = bucket;
    }

    const clubId = event.meta?.["clubId"] as string | undefined;
    if (clubId) {
      const bucket = byClub[clubId] ?? [];
      bucket.push(event);
      byClub[clubId] = bucket;
    }
  }

  return {
    byId,
    byEventKey,
    dueByDate,
    byPlayer,
    byClub,
    eventCount: events.length,
  };
}

export function ensureEventRuntimeIndex(state: GameState): EventRuntimeIndex {
  const events = state.events ?? [];
  const existing = state.meta?.eventRuntimeIndex;
  if (!existing) {
    const rebuilt = buildEventRuntimeIndex(events);
    return rebuilt;
  }

  if (existing.eventCount !== events.length) {
    return buildEventRuntimeIndex(events);
  }

  for (const event of events) {
    if (!event) continue;
    if (existing.byId[event.id] !== event) {
      return buildEventRuntimeIndex(events);
    }
  }

  return existing;
}

function addEventToIndex(
  index: EventRuntimeIndex,
  event: EventLogEntry,
): EventRuntimeIndex {
  const next: EventRuntimeIndex = {
    byId: { ...index.byId },
    byEventKey: { ...index.byEventKey },
    dueByDate: { ...index.dueByDate },
    byPlayer: { ...index.byPlayer },
    byClub: { ...index.byClub },
    eventCount: index.eventCount,
  };

  next.byId[event.id] = event;
  const eventKey = event.meta?.["eventKey"] ?? event.id;
  next.byEventKey[eventKey] = event;

  const delayedUntil = event.meta?.["delayedUntil"] as string | undefined;
  if (delayedUntil && event.meta?.["applied"] !== true) {
    next.dueByDate[delayedUntil] = [...(next.dueByDate[delayedUntil] ?? []), event];
  }

  const playerId = event.meta?.["playerId"] as string | undefined;
  if (playerId) {
    next.byPlayer[playerId] = [...(next.byPlayer[playerId] ?? []), event];
  }

  const clubId = event.meta?.["clubId"] as string | undefined;
  if (clubId) {
    next.byClub[clubId] = [...(next.byClub[clubId] ?? []), event];
  }

  next.eventCount += 1;
  return next;
}

function replaceEventInIndex(
  index: EventRuntimeIndex,
  previousEvent: EventLogEntry | undefined,
  nextEvent: EventLogEntry,
): EventRuntimeIndex {
  const next: EventRuntimeIndex = {
    byId: { ...index.byId },
    byEventKey: { ...index.byEventKey },
    dueByDate: { ...index.dueByDate },
    byPlayer: { ...index.byPlayer },
    byClub: { ...index.byClub },
    eventCount: index.eventCount,
  };

  if (previousEvent) {
    next.byId[previousEvent.id] = nextEvent;
    const previousKey = previousEvent.meta?.["eventKey"] ?? previousEvent.id;
    if (next.byEventKey[previousKey] === previousEvent) {
      next.byEventKey[previousKey] = nextEvent;
    }
    const prevDelayedUntil = previousEvent.meta?.["delayedUntil"] as string | undefined;
    if (prevDelayedUntil) {
      const bucket = (next.dueByDate[prevDelayedUntil] ?? []).filter((item) => item.id !== previousEvent.id);
      next.dueByDate[prevDelayedUntil] = bucket;
    }
    const prevPlayerId = previousEvent.meta?.["playerId"] as string | undefined;
    if (prevPlayerId) {
      const bucket = (next.byPlayer[prevPlayerId] ?? []).filter((item) => item.id !== previousEvent.id);
      next.byPlayer[prevPlayerId] = bucket;
    }
    const prevClubId = previousEvent.meta?.["clubId"] as string | undefined;
    if (prevClubId) {
      const bucket = (next.byClub[prevClubId] ?? []).filter((item) => item.id !== previousEvent.id);
      next.byClub[prevClubId] = bucket;
    }
  }

  next.byId[nextEvent.id] = nextEvent;
  const eventKey = nextEvent.meta?.["eventKey"] ?? nextEvent.id;
  next.byEventKey[eventKey] = nextEvent;

  const delayedUntil = nextEvent.meta?.["delayedUntil"] as string | undefined;
  if (delayedUntil && nextEvent.meta?.["applied"] !== true) {
    next.dueByDate[delayedUntil] = [...(next.dueByDate[delayedUntil] ?? []), nextEvent];
  }

  const playerId = nextEvent.meta?.["playerId"] as string | undefined;
  if (playerId) {
    next.byPlayer[playerId] = [...(next.byPlayer[playerId] ?? []), nextEvent];
  }

  const clubId = nextEvent.meta?.["clubId"] as string | undefined;
  if (clubId) {
    next.byClub[clubId] = [...(next.byClub[clubId] ?? []), nextEvent];
  }

  return next;
}

export function appendGameEvent(state: GameState, event: EventLogEntry): GameState {
  const currentEvents = state.events ?? [];
  const runtimeIndex = ensureEventRuntimeIndex(state);
  const nextIndex = addEventToIndex(runtimeIndex, event);
  return {
    ...state,
    events: [...currentEvents, event],
    meta: {
      ...(state.meta ?? {}),
      eventRuntimeIndex: nextIndex,
    },
  };
}

export function updateGameEvent(
  state: GameState,
  eventId: string,
  updater: (event: EventLogEntry) => EventLogEntry,
): GameState {
  const currentEvents = state.events ?? [];
  const previousEvent = currentEvents.find((item) => item.id === eventId);
  if (!previousEvent) return state;

  const nextEvent = updater(previousEvent);
  const runtimeIndex = ensureEventRuntimeIndex(state);
  const nextIndex = replaceEventInIndex(runtimeIndex, previousEvent, nextEvent);

  return {
    ...state,
    events: currentEvents.map((item) => (item.id === eventId ? nextEvent : item)),
    meta: {
      ...(state.meta ?? {}),
      eventRuntimeIndex: nextIndex,
    },
  };
}
