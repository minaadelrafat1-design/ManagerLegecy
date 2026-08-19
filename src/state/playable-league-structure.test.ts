import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { buildCareerState } from "./new-career";
import { applyPromotionRelegation } from "./promotion";

describe("playable league structures", () => {
  it("keeps the nine-club national league isolated to the demo seed", () => {
    const state = buildInitialState();
    expect(state.currentClub.leagueId).toBe("national-league");
    expect(Object.values(state.clubs).filter((club) => club.leagueId === "national-league")).toHaveLength(9);
    expect(state.meta?.worldConfig?.countries.some((country) =>
      country.divisions.some((division) => division.id === "national-league"),
    )).toBe(false);
  });

  it("uses the intended 22-club, 42-match playable New Career league", () => {
    const state = buildCareerState({
      managerName: "Test Manager",
      nationality: "ENG",
      philosophyId: "possession",
      clubId: "millbrook-town",
    });
    const clubs = Object.values(state.clubs).filter((club) => club.leagueId === "regional-third-division");
    const fixtures = state.fixtures.filter(
      (fixture) => fixture.competitionId === "regional-third-division",
    );
    const counts = new Map<string, { total: number; home: number; away: number }>();
    for (const club of clubs) counts.set(club.id, { total: 0, home: 0, away: 0 });
    const pairings = new Set<string>();
    for (const fixture of fixtures) {
      pairings.add(`${fixture.homeClubId}|${fixture.awayClubId}`);
      counts.get(fixture.homeClubId)!.total += 1;
      counts.get(fixture.homeClubId)!.home += 1;
      counts.get(fixture.awayClubId)!.total += 1;
      counts.get(fixture.awayClubId)!.away += 1;
    }

    expect(clubs).toHaveLength(22);
    expect(fixtures).toHaveLength(462);
    expect(new Set([...counts.values()].map((value) => value.total))).toEqual(new Set([42]));
    expect(new Set([...counts.values()].map((value) => value.home))).toEqual(new Set([21]));
    expect(new Set([...counts.values()].map((value) => value.away))).toEqual(new Set([21]));
    expect(pairings.size).toBe(462);
  });

  it("does not apply the demo hierarchy to the standalone playable regional division", () => {
    const state = buildCareerState({
      managerName: "Test Manager",
      nationality: "ENG",
      philosophyId: "possession",
      clubId: "millbrook-town",
    });
    const before = Object.values(state.clubs).filter((club) => club.leagueId === "regional-third-division").length;
    const after = applyPromotionRelegation(state);
    const afterCount = Object.values(after.clubs).filter((club) => club.leagueId === "regional-third-division").length;
    expect(afterCount).toBe(before);
  });
});
