import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

let state = buildInitialState("0");

for (let season = 1; season <= 5; season++) {
  state = simulateSeasonQuick(state);
}

console.log(`\n=== FINAL STATE (5 SEASONS) ===`);
console.log(`Date: ${state.time.date}`);
console.log(`Total players: ${Object.keys(state.players).length}`);
console.log(`Total clubs: ${Object.keys(state.clubs).length}`);

let duplicateCount = 0;
let playersMissingFromClubs = 0;
let playersWithInvalidClubId = 0;

for (const pid of Object.keys(state.players)) {
  const player = state.players[pid];
  const clubId = player.clubId;

  if (!clubId) {
    continue; // Academy prospects don't have clubId yet
  }

  const club = state.clubs[clubId];
  if (!club) {
    playersWithInvalidClubId++;
    continue;
  }

  // Count how many clubs have this player
  let appearanceCount = 0;
  for (const c of Object.values(state.clubs)) {
    if (c.playerIds.includes(pid)) {
      appearanceCount++;
    }
  }

  if (appearanceCount > 1) {
    duplicateCount++;
    console.log(`  ❌ DUPLICATE: ${player.name} (${pid}) appears in ${appearanceCount} clubs`);
  } else if (appearanceCount === 0) {
    playersMissingFromClubs++;
    console.log(
      `  ⚠️ MISSING: ${player.name} (${pid}) has clubId=${clubId} but not in that club's roster`,
    );
  }
}

console.log(`\n=== INVARIANT CHECKS ===`);
console.log(`Duplicate memberships: ${duplicateCount}`);
console.log(`Players missing from clubs: ${playersMissingFromClubs}`);
console.log(`Players with invalid clubId: ${playersWithInvalidClubId}`);

if (duplicateCount === 0 && playersMissingFromClubs === 0) {
  console.log(`✅ NO ROSTER INTEGRITY ISSUES`);
  process.exit(0);
} else {
  console.log(`❌ ROSTER INTEGRITY ISSUES FOUND`);
  process.exit(1);
}
