/**
 * TEST SUITE: Season Finalization Must NOT Reset Calendar
 *
 * CORE REQUIREMENT:
 * The calendar must advance sequentially by exactly 1 day, even when
 * a season ends. Season progression and calendar advancement are separate concerns.
 *
 * Example:
 * 14/11/2027 → season ends
 * Advance Day → 15/11/2027 (NOT 01/08/2028)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialState } from "./build";
import { gameReducer } from "./reducer";
import { isSeasonComplete, finalizeSeasonIfNeeded } from "./season";
import { addDaysISO } from "./calendar";
import type { GameState } from "./types";

describe("Season Calendar Separation", () => {
  let state: GameState;

  beforeEach(() => {
    state = buildInitialState();
  });

  // =========================================================================
  // TEST 1: Season ends on 14/11, advance day → 15/11 (NOT 01/08)
  // =========================================================================
  it("TEST 1: Advancing day after season ends preserves calendar continuity (14/11 → 15/11)", () => {
    // Arrange: Fast-forward to 14/11/2027 and mark season complete
    const targetDate = "2027-11-14";
    let test = state;

    // Advance to target date (14/11)
    const currentDate = test.time.date;
    const daysToAdvance = Math.max(1, getDayCount(currentDate, targetDate));

    for (let i = 0; i < daysToAdvance - 1; i++) {
      test = gameReducer(test, { type: "ADVANCE_DAY", days: 1 });
    }

    // Manually set the date to target (for test speed)
    test = {
      ...test,
      time: {
        ...test.time,
        date: targetDate,
        day: Math.floor(Math.random() * 100) + 1,
      },
    };

    // Mark season complete by clearing all scheduled fixtures
    test = {
      ...test,
      fixtures: (test.fixtures ?? []).map((f) =>
        f.season === test.time.season && f.status === "scheduled"
          ? { ...f, status: "played" as const }
          : f,
      ),
    };

    // Act: Verify season is complete, then advance day
    expect(isSeasonComplete(test)).toBe(true);
    const advancedState = gameReducer(test, { type: "ADVANCE_DAY", days: 1 });

    // Assert: Date must be 15/11, NOT 01/08
    expect(advancedState.time.date).toBe("2027-11-15");
    expect(advancedState.time.season).toBe("2027/28"); // Season changed
    console.log(`✓ TEST 1 PASSED: ${test.time.date} → ${advancedState.time.date}`);
  });

  // =========================================================================
  // TEST 2: Repeatedly advance after season ends, calendar stays sequential
  // =========================================================================
  it("TEST 2: Calendar remains sequential after season ends", () => {
    // Arrange: Set up state at 14/11 with season complete
    let test = state;
    test = {
      ...test,
      time: { ...test.time, date: "2027-11-14" },
      fixtures: (test.fixtures ?? []).map((f) =>
        f.status === "scheduled" ? { ...f, status: "played" as const } : f,
      ),
    };

    // Act: Advance 10 times
    const advanceSequence: string[] = [test.time.date];
    for (let i = 0; i < 10; i++) {
      test = gameReducer(test, { type: "ADVANCE_DAY", days: 1 });
      advanceSequence.push(test.time.date);
    }

    // Assert: Each date is exactly 1 day after the previous
    for (let i = 1; i < advanceSequence.length; i++) {
      const expected = addDaysISO(advanceSequence[i - 1], 1);
      expect(advanceSequence[i]).toBe(expected);
    }

    console.log(
      `✓ TEST 2 PASSED: Sequential dates from ${advanceSequence[0]} to ${advanceSequence[advanceSequence.length - 1]}`,
    );
  });

  // =========================================================================
  // TEST 3: 31/07 → 01/08 triggers new season initialization
  // =========================================================================
  it("TEST 3: New season starts when calendar naturally reaches 01/08", () => {
    // Arrange: Set up state at 31/07
    let test = state;
    test = {
      ...test,
      time: { ...test.time, date: "2028-07-31", season: "2027/28" },
    };

    // Act: Advance to 01/08
    test = gameReducer(test, { type: "ADVANCE_DAY", days: 1 });

    // Assert:
    // 1. Date is exactly 01/08
    expect(test.time.date).toBe("2028-08-01");
    // 2. Season has progressed to 2028/29
    expect(test.time.season).toBe("2028/29");
    // 3. New fixtures should be generated for the new season
    const newSeasonFixtures = (test.fixtures ?? []).filter(
      (f) => (f.season ?? test.time.season) === "2028/29",
    );
    expect(newSeasonFixtures.length).toBeGreaterThan(0);

    console.log(
      `✓ TEST 3 PASSED: Calendar reached 01/08, new season initialized with ${newSeasonFixtures.length} fixtures`,
    );
  });

  // =========================================================================
  // TEST 4: Season finalization happens exactly once
  // =========================================================================
  it("TEST 4: Season finalization is idempotent (happens only once)", () => {
    // Arrange: Create a state where season is complete
    let test = state;
    test = {
      ...test,
      time: { ...test.time, date: "2027-11-14" },
      fixtures: (test.fixtures ?? []).map((f) =>
        f.status === "scheduled" ? { ...f, status: "played" as const } : f,
      ),
    };

    // Act: Call finalizeSeasonIfNeeded multiple times
    const result1 = finalizeSeasonIfNeeded(test);
    const result2 = finalizeSeasonIfNeeded(result1);
    const result3 = finalizeSeasonIfNeeded(result2);

    // Assert: All results should be identical (no further changes)
    expect(result1.time.date).toBe(result2.time.date);
    expect(result2.time.date).toBe(result3.time.date);
    expect(result1.meta?.lastFinalizedDate).toBe(result2.meta?.lastFinalizedDate);
    expect(result2.meta?.lastFinalizedDate).toBe(result3.meta?.lastFinalizedDate);

    console.log(`✓ TEST 4 PASSED: Season finalization is idempotent`);
  });

  // =========================================================================
  // TEST 5: Season progression functions don't mutate calendar unexpectedly
  // =========================================================================
  it("TEST 5: Season progression preserves calendar date during normal advance", () => {
    // Arrange: Set up a normal advance scenario
    let test = state;
    const originalDate = "2027-11-14";
    test = {
      ...test,
      time: { ...test.time, date: originalDate },
    };

    // Act: Advance day
    const advanced = gameReducer(test, { type: "ADVANCE_DAY", days: 1 });

    // Assert: Date was incremented by exactly 1, not jumped
    expect(advanced.time.date).toBe("2027-11-15");

    console.log(
      `✓ TEST 5 PASSED: Calendar advanced by exactly 1 day (${originalDate} → ${advanced.time.date})`,
    );
  });
});

/**
 * Helper: Count days between two ISO dates
 */
function getDayCount(start: string, end: string): number {
  const startDate = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");
  return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}
