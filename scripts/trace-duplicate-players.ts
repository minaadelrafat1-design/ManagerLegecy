#!/usr/bin/env npx tsx
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

for (let season = 1; season <= 10; season++) {
  state = simulateSeasonQuick(state);

  // Check for duplicates
  const dupes: Record<string, string[]> = {};
  for (const [clubId, club] of Object.entries(state.clubs)) {
    for (const playerId of club.playerIds) {
      if (!dupes[playerId]) dupes[playerId] = [];
      dupes[playerId].push(clubId);
    }
  }

  const duplicatePlayers = Object.entries(dupes).filter(([, clubs]) => clubs.length > 1);

  if (duplicatePlayers.length > 0) {
    console.log(
      `\n=== SEASON ${season} (${state.time.season}) - ${duplicatePlayers.length} DUPLICATES ===`,
    );

    for (const [playerId, clubIds] of duplicatePlayers.slice(0, 3)) {
      // Show first 3
      const player = state.players[playerId];
      const playerClubId = player?.clubId;
      console.log(`\nPlayer: ${player?.name} (${playerId})`);
      console.log(`  Current clubId in player object: ${playerClubId}`);
      console.log(`  Found in these clubs: ${clubIds.join(", ")}`);

      // Check transfer history
      const transfers = (state.events ?? []).filter(
        (e) => e.type === "TRANSFER_COMPLETED" && e.meta?.playerId === playerId,
      );
      if (transfers.length > 0) {
        const lastTransfer = transfers[transfers.length - 1];
        console.log(
          `  Last transfer: S${lastTransfer.date} from ${lastTransfer.meta?.sellerClubId} to ${lastTransfer.meta?.buyerClubId}`,
        );
      }
    }
  }
}

console.log(`\n✓ Diagnostic complete`);
