import { registerDailyHook } from "./calendar";
import {
  computeTodayMatchFormDeltas,
  applyFormDeltas,
  decayInactivePlayerForm,
} from "./form-tracking";
import type { GameState } from "./types";

// Process completed matches and update player form
// PERF: Only process matches completed TODAY, batch all updates at once
registerDailyHook("fixtures", (state: GameState) => {
  let next = state;

  // 1. Find matches played today (usually 0 or 1, max a few)
  const todayMatches = (state.matches ?? []).filter((m) => m.playedAt === state.time.date);
  const hadMatchToday = todayMatches.length > 0;

  // 2. Batch compute all form deltas once
  if (hadMatchToday) {
    const deltas = computeTodayMatchFormDeltas(next, todayMatches);
    next = applyFormDeltas(next, deltas);
  }

  // 3. Decay form only when no match (and use optimized scan)
  next = decayInactivePlayerForm(next, hadMatchToday);

  return next;
});

export {};
