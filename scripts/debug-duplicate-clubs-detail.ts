#!/usr/bin/env npx tsx
/**
 * Deep diagnostic to trace duplicate club membership issues
 * Runs 10 seasons, checking after each season for duplicates
 * and reporting detailed state at time of duplication
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

async function main() {
  console.log(`${"═".repeat(70)}`);
  console.log(`DUPLICATE CLUB MEMBERSHIP DIAGNOSTIC`);
  console.log(`${"═".repeat(70)}\n`);

  let state = buildInitialState("0");

  for (let season = 1; season <= 10; season++) {
    state = simulateSeasonQuick(state);

    // Check for duplicates
    const playerRosterMap = new Map<string, string[]>();
    for (const [clubId, club] of Object.entries(state.clubs)) {
      for (const playerId of club.playerIds) {
        if (!playerRosterMap.has(playerId)) {
          playerRosterMap.set(playerId, []);
        }
        playerRosterMap.get(playerId)!.push(clubId);
      }
    }

    const duplicates = Array.from(playerRosterMap.entries())
      .filter(([_, clubs]) => clubs.length > 1)
      .slice(0, 5);

    if (duplicates.length > 0) {
      console.log(`\n⚠️  DUPLICATES FOUND AT SEASON ${season} (${state.time.season})`);
      console.log(`Total duplicate players: ${duplicates.length}\n`);

      for (const [playerId, clubIds] of duplicates) {
        const player = state.players[playerId];
        console.log(`  Player: ${player.name} (${playerId})`);
        console.log(`    Age: ${player.age}, Status: ${player.status}`);
        console.log(`    player.clubId: ${player.clubId}`);
        console.log(`    In ${clubIds.length} clubs: ${clubIds.join(", ")}`);

        // Check player's career history
        if (player.career?.clubHistory) {
          console.log(`    Career clubs: ${player.career.clubHistory.slice(-3).join(" → ")}`);
        }

        // Check if there are transfer events for this player
        const playerEvents = (state.events ?? [])
          .filter(
            (e: any) =>
              e.meta?.playerId === playerId &&
              (e.type === "TRANSFER_COMPLETED" || e.type.includes("TRANSFER")),
          )
          .slice(-5);

        if (playerEvents.length > 0) {
          console.log(`    Recent events:`);
          for (const evt of playerEvents) {
            console.log(`      - ${evt.date}: ${evt.type} (${evt.description})`);
          }
        }

        console.log();
      }
    } else {
      console.log(`✓ Season ${season} (${state.time.season}): No duplicates`);
    }
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`Diagnostic complete`);
}

main().catch(console.error);
