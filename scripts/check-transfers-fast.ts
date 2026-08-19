#!/usr/bin/env tsx
/**
 * ULTRA-FAST: Check transfer system in isolation
 */

import { buildInitialState } from "../src/state/seed";
import { runEnhancedTransferWindow } from "../src/state/transfers-enhanced";

const state = buildInitialState("0");

console.log(`⚡ TRANSFER SYSTEM CHECK\n`);

// Check initial transfers
const transfersBefore = state.transfers ?? [];
console.log(`Before transfer window:`, {
  total: transfersBefore.length,
  statuses: transfersBefore.map((t: any) => t.status ?? "undefined"),
});

// Run ONE transfer window
const stateAfter = runEnhancedTransferWindow(state);

const transfersAfter = stateAfter.transfers ?? [];
console.log(`\nAfter transfer window:`, {
  total: transfersAfter.length,
  statuses: transfersAfter.map((t: any) => t.status ?? "undefined"),
});

// Check events
const transferEvents = (stateAfter.events ?? []).filter((e: any) => e.type === "transfer");
console.log(`\nTransfer events created:`, transferEvents.length);
if (transferEvents.length > 0) {
  transferEvents.slice(0, 3).forEach((e: any) => {
    console.log(`  - ${e.description}`);
  });
}

// Check player movement
const playersMovedToOtherClubs = Object.entries(stateAfter.clubs as any).filter(
  ([clubId, club]: any) => {
    const before = state.clubs[clubId];
    return before && (before.playerIds?.length ?? 0) !== (club.playerIds?.length ?? 0);
  },
);

console.log(`\nClubs with roster changes: ${playersMovedToOtherClubs.length}`);
if (playersMovedToOtherClubs.length > 0) {
  playersMovedToOtherClubs.slice(0, 3).forEach(([clubId, club]: any) => {
    const before = state.clubs[clubId];
    console.log(
      `  ${club.name}: ${before.playerIds?.length ?? 0} → ${club.playerIds?.length ?? 0}`,
    );
  });
}

console.log(`\n✅ Test complete`);
process.exit(0);
