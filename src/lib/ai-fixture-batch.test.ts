import { describe, expect, it } from "vitest";
import { buildInitialState } from "@/state/seed";
import {
  applyAiFixtureResults,
  applyAiFixtureResultsBatched,
  type AiFixtureResult,
} from "./ai-fixture-sim";

describe("same-day AI fixture player batching", () => {
  function fixtureState() {
    const state = buildInitialState("batch-equivalence");
    const fixtures = state.fixtures.filter((fixture) => fixture.status === "scheduled");
    const first = fixtures[0];
    const second = fixtures.find(
      (fixture) =>
        fixture.homeClubId !== first?.homeClubId &&
        fixture.homeClubId !== first?.awayClubId &&
        fixture.awayClubId !== first?.homeClubId &&
        fixture.awayClubId !== first?.awayClubId,
    );
    if (!first || !second) throw new Error("Expected independent fixtures");
    return { state, first, second };
  }

  function result(fixture: { id: string; homeClubId: string; awayClubId: string }, home: number, away: number): AiFixtureResult {
    return {
      fixtureId: fixture.id,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      homeStrength: 60,
      awayStrength: 60,
      outcome: home > away ? "H" : home < away ? "A" : "D",
      scoreHome: home,
      scoreAway: away,
      seed: 100 + home + away,
    };
  }

  it.each([[3, 1], [1, 1], [0, 2]])("matches sequential state for %i-%i", (home, away) => {
    const { state, first, second } = fixtureState();
    const results = [result(first, home, away), result(second, away, home)];
    const sequential = applyAiFixtureResults(state, results, state.time.date);
    const batched = applyAiFixtureResultsBatched(state, results, state.time.date);
    expect(batched).toEqual(sequential);
    expect(state.players).not.toBe(batched.players);
  });

  it("returns the original state for zero results", () => {
    const { state } = fixtureState();
    expect(applyAiFixtureResultsBatched(state, [], state.time.date)).toBe(state);
  });

  it("falls back to sequential behavior when a player overlap is detected", () => {
    const { state, first } = fixtureState();
    const results = [result(first, 2, 0), result(first, 1, 1)];
    const sequential = applyAiFixtureResults(state, results, state.time.date);
    const batched = applyAiFixtureResultsBatched(state, results, state.time.date);
    expect(batched).toEqual(sequential);
  });
});
