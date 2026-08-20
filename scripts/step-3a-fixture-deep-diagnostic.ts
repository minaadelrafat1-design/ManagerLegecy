/**
 * Step 3A: Fixture Generation Deep Diagnostic
 *
 * Measures the actual generateLeagueFixtures() function to see where time is spent.
 */

import { buildInitialState, preInitializeAiLedgers } from "../src/state/seed";
import { generateLeagueFixtures } from "../src/state/season";
import type { GameState } from "../src/state/types";

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

async function main() {
  console.log("=".repeat(80));
  console.log("STEP 3A: DEEP FIXTURE GENERATION DIAGNOSTIC");
  console.log("=".repeat(80));
  console.log();

  // Build initial state
  console.log("Building initial state...");
  const state = buildInitialState();
  const stateWithLedgers = preInitializeAiLedgers(state);

  console.log(`Initial clubs: ${Object.keys(stateWithLedgers.clubs).length}`);
  console.log(`Initial leagues: ${Object.keys(stateWithLedgers.leagues).length}`);
  console.log(`Initial fixtures: ${(stateWithLedgers.fixtures ?? []).length}`);
  console.log();

  // Measure generateLeagueFixtures
  console.log("Measuring generateLeagueFixtures()...");
  const startTime = performance.now();
  const stateWithFixtures = generateLeagueFixtures(stateWithLedgers);
  const elapsed = performance.now() - startTime;

  console.log(`Time: ${formatMs(elapsed)}`);
  console.log(`Fixtures before: ${(stateWithLedgers.fixtures ?? []).length}`);
  console.log(`Fixtures after: ${(stateWithFixtures.fixtures ?? []).length}`);
  console.log(`Fixtures generated: ${(stateWithFixtures.fixtures ?? []).length - (stateWithLedgers.fixtures ?? []).length}`);
  console.log();

  // Analyze generated fixtures
  const generatedCount = (stateWithFixtures.fixtures ?? []).length - (stateWithLedgers.fixtures ?? []).length;
  const expectedRegularFixtures = 35756;

  console.log("Analysis:");
  console.log(`  Expected regular fixtures: ${expectedRegularFixtures}`);
  console.log(`  Actually generated: ${generatedCount}`);
  console.log(`  Match: ${generatedCount === expectedRegularFixtures ? "YES ✓" : "NO ✗"}`);
  console.log();

  // Break down by competition
  const byCompetition = new Map<string, number>();
  for (const fixture of stateWithFixtures.fixtures ?? []) {
    const count = byCompetition.get(fixture.competitionId) ?? 0;
    byCompetition.set(fixture.competitionId, count + 1);
  }

  console.log("Fixtures by competition:");
  for (const [comp, count] of Array.from(byCompetition.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${comp}: ${count}`);
  }
  console.log();

  console.log("=".repeat(80));
}

main().catch((err) => {
  console.error("DIAGNOSTIC FAILED:", err);
  process.exit(1);
});
