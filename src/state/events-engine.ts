import { registerDailyHook, addDaysISO } from "./calendar";
import type { GameState } from "./types";
import { seededUnit } from "./utils";
import { changeRelationship, relationshipLabel, getRelationship } from "./relationships";

// Basic event engine: processes delayed events and generates emergent ones.
registerDailyHook("events", (state: GameState, time) => {
  let next = state;

  const today = next.time.date;
  const events = [...(next.events ?? [])];
  if (events.length === 0) {
    return state;
  }

  const hasDueEvents = events.some((ev) => {
    if (!ev) return false;
    const meta = (ev.meta ?? {}) as Record<string, unknown>;
    const delayedUntil = meta["delayedUntil"] as string | undefined;
    return delayedUntil === today && !meta["applied"];
  });

  if (!hasDueEvents) {
    const managedClubId = next.currentClub?.id;
    const managedClub = managedClubId ? next.clubs[managedClubId] : undefined;
    const playerIds = managedClub?.playerIds ?? [];
    if (playerIds.length === 0) {
      return state;
    }
  }

  // Build index of events scheduled for today (avoid O(n) scan of all events)
  const eventsForToday: Array<{ event: (typeof events)[number]; index: number }> = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev) continue;
    const meta = (ev.meta ?? {}) as Record<string, unknown>;
    const delayedUntil = meta["delayedUntil"] as string | undefined;

    if (delayedUntil === today && !meta["applied"]) {
      eventsForToday.push({ event: ev, index: i });
    }
  }

  // Process only events scheduled for today (typically 0-5 events, not all 100+)
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

  const cutoffDate = addDaysISO(today, -90);
  const needsArchive = events.some((ev) => {
    if (!ev) return false;
    const meta = (ev.meta ?? {}) as Record<string, unknown>;
    const delayedUntil = meta["delayedUntil"] as string | undefined;
    if (delayedUntil && delayedUntil > today) return true;
    return ev.date < cutoffDate;
  });

  if (needsArchive) {
    const recentEvents = events.filter((ev) => {
      if (!ev) return false;
      const meta = (ev.meta ?? {}) as Record<string, unknown>;
      const delayedUntil = meta["delayedUntil"] as string | undefined;
      if (delayedUntil && delayedUntil > today) return true;
      if (ev.date >= cutoffDate) return true;
      return false;
    });
    next = { ...next, events: recentEvents };
  } else {
    next = { ...next, events };
  }

  return next;
});

export {};
