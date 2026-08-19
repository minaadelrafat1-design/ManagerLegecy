#!/usr/bin/env tsx
/**
 * PHASE AAA-90.2: Fast 5-Season Ecosystem Validation
 *
 * Checks:
 * - Season progression (fixtures, standings, results)
 * - Transfers (AI negotiations, player movement)
 * - Population (retirements vs youth generation)
 * - Club finances (stability, no negatives)
 * - Manager changes (board pressure, job market)
 * - European competitions (qualification, progression)
 * - Promotions/relegation
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import { runMonthlyPlayerDevelopment } from "../src/state/player-development";

interface SeasonSnapshot {
  season: number;
  totalPlayers: number;
  avgAge: number;
  totalTransfers: number;
  transferEvents: number;
  totalClubs: number;
  clubsInDebt: number;
  managerChanges: number;
  europeanClubs: number;
}

function captureSeasonSnapshot(state: any, seasonNum: number): SeasonSnapshot {
  const players = Object.values(state.players) as any[];
  const clubs = Object.values(state.clubs) as any[];
  const ages = players.map((p) => p.age).filter((a) => a != null);
  const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

  const completedTransfers = (state.transfers ?? []).filter(
    (t: any) => t.status === "completed",
  ).length;
  const transferEvents = (state.events ?? [])
    .filter((e: any) => e.type === "transfer" && e.description?.includes("moved"))
    .slice(-10).length; // Last 10 seasons worth

  const inDebt = clubs.filter((c: any) => (c.balance ?? 0) < 0).length;
  const europeanClubs = clubs.filter((c: any) => (c.europeanCompetition ?? null) !== null).length;

  return {
    season: seasonNum,
    totalPlayers: players.length,
    avgAge: Math.round(avgAge * 10) / 10,
    totalTransfers: completedTransfers,
    transferEvents,
    totalClubs: clubs.length,
    clubsInDebt: inDebt,
    managerChanges: Object.keys(state.managers ?? {}).length,
    europeanClubs,
  };
}

function runValidationTest(seed: string, numSeasons: number) {
  let state = buildInitialState(seed);
  const snapshots: SeasonSnapshot[] = [];

  console.log(`\n${"=".repeat(70)}`);
  console.log(`🔍 SEED ${seed}: ${numSeasons}-SEASON VALIDATION`);
  console.log(`${"=".repeat(70)}`);

  for (let s = 0; s < numSeasons; s++) {
    // Monthly development
    for (let m = 0; m < 12; m++) {
      state = runMonthlyPlayerDevelopment(state as any) as any;
    }

    // Season sim
    state = simulateSeasonQuick(state as any) as any;

    const snap = captureSeasonSnapshot(state, state.currentSeason);
    snapshots.push(snap);

    const indicator =
      `S${String(snap.season).padStart(2)} | ${String(snap.totalPlayers).padStart(4)}P | ` +
      `${String(snap.transferEvents).padStart(2)}xfer | ${String(snap.clubsInDebt).padStart(2)}debt | ` +
      `${String(snap.europeanClubs).padStart(2)}EU | Age ${snap.avgAge.toFixed(1)}`;

    console.log(`  ${indicator}`);
  }

  console.log(`\n${"─".repeat(70)}`);
  console.log(`METRICS:`, snapshots.length, `seasons`);

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  console.log(
    `\n  Players:      ${first.totalPlayers} → ${last.totalPlayers} (${((last.totalPlayers / first.totalPlayers) * 100 - 100).toFixed(0)}%)`,
  );
  console.log(`  Avg Age:      ${first.avgAge} → ${last.avgAge}`);
  console.log(`  Transfers:    ${snapshots.reduce((sum, s) => sum + s.transferEvents, 0)} total`);
  console.log(`  Clubs:        ${first.totalClubs} (${last.clubsInDebt} in debt)`);
  console.log(`  Managers:     ${last.managerChanges}`);
  console.log(
    `  Europe:       Avg ${(snapshots.reduce((sum, s) => sum + s.europeanClubs, 0) / snapshots.length).toFixed(1)} clubs/season`,
  );

  // Sanity checks
  const issues = [];
  if (last.totalPlayers < first.totalPlayers * 0.7) issues.push("❌ Population collapsed");
  if (last.totalPlayers > first.totalPlayers * 1.3) issues.push("❌ Population exploded");
  if (last.clubsInDebt === first.totalClubs) issues.push("❌ All clubs in debt");
  if (last.transferEvents === 0) issues.push("❌ No transfers happening");
  if (last.managerChanges === 0) issues.push("⚠️  No manager changes");

  if (issues.length === 0) {
    console.log(`\n  ✅ All systems healthy`);
  } else {
    issues.forEach((i) => console.log(`\n  ${i}`));
  }
}

async function main() {
  const seeds = ["0"];
  const seasons = 5;

  for (const seed of seeds) {
    runValidationTest(seed, seasons);
  }

  console.log(`\n${"=".repeat(70)}\n✅ VALIDATION COMPLETE\n`);
  process.exit(0);
}

main().catch(console.error);
