import {
  GameState,
  InboxMessage,
  InboxMessageCategory,
  InboxMessagePriority,
  EventLogEntry,
} from "./types";
import { Player, Club, TransferListing, Fixture } from "./types";
import { addDaysISO, registerDailyHook } from "./calendar";

/**
 * Transform an EventLogEntry into zero or more InboxMessage objects.
 * Returns empty array if event should not generate a message.
 * Handles all EventLogType cases with category, priority, and content rules.
 */
export function eventToMessages(event: EventLogEntry, state: GameState): InboxMessage[] {
  const messages: InboxMessage[] = [];

  switch (event.type) {
    // ---- TRANSFERS ----
    case "TRANSFER_COMPLETED": {
      const meta = event.meta as Record<string, unknown>;
      const playerId = meta["playerId"] as string | undefined;
      const fromClubId = meta["fromClubId"] as string | undefined;
      const toClubId = meta["toClubId"] as string | undefined;
      const player = playerId ? state.players?.[playerId] : undefined;
      const fromClub = fromClubId ? state.clubs?.[fromClubId] : undefined;
      const toClub = toClubId ? state.clubs?.[toClubId] : undefined;

      if (player && toClub) {
        const isManagerClub = toClub.id === state.currentClub.id;
        const message: InboxMessage = {
          id: `inbox-${event.id}`,
          date: event.date,
          category: "transfers",
          title: isManagerClub
            ? `${player.name} signed from ${fromClub?.name ?? "release"}`
            : `${player.name} transferred to ${toClub.name}`,
          body: isManagerClub
            ? `Your club has successfully signed ${player.name} (${player.pos}, age ${player.age}). 
               A quality addition to the squad at ${player.value}.`
            : `${player.name} has transferred to ${toClub.name} from ${fromClub?.name ?? "release"}. 
               The move was completed on ${event.date}.`,
          priority: isManagerClub ? "high" : "normal",
          isRead: false,
          ...(playerId && { relatedEntityId: playerId }),
          ...(isManagerClub && { action: "view_player" }),
          ...(event.id && { sourceEventId: event.id }),
        };
        messages.push(message);
      }
      break;
    }

    case "TRANSFER_REJECTED": {
      const { playerId, clubId, reason } = (event.meta ?? {}) as any;
      const player = state.players?.[playerId];
      if (player) {
        messages.push({
          id: `inbox-${event.id}`,
          date: event.date,
          category: "transfers",
          title: `Transfer offer rejected: ${player.name}`,
          body: `Your transfer offer for ${player.name} has been rejected. ${reason ? `Reason: ${reason}` : "The club declined to negotiate."}`,
          priority: "normal",
          isRead: false,
          relatedEntityId: playerId,
          action: "view_player",
          sourceEventId: event.id,
        });
      }
      break;
    }

    case "TRANSFER_ACCEPTED": {
      const { playerId, fromClubId, toClubId } = (event.meta ?? {}) as any;
      const player = state.players?.[playerId];
      const toClub = state.clubs?.[toClubId];
      if (player && toClub) {
        messages.push({
          id: `inbox-${event.id}`,
          date: event.date,
          category: "transfers",
          title: `Transfer agreed: ${player.name} → ${toClub.name}`,
          body: `Your transfer offer for ${player.name} to ${toClub.name} has been accepted. 
                 Contract and salary terms are being finalized.`,
          priority: "high",
          isRead: false,
          relatedEntityId: playerId,
          action: "view_negotiation",
          sourceEventId: event.id,
        });
      }
      break;
    }

    // ---- NEGOTIATIONS ---- (using transfer event type)
    case "transfer": {
      // Note: negotiation events are not explicitly defined in EventLogType.
      // This case handles transfer-related events generically.
      if (event.meta && typeof event.meta === "object") {
        const meta = event.meta as Record<string, unknown>;
        const playerId = meta["playerId"] as string | undefined;
        const clubId =
          (meta["clubId"] as string | undefined) ??
          (meta["buyerClubId"] as string | undefined) ??
          (meta["sellerClubId"] as string | undefined);
        const player = playerId ? state.players?.[playerId] : undefined;
        const club = clubId ? state.clubs?.[clubId] : undefined;

        if (player && club) {
          const action = meta["action"] as string | undefined;
          const title =
            action === "negotiation_start" && meta["stage"] === "player"
              ? `Player is negotiating contract terms: ${player.name}`
              : action === "negotiation_update" && meta["stage"] === "player"
                ? `Player / agent responded: ${player.name}`
                : action === "negotiation_update"
              ? event.description.includes("counter")
                ? `Club submitted a counteroffer: ${player.name}`
                : `Negotiation update: ${player.name}`
              : action === "negotiation_close" && meta["status"] === "accepted"
                ? `Club accepted your offer: ${player.name}`
                : action === "negotiation_close" && meta["status"] === "rejected"
                  ? `Club rejected your offer: ${player.name}`
                  : `Transfer update: ${player.name}`;
          const message: InboxMessage = {
            id: `inbox-${event.id}`,
            date: event.date,
            category: "transfers",
            title,
            body: `Update regarding ${player.name}: ${event.description}`,
            priority: "normal",
            isRead: false,
            ...(playerId && { relatedEntityId: playerId }),
            ...(event.id && { sourceEventId: event.id }),
          };
          messages.push(message);
        }
      }
      break;
    }

    // ---- MATCHES ----
    case "MATCH_PLAYED": {
      const meta = event.meta as Record<string, unknown>;
      const fixtureId = meta["fixtureId"] as string | undefined;
      const result = meta["result"] as string | undefined;
      const scoreHome = meta["scoreHome"] as number | undefined;
      const scoreAway = meta["scoreAway"] as number | undefined;
      const fixture = fixtureId ? state.fixtures?.find((f) => f.id === fixtureId) : undefined;
      const isManagerHome = fixture && fixture.homeClubId === state.currentClub.id;
      const isManagerAway = fixture && fixture.awayClubId === state.currentClub.id;
      const isManager = isManagerHome || isManagerAway;

      if (fixture) {
        const title = isManager
          ? `Match: ${state.clubs[fixture.homeClubId]?.name} ${scoreHome}-${scoreAway} ${state.clubs[fixture.awayClubId]?.name}`
          : `Match Result: ${state.clubs[fixture.homeClubId]?.name} ${scoreHome}-${scoreAway} ${state.clubs[fixture.awayClubId]?.name}`;

        const priority: InboxMessagePriority = isManager ? "high" : "normal";

        const message: InboxMessage = {
          id: `inbox-${event.id}`,
          date: event.date,
          category: "matches",
          title,
          body: `Final Score: ${state.clubs[fixture.homeClubId]?.name ?? "Home"} ${scoreHome} - ${scoreAway} ${state.clubs[fixture.awayClubId]?.name ?? "Away"}. ${
            isManager
              ? result === "W"
                ? "Excellent performance!"
                : result === "D"
                  ? "A solid draw."
                  : "Disappointing result."
              : "Match completed."
          }`,
          priority,
          isRead: false,
          ...(fixtureId && { relatedEntityId: fixtureId }),
          ...(isManager && { action: "view_fixture" }),
          ...(event.id && { sourceEventId: event.id }),
        };
        messages.push(message);
      }
      break;
    }

    // ---- SQUAD / PLAYER STATUS ----
    case "PLAYER_RETIRED": {
      const { playerId } = (event.meta ?? {}) as any;
      const player = state.players?.[playerId];
      if (player && player.clubId === state.currentClub.id) {
        messages.push({
          id: `inbox-${event.id}`,
          date: event.date,
          category: "squad",
          title: `Player retired: ${player.name}`,
          body: `${player.name} has retired from professional football at age ${player.age}. 
                 A career-ending injury or decision ends ${player.pos}'s time at the club.`,
          priority: "high",
          isRead: false,
          relatedEntityId: playerId,
          sourceEventId: event.id,
        });
      }
      break;
    }

    case "PLAYER_MOVEMENT": {
      const { playerId, reason, severity } = (event.meta ?? {}) as any;
      const player = state.players?.[playerId];
      if (player && player.clubId === state.currentClub.id) {
        // Only show high-severity movement issues
        if (severity === "high" || severity === "critical") {
          const priority: InboxMessagePriority = severity === "critical" ? "critical" : "high";

          messages.push({
            id: `inbox-${event.id}`,
            date: event.date,
            category: "squad",
            title: `${severity === "critical" ? "🔴" : "🟡"} Player issue: ${player.name}`,
            body: `${player.name} is experiencing ${reason || "a serious issue"}. 
                   Immediate attention may be required.`,
            priority,
            isRead: false,
            relatedEntityId: playerId,
            action: "view_player",
            sourceEventId: event.id,
          });
        }
      }
      break;
    }

    // ---- YOUTH / ACADEMY ----
    case "YOUTH_GENERATED": {
      const { playerId, potential, position } = (event.meta ?? {}) as any;
      const player = state.players?.[playerId];
      if (player && player.clubId === state.currentClub.id) {
        const isPotential = potential && potential > 70;
        messages.push({
          id: `inbox-${event.id}`,
          date: event.date,
          category: "youth",
          title: isPotential
            ? `🌟 Exciting prospect: ${player.name}`
            : `New academy product: ${player.name}`,
          body: isPotential
            ? `${player.name} (${position}) shows exceptional potential and could become a key player for the club.`
            : `${player.name} (${position}) has graduated from the academy and is available for team selection.`,
          priority: isPotential ? "high" : "normal",
          isRead: false,
          relatedEntityId: playerId,
          action: "view_player",
          sourceEventId: event.id,
        });
      }
      break;
    }

    // ---- LEAGUE EVENTS ----
    case "PROMOTION": {
      const { clubId, season } = (event.meta ?? {}) as any;
      const club = state.clubs?.[clubId];
      const isManagerClub = clubId === state.currentClub.id;
      if (club) {
        messages.push({
          id: `inbox-${event.id}`,
          date: event.date,
          category: "world",
          title: isManagerClub ? `🎉 Promotion! You are going up!` : `${club.name} promoted`,
          body: isManagerClub
            ? `Congratulations! Your club has been promoted to a higher league for the ${season} season. 
               This is a major achievement and opens new opportunities.`
            : `${club.name} has been promoted to a higher division.`,
          priority: isManagerClub ? "critical" : "normal",
          isRead: false,
          relatedEntityId: clubId,
          sourceEventId: event.id,
        });
      }
      break;
    }

    case "RELEGATION": {
      const { clubId, season } = (event.meta ?? {}) as any;
      const club = state.clubs?.[clubId];
      const isManagerClub = clubId === state.currentClub.id;
      if (club) {
        messages.push({
          id: `inbox-${event.id}`,
          date: event.date,
          category: "world",
          title: isManagerClub ? `Relegation 😞` : `${club.name} relegated`,
          body: isManagerClub
            ? `Your club has been relegated to a lower league for the ${season} season. 
               Focus on rebuilding and targeting promotion next year.`
            : `${club.name} has been relegated to a lower division.`,
          priority: isManagerClub ? "critical" : "normal",
          isRead: false,
          relatedEntityId: clubId,
          sourceEventId: event.id,
        });
      }
      break;
    }

    case "COMPETITION_WINNER": {
      const { clubId, competition } = (event.meta ?? {}) as any;
      const club = state.clubs?.[clubId];
      const isManagerClub = clubId === state.currentClub.id;
      if (club) {
        messages.push({
          id: `inbox-${event.id}`,
          date: event.date,
          category: "world",
          title: isManagerClub ? `🏆 Champions! ${competition}` : `${club.name} won ${competition}`,
          body: isManagerClub
            ? `Extraordinary! Your club has won the ${competition}. 
               This is a historic achievement and will boost morale and prestige.`
            : `${club.name} has won the ${competition}.`,
          priority: isManagerClub ? "critical" : "normal",
          isRead: false,
          relatedEntityId: clubId,
          sourceEventId: event.id,
        });
      }
      break;
    }

    // ---- BOARD / MANAGER ----
    case "board": {
      // Handle board-related events (objectives, manager changes)
      const { clubId, status, objective } = (event.meta ?? {}) as any;
      const isManagerClub = clubId === state.currentClub.id;
      if (isManagerClub && objective) {
        const priority: InboxMessagePriority = status === "failed" ? "high" : "normal";
        messages.push({
          id: `inbox-${event.id}`,
          date: event.date,
          category: "board",
          title:
            status === "achieved"
              ? `✅ Objective achieved: ${objective}`
              : `⚠️ Objective failed: ${objective}`,
          body:
            status === "achieved"
              ? `You have successfully completed the board's objective: ${objective}. Excellent work!`
              : `You have failed to meet the board's objective: ${objective}. This may affect your job security.`,
          priority,
          isRead: false,
          sourceEventId: event.id,
        });
      }
      break;
    }

    case "manager":
      // Manager-related events: handled by board case or other logic
      break;

    case "PLAYER_CREATED":
    case "EUROPEAN_QUALIFICATION":
    default:
      // These event types exist but don't generate user-facing inbox messages
      // (they're tracked in the event log but filtered from inbox)
      break;
  }

  return messages;
}

