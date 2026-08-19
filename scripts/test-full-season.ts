import assert from "node:assert/strict";
const { buildInitialState } = await import("../src/state/seed.ts");
const { simulateSeason } = await import("../src/state/season.ts");

let state = buildInitialState();
console.log("Starting season simulation...");
state = simulateSeason(state);

const played = (state.fixtures ?? []).filter((f) => f.status === "played");
console.log("Fixtures played:", played.length);
console.log("Events count:", (state.events ?? []).length);
console.log("News count:", (state.news ?? []).length);

assert(played.length > 0, "No fixtures were played");
assert((state.events ?? []).length > 0, "No events recorded");

console.log("PASS — full season simulation ran");
process.exit(0);
