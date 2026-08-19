#!/usr/bin/env npx tsx
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

for (let s = 1; s <= 6; s++) {
  state = simulateSeasonQuick(state);
  console.log(`\n=== SEASON ${s} ===`);

  const transferEvents = (state.events ?? []).filter((e) => e.type === "TRANSFER_COMPLETED");
  console.log(`TRANSFER_COMPLETED events: ${transferEvents.length}`);

  const duplicates: Record<string, number> = {};
  for (const [clubId, club] of Object.entries(state.clubs)) {
    for (const playerId of club.playerIds) {
      duplicates[playerId] = (duplicates[playerId] ?? 0) + 1;
    }
  }

  const dups = Object.entries(duplicates).filter(([, count]) => count > 1);
  console.log(`Duplicate players: ${dups.length}`);
  if (dups.length > 0) {
    for (const [playerId, count] of dups.slice(0, 3)) {
      const player = state.players[playerId];
      const clubNames = Object.entries(state.clubs)
        .filter(([, club]) => club.playerIds.includes(playerId))
        .map(([clubId, club]) => club.name);
      console.log(`  ${player?.name ?? playerId}: in ${count} clubs: ${clubNames.join(", ")}`);
    }
    if (dups.length > 0) break; // Stop when we find duplicates
  }
}
