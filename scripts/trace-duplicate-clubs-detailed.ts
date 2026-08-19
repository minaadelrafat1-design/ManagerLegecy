import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import { detectPlayerDuplication } from "../src/state/event-invariants";

async function traceDetailedDuplicates() {
  console.log(`${"═".repeat(70)}`);
  console.log(`DETAILED DUPLICATE-CLUB TRACE`);
  console.log(`${"═".repeat(70)}`);

  let state = buildInitialState("0");
  const duplicatesByPlayerId = new Map<string, Set<number>>();

  // Advance through 30 seasons, checking for duplicates at each checkpoint
  for (let season = 1; season <= 30; season++) {
    state = simulateSeasonQuick(state);

    // Check for duplicates
    const duplicates = detectPlayerDuplication(state);
    if (duplicates.length > 0) {
      console.log(
        `\n📍 Season ${season} (${state.time.season}): Found ${duplicates.length} duplicate(s)`,
      );

      for (const dup of duplicates) {
        if (!duplicatesByPlayerId.has(dup.playerId)) {
          duplicatesByPlayerId.set(dup.playerId, new Set());
        }
        duplicatesByPlayerId.get(dup.playerId)!.add(season);

        // Get player details
        const player = state.players.find((p) => p.id === dup.playerId);
        if (player) {
          console.log(`  Player: ${player.firstName} ${player.lastName} (${dup.playerId})`);
          console.log(`    In clubs: ${dup.clubIds.join(", ")}`);
          console.log(`    Player.clubId: ${player.clubId}`);

          // Check event history for this player
          const playerEvents = (state.events ?? []).filter(
            (e) => e.description?.includes(dup.playerId) || (e as any).playerId === dup.playerId,
          );
          if (playerEvents.length > 0) {
            console.log(
              `    Recent events: ${playerEvents
                .slice(-3)
                .map((e) => `${e.type}@${e.date}`)
                .join(", ")}`,
            );
          }
        }
      }

      // Stop after first batch of duplicates to investigate
      if (season > 5 && duplicates.length > 0) {
        console.log(`\n⏹️  Stopping at season ${season} to investigate`);
        break;
      }
    }

    if (season % 5 === 0) {
      console.log(`  ✓ Season ${season} checked - no new duplicates`);
    }
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`SUMMARY: ${duplicatesByPlayerId.size} player(s) affected across seasons`);
}

traceDetailedDuplicates().catch(console.error);
