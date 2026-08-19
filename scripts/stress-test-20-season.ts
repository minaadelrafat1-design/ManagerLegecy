#!/usr/bin/env tsx
/**
 * PHASE AAA-90.2: 20-Season Stress Test
 *
 * Validates ecosystem under realistic long-term load:
 * - Population stability (retirements vs youth generation)
 * - Age distribution health
 * - Transfer market activity
 * - Club finances stability
 * - European competition integrity
 * - Season progression continuity
 * - Manager changes and board pressure
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import { runMonthlyPlayerDevelopment } from "../src/state/player-development";

interface StressTestMetrics {
  season: number;
  totalPlayers: number;
  retiredThisSeason: number;
  youthGeneratedThisSeason: number;
  avgPlayerAge: number;
  playersOver35: number;
  playersUnder23: number;
  totalTransfers: number;
  avgClubBalance: number;
  europeanClubsParticipating: number;
  clubsWithNegativeBalance: number;
  activeManagers: number;
}

function runStressTest(seed: string, seasons: number): StressTestMetrics[] {
  let state = buildInitialState(seed);
  const metrics: StressTestMetrics[] = [];

  console.log(`\n📊 STRESS TEST SEED ${seed}: ${seasons} SEASONS`);
  console.log(`${"=".repeat(70)}`);

  for (let s = 0; s < seasons; s++) {
    const playersBefore = Object.keys(state.players).length;
    const retiredBefore = (state.players as any).retired?.length ?? 0;
    const transfersBefore = (state.transfers ?? []).filter(
      (t: any) => t.status === "completed",
    ).length;

    // Simulate one season
    for (let month = 0; month < 12; month++) {
      state = runMonthlyPlayerDevelopment(state as any) as any;
    }
    state = simulateSeasonQuick(state as any) as any;

    const playersAfter = Object.keys(state.players).length;
    const transfersAfter = (state.transfers ?? []).filter(
      (t: any) => t.status === "completed",
    ).length;
    const newTransfers = transfersAfter - transfersBefore;

    // Calculate metrics
    const allPlayers = Object.values(state.players) as any[];
    const ages = allPlayers.map((p) => p.age).filter((a) => a != null);
    const avgAge =
      ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "N/A";
    const over35 = allPlayers.filter((p) => p.age >= 35).length;
    const under23 = allPlayers.filter((p) => p.age <= 23).length;

    // Club finances
    const clubs = Object.values(state.clubs) as any[];
    const totalBalance = clubs.reduce((sum, c) => sum + (c.balance ?? 0), 0);
    const avgBalance = (totalBalance / clubs.length).toFixed(0);
    const negativeBalance = clubs.filter((c) => (c.balance ?? 0) < 0).length;

    // European qualification
    const europeanClubs = clubs.filter((c) => (c.europeanCompetition ?? null) !== null).length;

    // Managers
    const managers = Object.keys(state.managers ?? {}).length;

    const seasonMetrics: StressTestMetrics = {
      season: state.currentSeason,
      totalPlayers: playersAfter,
      retiredThisSeason: playersBefore - playersAfter + newTransfers,
      youthGeneratedThisSeason: playersAfter - playersBefore - newTransfers,
      avgPlayerAge: parseFloat(avgAge as string),
      playersOver35: over35,
      playersUnder23: under23,
      totalTransfers: newTransfers,
      avgClubBalance: parseFloat(avgBalance as string),
      clubsWithNegativeBalance: negativeBalance,
      europeanClubsParticipating: europeanClubs,
      activeManagers: managers,
    };

    metrics.push(seasonMetrics);

    // Progress indicator
    const indicator = `Season ${String(state.currentSeason).padStart(2)}`;
    const players = `${String(playersAfter).padStart(4)} players`;
    const transfers = `${String(newTransfers).padStart(3)} transfers`;
    const retired = `${String(over35).padStart(2)} over-35`;
    const youth = `${String(under23).padStart(2)} under-23`;

    console.log(`  ${indicator} | ${players} | ${transfers} | ${retired} | ${youth}`);
  }

  return metrics;
}

function analyzeMetrics(metrics: StressTestMetrics[], seedLabel: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📈 ANALYSIS: SEED ${seedLabel}`);
  console.log(`${"=".repeat(70)}`);

  const firstSeason = metrics[0];
  const lastSeason = metrics[metrics.length - 1];

  console.log(`\nPOPULATION STABILITY:`);
  console.log(`  Season 1:     ${firstSeason.totalPlayers} players`);
  console.log(`  Season ${lastSeason.season}:     ${lastSeason.totalPlayers} players`);
  console.log(`  Change:       ${lastSeason.totalPlayers - firstSeason.totalPlayers} players`);
  console.log(
    `  Stability:    ${((lastSeason.totalPlayers / firstSeason.totalPlayers) * 100).toFixed(1)}%`,
  );

  console.log(`\nAGE DISTRIBUTION:`);
  console.log(`  Avg Age S1:   ${firstSeason.avgPlayerAge.toFixed(1)} years`);
  console.log(`  Avg Age S${lastSeason.season}:   ${lastSeason.avgPlayerAge.toFixed(1)} years`);
  console.log(
    `  Over-35 S1:   ${firstSeason.playersOver35} (${((firstSeason.playersOver35 / firstSeason.totalPlayers) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Over-35 S${lastSeason.season}:   ${lastSeason.playersOver35} (${((lastSeason.playersOver35 / lastSeason.totalPlayers) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Under-23 S1:  ${firstSeason.playersUnder23} (${((firstSeason.playersUnder23 / firstSeason.totalPlayers) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Under-23 S${lastSeason.season}:  ${lastSeason.playersUnder23} (${((lastSeason.playersUnder23 / lastSeason.totalPlayers) * 100).toFixed(1)}%)`,
  );

  const totalRetirements = metrics.reduce((sum, m) => sum + m.retiredThisSeason, 0);
  const totalYouth = metrics.reduce((sum, m) => sum + m.youthGeneratedThisSeason, 0);
  console.log(`\nCARDINAL FLOWS (All ${metrics.length} seasons):`);
  console.log(`  Total Retirements:  ${totalRetirements} players`);
  console.log(`  Total Youth Gen:    ${totalYouth} players`);
  console.log(`  Flow Balance:       ${totalYouth - totalRetirements} (should be ~0)`);

  const totalTransfers = metrics.reduce((sum, m) => sum + m.totalTransfers, 0);
  const avgTransfersPerSeason = (totalTransfers / metrics.length).toFixed(1);
  console.log(`\nTRANSFER MARKET:`);
  console.log(`  Total Transfers:    ${totalTransfers} (${avgTransfersPerSeason} per season)`);

  console.log(`\nFINANCES:`);
  const avgBalance = metrics.reduce((sum, m) => sum + m.avgClubBalance, 0) / metrics.length;
  console.log(`  Avg Club Balance:   $${avgBalance.toFixed(0)}`);
  const negativeSeasons = metrics.filter((m) => m.clubsWithNegativeBalance > 0).length;
  console.log(
    `  Seasons w/ Deficit: ${negativeSeasons}/${metrics.length} (${((negativeSeasons / metrics.length) * 100).toFixed(1)}%)`,
  );

  console.log(`\nEUROPEAN COMPETITIONS:`);
  const avgEuropean =
    metrics.reduce((sum, m) => sum + m.europeanClubsParticipating, 0) / metrics.length;
  console.log(`  Avg Clubs in Europe: ${avgEuropean.toFixed(1)} (of 20 top-tier clubs)`);

  console.log(`\nMANAGEMENT:`);
  const avgManagers = metrics.reduce((sum, m) => sum + m.activeManagers, 0) / metrics.length;
  console.log(`  Avg Active Managers: ${avgManagers.toFixed(1)} (of 20 clubs)`);

  console.log(`\nHEALTH CHECK:`);
  const criticalIssues = [];
  if (lastSeason.totalPlayers < firstSeason.totalPlayers * 0.8) {
    criticalIssues.push("  ❌ Population collapsed (< 80% of start)");
  }
  if (lastSeason.totalPlayers > firstSeason.totalPlayers * 1.2) {
    criticalIssues.push("  ❌ Population exploded (> 120% of start)");
  }
  if (lastSeason.playersOver35 > firstSeason.totalPlayers * 0.3) {
    criticalIssues.push("  ⚠️  Too many aging players (>30%)");
  }
  if (lastSeason.playersUnder23 < firstSeason.totalPlayers * 0.1) {
    criticalIssues.push("  ⚠️  Insufficient youth pool (<10%)");
  }
  if (negativeSeasons === metrics.length) {
    criticalIssues.push("  ❌ All seasons had clubs in deficit");
  }

  if (criticalIssues.length === 0) {
    console.log(`  ✅ No critical issues detected`);
  } else {
    criticalIssues.forEach((issue) => console.log(issue));
  }
}

async function main() {
  const seeds = ["0", "1", "2"];
  const seasons = 20;

  const allResults = new Map<string, StressTestMetrics[]>();

  for (const seed of seeds) {
    const metrics = runStressTest(seed, seasons);
    allResults.set(seed, metrics);
    analyzeMetrics(metrics, seed);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`✅ STRESS TEST COMPLETE: ${seasons} seasons × 3 seeds`);
  console.log(`${"=".repeat(70)}\n`);

  process.exit(0);
}

main().catch(console.error);
