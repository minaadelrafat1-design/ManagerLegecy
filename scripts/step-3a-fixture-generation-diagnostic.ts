/**
 * Step 3A: Fixture Generation Diagnostic
 *
 * Measures timing for each phase of buildInitialState() and generateLeagueFixtures()
 * to identify the actual bottleneck.
 *
 * Usage:
 *   npx tsx scripts/step-3a-fixture-generation-diagnostic.ts
 */

import { buildInitialState, preInitializeAiLedgers } from "../src/state/seed";
import type { GameState } from "../src/state/types";

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function markTime(label: string): { label: string; startTime: number } {
  return { label, startTime: performance.now() };
}

function elapsed(mark: { label: string; startTime: number }): number {
  return performance.now() - mark.startTime;
}

interface DiagnosticReport {
  buildInitialState: number;
  clubCount: number;
  leagueCount: number;
  fixtureCount: number;
  reportDate: string;
}

async function main() {
  console.log("=".repeat(80));
  console.log("STEP 3A: FIXTURE GENERATION DIAGNOSTIC");
  console.log("=".repeat(80));
  console.log();

  const report: DiagnosticReport = {
    buildInitialState: 0,
    clubCount: 0,
    leagueCount: 0,
    fixtureCount: 0,
    reportDate: new Date().toISOString(),
  };

  // ========================================================================
  // PHASE A: buildInitialState
  // ========================================================================
  console.log("PHASE A: buildInitialState()");
  console.log("-".repeat(80));

  let mark = markTime("buildInitialState");
  const state = buildInitialState();
  report.buildInitialState = elapsed(mark);

  console.log(`  Time: ${formatMs(report.buildInitialState)}`);
  console.log();

  // ========================================================================
  // PHASE B: Analyze state structure
  // ========================================================================
  console.log("PHASE B: Initial State Structure");
  console.log("-".repeat(80));

  report.clubCount = Object.keys(state.clubs).length;
  report.leagueCount = Object.keys(state.leagues).length;
  report.fixtureCount = (state.fixtures ?? []).length;

  console.log(`  Clubs: ${report.clubCount}`);
  console.log(`  Leagues: ${report.leagueCount}`);
  console.log(`  Fixtures: ${report.fixtureCount}`);
  console.log();

  // ========================================================================
  // PHASE C: Club-to-league grouping (simulate current approach)
  // ========================================================================
  console.log("PHASE C: Club Filtering Simulation (current approach)");
  console.log("-".repeat(80));

  let totalFilterTime = 0;
  let clubsPerLeagueStats = { min: Infinity, max: 0, total: 0, count: 0 };

  mark = markTime("all league filters");
  for (const leagueId of Object.keys(state.leagues)) {
    const filterMark = markTime(`filter for ${leagueId}`);
    const leagueClubs = Object.values(state.clubs).filter((c) => c.leagueId === leagueId);
    const filterTime = elapsed(filterMark);

    if (leagueClubs.length > 0) {
      totalFilterTime += filterTime;
      clubsPerLeagueStats.min = Math.min(clubsPerLeagueStats.min, leagueClubs.length);
      clubsPerLeagueStats.max = Math.max(clubsPerLeagueStats.max, leagueClubs.length);
      clubsPerLeagueStats.total += leagueClubs.length;
      clubsPerLeagueStats.count += 1;
    }
  }
  const totalFilterMark = elapsed(mark);

  console.log(`  Total filter time (all leagues): ${formatMs(totalFilterMark)}`);
  console.log(
    `  Average filter time per league: ${formatMs(totalFilterMark / Object.keys(state.leagues).length)}`,
  );
  if (clubsPerLeagueStats.count > 0) {
    console.log(`  Clubs per league: min=${clubsPerLeagueStats.min}, max=${clubsPerLeagueStats.max}`);
    console.log(`  Average clubs per league: ${(clubsPerLeagueStats.total / clubsPerLeagueStats.count).toFixed(1)}`);
  }
  console.log();

  // ========================================================================
  // PHASE D: Pre-computed club-to-league index (proposed optimization)
  // ========================================================================
  console.log("PHASE D: Pre-computed Club-to-League Index");
  console.log("-".repeat(80));

  mark = markTime("build club-to-league map");
  const clubToLeague = new Map<string, string>();
  for (const [clubId, club] of Object.entries(state.clubs)) {
    clubToLeague.set(clubId, club.leagueId);
  }
  const indexBuildTime = elapsed(mark);

  console.log(`  Time to build index: ${formatMs(indexBuildTime)}`);

  // Now test lookup speed
  mark = markTime("lookup all leagues (using index)");
  const leagueToClubsOptimized = new Map<string, string[]>();
  for (const leagueId of Object.keys(state.leagues)) {
    const clubs: string[] = [];
    for (const [clubId, league] of clubToLeague) {
      if (league === leagueId) {
        clubs.push(clubId);
      }
    }
    leagueToClubsOptimized.set(leagueId, clubs);
  }
  const optimizedLookupTime = elapsed(mark);

  console.log(`  Time to lookup all leagues: ${formatMs(optimizedLookupTime)}`);
  console.log(`  Total (index build + lookup): ${formatMs(indexBuildTime + optimizedLookupTime)}`);
  console.log();

  // ========================================================================
  // PHASE E: Comparison
  // ========================================================================
  console.log("PHASE E: Comparison");
  console.log("-".repeat(80));

  const currentApproachTime = totalFilterMark;
  const optimizedApproachTime = indexBuildTime + optimizedLookupTime;
  const improvement = ((currentApproachTime - optimizedApproachTime) / currentApproachTime * 100).toFixed(1);

  console.log(`  Current approach (Object.values().filter × 81): ${formatMs(currentApproachTime)}`);
  console.log(`  Optimized approach (pre-computed index): ${formatMs(optimizedApproachTime)}`);
  console.log(
    `  Improvement: ${improvement}% ${optimizedApproachTime < currentApproachTime ? "FASTER" : "SLOWER"}`,
  );
  console.log();

  // ========================================================================
  // PHASE F: AI Ledger Pre-initialization
  // ========================================================================
  console.log("PHASE F: AI Ledger Pre-initialization");
  console.log("-".repeat(80));

  mark = markTime("preInitializeAiLedgers");
  const stateWithLedgers = preInitializeAiLedgers(state);
  const ledgerTime = elapsed(mark);

  console.log(`  Time: ${formatMs(ledgerTime)}`);
  console.log();

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  const totalTime = report.buildInitialState + ledgerTime;

  console.log(`buildInitialState():            ${formatMs(report.buildInitialState)}`);
  console.log(`preInitializeAiLedgers():       ${formatMs(ledgerTime)}`);
  console.log(`Total world initialization:     ${formatMs(totalTime)}`);
  console.log();
  console.log(`Club filtering bottleneck:      ${formatMs(currentApproachTime)}`);
  console.log(`  as % of buildInitialState:    ${((currentApproachTime / report.buildInitialState) * 100).toFixed(1)}%`);
  console.log();

  console.log("Expected full-world fixture projection:");
  console.log(`  Regular league fixtures:       ~35,756`);
  console.log(`  Demo league fixtures:          ${report.fixtureCount}`);
  console.log();

  // ========================================================================
  // RECOMMENDATIONS
  // ========================================================================
  console.log("RECOMMENDATIONS");
  console.log("-".repeat(80));

  if (currentApproachTime > optimizedApproachTime) {
    console.log("✓ Pre-computed club-to-league index is faster");
    console.log(`  Expected speedup: ${improvement}%`);
  } else {
    console.log("⚠ Current Object.values().filter approach is competitive");
    console.log("  Optimization may not be worthwhile");
  }

  console.log();
}

main().catch((err) => {
  console.error("DIAGNOSTIC FAILED:", err);
  process.exit(1);
});
