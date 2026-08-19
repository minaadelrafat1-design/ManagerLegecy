#!/usr/bin/env tsx
/**
 * DETAILED TRANSFER DIAGNOSTIC
 *
 * Tracks exactly what happens with transfers:
 * 1. Are transfers created?
 * 2. Are they actually changing roster state?
 * 3. Do the events accurately describe the state changes?
 */

import { buildInitialState } from "../src/state/seed";
import { runEnhancedTransferWindow } from "../src/state/transfers-enhanced";

let state = buildInitialState("0");

console.log(`\n🔍 TRANSFER DIAGNOSTIC - DETAILED TRACKING\n`);
console.log(`${"=".repeat(70)}`);

// Capture before state
const beforeState = state;
const beforeClubs = new Map<string, number>();
for (const [clubId, club] of Object.entries(beforeState.clubs)) {
  beforeClubs.set(clubId, (club as any).playerIds?.length ?? 0);
}

console.log(`\nBEFORE TRANSFER WINDOW:`);
console.log(`  Total clubs: ${Object.keys(beforeState.clubs).length}`);
console.log(`  Sample clubs:`);
Array.from(beforeClubs.entries())
  .slice(0, 5)
  .forEach(([clubId, count]) => {
    console.log(`    ${beforeState.clubs[clubId].name}: ${count} players`);
  });

// Run transfer window
state = runEnhancedTransferWindow(state);

console.log(`\nAFTER TRANSFER WINDOW:`);

// Find clubs with roster changes
const changedClubs = [];
for (const [clubId, beforeCount] of beforeClubs) {
  const afterCount = (state.clubs[clubId] as any)?.playerIds?.length ?? 0;
  if (beforeCount !== afterCount) {
    changedClubs.push({
      clubId,
      clubName: state.clubs[clubId].name,
      before: beforeCount,
      after: afterCount,
      delta: afterCount - beforeCount,
    });
  }
}

console.log(`  Clubs with roster changes: ${changedClubs.length}`);
changedClubs.forEach((c) => {
  const sign = c.delta > 0 ? "+" : "";
  console.log(`    ${c.clubName}: ${c.before} → ${c.after} (${sign}${c.delta})`);
});

// Analyze events
const allEvents = state.events ?? [];
const transferEvents = allEvents.filter(
  (e: any) => e.type === "transfer" || e.type?.includes("transfer"),
);
const completedTransfers = allEvents.filter((e: any) => e.type === "TRANSFER_COMPLETED");
const movedEvents = allEvents.filter((e: any) => e.description?.includes("moved"));

console.log(`\nEVENTS SUMMARY:`);
console.log(`  Total events: ${allEvents.length}`);
console.log(`  Transfer type events: ${transferEvents.length}`);
console.log(`  TRANSFER_COMPLETED events: ${completedTransfers.length}`);
console.log(`  "moved" in description: ${movedEvents.length}`);

if (completedTransfers.length > 0) {
  console.log(`\n  Sample completed transfers:`);
  completedTransfers.slice(0, 5).forEach((e: any) => {
    console.log(`    - ${e.description}`);
    console.log(`      From: ${e.meta?.fromClubId ?? "unknown"}`);
    console.log(`      To: ${e.meta?.toClubId ?? "unknown"}`);
    console.log(`      Player: ${e.meta?.playerId ?? "unknown"}`);
  });
}

if (movedEvents.length > 0) {
  console.log(`\n  Sample "moved" events:`);
  movedEvents.slice(0, 5).forEach((e: any) => {
    console.log(`    - ${e.description}`);
  });
}

// Check if transfers are recorded in state.transfers
const transfers = state.transfers ?? [];
console.log(`\nTRANSFER LISTINGS:`);
console.log(`  Total listings: ${transfers.length}`);
const statuses = new Map<string, number>();
for (const t of transfers) {
  const status = (t as any).status ?? "unknown";
  statuses.set(status, (statuses.get(status) ?? 0) + 1);
}
console.log(`  By status:`);
statuses.forEach((count, status) => {
  console.log(`    ${status}: ${count}`);
});

// Verify consistency: if events say moved, did roster actually change?
console.log(`\nCONSISTENCY CHECK:`);
let consistencyErrors = 0;
for (const event of movedEvents) {
  const description = event.description ?? "";
  // Try to parse: "{player} moved {from} -> {to}"
  const match = description.match(/^(.*?)\s+moved\s+(.*?)\s+->\s+(.*?)(?:\s+for)?/);
  if (match) {
    const [, playerName, fromName, toName] = match;
    // Find player
    const player = Object.values(state.players).find((p: any) =>
      p.name?.toLowerCase().includes(playerName.toLowerCase().split(" ")[0]),
    ) as any;
    if (player && player.clubId) {
      const playerClub = state.clubs[player.clubId];
      if (!playerClub?.name.includes(toName)) {
        console.log(
          `  ⚠️  Event says "${playerName}" → "${toName}" but player is at "${playerClub?.name}"`,
        );
        consistencyErrors++;
      }
    }
  }
}

if (consistencyErrors === 0) {
  console.log(`  ✅ All transfer events match actual roster state`);
} else {
  console.log(`  ❌ ${consistencyErrors} events don't match roster`);
}

console.log(`\n${"=".repeat(70)}\n`);

if (changedClubs.length > 0 && completedTransfers.length > 0) {
  console.log(`✅ TRANSFERS ARE WORKING`);
  console.log(`   - Roster changes: ${changedClubs.length} clubs`);
  console.log(`   - Completed events: ${completedTransfers.length}`);
  console.log(`   - Net player movement: ${changedClubs.reduce((sum, c) => sum + c.delta, 0)}`);
} else if (changedClubs.length > 0) {
  console.log(`⚠️  PARTIAL ISSUE`);
  console.log(`   - Rosters changed: ${changedClubs.length} clubs`);
  console.log(`   - But no TRANSFER_COMPLETED events found`);
  console.log(`   - Check event naming conventions`);
} else {
  console.log(`❌ TRANSFER SYSTEM NOT WORKING`);
  console.log(`   - No roster changes detected`);
  console.log(`   - No completed transfer events`);
}

console.log();
process.exit(0);
