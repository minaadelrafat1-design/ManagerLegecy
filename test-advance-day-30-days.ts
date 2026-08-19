/**
 * 30-day profiling test - Advance Day performance with state accumulation
 * Measures if days progressively slow down as transfers/negotiations/events grow
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
console.log("ADVANCE DAY PERFORMANCE PROFILE - 30 Day Test");
console.log("=".repeat(100));

console.log(`\nInitial state:`);
console.log(`  Date: ${state.time.date}`);
console.log(`  Clubs: ${Object.keys(state.clubs).length}`);
console.log(`  Players: ${Object.keys(state.players).length}\n`);

const timings = [];
let consecutiveSlowdowns = 0;
let maxSlowdownPercent = 0;

for (let i = 0; i < 30; i++) {
  const startTime = performance.now();
  const beforeDate = state.time.date;
  const beforeTransfers = (state.transfers ?? []).length;
  const beforeNegotiations = (state.negotiations ?? []).length;
  const beforeEvents = (state.events ?? []).length;

  // Dispatch ADVANCE_DAY action
  state = gameReducer(state, { type: "ADVANCE_DAY", days: 1 });

  const elapsedMs = performance.now() - startTime;
  const afterDate = state.time.date;
  const afterTransfers = (state.transfers ?? []).length;
  const afterNegotiations = (state.negotiations ?? []).length;
  const afterEvents = (state.events ?? []).length;

  const dayNum = i + 1;

  let statusIcon = "";
  if (i > 0) {
    const prevMs = timings[i - 1].elapsedMs;
    const percentChange = ((elapsedMs - prevMs) / prevMs) * 100;
    if (percentChange > 20) {
      statusIcon = "⚠";
      consecutiveSlowdowns++;
      maxSlowdownPercent = Math.max(maxSlowdownPercent, percentChange);
    } else {
      consecutiveSlowdowns = 0;
    }
  }

  const output = `Day ${String(dayNum).padStart(2)}: ${statusIcon} ${elapsedMs.toFixed(2).padStart(7)}ms | Transfers: ${String(afterTransfers).padStart(2)} | Negotiations: ${String(afterNegotiations).padStart(2)} | Events: ${String(afterEvents).padStart(3)}`;

  if (dayNum % 5 === 0 || statusIcon === "⚠") {
    console.log(output);
  }

  timings.push({
    dayNum,
    beforeDate,
    afterDate,
    elapsedMs,
    beforeTransfers,
    afterTransfers,
    beforeNegotiations,
    afterNegotiations,
    beforeEvents,
    afterEvents,
  });
}

const totalMs = timings.reduce((sum, t) => sum + t.elapsedMs, 0);
const avgMs = totalMs / timings.length;
const maxMs = Math.max(...timings.map((t) => t.elapsedMs));
const minMs = Math.min(...timings.map((t) => t.elapsedMs));

console.log("\n" + "-".repeat(100));
console.log("SUMMARY - 30 DAY RUN");
console.log("-".repeat(100));
console.log(`  Total Time: ${totalMs.toFixed(2)}ms`);
console.log(`  Average:    ${avgMs.toFixed(2)}ms per day`);
console.log(`  Max:        ${maxMs.toFixed(2)}ms`);
console.log(`  Min:        ${minMs.toFixed(2)}ms`);
console.log(`  Max Slowdown: ${maxSlowdownPercent.toFixed(1)}%`);
console.log(`  Consecutive Slowdowns: ${consecutiveSlowdowns}`);

// Trend analysis
console.log("\n" + "-".repeat(100));
console.log("TREND ANALYSIS");
console.log("-".repeat(100));

const firstQuarter = timings.slice(0, 7).reduce((sum, t) => sum + t.elapsedMs, 0) / 7;
const secondQuarter = timings.slice(7, 14).reduce((sum, t) => sum + t.elapsedMs, 0) / 7;
const thirdQuarter = timings.slice(14, 21).reduce((sum, t) => sum + t.elapsedMs, 0) / 7;
const fourthQuarter = timings.slice(21, 28).reduce((sum, t) => sum + t.elapsedMs, 0) / 7;

console.log(`  Days 1-7:   ${firstQuarter.toFixed(2)}ms avg`);
console.log(
  `  Days 8-14:  ${secondQuarter.toFixed(2)}ms avg (${((secondQuarter / firstQuarter - 1) * 100).toFixed(1)}%)`,
);
console.log(
  `  Days 15-21: ${thirdQuarter.toFixed(2)}ms avg (${((thirdQuarter / firstQuarter - 1) * 100).toFixed(1)}%)`,
);
console.log(
  `  Days 22-28: ${fourthQuarter.toFixed(2)}ms avg (${((fourthQuarter / firstQuarter - 1) * 100).toFixed(1)}%)`,
);

// Final state
console.log("\n" + "-".repeat(100));
console.log("FINAL STATE");
console.log("-".repeat(100));
console.log(`  Date: ${state.time.date}`);
console.log(`  Transfers: ${(state.transfers ?? []).length}`);
console.log(`  Negotiations: ${(state.negotiations ?? []).length}`);
console.log(`  Events: ${(state.events ?? []).length}`);
console.log(`  News: ${(state.news ?? []).length}`);

// Performance rating
console.log("\n" + "-".repeat(100));
let perfRating = "";
if (avgMs < 5) perfRating = "✓ EXCELLENT (< 5ms avg)";
else if (avgMs < 10) perfRating = "✓ GOOD (< 10ms avg)";
else if (avgMs < 20) perfRating = "⚠ ACCEPTABLE (< 20ms avg)";
else if (avgMs < 50) perfRating = "✗ SLOW (< 50ms avg)";
else perfRating = "✗ VERY SLOW (> 50ms avg)";

console.log(`PERFORMANCE RATING: ${perfRating}`);
console.log("=".repeat(100) + "\n");

export { timings, totalMs, avgMs };
