import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { finalizeSeasonIfNeeded, buildEndOfSeasonReport } from "./season";

describe("season report", () => {
  it("creates a season report once the season genuinely ends", () => {
    const state = buildInitialState();
    const season = String(state.time.season);

    const finalState = {
      ...state,
      time: {
        ...state.time,
        date: `${Number.parseInt(season.split("/")[0], 10) + 1}-05-31`,
      },
      fixtures: state.fixtures.map((fixture) =>
        fixture.season === season ? { ...fixture, status: "played" } : fixture,
      ),
    };

    const firstPass = finalizeSeasonIfNeeded(finalState);
    const secondPass = finalizeSeasonIfNeeded(firstPass);

    expect(firstPass.seasonReport).toBeDefined();
    expect(firstPass.seasonReport?.season).toBe(season);
    expect(firstPass.seasonReport?.highlights.length).toBeGreaterThan(0);
    expect(secondPass.seasonReport?.season).toBe(season);
    expect(secondPass.seasonReport?.generatedAt).toBe(firstPass.seasonReport?.generatedAt);
  });

  it("derives report data from the real game state without duplicating stats", () => {
    const state = buildInitialState();
    const report = buildEndOfSeasonReport(state);

    expect(report).toBeNull();

    const finalState = {
      ...state,
      time: {
        ...state.time,
        date: `${Number.parseInt(String(state.time.season).split("/")[0], 10) + 1}-05-31`,
      },
      fixtures: state.fixtures.map((fixture) =>
        fixture.season === String(state.time.season) ? { ...fixture, status: "played" } : fixture,
      ),
    };

    const completed = finalizeSeasonIfNeeded(finalState);
    const generated = buildEndOfSeasonReport(completed);

    expect(generated).toBeDefined();
    expect(generated?.clubName).toBe(completed.currentClub.name);
    expect(generated?.competitions.length).toBeGreaterThanOrEqual(1);
    expect(generated?.highlights.length).toBeGreaterThan(0);
    expect(generated?.squad.players).toBeGreaterThan(0);
    expect(generated?.manager.tier).toBeDefined();
  });
});
