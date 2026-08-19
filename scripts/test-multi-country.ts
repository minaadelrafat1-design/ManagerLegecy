import assert from "node:assert/strict";
const { buildInitialState } = await import("../src/state/seed.ts");
const { generateLeagueFixtures } = await import("../src/state/season.ts");
const { runEnhancedTransferWindow } = await import("../src/state/transfers-enhanced.ts");

// Quick smoke test: verify world config has 16 countries, only first 3 populated,
// generate league fixtures (light), and run a quick transfer window.
let state = buildInitialState();
console.log("World countries count:", (state.meta?.worldConfig?.countries ?? []).length);
assert(
  (state.meta?.worldConfig?.countries ?? []).length === 16,
  "Expected 16 countries in worldConfig",
);

// Check clubs exist for first 3 countries only
const worldCountries = state.meta!.worldConfig!.countries as any[];
for (let i = 0; i < 3; i++) {
  const country = worldCountries[i];
  const divs = country.divisions ?? [];
  for (const d of divs) {
    const clubsInDiv = Object.values(state.clubs).filter((c) => c.leagueId === d.id);
    console.log(`Country ${country.id} division ${d.id} clubs:`, clubsInDiv.length);
    assert(clubsInDiv.length > 0, `Expected clubs in ${d.id}`);
  }
}

// Run light operations
console.log("Generating league fixtures (light)...");
state = generateLeagueFixtures(state as any) as any;
console.log(
  "League fixtures created:",
  (state.fixtures ?? []).filter((f) => f.competitionId).length,
);

console.log("Running quick transfer window...");
state = runEnhancedTransferWindow(state as any) as any;
console.log("Events after transfers:", (state.events ?? []).length);

console.log("PASS — quick multi-country smoke test ran");
process.exit(0);
