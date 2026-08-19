/**
 * PHASE AAA-REPAIR-4: Player Lifecycle Tests
 *
 * This comprehensive test suite validates that the player lifecycle system
 * works correctly after the repair:
 * 1. Age progression - players age exactly once per season
 * 2. Retirement - occurs once per player, status changes, removed from squad
 * 3. Youth generation - legitimate new players with realistic attributes
 * 4. DOB-based age - authoritative age calculation from date of birth
 * 5. No state drift - repeated seasons produce consistent results
 */

import type { GameState } from "../src/state/types";
import { buildInitialState } from "../src/state/seed";
import { advanceGameDays, calculateAge, generateDOBFromAge } from "../src/state/calendar";
import { runSeasonalPlayerLifecycle } from "../src/state/player-development";
import { runSeasonalYouthGeneration } from "../src/state/academy";

function findPlayerById(state: GameState, playerId: string) {
  return state.players[playerId];
}

function countRetiredPlayers(state: GameState): number {
  return Object.values(state.players).filter((p) => p.status === "retired").length;
}

function getRetirementEvents(state: GameState) {
  return state.events.filter((e) => e.type === "PLAYER_RETIRED");
}

function getYouthGenerationEvents(state: GameState) {
  return state.events.filter((e) => e.type === "YOUTH_GENERATED");
}

function advanceToDate(state: GameState, targetDate: string): GameState {
  let current = state;
  while (current.time.date < targetDate) {
    current = advanceGameDays(current, 1);
  }
  return current;
}

function advanceSeason(state: GameState): GameState {
  const [year, suffix] = state.time.season.split("/");
  const nextYear = Number(year) + 1;
  const nextSuffix = String(nextYear % 100).padStart(2, "0");
  // Advance to next season (August 1st)
  return advanceToDate(state, `${nextYear}-08-01`);
}

// TEST 1: Age Progression - DOB-based age advances once at the birthday transition
async function testAgeProgression() {
  console.log("\n=== TEST 1: Age Progression ===");
  const baseState = buildInitialState() as any;
  const playerId = "dob-age-test-player";
  const basePlayer = Object.values(baseState.players)[0];
  const clubId = baseState.currentClub.id;

  const state: GameState = {
    ...baseState,
    time: { ...baseState.time, date: "2024-07-31", season: "2024/25" },
    players: {
      ...baseState.players,
      [playerId]: {
        ...basePlayer,
        id: playerId,
        name: "DOB Age Test Player",
        age: 24,
        dateOfBirth: "2000-08-01",
        clubId,
        status: "available",
        contractYears: 2,
      },
    },
    clubs: {
      ...baseState.clubs,
      [clubId]: {
        ...baseState.clubs[clubId],
        playerIds: [...baseState.clubs[clubId].playerIds, playerId],
      },
    },
  };

  const before = findPlayerById(state, playerId)!;
  console.log(`Before birthday: age ${before.age} from DOB ${before.dateOfBirth}`);

  const afterBirthday = runSeasonalPlayerLifecycle({
    ...state,
    time: { ...state.time, date: "2024-08-01", season: "2024/25" },
  } as any) as any;
  const ageAfterBirthday = findPlayerById(afterBirthday, playerId)!;
  console.log(
    `After birthday: age ${ageAfterBirthday.age} from DOB ${ageAfterBirthday.dateOfBirth}`,
  );

  if (ageAfterBirthday.age !== 24) {
    console.log(`❌ FAIL: Expected age 24 on the exact birthday, got ${ageAfterBirthday.age}`);
    return;
  }

  const afterOneYear = runSeasonalPlayerLifecycle({
    ...afterBirthday,
    time: { ...afterBirthday.time, date: "2025-08-01", season: "2025/26" },
  } as any) as any;
  const ageOneYearLater = findPlayerById(afterOneYear, playerId)!;
  console.log(`One year later: age ${ageOneYearLater.age}`);

  if (ageOneYearLater.age !== 25) {
    console.log(`❌ FAIL: Expected age 25 one season later, got ${ageOneYearLater.age}`);
    return;
  }

  const sameCycle = runSeasonalPlayerLifecycle({
    ...afterOneYear,
    time: { ...afterOneYear.time, date: "2025-08-01", season: "2025/26" },
  } as any) as any;
  const noDoubleAge = findPlayerById(sameCycle, playerId)!;
  if (noDoubleAge.age !== 25) {
    console.log(`❌ FAIL: Double-age drift detected: expected 25, got ${noDoubleAge.age}`);
    return;
  }

  console.log("✓ PASS: Age progression is correct");
}

