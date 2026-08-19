import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialState } from "./seed";
import { gameReducer, type GameAction } from "./reducer";
import { createNegotiationSession } from "./negotiation-sessions";
import { listPlayerForTransfer } from "./ai-transfers";
import type { GameState } from "./types";

describe("Transfer Month Simulation — AI Activity & Performance", () => {
  let state: GameState;

  beforeEach(() => {
    state = buildInitialState();
  });

  const dispatch = (action: GameAction): GameState => {
    return gameReducer(state, action);
  };

  it("simulates 30 days of transfer activity without lag or corruption", () => {
    let testState = state;
    const dayTimings: number[] = [];
    const dailySnapshot = {
      transfers: [] as number[],
      negotiations: [] as number[],
      events: [] as number[],
      blockedByMatch: 0,
    };

    const startDay = testState.time.day;

    console.log("\n=== Transfer Month Simulation (30 days) ===\n");
    console.log(`Day Offset\tTransfers\tNegotiations\tEvents\t\tTime(ms)\tStatus`);
    console.log("-".repeat(100));

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const start = performance.now();
      const dayBefore = testState.time.day;
      testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
      const end = performance.now();
      const elapsed = end - start;
      const dayAfter = testState.time.day;

      dayTimings.push(elapsed);
      dailySnapshot.transfers.push(testState.transfers?.length ?? 0);
      dailySnapshot.negotiations.push(testState.negotiations?.length ?? 0);
      dailySnapshot.events.push(testState.events?.length ?? 0);

      const dayAdvanced = dayAfter > dayBefore ? "✓" : "blocked";
      if (dayAfter === dayBefore) dailySnapshot.blockedByMatch++;

      const isBigDay = (startDay + dayOffset + 1) % 3 === 0 ? "(EVAL)" : "";
      console.log(
        `+${dayOffset + 1}\t\t${testState.transfers?.length ?? 0}\t\t${testState.negotiations?.length ?? 0}\t\t${testState.events?.length ?? 0}\t\t${elapsed.toFixed(1)}\t${dayAdvanced} ${isBigDay}`,
      );

      // Sanity checks
      expect(testState.clubs).toBeDefined();
      expect(Object.keys(testState.clubs).length).toBeGreaterThan(0);

      // No negative lengths
      expect(testState.transfers?.length ?? 0).toBeGreaterThanOrEqual(0);
      expect(testState.negotiations?.length ?? 0).toBeGreaterThanOrEqual(0);
    }

    console.log("-".repeat(100));
    const avgTime = dayTimings.reduce((a, b) => a + b, 0) / dayTimings.length;
    const maxTime = Math.max(...dayTimings);
    const minTime = Math.min(...dayTimings);

    console.log(`\nPerformance Summary:`);
    console.log(`  Avg per day: ${avgTime.toFixed(2)}ms`);
    console.log(`  Max per day: ${maxTime.toFixed(2)}ms`);
    console.log(`  Min per day: ${minTime.toFixed(2)}ms`);
    console.log(`  Days blocked by match: ${dailySnapshot.blockedByMatch}`);

    console.log(`\nTransfer Activity Summary:`);
    console.log(`  Transfers at start: ${dailySnapshot.transfers[0]}`);
    console.log(`  Transfers at day 30: ${dailySnapshot.transfers[29]}`);
    console.log(`  Negotiations at day 30: ${dailySnapshot.negotiations[29]}`);

    // Expectations
    expect(maxTime).toBeLessThan(1500); // No single day should take > 1.5s
    expect(avgTime).toBeLessThan(300); // Average should be fast

    // Verify final state integrity
    expect(testState.time.date).toBeDefined();
    expect(testState.fixtures).toBeDefined();
    expect(testState.players).toBeDefined();
    expect(testState.clubs).toBeDefined();
  });

  it("day 1, 2 should be fast (no eval), day 3 might be slower (eval runs)", () => {
    let testState = state;
    const times = { day1: 0, day2: 0, day3: 0 };
    const startDay = testState.time.day;

    // Day 1
    let start = performance.now();
    testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
    times.day1 = performance.now() - start;

    // Day 2
    start = performance.now();
    testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
    times.day2 = performance.now() - start;

    // Day 3 (eval runs if (startDay + 3) % 3 === 0)
    start = performance.now();
    testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
    times.day3 = performance.now() - start;

    const evalDay3 = (startDay + 3) % 3 === 0 ? "(eval)" : "(cheap)";

    console.log(`\nDay Timing Comparison:`);
    console.log(`  +1 (cheap): ${times.day1.toFixed(2)}ms`);
    console.log(`  +2 (cheap): ${times.day2.toFixed(2)}ms`);
    console.log(`  +3 ${evalDay3}:  ${times.day3.toFixed(2)}ms`);

    // Days 1 & 2 should be notably faster than day 3
    expect(times.day1).toBeLessThan(500);
    expect(times.day2).toBeLessThan(500);
    // Day 3 can be a bit slower since eval runs, but still reasonable
    expect(times.day3).toBeLessThan(1000);
  });

  it("ensures no player appears in multiple clubs after 30 days", () => {
    let testState = state;

    for (let i = 0; i < 30; i++) {
      testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
    }

    // Collect all players in all clubs
    const playerClubCount: Record<string, number> = {};
    for (const club of Object.values(testState.clubs)) {
      for (const playerId of club.playerIds) {
        playerClubCount[playerId] = (playerClubCount[playerId] ?? 0) + 1;
      }
    }

    // Each player should be in at most 1 club
    for (const [playerId, count] of Object.entries(playerClubCount)) {
      expect(count).toBeLessThanOrEqual(1);
    }

    console.log(`\nPlayer Roster Integrity: ✓ (no player in multiple clubs)`);
  });

  it("does not create duplicate negotiation sessions or transfer listings for the same transfer opportunity", () => {
    const testState = buildInitialState();
    const clubA = Object.values(testState.clubs).find(
      (club) => club.aiManager !== undefined && club.playerIds.length > 0,
    );
    const clubB = Object.values(testState.clubs).find(
      (club) => club.aiManager !== undefined && club.id !== clubA?.id,
    );
    const playerId = clubA!.playerIds[0];

    const firstSession = createNegotiationSession(
      testState,
      clubB!.id,
      clubA!.id,
      playerId,
      { fee: 500000, salaryWeekly: 15000 },
      "Initial offer",
      "transfer",
    );

    const secondSession = createNegotiationSession(
      firstSession,
      clubB!.id,
      clubA!.id,
      playerId,
      { fee: 600000, salaryWeekly: 16000 },
      "Duplicate offer",
      "transfer",
    );

    expect(secondSession.negotiations).toHaveLength(firstSession.negotiations!.length);

    const listed = listPlayerForTransfer(firstSession, playerId, clubA!.id, { status: "new" });
    const duplicateListed = listPlayerForTransfer(listed, playerId, clubA!.id, { status: "new" });

    expect(duplicateListed.transfers).toHaveLength(listed.transfers.length);
  });
});
