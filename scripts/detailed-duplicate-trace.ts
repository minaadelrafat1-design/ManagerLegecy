#!/usr/bin/env npx tsx
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

// Run to season 6 where first duplicate appears
for (let season = 1; season <= 6; season++) {
  state = simulateSeasonQuick(state);
}

// Find the exact duplicates
const dupes: Record<string, { clubs: string[]; player: any }> = {};
for (const [clubId, club] of Object.entries(state.clubs)) {
  for (const playerId of club.playerIds) {
    const player = state.players[playerId];
    if (!dupes[playerId]) {
      dupes[playerId] = { clubs: [], player };
    }
    dupes[playerId].clubs.push(clubId);
  }
}

const duplicatePlayers = Object.entries(dupes)
  .filter(([, info]) => info.clubs.length > 1)
  .map(([id, info]) => ({ id, ...info }));

console.log(`\n=== SEASON 6 DUPLICATES ===`);
console.log(`Total: ${duplicatePlayers.length}`);

if (duplicatePlayers.length > 0) {
  const dup = duplicatePlayers[0];
  console.log(`\nFirst duplicate: ${dup.player.name} (${dup.id})`);
  console.log(`  Player.clubId value: ${dup.player.clubId}`);
  console.log(`  Found in clubs: ${dup.clubs.join(", ")}`);

  // Check the actual club rosters
  for (const clubId of dup.clubs) {
    const club = state.clubs[clubId];
    const index = club.playerIds.indexOf(dup.id);
    console.log(`    ${clubId}: appears at index ${index}`);
  }

  // Trace transfer events for this player
  const transfers = (state.events ?? []).filter(
    (e) => e.type === "TRANSFER_COMPLETED" && e.meta?.playerId === dup.id,
  );
  console.log(`  Transfer events for this player: ${transfers.length}`);
  for (const t of transfers.slice(-2)) {
    console.log(`    ${t.date}: ${t.meta?.fromClubId} -> ${t.meta?.buyerClubId}`);
  }

  // Check if player has career history
  if (dup.player.career?.clubHistory) {
    console.log(`  Career history: ${dup.player.career.clubHistory.join(" -> ")}`);
  }
}
