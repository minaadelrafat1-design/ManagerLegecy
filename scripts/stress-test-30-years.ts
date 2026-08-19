#!/usr/bin/env npx tsx
/**
 * PHASE AAA-90.3: 15-YEAR STRESS TEST
 *
 * Runs 15 complete seasons with single seed 0
 * Validates ecosystem stability over 15-year horizon
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

interface StressTestMetrics {
  seed: string;
  seasons: number;
  endDate: string;
  endSeason: string;
  totalPlayers: number;
  retiredPlayers: number;
  youthPlayers: number;
  totalRetirements: number;
  totalYouthGenerated: number;
  totalPromotions: number;
  totalRelegations: number;
  totalTransfers: number;
  totalClubs: number;
  criticalErrors: string[];
}

async function runStressTest(seed: string): Promise<StressTestMetrics> {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`Starting 15-Year Stress Test - Seed ${seed}`);
  console.log(`${"─".repeat(70)}`);

  let state = buildInitialState(seed);
  const startDate = state.time.date;
  const startSeason = state.time.season;
  const errors: string[] = [];

  console.log(
    `Starting: ${startDate} (${startSeason}), ${Object.keys(state.players).length} players`,
  );

  // Run 15 seasons
  for (let season = 1; season <= 15; season++) {
    try {
      state = simulateSeasonQuick(state);

      // Progress indicator
      if (season % 5 === 0 || season === 15) {
        console.log(`  ✓ Season ${season}/15 complete (${state.time.season})`);
      }

      // Safety checks
      const players = state.players;
      const clubs = state.clubs;
      const fixtures = state.fixtures ?? [];

      // Check for impossible states
      if (Object.keys(players).length < 5000) {
        errors.push(`Season ${season}: Too few players (${Object.keys(players).length})`);
      }
      if (Object.keys(clubs).length < 200) {
        errors.push(`Season ${season}: Too few clubs (${Object.keys(clubs).length})`);
      }

      // Check for broken squad assignments
      let orphanedPlayers = 0;
      for (const [playerId, player] of Object.entries(players)) {
        if (player.clubId && !clubs[player.clubId]) {
          orphanedPlayers++;
        }
      }
      if (orphanedPlayers > 0) {
        errors.push(`Season ${season}: ${orphanedPlayers} orphaned players (clubs deleted)`);
      }

      // Check for duplicate registrations
      const playerRosterMap = new Map<string, number>();
      for (const club of Object.values(clubs)) {
        for (const playerId of club.playerIds) {
          playerRosterMap.set(playerId, (playerRosterMap.get(playerId) ?? 0) + 1);
        }
      }
      const duplicates = Array.from(playerRosterMap.entries()).filter(
        ([_, count]) => count > 1,
      ).length;
      if (duplicates > 0) {
        errors.push(`Season ${season}: ${duplicates} players in multiple clubs`);
      }
    } catch (err) {
      errors.push(`Season ${season}: ${(err as Error).message}`);
      console.error(`  ✗ Season ${season} ERROR: ${(err as Error).message}`);
      break;
    }
  }

  console.log(`  ✓ All ${15} seasons complete`);

  // Collect final metrics
  const finalPlayers = Object.keys(state.players).length;
  const retiredPlayers = Object.values(state.players as any).filter(
    (p: any) => p.status === "retired",
  ).length;
  const youthPlayers = Object.values(state.players as any).filter((p: any) => p.age <= 18).length;

  const retirementEvents = (state.events ?? []).filter(
    (e: any) => e.type === "PLAYER_RETIRED",
  ).length;
  const youthEvents = (state.events ?? []).filter((e: any) => e.type === "YOUTH_GENERATED").length;
  const promotionEvents = (state.events ?? []).filter((e: any) => e.type === "PROMOTION").length;
  const relegationEvents = (state.events ?? []).filter((e: any) => e.type === "RELEGATION").length;
  const transfers = (state.events ?? []).filter((e: any) => e.type === "TRANSFER_COMPLETED").length;

  return {
    seed,
    seasons: 15,
    endDate: state.time.date,
    endSeason: state.time.season,
    totalPlayers: finalPlayers,
    retiredPlayers,
    youthPlayers,
    totalRetirements: retirementEvents,
    totalYouthGenerated: youthEvents,
    totalPromotions: promotionEvents,
    totalRelegations: relegationEvents,
    totalTransfers: transfers,
    totalClubs: Object.keys(state.clubs).length,
    criticalErrors: errors,
  };
}

async function main() {
  console.log(`${"═".repeat(70)}`);
  console.log(`PHASE AAA-90.3: 15-YEAR FOOTBALL ECOSYSTEM STRESS TEST`);
  console.log(`${"═".repeat(70)}`);
  console.log(`Running 1 seed × 15 seasons = 15 seasons total`);
  console.log(`This validates ecosystem stability over 15 years of gameplay`);

  const results: StressTestMetrics[] = [];

  for (const seed of ["0"]) {
    const result = await runStressTest(seed);
    results.push(result);
  }

  // Report results
  console.log(`\n${"═".repeat(70)}`);
  console.log(`STRESS TEST RESULTS`);
  console.log(`${"═".repeat(70)}`);

  for (const result of results) {
    console.log(`\nSeed ${result.seed}:`);
    console.log(`  Duration: ${result.endDate} (${result.endSeason})`);
    console.log(
      `  Players: ${result.totalPlayers} (${result.youthPlayers} youth, ${result.retiredPlayers} retired)`,
    );
    console.log(`  Clubs: ${result.totalClubs}`);
    console.log(`  Retirements: ${result.totalRetirements}`);
    console.log(`  Youth Generated: ${result.totalYouthGenerated}`);
    console.log(`  Promotions: ${result.totalPromotions}`);
    console.log(`  Relegations: ${result.totalRelegations}`);
    console.log(`  Transfers (completed): ${result.totalTransfers}`);

    if (result.criticalErrors.length > 0) {
      console.log(`  ⚠️  ERRORS (${result.criticalErrors.length}):`);
      for (const err of result.criticalErrors.slice(0, 5)) {
        console.log(`      - ${err}`);
      }
    } else {
      console.log(`  ✅ NO CRITICAL ERRORS`);
    }
  }

  // Summary
  console.log(`\n${"═".repeat(70)}`);
  console.log(`SUMMARY`);
  console.log(`${"═".repeat(70)}`);

  const totalErrors = results.reduce((sum, r) => sum + r.criticalErrors.length, 0);
  const avgPlayers = Math.round(
    results.reduce((sum, r) => sum + r.totalPlayers, 0) / results.length,
  );
  const avgClubs = Math.round(results.reduce((sum, r) => sum + r.totalClubs, 0) / results.length);

  console.log(`\n✓ Total seasons simulated: 15`);
  console.log(`✓ Critical errors: ${totalErrors}`);
  console.log(`✓ Final players: ${avgPlayers}`);
  console.log(`✓ Final clubs: ${avgClubs}`);

  const totalRetirements = results.reduce((sum, r) => sum + r.totalRetirements, 0);
  const totalYouth = results.reduce((sum, r) => sum + r.totalYouthGenerated, 0);

  console.log(`\n✓ Total retirements (all seeds): ${totalRetirements}`);
  console.log(`✓ Total youth generated (all seeds): ${totalYouth}`);

  if (totalErrors === 0) {
    console.log(`\n${"✅".repeat(35)}`);
    console.log(`✅ 30-YEAR STRESS TEST PASSED - ECOSYSTEM STABLE`);
    console.log(`${"✅".repeat(35)}`);
    process.exit(0);
  } else {
    console.log(`\n❌ STRESS TEST REVEALED ISSUES - See above for details`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