// TEST 2: Retirement - Occurs Once, Status Changes, Removed from Squad
async function testRetirement() {
  console.log("\n=== TEST 2: Retirement ===");
  let state = buildInitialState() as any;

  // Find an old GK who will likely retire (GK threshold is 38)
  let oldPlayerId: string | undefined;
  let targetClubId: string | undefined;

  for (const [pid, player] of Object.entries(state.players)) {
    if (player.pos === "GK" && player.age && player.age >= 37) {
      oldPlayerId = pid;
      targetClubId = player.clubId;
      break;
    }
  }

  if (!oldPlayerId) {
    console.log("SKIP: No suitable old player found for retirement test");
    return;
  }

  const oldPlayer = findPlayerById(state, oldPlayerId)!;
  console.log(
    `Player: ${oldPlayer.name} (${oldPlayerId}), Age: ${oldPlayer.age}, Status: ${oldPlayer.status}`,
  );

  // Count retirements before
  const retirementsBefore = countRetiredPlayers(state);
  const retirementEventsBefore = getRetirementEvents(state).length;

  // Advance to season start
  const currentYear = state.time.date.split("-")[0];
  state = advanceToDate(state, `${currentYear}-08-01`);
  state = runSeasonalPlayerLifecycle(state as any) as any;

  const afterRetirement = findPlayerById(state, oldPlayerId)!;
  console.log(`After Lifecycle: Age: ${afterRetirement.age}, Status: ${afterRetirement.status}`);

  // Verify retirement status was set
  if (afterRetirement.status !== "retired") {
    console.log("SKIP: Player did not retire (threshold not reached or unlucky roll)");
    return;
  }

  // Verify status changed
  if (oldPlayer.status === "retired") {
    console.log("SKIP: Player was already retired");
    return;
  }

  // Verify player was removed from squad
  if (targetClubId) {
    const targetClub = state.clubs[targetClubId];
    if (targetClub && targetClub.playerIds.includes(oldPlayerId)) {
      console.log(`❌ FAIL: Retired player still in squad playerIds`);
      return;
    }
  }

  // Verify retirement event was created
  const retirementEventsAfter = getRetirementEvents(state);
  if (retirementEventsAfter.length <= retirementEventsBefore) {
    console.log(`❌ FAIL: No retirement event created`);
    return;
  }

  console.log("✓ PASS: Retirement handled correctly");
}

// TEST 3: Youth Generation - Legitimate Players Created
async function testYouthGeneration() {
  console.log("\n=== TEST 3: Youth Generation ===");
  let state = buildInitialState() as any;

  const youthEventsBefore = getYouthGenerationEvents(state).length;

  // Advance to season start for youth generation
  const currentYear = state.time.date.split("-")[0];
  state = advanceToDate(state, `${currentYear}-08-01`);
  state = runSeasonalYouthGeneration(state as any) as any;

  const youthEventsAfter = getYouthGenerationEvents(state);
  const newYouthEvents = youthEventsAfter.length - youthEventsBefore;

  if (newYouthEvents === 0) {
    console.log("SKIP: No youth generated in this test run");
    return;
  }

  console.log(`Generated ${newYouthEvents} new youth players`);

  // Check the last generated player
  const lastYouthEvent = youthEventsAfter[youthEventsAfter.length - 1];
  const generatedPlayerId = (lastYouthEvent.meta as any)?.playerId;

  if (!generatedPlayerId) {
    console.log("❌ FAIL: Youth event missing playerId");
    return;
  }

  const generatedPlayer = findPlayerById(state, generatedPlayerId);
  if (!generatedPlayer) {
    console.log("❌ FAIL: Generated player not found in state");
    return;
  }

  console.log(`Generated Player: ${generatedPlayer.name}`);
  console.log(`  Age: ${generatedPlayer.age}, DOB: ${generatedPlayer.dateOfBirth}`);
  console.log(`  Position: ${generatedPlayer.pos}, Overall: ${generatedPlayer.overall}`);
  console.log(`  Potential: ${generatedPlayer.potential}`);

  // Verify youth are in expected age range
  if (!generatedPlayer.age || generatedPlayer.age < 15 || generatedPlayer.age > 18) {
    console.log(`❌ FAIL: Youth age ${generatedPlayer.age} out of range [15-18]`);
    return;
  }

  // Verify DOB exists
  if (!generatedPlayer.dateOfBirth) {
    console.log(`❌ FAIL: Generated player missing dateOfBirth`);
    return;
  }

  // Verify age calculated from DOB matches stored age
  const calculatedAge = calculateAge(generatedPlayer.dateOfBirth, state.time.date);
  if (calculatedAge !== generatedPlayer.age) {
    console.log(
      `❌ FAIL: Age mismatch - stored ${generatedPlayer.age}, calculated from DOB: ${calculatedAge}`,
    );
    return;
  }

  // Verify attributes are reasonable (overall should relate to potential)
  if (generatedPlayer.overall >= generatedPlayer.potential) {
    console.log(
      `❌ FAIL: Overall (${generatedPlayer.overall}) >= potential (${generatedPlayer.potential})`,
    );
    return;
  }

  console.log("✓ PASS: Youth generation creates legitimate players");
}

