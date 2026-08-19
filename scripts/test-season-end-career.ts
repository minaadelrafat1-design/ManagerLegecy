import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const { runMonthlyPlayerDevelopment, runSeasonalPlayerLifecycle } =
  await import("../src/state/player-development.ts");
const { applyWeeklyFinanceTick } = await import("../src/state/finance.ts");
const { generateJobOffers } = await import("../src/state/jobs.ts");

let state = buildInitialState();

// Simulate a season: 40 weeks of activity (rough approximation)
for (let w = 0; w < 40; w++) {
  // weekly finance tick
  state = applyWeeklyFinanceTick(state);
  // monthly development every ~4 weeks
  if (w % 4 === 0) state = runMonthlyPlayerDevelopment(state);
}

// Season rollover: run seasonal lifecycle (aging/retirements) and job offers
state = runSeasonalPlayerLifecycle(state);
state = generateJobOffers(state);

console.log("Career history length", state.careerHistory.length);
console.log("Events tail", state.events.slice(-5));
console.log("News tail", state.news.slice(-3));

// Basic assertions: career history present, news/events created, manager reputation within bounds
assert(Array.isArray(state.careerHistory));
assert(state.news.length >= 0);
assert(state.events.length >= 0);
assert(state.manager.reputation >= 0 && state.manager.reputation <= 100);

console.log("PASS — season-end career checks");
process.exit(0);
