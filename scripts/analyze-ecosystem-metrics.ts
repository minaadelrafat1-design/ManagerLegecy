import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

let state = buildInitialState("0");

console.log(`\n=== ECOSYSTEM STRUCTURE ===`);
console.log(`Total clubs: ${Object.keys(state.clubs).length}`);
const leagues = new Map();
for (const club of Object.values(state.clubs)) {
  const count = (leagues.get(club.leagueId) ?? 0) + 1;
  leagues.set(club.leagueId, count);
}
console.log(`Total leagues: ${leagues.size}`);
console.log(
  `Average clubs per league: ${(Object.keys(state.clubs).length / leagues.size).toFixed(1)}`,
);
console.log(`Initial total players: ${Object.keys(state.players).length}`);
const initialRosters = Object.values(state.clubs).reduce(
  (sum, c) => sum + (c.playerIds?.length ?? 0),
  0,
);
console.log(`Initial roster slots occupied: ${initialRosters}`);

console.log(`\n=== SEASON-BY-SEASON METRICS ===`);
console.log(
  `Season | Transfers | Retirements | Youth Gen | Transfers/Club | Retirements/Club | Youth/Club | Total Players | Total Retired`,
);
console.log(
  `-------|-----------|-------------|-----------|----------------|------------------|-----------|---------------|---------------`,
);

let prevTransfersCount = 0;
let prevRetirementsCount = 0;
let prevYouthCount = 0;

for (let season = 1; season <= 12; season++) {
  state = simulateSeasonQuick(state);

  // Count transfers this season
  const transfersCount = (state.events ?? []).filter(
    (e) => e.type === "TRANSFER_COMPLETED" && e.date?.startsWith(state.time.date.slice(0, 4)),
  ).length;
  const seasonTransfers = transfersCount - prevTransfersCount;

  // Count retirements
  const retirements = (state.events ?? []).filter(
    (e) => e.type === "PLAYER_RETIRED" && e.date?.startsWith(state.time.date.slice(0, 4)),
  ).length;
  const seasonRetirements = retirements - prevRetirementsCount;

  // Count youth generated
  const youthGen = (state.events ?? []).filter(
    (e) => e.type === "YOUTH_GENERATED" && e.date?.startsWith(state.time.date.slice(0, 4)),
  ).length;
  const seasonYouth = youthGen - prevYouthCount;

  const totalPlayers = Object.keys(state.players).length;
  const totalRetired = Object.values(state.players).filter((p) => p.status === "retired").length;

  const clubCount = Object.keys(state.clubs).length;
  const transfersPerClub = (seasonTransfers / clubCount).toFixed(2);
  const retirePerClub = (seasonRetirements / clubCount).toFixed(2);
  const youthPerClub = (seasonYouth / clubCount).toFixed(2);

  console.log(
    `${season.toString().padEnd(6)} | ${seasonTransfers.toString().padEnd(9)} | ${seasonRetirements.toString().padEnd(11)} | ${seasonYouth.toString().padEnd(9)} | ${transfersPerClub.padEnd(14)} | ${retirePerClub.padEnd(16)} | ${youthPerClub.padEnd(9)} | ${totalPlayers.toString().padEnd(13)} | ${totalRetired}`,
  );

  prevTransfersCount = transfersCount;
  prevRetirementsCount = retirements;
  prevYouthCount = youthGen;
}

console.log(`\n=== ANALYSIS ===`);
console.log(
  `Expected roster: ~18 players per club × ${Object.keys(state.clubs).length} clubs = ~${18 * Object.keys(state.clubs).length} active players`,
);
console.log(
  `With 15+ year career length and ~2-5% retirement rate, expect ${Math.round(Object.keys(state.clubs).length * 0.03)} retirements/season`,
);
console.log(
  `With 2-4 academy players per club generating annually, expect ${Math.round(Object.keys(state.clubs).length * 0.5)} youth/season`,
);
console.log(
  `With active transfer market, expect ${Math.round(Object.keys(state.clubs).length * 0.15)} transfers/season`,
);
