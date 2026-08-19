/**
 * Direct profiling test - Advance Day performance
 * Runs 7 consecutive day advances and measures execution time per hook
 */

import { gameReducer } from "./src/state/reducer";
import { buildCareerState } from "./src/state/new-career";
import { STARTER_CLUBS } from "./src/data/starter-clubs";

// Create a new game state
const starterClub = Object.values(STARTER_CLUBS)[0];
let state = buildCareerState({
  managerName: "Test Manager",
  managerNationality: "england",
  clubId: starterClub.id,
  philosophy: "balanced",
  attributeOverrides: {},
});

console.log("\n" + "=".repeat(100));
console.log("ADVANCE DAY PERFORMANCE PROFILE - 7 Day Test");
console.log("=".repeat(100));

console.log(`\nInitial state:`);
console.log(`  Date: ${state.time.date}`);
console.log(`  Clubs: ${Object.keys(state.clubs).length}`);
console.log(`  Players: ${Object.keys(state.players).length}`);
console.log(`  Transfers: ${(state.transfers ?? []).length}`);
console.log(`  Negotiations: ${(state.negotiations ?? []).length}`);
console.log(`  Events: ${(state.events ?? []).length}\n`);

const timings = [];

for (let i = 0; i < 7; i++) {
  const startTime = performance.now();
  const beforeDate = state.time.date;

  // Dispatch ADVANCE_DAY action
  state = gameReducer(state, { type: "ADVANCE_DAY", days: 1 });

  const elapsedMs = performance.now() - startTime;
  const afterDate = state.time.date;

  const dayNum = i + 1;
  console.log(
    `Day ${dayNum}: ${beforeDate} → ${afterDate} (${elapsedMs.toFixed(2)}ms) | Players: ${Object.keys(state.players).length} | Transfers: ${(state.transfers ?? []).length} | Negotiations: ${(state.negotiations ?? []).length}`,
  );

  timings.push({
    dayNum,
    beforeDate,
    afterDate,
    elapsedMs,
    playerCount: Object.keys(state.players).length,
    transferCount: (state.transfers ?? []).length,
    negotiationCount: (state.negotiations ?? []).length,
    eventCount: (state.events ?? []).length,
    newsCount: (state.news ?? []).length,
  });
}

const totalMs = timings.reduce((sum, t) => sum + t.elapsedMs, 0);
const avgMs = totalMs / timings.length;
const maxMs = Math.max(...timings.map((t) => t.elapsedMs));
const minMs = Math.min(...timings.map((t) => t.elapsedMs));

console.log("\n" + "-".repeat(100));
console.log("SUMMARY");
console.log("-".repeat(100));
console.log(`  Total Time: ${totalMs.toFixed(2)}ms`);
console.log(`  Average:    ${avgMs.toFixed(2)}ms per day`);
console.log(`  Max:        ${maxMs.toFixed(2)}ms`);
console.log(`  Min:        ${minMs.toFixed(2)}ms`);

// Check for slowdown
let slowingDown = false;
for (let i = 1; i < timings.length; i++) {
  if (timings[i].elapsedMs > timings[i - 1].elapsedMs * 1.2) {
    slowingDown = true;
    console.log(
      `⚠ Slowdown detected: Day ${timings[i - 1].dayNum} (${timings[i - 1].elapsedMs.toFixed(2)}ms) → Day ${timings[i].dayNum} (${timings[i].elapsedMs.toFixed(2)}ms) [${((timings[i].elapsedMs / timings[i - 1].elapsedMs - 1) * 100).toFixed(1)}% slower]`,
    );
  }
}

if (!slowingDown) {
  console.log(`✓ No significant slowdown detected`);
}

console.log("\n" + "=".repeat(100) + "\n");

// Export as JSON for further analysis
const exportData = {
  testDate: new Date().toISOString(),
  description: "7-day advance day performance test",
  summary: {
    totalDays: timings.length,
    totalTimeMs: totalMs,
    averageTimeMs: avgMs,
    maxTimeMs: maxMs,
    minTimeMs: minMs,
  },
  timings,
};

console.log("Raw timing data (JSON):");
console.log(JSON.stringify(exportData, null, 2));

export { exportData };
