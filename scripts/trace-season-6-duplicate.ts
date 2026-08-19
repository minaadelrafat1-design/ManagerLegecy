#!/usr/bin/env npx tsx
/**
 * Trace exactly when and how player duplication occurs
 * Focus on season 6 when first duplicate appears
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import { detectPlayerDuplication } from "../src/state/event-invariants";

async function traceFirstDuplicate() {
  console.log(`TRACING FIRST DUPLICATE AT SEASON 6\n`);

  let state = buildInitialState("0");

  // Advance to season 6 where first duplicate appears
  for (let season = 1; season < 6; season++) {
    state = simulateSeasonQuick(state);
  }

  console.log(`Season 5 complete. Checking for duplicates...`);
  let dups = detectPlayerDuplication(state);
  if (dups.length > 0) {
    console.log(`  ⚠️  Found ${dups.length} duplicates at season 5`);
  } else {
    console.log(`  ✓ No duplicates at season 5`);
  }

  // Simulate season 6
  console.log(`\nSimulating season 6...`);
  state = simulateSeasonQuick(state);

  // Check after season 6
  dups = detectPlayerDuplication(state);
  if (dups.length > 0) {
    console.log(`\n❌ SEASON 6: Found ${dups.length} duplicate(s)!`);

    for (const dup of dups.slice(0, 3)) {
      const playerId = dup.data?.playerId;
      const clubIds = dup.data?.clubIds;
      const player = state.players[playerId!];

      if (player) {
        console.log(`\nPlayer: ${player.firstName} ${player.lastName} (${playerId})`);
        console.log(`  In clubs: ${clubIds?.join(", ")}`);
        console.log(`  Player.clubId: ${player.clubId}`);

        // Find events related to this player in season 6
        const playerEvents = (state.events ?? [])
          .filter((e) => e.description?.includes(playerId) || (e as any).playerId === playerId)
          .slice(-5);

        if (playerEvents.length > 0) {
          console.log(`  Recent events (last 5):`);
          for (const evt of playerEvents) {
            console.log(`    ${evt.date} ${evt.type}: ${evt.description?.substring(0, 60)}`);
          }
        }

        // Check which clubs have this player
        for (const clubId of clubIds ?? []) {
          const club = state.clubs[clubId];
          if (club) {
            console.log(
              `  Club ${club.name}: ${club.playerIds?.includes(playerId) ? "✓ HAS" : "✗ MISSING"} player`,
            );
          }
        }
      }
    }
  } else {
    console.log(`  ✓ No duplicates at season 6 (bug not reproduced)`);
  }
}

traceFirstDuplicate().catch(console.error);
