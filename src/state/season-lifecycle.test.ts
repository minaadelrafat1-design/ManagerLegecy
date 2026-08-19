import { afterEach, describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { gameReducer } from "./reducer";
import { sanitizeLoadedGameState } from "./store";
import { setDailyHooksEnabled } from "./calendar";

function buildCompletedDemoSeason() {
  const base = buildInitialState();
  const demoClubIds = new Set(
    Object.values(base.clubs)
      .filter((club) => club.leagueId === "national-league")
      .map((club) => club.id),
  );
  const fixtures = base.fixtures
    .filter(
      (fixture) =>
        fixture.competitionId === "national-league" &&
        demoClubIds.has(fixture.homeClubId) &&
        demoClubIds.has(fixture.awayClubId),
    )
    .map((fixture) => ({
      ...fixture,
      season: "2027/28",
      status: "played" as const,
      scoreHome: 1,
      scoreAway: 0,
    }));

  return {
    ...base,
    time: {
      ...base.time,
      date: "2028-05-14",
      season: "2027/28",
      seasonStartDate: "2027-08-01",
    },
    clubs: Object.fromEntries(
      Object.entries(base.clubs).filter(([id]) => demoClubIds.has(id)),
    ),
    leagues: { "national-league": base.leagues["national-league"]! },
    competitions: base.competitions.filter(
      (competition) => competition.id === "national-league" || competition.id === "national-cup",
    ),
    fixtures,
    currentClub: { ...base.currentClub, leagueId: "national-league" },
    manager: { ...base.manager, clubId: base.currentClub.id },
    meta: { ...(base.meta ?? {}), fixturesInitializedSeason: undefined },
  };
}

describe("natural season lifecycle", () => {
  afterEach(() => setDailyHooksEnabled(true));

  it("keeps the date moving through the off-season and initializes fixtures exactly at August 1", () => {
    setDailyHooksEnabled(false);
    let state = buildCompletedDemoSeason();

    state = gameReducer(state, { type: "ADVANCE_DAY" });
    expect(state.time.date).toBe("2028-05-15");
    expect(state.time.season).toBe("2027/28");

    while (state.time.date < "2028-08-01") {
      state = gameReducer(state, { type: "ADVANCE_DAY" });
    }

    expect(state.time.date).toBe("2028-08-01");
    expect(state.time.season).toBe("2028/29");
    expect(
      state.fixtures.filter(
        (fixture) => fixture.season === "2028/29" && fixture.competitionId === "national-league",
      ),
    ).toHaveLength(108);

    const fixtureCount = state.fixtures.length;
    state = gameReducer(state, { type: "ADVANCE_DAY" });
    expect(state.time.date).toBe("2028-08-02");
    expect(state.fixtures).toHaveLength(fixtureCount);
    expect(state.meta?.fixturesInitializedSeason).toBe("2028/29");
  });

  it("reloads on July 31 and initializes once on August 1", () => {
    const base = buildCompletedDemoSeason();
    const july31 = {
      ...base,
      time: {
        ...base.time,
        date: "2028-07-31",
        season: "2028/29",
        seasonStartDate: "2027-08-01",
      },
      fixtures: [],
    };
    const loaded = sanitizeLoadedGameState(july31);
    expect(loaded).toBeDefined();

    const august1 = gameReducer(loaded!, { type: "ADVANCE_DAY" });
    expect(august1.time.date).toBe("2028-08-01");
    expect(august1.meta?.fixturesInitializedSeason).toBe("2028/29");
    const fixtureCount = august1.fixtures.filter(
      (fixture) => fixture.competitionId === "national-league" && fixture.season === "2028/29",
    ).length;

    const reloaded = sanitizeLoadedGameState(august1)!;
    const nextDay = gameReducer(reloaded, { type: "ADVANCE_DAY" });
    expect(nextDay.time.date).toBe("2028-08-02");
    expect(
      nextDay.fixtures.filter(
        (fixture) => fixture.competitionId === "national-league" && fixture.season === "2028/29",
      ),
    ).toHaveLength(fixtureCount);
  });
});
