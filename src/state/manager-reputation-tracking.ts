import { registerDailyHook } from "./calendar";
import type { GameState } from "./types";

/**
 * Track manager reputation-earning events and apply bonuses.
 * Significant achievements boost manager reputation:
 * - Cup victories (+3-5)
 * - Promotion (+4-6)
 * - European qualification (+2-3)
 * - Player development breakthroughs (+1-2)
 * - Overperformance vs expectations (+1)
 *
 * Reputation represents manager prestige/market value for job opportunities.
 * Higher reputation attracts better job offers.
 */
function trackReputationEvents(state: GameState): GameState {
  let next = state;
  const manager = next.manager;
  if (!manager || !manager.clubId) return next;

  const managedClub = next.clubs[manager.clubId];
  if (!managedClub) return next;

  // Scan recent events for reputation-earning moments
  const recentEvents = (next.events ?? []).slice(-20); // check last 20 events
  let reputationDelta = 0;
  let reputationSource = "";
  const updatedEvents: typeof next.events = [];

  for (const event of recentEvents) {
    let eventToAdd = event;
    // Check if event has already been processed for reputation
    const meta = event.meta as Record<string, unknown> | undefined;
    if (meta?.["reputationApplied"]) {
      updatedEvents.push(eventToAdd);
      continue;
    }

    // Cup victories
    if (
      event.type === "milestone" &&
      (event.description?.includes("Cup") || event.description?.includes("won")) &&
      event.description?.includes(managedClub.name)
    ) {
      const isDomesticCup = event.description?.includes("Cup");
      const cupBonus = isDomesticCup ? 4 : 2; // domestic cups worth more
      reputationDelta = Math.max(reputationDelta, cupBonus);
      reputationSource = "Cup victory";
      eventToAdd = { ...event, meta: { ...meta, reputationApplied: true } };
    }

    // Promotions
    if (
      event.type === "milestone" &&
      (event.description?.includes("promoted") || event.description?.includes("Promotion"))
    ) {
      reputationDelta = Math.max(reputationDelta, 5);
      reputationSource = "Promotion";
      eventToAdd = { ...event, meta: { ...meta, reputationApplied: true } };
    }

    // European qualification
    if (
      event.type === "milestone" &&
      (event.description?.includes("European") || event.description?.includes("Champions League"))
    ) {
      reputationDelta = Math.max(reputationDelta, 3);
      reputationSource = "European qualification";
      eventToAdd = { ...event, meta: { ...meta, reputationApplied: true } };
    }

    updatedEvents.push(eventToAdd);
  }

  // Apply reputation changes if any were found
  if (reputationDelta > 0) {
    const currentReputation = manager.reputation ?? 50;
    const newReputation = Math.min(100, currentReputation + reputationDelta);
    next = {
      ...next,
      manager: {
        ...manager,
        reputation: newReputation,
      },
    };

    // Add news about reputation change
    if (reputationSource) {
      const nid = `news-reputation-${(next.news?.length ?? 0) + 1}`;
      next = {
        ...next,
        news: [
          ...(next.news ?? []),
          {
            id: nid,
            tag: "manager",
            time: next.time.date,
            text: `Manager reputation improved (${reputationSource}): ${currentReputation} → ${newReputation}`,
          },
        ],
      };
    }
  }

  // Return updated state with any reputationApplied flags set on events
  return { ...next, events: updatedEvents };
}

/**
 * Monthly check: overperformance vs board expectations can boost reputation.
 * If board confidence is high and improving, manager's reputation slowly improves
 * as they're seen as meeting/exceeding expectations.
 */
function checkExpectationsPerformance(state: GameState): GameState {
  // Only run monthly
  if ((state.time?.day ?? 0) % 30 !== 0) return state;

  let next = state;
  const manager = next.manager;
  const board = next.board;

  if (!manager || !board) return next;

  // If board confidence is strong and board is optimistic, manager gains reputation
  const confidence = board.confidence ?? 50;
  if (confidence >= 70) {
    // Strong board confidence = manager meeting expectations
    const currentReputation = manager.reputation ?? 50;
    const reputationGain = confidence >= 85 ? 2 : 1;
    next = {
      ...next,
      manager: {
        ...manager,
        reputation: Math.min(100, currentReputation + reputationGain),
      },
    };
  }

  return next;
}

registerDailyHook("events", (state: GameState) => {
  // OPTIMIZATION: Only track reputation every 7 days to reduce overhead
  // Reputation changes gradually so daily tracking is unnecessary
  const dayOfCycle = state.time.day % 7;
  if (dayOfCycle !== 0) return state;

  let next = trackReputationEvents(state);
  next = checkExpectationsPerformance(next);
  return next;
});

export {};
