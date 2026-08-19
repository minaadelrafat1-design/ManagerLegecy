#!/usr/bin/env npx tsx
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

// Run to season 6
for (let season = 1; season <= 6; season++) {
  state = simulateSeasonQuick(state);
}

// Check for duplicates at season 6
const dupes: Record<string, string[]> = {};
for (const [clubId, club] of Object.entries(state.clubs)) {
  for (const playerId of club.playerIds) {
    if (!dupes[playerId]) dupes[playerId] = [];
    dupes[playerId].push(clubId);
  }
}

const duplicatePlayers = Object.entries(dupes).filter(([, clubs]) => clubs.length > 1);
console.log(`Season 6 duplicates: ${duplicatePlayers.length}`);

if (duplicatePlayers.length > 0) {
  for (const [playerId, clubIds] of duplicatePlayers.slice(0, 1)) {
    const player = state.players[playerId];
    console.log(`\nPlayer: ${player?.name} (${playerId})`);
    console.log(`  Current clubId in player object: ${player?.clubId}`);
    console.log(`  Found in these clubs: ${clubIds.join(", ")}`);

    // Get the player's info in each club roster
    for (const clubId of clubIds) {
      const club = state.clubs[clubId];
      console.log(`    ${clubId}: roster has ${club.playerIds.length} players`);
    }
  }
}