/**
 * Check if a message with this content already exists in the inbox
 * to prevent duplicates within the dedup window.
 */
export function isDuplicateMessage(
  newMessage: InboxMessage,
  existing: InboxMessage[],
  dedupeWindowDays: number,
): boolean {
  const newDate = new Date(newMessage.date);
  const windowStart = new Date(newDate.getTime() - dedupeWindowDays * 24 * 60 * 60 * 1000);

  // Check for same title + category + relatedEntityId within window
  return existing.some((msg) => {
    if (msg.archivedAt) return false; // Don't dedupe against archived

    const msgDate = new Date(msg.date);
    if (msgDate < windowStart) return false; // Outside window

    const titleMatch = msg.title === newMessage.title;
    const categoryMatch = msg.category === newMessage.category;
    const entityMatch = msg.relatedEntityId === newMessage.relatedEntityId;

    return titleMatch && categoryMatch && entityMatch;
  });
}

/**
 * Process recent events and generate inbox messages.
 * Called daily from the calendar hook system.
 */
export function generateInboxMessagesFromEvents(
  state: GameState,
  lookbackDays: number = 1,
): InboxMessage[] {
  const inbox = state.inbox ?? [];
  const inboxSettings = state.inboxSettings ?? {
    archiveOldAfterDays: 30,
    dedupeWindowDays: 1,
  };
  const cutoffDate = addDaysISO(state.time.date, -lookbackDays);

  const existingSourceIds = new Set<string>();
  const dedupeKeys = new Set<string>();
  const dedupeCutoff = addDaysISO(
    state.time.date,
    -lookbackDays - inboxSettings.dedupeWindowDays,
  );

  for (const message of inbox) {
    if (typeof message.sourceEventId === "string") existingSourceIds.add(message.sourceEventId);
    if (message.archivedAt || message.date < dedupeCutoff) continue;
    dedupeKeys.add(`${message.title}\u0000${message.category}\u0000${message.relatedEntityId ?? ""}`);
  }

  const newEvents = (state.events ?? []).filter(
    (event) => event.date >= cutoffDate && !existingSourceIds.has(event.id),
  );

  const newMessages: InboxMessage[] = [];

  for (const event of newEvents) {
    const messages = eventToMessages(event, state);
    for (const msg of messages) {
      const key = `${msg.title}\u0000${msg.category}\u0000${msg.relatedEntityId ?? ""}`;
      if (dedupeKeys.has(key)) continue;
      dedupeKeys.add(key);
      newMessages.push(msg);
    }
  }

  return newMessages;
}

