import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

let state = buildInitialState("0");
for (let season = 1; season <= 8; season++) {
  state = simulateSeasonQuick(state);

  if (season === 8) {
    // Find Elias Haugen
    const haugen = Object.entries(state.players).find(([, p]) => p.name === "Elias Haugen");
    if (haugen) {
      const [playerId, player] = haugen;
      console.log("Season 8: Found Elias Haugen");
      console.log("  playerId:", playerId);
      console.log("  player.clubId:", player.clubId);

      // Check which clubs have this player in their roster
      const clubsWithPlayer: string[] = [];
      for (const [clubId, club] of Object.entries(state.clubs)) {
        if (club.playerIds?.includes(playerId)) {
          clubsWithPlayer.push(clubId);
          console.log(`  Found in club: ${clubId} (${club.name})`);
        }
      }

      console.log("  Total duplicates:", clubsWithPlayer.length);

      // Search the event log for this player's recent transfer events
      const recentEvents = (state.events ?? [])
        .filter(
          (e) => (e.meta as any)?.playerId === playerId || e.description?.includes("Elias Haugen"),
        )
        .slice(-20);

      console.log("\n  Last 20 events mentioning Elias Haugen:");
      for (const event of recentEvents) {
        console.log(`    [${event.date}] ${event.type}: ${event.description}`);
        if ((event.meta as any)?.action) console.log(`      action: ${(event.meta as any).action}`);
        if ((event.meta as any)?.fromClubId)
          console.log(`      from: ${(event.meta as any).fromClubId}`);
        if ((event.meta as any)?.toClubId) console.log(`      to: ${(event.meta as any).toClubId}`);
      }
    }
  }
}
