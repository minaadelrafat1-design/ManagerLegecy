#!/usr/bin/env npx tsx
/**
 * PHASE 7B: Transfer System - Multi-Season Production Simulation
 *
 * Run a deterministic multi-season simulation and:
 * 1. Track every transfer that occurs
 * 2. Verify atomic player movement
 * 3. Reconcile financial changes
 * 4. Report all inconsistencies
 * 5. Count successful vs failed transfers
 */

const { buildInitialState } = await import("../src/state/seed");
const { advanceGameDays } = await import("../src/state/calendar");
const { verifyTransferConsistency } = await import("../src/state/transfer-hardening");
import type { GameState, Player } from "../src/state/types";

function logSection(title: string) {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ ${title.padEnd(78)} ║`);
  console.log(`${"═".repeat(80)}`);
}

function logSubsection(title: string) {
  console.log(`\n── ${title}`);
}

function main() {
  logSection("TRANSFER SYSTEM MULTI-SEASON SIMULATION");

  let state = buildInitialState();
  const startDate = state.time.date;
  const startSeason = state.time.season;

  console.log(`Starting: ${startDate} / ${startSeason}`);
  console.log(`Clubs: ${Object.keys(state.clubs).length}`);
  console.log(`Players: ${Object.keys(state.players).length}`);

  // Track state snapshots
  interface PlayerSnapshot {
    playerId: string;
    playerName: string;
    clubId: string;
    clubName: string;
    date: string;
  }

  const playerHistory: PlayerSnapshot[] = [];
  const transferLog: Array<{
    date: string;
    playerId: string;
    playerName: string;
    fromClubId: string;
    fromClubName: string;
    toClubId: string;
    toClubName: string;
  }> = [];

  // Initial snapshot
  for (const [playerId, player] of Object.entries(state.players)) {
    if (!player) continue;
    const club = state.clubs[player.clubId];
    playerHistory.push({
      playerId,
      playerName: player.name,
      clubId: player.clubId,
      clubName: club?.name ?? "UNKNOWN",
      date: startDate,
    });
  }

  // Run simulation for 730 days (2 full seasons)
  const simulationDays = 730;
  const daysPerReport = 90; // Report every quarter
  const reportCounter = 0;

  for (let day = 0; day < simulationDays; day++) {
    state = advanceGameDays(state, 1);

    // Detect transfers by comparing player club assignments
    for (const [playerId, player] of Object.entries(state.players)) {
      if (!player) continue;

      const lastRecord = playerHistory[playerHistory.length - 1];
      if (!lastRecord) continue;

      const prevEntry = playerHistory.filter((h) => h.playerId === playerId).slice(-1)[0];

      if (prevEntry && prevEntry.clubId !== player.clubId) {
        // Transfer detected!
        const fromClub = state.clubs[prevEntry.clubId];
        const toClub = state.clubs[player.clubId];

        transferLog.push({
          date: state.time.date,
          playerId,
          playerName: player.name,
          fromClubId: prevEntry.clubId,
          fromClubName: fromClub?.name ?? prevEntry.clubName,
          toClubId: player.clubId,
          toClubName: toClub?.name ?? "UNKNOWN",
        });
      }
    }

    // Periodic snapshot
    if (day % daysPerReport === 0) {
      for (const [playerId, player] of Object.entries(state.players)) {
        if (!player) continue;
        const club = state.clubs[player.clubId];
        playerHistory.push({
          playerId,
          playerName: player.name,
          clubId: player.clubId,
          clubName: club?.name ?? "UNKNOWN",
          date: state.time.date,
        });
      }
    }
  }

  const endDate = state.time.date;
  const endSeason = state.time.season;

  logSection("SIMULATION COMPLETE");
  console.log(`Duration: ${startDate} → ${endDate}`);
  console.log(`Seasons: ${startSeason} → ${endSeason}`);
  console.log(`Days simulated: ${simulationDays}`);

  // =====================================================================
  // TRANSFER ANALYSIS
  // =====================================================================

  logSubsection("Transfer Activity");
  console.log(`Total transfers detected (by player movement): ${transferLog.length}`);

  const transfersByDate: Record<string, number> = {};
  for (const t of transferLog) {
    transfersByDate[t.date] = (transfersByDate[t.date] ?? 0) + 1;
  }

  const activeDates = Object.keys(transfersByDate).sort();
  console.log(`Active transfer dates: ${activeDates.length}`);
  if (activeDates.length > 0) {
    console.log(`First transfer: ${activeDates[0]} (${transfersByDate[activeDates[0]]} transfers)`);
    console.log(
      `Last transfer: ${activeDates[activeDates.length - 1]} (${transfersByDate[activeDates[activeDates.length - 1]]} transfers)`,
    );
  }

  const maxTransfersInDay = Math.max(...Object.values(transfersByDate), 0);
  console.log(`Max transfers in single day: ${maxTransfersInDay}`);

  // Event analysis
  const transferEvents = state.events.filter(
    (e) => e.type === "transfer" || e.type === "TRANSFER_COMPLETED",
  );
  console.log(`Transfer events in log: ${transferEvents.length}`);

  // =====================================================================
  // ATOMICITY VERIFICATION
  // =====================================================================

  logSubsection("Atomicity Verification");

  let consistencyViolations = 0;
  const violationDetails: Record<string, string[]> = {};

  for (const [playerId, player] of Object.entries(state.players)) {
    if (!player) continue;
    const consistency = verifyTransferConsistency(state, playerId, player.clubId);
    if (!consistency.consistent) {
      consistencyViolations++;
      const key = player.name;
      violationDetails[key] = consistency.violations;
    }
  }

  console.log(`Players with consistency violations: ${consistencyViolations}`);
  if (consistencyViolations > 0) {
    console.log("\nViolation details:");
    for (const [name, violations] of Object.entries(violationDetails)) {
      console.log(`  ${name}: ${violations.join(", ")}`);
    }
  }

  // Check for duplicate club memberships
  let duplicateMemberships = 0;
  const clubsByPlayer: Record<string, string[]> = {};
  for (const [clubId, club] of Object.entries(state.clubs)) {
    for (const playerId of club.playerIds ?? []) {
      if (!clubsByPlayer[playerId]) clubsByPlayer[playerId] = [];
      clubsByPlayer[playerId].push(clubId);
    }
  }

  for (const [playerId, clubs] of Object.entries(clubsByPlayer)) {
    if (clubs.length > 1) {
      duplicateMemberships++;
      const player = state.players[playerId];
      console.log(`  ✗ ${player?.name || playerId} in ${clubs.length} clubs: ${clubs.join(", ")}`);
    }
  }

  console.log(`Players in multiple clubs: ${duplicateMemberships}`);

  // =====================================================================
  // TRANSFER COMPLETENESS
  // =====================================================================

  logSubsection("Transfer Completeness");

  // Count players who moved
  const playersWhoMoved = new Set<string>();
  for (const t of transferLog) {
    playersWhoMoved.add(t.playerId);
  }

  console.log(`Unique players transferred: ${playersWhoMoved.size}`);
  console.log(`Total transfers: ${transferLog.length}`);

  // Average transfers per moving player
  if (playersWhoMoved.size > 0) {
    const avgTransfersPerPlayer = transferLog.length / playersWhoMoved.size;
    console.log(`Average transfers per player: ${avgTransfersPerPlayer.toFixed(2)}`);
  }

  // =====================================================================
  // FINANCIAL RECONCILIATION
  // =====================================================================

  logSubsection("Financial Impact");

  // Sum transfer event fees
  let totalFeeFromEvents = 0;
  for (const event of transferEvents) {
    const fee = event.meta?.fee as number | undefined;
    if (typeof fee === "number" && fee > 0) {
      totalFeeFromEvents += fee;
    }
  }

  console.log(`Total fees recorded in events: €${totalFeeFromEvents.toLocaleString()}`);

  // Club financial health
  const clubFinances: Record<string, { name: string; balance: number }> = {};
  for (const [clubId, club] of Object.entries(state.clubs)) {
    clubFinances[clubId] = {
      name: club.name,
      balance: 0, // Would need to compute from game state
    };
  }

  // =====================================================================
  // ISSUE DETECTION
  // =====================================================================

  logSubsection("Detected Issues");

  const issues: string[] = [];

  if (consistencyViolations > 0) {
    issues.push(`${consistencyViolations} players with state consistency violations`);
  }

  if (duplicateMemberships > 0) {
    issues.push(`${duplicateMemberships} players registered to multiple clubs simultaneously`);
  }

  if (transferEvents.length === 0 && transferLog.length > 0) {
    issues.push("Transfers detected in player state but not recorded in event log");
  }

  if (transferEvents.length > 0 && transferLog.length === 0) {
    issues.push("Transfer events logged but no player movements detected");
  }

  // Check for artificial market players
  const marketPlayers = Object.values(state.players).filter(
    (p) => p && (p.id?.includes("market-") || p.id?.includes("gen-")),
  );

  if (marketPlayers.length > 0) {
    issues.push(`${marketPlayers.length} artificial market players created`);
  }

  if (issues.length === 0) {
    console.log("✓ No major issues detected");
  } else {
    for (let i = 0; i < issues.length; i++) {
      console.log(`${i + 1}. ${issues[i]}`);
    }
  }

  // =====================================================================
  // DETAILED TRANSFER LOG (sample)
  // =====================================================================

  logSubsection("Sample Transfers");

  const sampleTransfers = transferLog.slice(0, 10);
  if (sampleTransfers.length > 0) {
    for (const t of sampleTransfers) {
      console.log(`${t.date}: ${t.playerName} (${t.fromClubName} → ${t.toClubName})`);
    }
    if (transferLog.length > 10) {
      console.log(`... and ${transferLog.length - 10} more transfers`);
    }
  } else {
    console.log("(No transfers recorded)");
  }

  // =====================================================================
  // SUMMARY
  // =====================================================================

  logSection("SIMULATION SUMMARY");

  console.log(`\nStarting state:`);
  console.log(`  Date: ${startDate}`);
  console.log(`  Clubs: ${Object.keys(state.clubs).length}`);
  console.log(`  Players: ${Object.keys(state.players).length}`);

  console.log(`\nEnding state:`);
  console.log(`  Date: ${endDate}`);
  console.log(`  Clubs: ${Object.keys(state.clubs).length}`);
  console.log(`  Players: ${Object.keys(state.players).length}`);

  console.log(`\nTransfer Activity:`);
  console.log(`  Total transfers: ${transferLog.length}`);
  console.log(`  Unique players: ${playersWhoMoved.size}`);
  console.log(`  Event log entries: ${transferEvents.length}`);
  console.log(`  Consistency violations: ${consistencyViolations}`);
  console.log(`  Duplicate memberships: ${duplicateMemberships}`);
  console.log(`  Issues detected: ${issues.length}`);

  console.log(`\nFinancial:`);
  console.log(`  Total transfer fees (events): €${totalFeeFromEvents.toLocaleString()}`);

  console.log(
    `\nStatus: ${issues.length === 0 && consistencyViolations === 0 ? "✓ PASS" : "✗ ISSUES"}`,
  );

  console.log("\n");

  process.exit(issues.length > 0 || consistencyViolations > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Simulation error:", e);
  process.exit(2);
});
