import { describe, it, expect } from "vitest";
import { buildInitialState } from "./seed";
import { generateLeagueFixtures } from "./season";

describe("Realistic season calendar", () => {
  it("generates August-to-May league fixtures with balanced club scheduling", () => {
    const season = "2026/27";
    const [seasonYear] = season.split("/");
    const baseState = buildInitialState();
    const leagueId = Object.keys(baseState.leagues)[0];
    const leagueClubs = Object.values(baseState.clubs)
      .filter((club) => club.leagueId === leagueId)
      .slice(0, 8);

    const state = {
      ...baseState,
      leagues: {
        [leagueId]: baseState.leagues[leagueId],
      },
      clubs: Object.fromEntries(leagueClubs.map((club) => [club.id, club])),
      fixtures: [],
      time: {
        ...baseState.time,
        season,
        seasonStartDate: `${seasonYear}-08-01`,
        date: `${seasonYear}-08-15`,
      },
    };

    const generated = generateLeagueFixtures(state);
    const leagueFixtures = (generated.fixtures ?? []).filter(
      (fixture) =>
        (fixture.season ?? season) === season && fixture.competitionId !== "national-cup",
    );

    expect(leagueFixtures.length).toBeGreaterThan(0);

    const firstDate = [...leagueFixtures].sort((a, b) =>
      (a.calendarDate ?? "").localeCompare(b.calendarDate ?? ""),
    )[0]?.calendarDate;
    const lastDate = [...leagueFixtures]
      .sort((a, b) => (a.calendarDate ?? "").localeCompare(b.calendarDate ?? ""))
      .at(-1)?.calendarDate;

    expect(firstDate).toBeDefined();
    expect(lastDate).toBeDefined();
    expect(firstDate! >= `${seasonYear}-08-01`).toBe(true);
    expect(firstDate! <= `${seasonYear}-08-31`).toBe(true);
    expect(lastDate! <= `${Number(seasonYear) + 1}-05-31`).toBe(true);
    expect(
      leagueFixtures.some((fixture) => fixture.calendarDate > `${Number(seasonYear) + 1}-05-31`),
    ).toBe(false);
    expect(leagueFixtures.some((fixture) => fixture.calendarDate < `${seasonYear}-08-01`)).toBe(
      false,
    );

    const clubDates = new Map<string, Set<string>>();
    const clubHomeAway = new Map<string, { home: number; away: number }>();
    for (const club of leagueClubs) {
      clubDates.set(club.id, new Set<string>());
      clubHomeAway.set(club.id, { home: 0, away: 0 });
    }

    const seenExactMatches = new Set<string>();
    for (const fixture of leagueFixtures) {
      const exactKey = `${fixture.homeClubId}|${fixture.awayClubId}|${fixture.calendarDate}`;
      expect(seenExactMatches.has(exactKey)).toBe(false);
      seenExactMatches.add(exactKey);

      const home = clubHomeAway.get(fixture.homeClubId);
      const away = clubHomeAway.get(fixture.awayClubId);
      if (home) home.home += 1;
      if (away) away.away += 1;

      clubDates.get(fixture.homeClubId)?.add(fixture.calendarDate);
      clubDates.get(fixture.awayClubId)?.add(fixture.calendarDate);
    }

    for (const [clubId, dates] of clubDates) {
      expect([...dates].length).toBeGreaterThan(0);
      expect(
        [...dates].every((date) => {
          const clubFixtures = leagueFixtures.filter(
            (fixture) =>
              fixture.calendarDate === date &&
              (fixture.homeClubId === clubId || fixture.awayClubId === clubId),
          );
          return clubFixtures.length <= 1;
        }),
      ).toBe(true);
    }

    const homeAwayBalance = [...clubHomeAway.values()].every(
      ({ home, away }) => Math.abs(home - away) <= 1,
    );
    expect(homeAwayBalance).toBe(true);

    const weekendMatches = leagueFixtures.filter((fixture) =>
      [0, 6].includes(new Date(`${fixture.calendarDate}T00:00:00Z`).getUTCDay()),
    ).length;
    const midweekMatches = leagueFixtures.filter((fixture) =>
      [2, 4].includes(new Date(`${fixture.calendarDate}T00:00:00Z`).getUTCDay()),
    ).length;
    expect(weekendMatches + midweekMatches).toBe(leagueFixtures.length);
    expect(weekendMatches).toBeGreaterThan(0);
    expect(midweekMatches).toBeGreaterThanOrEqual(0);
  });
});
