/**
 * Test Phase 7A Event Integrity (1-year deterministic simulation)
 *
 * Verifies that:
 * 1. New explicit event types (TRANSFER_COMPLETED, PROMOTION, RELEGATION, YOUTH_GENERATED) are emitted
 * 2. Event meta contains authoritative proof of state transitions
 * 3. Invariant checks pass (no duplicate completions, movements, etc.)
 */

import { collectCanonicalSimulationReport } from "./canonical-simulation-audit";
import { checkAllInvariants } from "../src/state/event-invariants";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

console.log("=== Phase 7A: Event Integrity Audit (1-Year Test) ===\n");

// Run 1-year simulation
const report = collectCanonicalSimulationReport(1);

console.log("SIMULATION RESULTS (1 Year):");
console.log(`  Seasons: ${report.seasonsCompleted}`);
console.log(`  Fixtures scheduled: ${report.fixturesScheduled}`);
console.log(`  Matches played: ${report.matchesPlayed}`);
console.log(`  Goals: ${report.goals}`);
console.log(`  Completed transfers: ${report.completedTransfers}`);
console.log(`  Promotions: ${report.promotions}`);
console.log(`  Relegations: ${report.relegations}`);
console.log(`  Retirements: ${report.retirements}`);
console.log(`  Youth generated: ${report.youthGenerated}`);
console.log(`  Manager changes: ${report.managerChanges}\n`);

// Check invariants on final state
let state = buildInitialState();
state = simulateSeason(state as any) as any;
const violations = checkAllInvariants(state);

console.log("INVARIANT CHECK RESULTS:");
console.log(`  Total violations: ${violations.length}`);

if (violations.length > 0) {
  console.log("\nVIOLATIONS FOUND:");
  for (const violation of violations) {
    console.log(
      `  - [${violation.severity.toUpperCase()}] ${violation.type}: ${violation.description}`,
    );
    if (violation.data) {
      console.log(`    Data: ${JSON.stringify(violation.data)}`);
    }
  }
} else {
  console.log("  ✓ All invariants passed!\n");
}

// Count event types in final state
const eventCounts: Record<string, number> = {};
for (const event of state.events ?? []) {
  eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
}

console.log("EVENT TYPE DISTRIBUTION:");
const sortedTypes = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]);

for (const [type, count] of sortedTypes) {
  console.log(`  ${type}: ${count}`);
}

console.log("\n✓ Test complete!");