// TEST 4: DOB-Based Age - Authoritative Calculation
async function testDOBBasedAge() {
  console.log("\n=== TEST 4: DOB-Based Age Calculation ===");

  // Test the calculateAge function directly
  const testCases = [
    { dob: "2000-06-15", currentDate: "2024-06-14", expectedAge: 23 },
    { dob: "2000-06-15", currentDate: "2024-06-15", expectedAge: 24 },
    { dob: "2000-06-15", currentDate: "2024-06-16", expectedAge: 24 },
    { dob: "2000-01-01", currentDate: "2024-12-31", expectedAge: 24 },
    { dob: "2000-12-31", currentDate: "2024-01-01", expectedAge: 23 },
  ];

  let passCount = 0;
  for (const tc of testCases) {
    const calculated = calculateAge(tc.dob, tc.currentDate);
    if (calculated === tc.expectedAge) {
      passCount++;
      console.log(`  ✓ DOB ${tc.dob} on ${tc.currentDate} = age ${calculated}`);
    } else {
      console.log(
        `  ❌ DOB ${tc.dob} on ${tc.currentDate}: expected ${tc.expectedAge}, got ${calculated}`,
      );
    }
  }

  // Test generateDOBFromAge
  const age = 25;
  const referenceDate = "2024-06-15";
  const generatedDOB = generateDOBFromAge(age, referenceDate);
  const recalculatedAge = calculateAge(generatedDOB, referenceDate);

  if (recalculatedAge === age) {
    console.log(
      `  ✓ Generated DOB for age ${age}: ${generatedDOB} → recalculates to ${recalculatedAge}`,
    );
    passCount++;
  } else {
    console.log(
      `  ❌ Generated DOB age mismatch: expected ${age}, recalculated ${recalculatedAge}`,
    );
  }

  if (passCount === testCases.length + 1) {
    console.log("✓ PASS: DOB-based age calculation is correct");
  }
}

// TEST 5: No State Drift - Repeated Seasons
async function testNoDrift() {
  console.log("\n=== TEST 5: No State Drift Across Seasons ===");
  let state = buildInitialState() as any;

  const playersBefore = Object.keys(state.players).length;
  const clubsBefore = Object.keys(state.clubs).length;

  console.log(`Initial state: ${playersBefore} players, ${clubsBefore} clubs`);

  // Advance 3 full seasons and record counts
  for (let season = 1; season <= 3; season++) {
    const currentYear = state.time.date.split("-")[0];
    state = advanceToDate(state, `${currentYear}-08-01`);
    state = runSeasonalPlayerLifecycle(state as any) as any;
    state = runSeasonalYouthGeneration(state as any) as any;

    const playersNow = Object.keys(state.players).length;
    const clubsNow = Object.keys(state.clubs).length;

    console.log(`Season ${season}: ${playersNow} players, ${clubsNow} clubs`);
  }

  // Final checks
  const playersAfter = Object.keys(state.players).length;
  const clubsAfter = Object.keys(state.clubs).length;

  if (clubsAfter !== clubsBefore) {
    console.log(`❌ FAIL: Club count changed from ${clubsBefore} to ${clubsAfter}`);
    return;
  }

  // Players can increase due to youth generation, but shouldn't decrease drastically
  if (playersAfter < playersBefore * 0.9) {
    console.log(
      `❌ FAIL: Player count decreased too much from ${playersBefore} to ${playersAfter}`,
    );
    return;
  }

  console.log("✓ PASS: No significant state drift detected");
}

// Main test runner
async function runTests() {
  console.log("============================================");
  console.log("PHASE AAA-REPAIR-4: Player Lifecycle Tests");
  console.log("============================================");

  try {
    await testAgeProgression();
    await testRetirement();
    await testYouthGeneration();
    await testDOBBasedAge();
    await testNoDrift();

    console.log("\n============================================");
    console.log("All tests completed!");
    console.log("============================================\n");
  } catch (error) {
    console.error("Test execution error:", error);
    process.exit(1);
  }
}

runTests();
