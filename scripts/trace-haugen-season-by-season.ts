import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

let state = buildInitialState("0");

// Run through seasons 1-8
for (let season = 1; season <= 8; season++) {
  console.log(`\n=== SEASON ${season} START ===`);

  // Check if Elias Haugen exists before this season
  const haugenBefore = Object.entries(state.players).find(([, p]) => p.name === "Elias Haugen");
  if (haugenBefore) {
    const [pid, p] = haugenBefore;
    const clubs = Object.entries(state.clubs)
      .filter(([, c]) => c.playerIds?.includes(pid))
      .map(([cid, c]) => c.name);
    console.log(
      `Elias Haugen before: player.clubId=${p.clubId}, clubs.playerIds=${clubs.join(", ")}`,
    );
  }

  state = simulateSeasonQuick(state);

  // Check after
  const haugenAfter = Object.entries(state.players).find(([, p]) => p.name === "Elias Haugen");
  if (haugenAfter) {
    const [pid, p] = haugenAfter;
    const clubs = Object.entries(state.clubs)
      .filter(([, c]) => c.playerIds?.includes(pid))
      .map(([cid, c]) => c.name);
    console.log(
      `Elias Haugen after: player.clubId=${p.clubId}, clubs.playerIds=${clubs.join(", ")}`,
    );

    if (clubs.length > 1) {
      console.log(`\n*** DUPLICATE DETECTED IN SEASON ${season} ***`);
      console.log(`Player ${pid} is in ${clubs.length} clubs`);
      break;
    }
  }
}