/**
 * Archive old messages and clean up inbox.
 */
export function cleanupInbox(state: GameState): GameState {
  if (!state.inbox || !state.inboxSettings) return state;

  const archiveThreshold = addDaysISO(
    state.time.date,
    -state.inboxSettings.archiveOldAfterDays,
  );
  const permanentDeleteThreshold = addDaysISO(
    archiveThreshold,
    -10,
  );
  let changed = false;
  const filtered: typeof state.inbox = [];

  for (const msg of state.inbox) {
    let nextMessage = msg;
    if (!msg.archivedAt && msg.date < archiveThreshold) {
      nextMessage = { ...msg, archivedAt: state.time.date };
      changed = true;
    }
    if (nextMessage.archivedAt && nextMessage.archivedAt <= permanentDeleteThreshold) {
      changed = true;
      continue;
    }
    filtered.push(nextMessage);
  }

  if (!changed) return state;

  return {
    ...state,
    inbox: filtered,
  };
}

/**
 * Calculate unread message count for display in UI.
 */
export function getUnreadCount(state: GameState): number {
  return (state.inbox ?? []).filter((m) => !m.isRead && !m.archivedAt).length;
}

/**
 * Daily hook: Generate inbox messages from recent events.
 * Runs after events have been created, deduplicates, and cleans up old messages.
 */
registerDailyHook("events", (state, time) => {
  const recentEvents = (state.events ?? []).filter(
    (event) => event.date >= addDaysISO(state.time.date, -2),
  );

  if (recentEvents.length === 0) {
    return state;
  }

  // Generate messages from events created on previous day
  const newMessages = generateInboxMessagesFromEvents(state, 1);
  const nextState = {
    ...state,
    inbox: [...(state.inbox ?? []), ...newMessages],
  };

  // Clean up archived/old messages
  return cleanupInbox(nextState);
});

export {};
