import { registerDailyHook, addDaysISO } from "./calendar";
import type { GameState } from "./types";
import { seededUnit } from "./utils";
import { changeRelationship, relationshipLabel, getRelationship } from "./relationships";
import { ensureEventRuntimeIndex } from "./event-runtime-index";

// Basic event engine: processes delayed events and generates emergent ones.
registerDailyHook("events", (state: GameState, time) => {
  let next = state;

  const today = next.time.date;
  const events = [...(next.events ?? [])];
  const runtimeIndex = ensureEventRuntimeIndex(next);
  const eventIndexById = new Map<string, number>();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event && !eventIndexById.has(event.id)) eventIndexById.set(event.id, index);
  }
  const eventsForToday = (runtimeIndex.dueByDate[today] ?? []).map((event) => ({
    event,
    index: eventIndexById.get(event.id) ?? -1,
  }));

  for (const { event: ev, index: i } of eventsForToday) {
    const meta = (ev.meta ?? {}) as Record<string, unknown>;

    // apply consequences based on meta.type
    if (meta["type"] === "player_conflict") {
      const pid = meta["playerId"] as string | undefined;
      if (pid && next.players[pid]) {
        // lower morale and relationships
        next = {
          ...next,
          players: {
            ...next.players,
            [pid]: {
              ...next.players[pid],
              morale: Math.max(0, (next.players[pid].morale ?? 50) - 8),
            },
          },
        };
        next = changeRelationship(next, "manager", next.manager.id, "player", pid, -12);
        // schedule a possible transfer request a week later
        const trDate = addDaysISO(today, 7);
        const player = next.players[pid];
        if (player) {
          const trEv: GameState["events"][number] = {
            id: `event-${events.length + 1}`,
            date: trDate,
            type: "transfer" as const,
            description: `Transfer rumour: ${player.name} may request move`,
            meta: {
              type: "transfer_request",
              playerId: pid,
              delayedUntil: trDate,
              applied: false,
            },
          };
          events.push(trEv);
        }
      }
    }
    // mark applied
    if (i >= 0) {
      events[i] = { ...ev, meta: { ...meta, applied: true } } as GameState["events"][number];
    }
  }

  // emergent event generation: simple rules (only for manager's club to avoid checking all players)
  const managedClubId = next.currentClub.id;
  const managedClub = next.clubs[managedClubId];
  const playerIds = managedClub?.playerIds ?? [];

  for (const pid of playerIds) {
    const p = next.players[pid];
    if (!p) continue;
    const rel = getRelationship(next, "manager", next.manager.id, "player", pid) ?? 50;
    // if morale low and relationship poor, small chance to create player_conflict
    if ((p.morale ?? 50) < 35 && rel < 45) {
      const chance = seededUnit(`${next.time.date}|conflict|${pid}`);
      if (chance < 0.18) {
        const delayed = addDaysISO(next.time.date, 3);
        const ev = {
          id: `event-${events.length + 1}`,
          date: next.time.date,
          type: "milestone" as const,
          description: `Tension with ${p.name} detected`,
          meta: { type: "player_conflict", playerId: pid, delayedUntil: delayed, applied: false },
        };
        events.push(ev);
        // immediate small relationship drop
        next = changeRelationship(next, "manager", next.manager.id, "player", pid, -6);
      }
    }
    // youth discovery: if player is young and trainingEfficiency high, chance to discover
    if ((p.age ?? 99) <= 21 && (p.development?.trainingEfficiency ?? 50) > 65) {
      const chance = seededUnit(`${next.time.date}|youth|${pid}`);
      if (chance < 0.02) {
        const ev = {
          id: `event-${events.length + 1}`,
          date: next.time.date,
          type: "milestone" as const,
          description: `Youth discovery: ${p.name} impresses in training`,
          meta: { type: "youth_discovery", playerId: pid },
        };
        events.push(ev);
        // boost relationship with staff/manager
        next = changeRelationship(next, "manager", next.manager.id, "player", pid, 6);
      }
    }
  }

  // OPTIMIZATION: Archive old events (>90 days) to prevent unbounded array growth
  // Calculate cutoff date (90 days ago)
  const cutoffDate = addDaysISO(today, -90);

  // Keep only recent events and events with future delayedUntil dates
  const recentEvents = events.filter((ev) => {
    if (!ev) return false;
    const meta = (ev.meta ?? {}) as Record<string, unknown>;
    const delayedUntil = meta["delayedUntil"] as string | undefined;

    // Keep if:
    // 1. Has future delayedUntil date (not yet processed)
    if (delayedUntil && delayedUntil > today) return true;

    // 2. Event date is recent, including applied events for history
    if (ev.date >= cutoffDate) return true;

    return false;
  });

  next = { ...next, events: recentEvents };

  return next;
}, { mergeMode: "authoritative" });

export {};
