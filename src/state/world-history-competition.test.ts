import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { recordCupWinner, recordEuropeanWinner, recordSeasonChampion } from "./world-history";

describe("competition history references", () => {
  it("persists explicit competition IDs for league, cup, and European records", () => {
    const state = buildInitialState("history-competition-reference");
    const clubId = state.currentClub.id;
    let next = recordSeasonChampion(state, clubId, "National League", "2026/27", "national-league");
    next = recordCupWinner(next, clubId, "National Cup", "2026/27", "national-cup");
    next = recordEuropeanWinner(
      next,
      clubId,
      "UEFA Champions League",
      "2026/27",
      "uefa-champions-league",
    );

    expect(next.history?.clubRecords.map((record) => record.competitionId)).toEqual([
      "national-league",
      "national-cup",
      "uefa-champions-league",
    ]);
  });
});
