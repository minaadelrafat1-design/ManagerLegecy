import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const { applyPromotionRelegation } = await import("../src/state/promotion.ts");
const { finalizeSeasonIfNeeded, initializeSeasonFixturesIfNeeded } =
  await import("../src/state/season.ts");
const { advanceGameDays } = await import("../src/state/calendar.ts");

function makeFinishedSeasonState() {
  const state = buildInitialState();
  return {
    ...state,
    fixtures: (state.fixtures ?? []).map((fixture) => ({
      ...fixture,
      status: "played",
      scoreHome: fixture.homeClubId === state.currentClub.id ? 2 : 1,
      scoreAway: fixture.awayClubId === state.currentClub.id ? 0 : 2,
      result: "W",
    })),
    time: {
      ...state.time,
      season: "2026/27",
      date: "2027-06-01",
    },
  };
}

const finished = makeFinishedSeasonState();
assert.equal(
  finished.fixtures.every((f) => f.status === "played"),
  true,
  "season fixtures should all be played",
);

const transitioned = finalizeSeasonIfNeeded(finished);
assert.ok(
  transitioned.time.season !== finished.time.season,
  "season should advance to a new season",
);
assert.equal(
  (transitioned.fixtures ?? []).some((f) => f.status === "scheduled"),
  false,
  "fresh fixtures should wait for the August 1 season initialization boundary",
);
assert.ok(
  transitioned.clubs && transitioned.currentClub,
  "world should persist across the transition",
);
assert.ok(transitioned.meta?.worldYear !== undefined, "world year should continue");

const promoted = applyPromotionRelegation(transitioned);
assert.ok(
  promoted.events?.some((e) => /promot|relegat/i.test(String(e.description ?? ""))),
  "promotion or relegation should be recorded",
);

const openingDay = {
  ...transitioned,
  time: {
    ...transitioned.time,
    date: "2027-08-01",
  },
};
const initialized = initializeSeasonFixturesIfNeeded(openingDay);
assert.ok(
  (initialized.fixtures ?? []).some((f) => f.status === "scheduled"),
  "new season should generate fresh fixtures on August 1",
);
const advanced = advanceGameDays(initialized, 1);
assert.ok(
  advanced.time.date !== transitioned.time.date,
  "calendar should advance normally after season transition",
);

console.log("PASS — season transition lifecycle");
process.exit(0);
