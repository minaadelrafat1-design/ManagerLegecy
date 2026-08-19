import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { generateLeagueFixtures } from "./season";
import { applyPromotionRelegation } from "./promotion";
import { runDomesticCup } from "./cups";

function configuredDivisions(state: ReturnType<typeof buildInitialState>) {
  return state.meta?.worldConfig?.countries.flatMap((country) => country.divisions) ?? [];
}

describe("configured league pyramid", () => {
  it("uses 20 clubs in top tiers and 22 in every lower division", () => {
    const state = buildInitialState();

    for (const division of configuredDivisions(state)) {
      const clubs = Object.values(state.clubs).filter((club) => club.leagueId === division.id);
      const target = division.level === 1 ? 20 : 22;
      expect(clubs.length, division.id).toBe(target);
      expect(new Set(clubs.map((club) => club.id)).size, division.id).toBe(clubs.length);
    }
  });

  it("generates a complete, balanced double round robin for every configured division", () => {
    const base = buildInitialState();
    const state = generateLeagueFixtures({ ...base, fixtures: [] });
    const season = String(state.time.season);

    for (const division of configuredDivisions(state)) {
      const clubs = Object.values(state.clubs).filter((club) => club.leagueId === division.id);
      const fixtures = state.fixtures.filter(
        (fixture) => fixture.competitionId === division.id && fixture.season === season,
      );
      const expectedPerClub = 2 * (clubs.length - 1);
      expect(fixtures.length, division.id).toBe(clubs.length * (clubs.length - 1));

      const ids = new Set<string>();
      const pairings = new Set<string>();
      const appearances = new Map<string, { home: number; away: number }>();
      for (const club of clubs) appearances.set(club.id, { home: 0, away: 0 });

      for (const fixture of fixtures) {
        expect(ids.has(fixture.id), `${division.id} duplicate fixture id`).toBe(false);
        ids.add(fixture.id);

        const pairing = `${fixture.homeClubId}|${fixture.awayClubId}`;
        expect(pairings.has(pairing), `${division.id} duplicate home/away pairing`).toBe(false);
        pairings.add(pairing);

        appearances.get(fixture.homeClubId)!.home += 1;
        appearances.get(fixture.awayClubId)!.away += 1;
      }

      for (const [clubId, counts] of appearances) {
        expect(counts.home + counts.away, `${division.id}:${clubId}`).toBe(expectedPerClub);
        expect(counts.home, `${division.id}:${clubId} home`).toBe(clubs.length - 1);
        expect(counts.away, `${division.id}:${clubId} away`).toBe(clubs.length - 1);
      }
    }
  });

  it("keeps division sizes stable when configured promotion and relegation spots exchange", () => {
    const base = generateLeagueFixtures({ ...buildInitialState(), fixtures: [] });
    const completed = {
      ...base,
      fixtures: base.fixtures.map((fixture) => ({
        ...fixture,
        status: "played" as const,
        scoreHome: 1,
        scoreAway: 0,
      })),
    };
    const next = applyPromotionRelegation(completed);

    for (const division of configuredDivisions(base)) {
      const clubs = Object.values(next.clubs).filter((club) => club.leagueId === division.id);
      const target = division.level === 1 ? 20 : 22;
      expect(clubs.length, division.id).toBe(target);
    }
  });

  it("gives the nine-team demo league 24 matches per club", () => {
    const state = buildInitialState();
    const clubs = Object.values(state.clubs).filter((club) => club.leagueId === "national-league");
    const fixtures = state.fixtures.filter(
      (fixture) =>
        fixture.competitionId === "national-league" && fixture.season === String(state.time.season),
    );
    const appearances = new Map<string, number>();
    for (const club of clubs) appearances.set(club.id, 0);
    for (const fixture of fixtures) {
      appearances.set(fixture.homeClubId, (appearances.get(fixture.homeClubId) ?? 0) + 1);
      appearances.set(fixture.awayClubId, (appearances.get(fixture.awayClubId) ?? 0) + 1);
    }

    expect(clubs).toHaveLength(9);
    expect(fixtures).toHaveLength(108);
    expect([...appearances.values()]).toEqual(Array(9).fill(24));
    expect(
      fixtures.filter(
        (fixture) => fixture.calendarDate > state.time.date && fixture.status === "scheduled",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("starts the demo domestic cup with only demo-league entrants", () => {
    const state = runDomesticCup(buildInitialState());
    const cupFixtures = state.fixtures.filter((fixture) => fixture.competitionId === "national-cup");
    const demoClubIds = new Set(
      Object.values(state.clubs)
        .filter((club) => club.leagueId === "national-league")
        .map((club) => club.id),
    );

    expect(cupFixtures).toHaveLength(4);
    expect(cupFixtures.every((fixture) => demoClubIds.has(fixture.homeClubId))).toBe(true);
    expect(cupFixtures.every((fixture) => demoClubIds.has(fixture.awayClubId))).toBe(true);
    expect(new Set(cupFixtures.flatMap((fixture) => [fixture.homeClubId, fixture.awayClubId])).size).toBe(8);
  });
});
