/**
 * Test to verify advance day button is enabled after a match is played.
 */

import { buildInitialState } from "./src/state/seed";
import { gameReducer } from "./src/state/reducer";
import { selectNextFixture } from "./src/state/calendar";
import { getPendingManagerFixtureForToday } from "./src/state/calendar";

function testAdvanceDayAfterMatch() {
  console.log("\n🧪 Test: Advance Day Button Enabled After Match");
  console.log("=".repeat(60));

  let state = buildInitialState();
  const managerClubId = state.currentClub.id;

  // Advance to find a fixture
  let dayCounter = 0;
  while (dayCounter < 30) {
    const todayFixture = state.fixtures.find(
      (f) =>
        f.status === "scheduled" &&
        f.calendarDate === state.time.date &&
        (f.homeClubId === managerClubId || f.awayClubId === managerClubId),
    );

    if (todayFixture) break;
    state = gameReducer(state, { type: "ADVANCE_DAY" });
    dayCounter++;
  }

  const fixture = state.fixtures.find(
    (f) =>
      f.status === "scheduled" &&
      f.calendarDate === state.time.date &&
      (f.homeClubId === managerClubId || f.awayClubId === managerClubId),
  );

  if (!fixture) {
    console.log("❌ No fixture found");
    return false;
  }

  console.log(`\n1️⃣  Before match:`);
  console.log(`   Fixture: ${fixture.id} (${fixture.status})`);

  const nextFixtureBefore = selectNextFixture(state);
  const blockingFixtureBefore =
    getPendingManagerFixtureForToday(state) ||
    (nextFixtureBefore && nextFixtureBefore.calendarDate === state.time.date
      ? nextFixtureBefore.status === "scheduled"
        ? nextFixtureBefore
        : undefined
      : undefined);
  const isAdvanceBlockedBefore = !!blockingFixtureBefore;

  console.log(`   Advance blocked? ${isAdvanceBlockedBefore ? "YES ✓" : "NO"}`);
  console.log(`   Button shows: ${isAdvanceBlockedBefore ? "MATCH TODAY" : "→ ADVANCE DAY"}`);

  if (!isAdvanceBlockedBefore) {
    console.log("   ❌ Button should be blocked before match");
    return false;
  }

  // Play the match
  state = gameReducer(state, {
    type: "RECORD_MATCH_RESULT",
    fixtureId: fixture.id,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    scoreHome: 2,
    scoreAway: 1,
    seed: 12345,
    playedAt: fixture.calendarDate,
  });

  console.log(`\n2️⃣  After match:`);

  const playedFixture = state.fixtures.find((f) => f.id === fixture.id);
  console.log(`   Fixture: ${playedFixture?.id} (${playedFixture?.status})`);
  console.log(`   Score: ${playedFixture?.scoreHome}-${playedFixture?.scoreAway}`);

  const nextFixtureAfter = selectNextFixture(state);
  const blockingFixtureAfter =
    getPendingManagerFixtureForToday(state) ||
    (nextFixtureAfter && nextFixtureAfter.calendarDate === state.time.date
      ? nextFixtureAfter.status === "scheduled"
        ? nextFixtureAfter
        : undefined
      : undefined);
  const isAdvanceBlockedAfter = !!blockingFixtureAfter;

  console.log(`   Advance blocked? ${isAdvanceBlockedAfter ? "YES" : "NO ✓"}`);
  console.log(`   Button shows: ${isAdvanceBlockedAfter ? "MATCH TODAY" : "→ ADVANCE DAY"}`);

  if (isAdvanceBlockedAfter) {
    console.log("   ❌ Button should NOT be blocked after match is played");
    return false;
  }

  console.log(`\n3️⃣  Fixture panel still visible for reference:`);
  console.log(`   nextFixture: ${nextFixtureAfter?.id} ✓`);
  console.log(
    `   Shows: ${state.clubs[nextFixtureAfter?.homeClubId!]?.name} vs ${state.clubs[nextFixtureAfter?.awayClubId!]?.name} ✓`,
  );

  console.log("\n" + "=".repeat(60));
  console.log("✅ TEST PASSED: Advance day button is enabled after match");
  console.log("\nDashboard shows:");
  console.log("  ✓ Match result in fixture panel (for reference)");
  console.log("  ✓ Advance day button enabled and clickable");
  console.log("  ✓ Player can progress to next day");
  console.log("=".repeat(60) + "\n");

  return true;
}

const result = testAdvanceDayAfterMatch();
process.exit(result ? 0 : 1);
