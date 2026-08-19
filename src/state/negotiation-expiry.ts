import { registerDailyHook, addDaysISO } from "./calendar";
import { closeNegotiation } from "./negotiation-sessions";
import type { GameState } from "./types";

/**
 * Expire negotiations that have been open too long without activity.
 * - Transfer negotiations: expire after 14 days
 * - Contract negotiations: expire after 7 days (salary talks are faster)
 * AI clubs automatically initiate new sessions if priority is high enough,
 * so old failed sessions don't permanently block decisions.
 */
function expireOldNegotiations(state: GameState): GameState {
  const sessions = state.negotiations ?? [];
  if (sessions.length === 0) return state;

  let next = state;
  const today = state.time.date;

  for (const session of sessions) {
    if (session.status !== "open") continue; // only expire open negotiations

    // Get the oldest entry's date
    const firstEntry = session.entries[0];
    if (!firstEntry) continue;

    const startDate = new Date(firstEntry.date);
    const todayDate = new Date(today);
    const daysOpen = Math.floor(
      (todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Determine expiry threshold based on type
    const expiryDays = session.type === "transfer" ? 14 : 7; // transfers 2 weeks, contracts 1 week

    if (daysOpen >= expiryDays) {
      // Expire the negotiation
      const message =
        session.type === "transfer"
          ? `Transfer negotiations expired after ${daysOpen} days`
          : `Contract negotiations expired after ${daysOpen} days`;
      next = closeNegotiation(next, session.id, "expired", message);
    }
  }

  return next;
}

registerDailyHook("events", (state: GameState) => {
  // OPTIMIZATION: Only check negotiations every 3 days instead of daily
  // Negotiations don't expire that frequently so daily checks are unnecessary
  const dayOfCycle = state.time.day % 3;
  if (dayOfCycle !== 0) return state;

  return expireOldNegotiations(state);
});

export {};
