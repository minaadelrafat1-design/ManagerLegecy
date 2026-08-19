import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

// Monkey-patch to trace club roster modifications
const originalSimulate = simulateSeasonQuick;

let state = buildInitialState("0");

for (let season = 1; season <= 8; season++) {
  state = simulateSeasonQuick(state);

  if (season === 8) {
    // Before season 8 is finalized, check if there's a duplicate
    const dupes = new Map();
    for (const [clubId, club] of Object.entries(state.clubs)) {
      for (const pid of club.playerIds ?? []) {
        const arr = dupes.get(pid) || [];
        arr.push(clubId);
        dupes.set(pid, arr);
      }
    }
    const duplicates = [...dupes.entries()].filter(([, clubs]) => clubs.length > 1);

    if (duplicates.length > 0) {
      const [playerId, clubIds] = duplicates[0];
      const player = state.players[playerId];

      console.log(`\n*** DUPLICATE FOUND IN SEASON 8 ***`);
      console.log(`Player: ${player?.name} (${playerId})`);
      console.log(`Player.clubId: ${player?.clubId}`);
      console.log(`In rosters: ${clubIds.map((cid: string) => state.clubs[cid]?.name).join(", ")}`);

      // Find recent transfer events for this player
      const recentEvents = (state.events ?? [])
        .filter(
          (e) =>
            (e.meta as any)?.playerId === playerId || e.description?.includes(player?.name || ""),
        )
        .slice(-30);

      console.log(`\nLast 30 events mentioning this player:`);
      for (const event of recentEvents) {
        console.log(`  [${event.date}] ${event.type}: ${event.description?.substring(0, 80)}`);
      }
    }
  }
}
