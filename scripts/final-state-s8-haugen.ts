import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

let state = buildInitialState("0");

for (let season = 1; season <= 8; season++) {
  state = simulateSeasonQuick(state);
}

// Now we're at season 8 with the duplicate
const haugenId = "haugen";
const player = state.players[haugenId];
console.log(`\nFinal state in season 8:`);
console.log(`Player ${player?.name} (${haugenId}):`);
console.log(`  player.clubId: ${player?.clubId}`);

// Check all clubs
const clubsWithHaugen = [];
for (const [cid, club] of Object.entries(state.clubs)) {
  if (club.playerIds?.includes(haugenId)) {
    clubsWithHaugen.push(cid);
    const playerIds = club.playerIds;
    const count = playerIds.length;
    console.log(`  Found in club ${club.name} (${cid}): playerIds.length=${count}`);
  }
}

console.log(`\nTotal clubs containing this player: ${clubsWithHaugen.length}`);

// Find the last TRANSFER_COMPLETED event for this player in season 8
const season8Events = (state.events ?? []).filter((e) => e.date?.startsWith("2031-08"));
const transferEvents = season8Events.filter(
  (e) => e.type === "TRANSFER_COMPLETED" && (e.meta as any)?.playerId === haugenId,
);

console.log(`\nTransfer events on 2031-08-01:`);
for (const event of transferEvents) {
  const meta = event.meta as any;
  console.log(
    `  from ${meta.fromClubId} to ${meta.toClubId} (${event.description?.substring(0, 80)})`,
  );
}
