/**
 * Test: Verify play button is hidden after match, and advance day doesn't crash
 */

import { buildInitialState } from "./src/state/seed";
import { gameReducer } from "./src/state/reducer";
import { selectNextFixture } from "./src/state/calendar";

function testPlayButtonAndAdvanceDayFlow() {
  console.log("\n🧪 Test: Play Button Hidden After Match + Advance Day Safe");
  console.log("=".repeat(70));

  let state = buildInitialState();
  const managerClubId = state.currentClub.id;

  // Step 1: Find a fixture
  console.log("\n1️⃣  Finding a scheduled fixture...");
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
    console.log("   ❌ No fixture found");
    return false;
  }

  console.log(`   ✓ Found fixture: ${fixture.id} on ${fixture.calendarDate}`);

  // Step 2: Verify play button should show
  console.log("\n2️⃣  Before match - verify play button SHOULD show:");
  const nextFixtureBefore = selectNextFixture(state);
  const isTodayMatchDayBefore =
    nextFixtureBefore && nextFixtureBefore.calendarDate === state.time.date;
  const shouldShowPlayButton = isTodayMatchDayBefore && nextFixtureBefore?.status === "scheduled";

  console.log(`   Fixture status: ${nextFixtureBefore?.status}`);
  console.log(`   Is today's match: ${isTodayMatchDayBefore}`);
  console.log(`   Play button visible: ${shouldShowPlayButton ? "YES ✓" : "NO ❌"}`);

  if (!shouldShowPlayButton) {
    console.log("   ❌ Play button should be visible for scheduled fixture");
    return false;
  }

  // Step 3: Play the match
  console.log("\n3️⃣  Playing the match...");
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
  console.log(`   ✓ Match recorded`);

  // Step 4: Verify play button is hidden after match
  console.log("\n4️⃣  After match - verify play button is HIDDEN:");
  const nextFixtureAfter = selectNextFixture(state);
  const isTodayMatchDayAfter =
    nextFixtureAfter && nextFixtureAfter.calendarDate === state.time.date;
  const playButtonShouldBeHidden = !(
    isTodayMatchDayAfter && nextFixtureAfter?.status === "scheduled"
  );

  console.log(`   Fixture status: ${nextFixtureAfter?.status}`);
  console.log(`   Is today's match: ${isTodayMatchDayAfter}`);
  console.log(`   Play button visible: ${!playButtonShouldBeHidden ? "YES" : "NO ✓"}`);

  if (!playButtonShouldBeHidden) {
    console.log("   ❌ Play button should be HIDDEN for played fixture");
    return false;
  }

  // Step 5: Test advance day doesn't crash
  console.log("\n5️⃣  Testing advance day action (should not crash)...");
  try {
    const beforeAdvance = state;
    state = gameReducer(state, { type: "ADVANCE_DAY", days: 1 });

    console.log(`   ✓ Advance day succeeded`);
    console.log(`   Old date: ${beforeAdvance.time.date}`);
    console.log(`   New date: ${state.time.date}`);

    // Verify state is still valid
    const nextFixtureAfterAdvance = selectNextFixture(state);
    console.log(
      `   ✓ Can still select next fixture: ${nextFixtureAfterAdvance?.id || "none (end of season)"}`,
    );

    // Verify no undefined fixture data
    if (nextFixtureAfterAdvance) {
      const homeClub = state.clubs[nextFixtureAfterAdvance.homeClubId];
      const awayClub = state.clubs[nextFixtureAfterAdvance.awayClubId];
      if (!homeClub || !awayClub) {
        console.log("   ❌ Fixture references invalid clubs after advance");
        return false;
      }
      console.log(`   ✓ Fixture has valid club data`);
    }
  } catch (err) {
    console.log(`   ❌ Advance day crashed: ${err}`);
    return false;
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ ALL TESTS PASSED");
  console.log("\nBehavior verified:");
  console.log("  ✓ Play button shows for scheduled fixtures");
  console.log("  ✓ Play button hidden after match is played");
  console.log("  ✓ Advance day button works without crash");
  console.log("  ✓ State remains valid after advance");
  console.log("=".repeat(70) + "\n");

  return true;
}

const result = testPlayButtonAndAdvanceDayFlow();
process.exit(result ? 0 : 1);
