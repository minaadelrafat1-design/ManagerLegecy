#!/usr/bin/env npx tsx
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

// Check for duplicates at season 1
state = simulateSeasonQuick(state);

const dupes: Record<string, string[]> = {};
for (const [clubId, club] of Object.entries(state.clubs)) {
  for (const playerId of club.playerIds) {
    if (!dupes[playerId]) dupes[playerId] = [];
    dupes[playerId].push(clubId);
  }
}

const duplicatePlayers = Object.entries(dupes).filter(([, clubs]) => clubs.length > 1);
console.log(`Season 1 duplicates: ${duplicatePlayers.length}`);

if (duplicatePlayers.length > 0) {
  for (const [playerId, clubIds] of duplicatePlayers.slice(0, 1)) {
    const player = state.players[playerId];
    console.log(
      `  Player: ${player?.name} (${playerId}), clubId=${player?.clubId}, found in: ${clubIds.join(", ")}`,
    );
  }
} else {
  console.log("✓ No duplicates in season 1");
}
