import assert from "node:assert/strict";
const { buildInitialState } = await import("../src/state/seed.ts");
const { simulateSeason } = await import("../src/state/season.ts");

let state = buildInitialState();
console.log("Running complete season lifecycle...");
state = simulateSeason(state);

console.log("Fixtures played:", (state.fixtures ?? []).filter((f) => f.status === "played").length);
console.log("Events:", (state.events ?? []).length);
console.log("News:", (state.news ?? []).length);

assert(
  (state.fixtures ?? []).some((f) => f.status === "played"),
  "No played fixtures",
);
assert((state.events ?? []).length > 0, "No events generated");
assert((state.news ?? []).length > 0, "No news generated");

console.log("PASS — complete season lifecycle");
process.exit(0);
