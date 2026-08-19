import { registerDailyHook } from "./calendar";
import { simulateAndApplyScheduledAiFixturesViaEngine } from "../lib/ai-match-adapter";
import type { GameState } from "./types";

/**
 * Resolve only today's current-season AI fixtures through the canonical match
 * engine. The adapter excludes the manager's interactive fixture and applies
 * results through RECORD_MATCH_RESULT, which supplies the exactly-once guard.
 */
export function resolveTodaysAiFixtures(state: GameState): GameState {
  const currentSeason = String(state.time.season);
  const hasEligibleFixture = (state.fixtures ?? []).some(
    (fixture) =>
      fixture.status === "scheduled" &&
      fixture.calendarDate === state.time.date &&
      String(fixture.season ?? currentSeason) === currentSeason &&
      fixture.homeClubId !== state.currentClub.id &&
      fixture.awayClubId !== state.currentClub.id,
  );

  if (!hasEligibleFixture) return state;
  return simulateAndApplyScheduledAiFixturesViaEngine(state, state.time.date);
}

registerDailyHook("fixtures", (state) => resolveTodaysAiFixtures(state));
