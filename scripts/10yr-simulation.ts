import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeason } from "../src/state/season.ts";

const start = Date.now();
let state = buildInitialState("0");

const stats = {
  transfers: 0,
  retirements: 0,
  youthGenerated: 0,
  matchesPlayed: 0,
  goalsScored: 0,
  managersFired: 0,
  seasons: [] as any[],
};

for (let season = 1; season <= 10; season++) {
  const seasonStart = Date.now();
  const eventsBeforeCount = state.events.length;

  state = simulateSeason(state);

  const seasonEnd = Date.now();
  const elapsed = (seasonEnd - seasonStart) / 1000;
  const totalElapsed = (seasonEnd - start) / 1000;

  // Count events in this season
  const newEvents = state.events.slice(eventsBeforeCount);

  const seasonTransfers = newEvents.filter((e: any) => e.type === "TRANSFER_COMPLETED").length;
  const seasonRetirements = newEvents.filter((e: any) => e.type === "PLAYER_RETIRED").length;
  const seasonYouth = newEvents.filter((e: any) => e.type === "YOUTH_GENERATED").length;
  const seasonMatches = newEvents.filter((e: any) => e.type === "MATCH_PLAYED").length;
  const seasonGoals = newEvents
    .filter((e: any) => e.type === "MATCH_PLAYED")
    .reduce((sum, e: any) => sum + ((e.meta?.scoreHome ?? 0) + (e.meta?.scoreAway ?? 0)), 0);
  const seasonManagersFired = newEvents.filter(
    (e: any) =>
      (e.type === "manager" && e.meta?.action === "sacked") ||
      (e.type === "board" && /sacked.*manager/i.test(e.description ?? "")) ||
      (e.type === "board" && /relieve.*manager/i.test(e.description ?? "")),
  ).length;

  stats.transfers += seasonTransfers;
  stats.retirements += seasonRetirements;
  stats.youthGenerated += seasonYouth;
  stats.matchesPlayed += seasonMatches;
  stats.goalsScored += seasonGoals;
  stats.managersFired += seasonManagersFired;

  stats.seasons.push({
    season,
    date: state.time.date,
    elapsed: elapsed.toFixed(2),
    totalElapsed: totalElapsed.toFixed(2),
    transfers: seasonTransfers,
    retirements: seasonRetirements,
    youthGenerated: seasonYouth,
    matchesPlayed: seasonMatches,
    goalsScored: seasonGoals,
    managersFired: seasonManagersFired,
    clubs: Object.keys(state.clubs).length,
    players: Object.keys(state.players).length,
    retired: Object.values(state.players).filter((p: any) => p.status === "retired").length,
  });

  console.log(
    `S${season} (${state.time.date}): ${elapsed.toFixed(1)}s - transfers=${seasonTransfers} retirements=${seasonRetirements} youth=${seasonYouth} matches=${seasonMatches} goals=${seasonGoals} managersFired=${seasonManagersFired}`,
  );
}

const finalTime = (Date.now() - start) / 1000;

console.log("\n=== 10-YEAR SIMULATION RESULTS ===\n");
console.log(`Total Time: ${finalTime.toFixed(1)}s (${(finalTime / 60).toFixed(1)} min)`);
console.log(`Average per Season: ${(finalTime / 10).toFixed(1)}s\n`);

console.log("=== CUMULATIVE STATS ===");
console.log(`Transfers: ${stats.transfers}`);
console.log(`Retirements: ${stats.retirements}`);
console.log(`Youth Generated: ${stats.youthGenerated}`);
console.log(`Matches Played: ${stats.matchesPlayed}`);
console.log(`Goals Scored: ${stats.goalsScored}`);
console.log(`Managers Fired: ${stats.managersFired}`);
console.log(`Average Goals/Match: ${(stats.goalsScored / stats.matchesPlayed).toFixed(2)}\n`);

console.log("=== SEASON BREAKDOWN ===");
console.table(stats.seasons);

console.log("\n=== FINAL STATE ===");
console.log(`Clubs: ${Object.keys(state.clubs).length}`);
console.log(`Total Players: ${Object.keys(state.players).length}`);
console.log(
  `Retired Players: ${Object.values(state.players).filter((p: any) => p.status === "retired").length}`,
);
console.log(
  `Active Players: ${Object.values(state.players).filter((p: any) => p.status === "active").length}`,
);

// Save results
import { writeFileSync } from "fs";
const results = {
  metadata: {
    seed: "0",
    duration: `${(finalTime / 60).toFixed(1)} minutes`,
    totalSeconds: finalTime.toFixed(1),
  },
  cumulative: stats,
  final: {
    date: state.time.date,
    clubs: Object.keys(state.clubs).length,
    totalPlayers: Object.keys(state.players).length,
    retiredPlayers: Object.values(state.players).filter((p: any) => p.status === "retired").length,
    activeByStatus: {
      active: Object.values(state.players).filter((p: any) => p.status === "active").length,
      onLoan: Object.values(state.players).filter((p: any) => p.status === "on_loan").length,
      prospect: Object.values(state.players).filter((p: any) => p.status === "prospect").length,
    },
    managersFired: stats.managersFired,
  },
};

writeFileSync("outputs/10yr-sim-results.json", JSON.stringify(results, null, 2));
console.log("\n✅ Results saved to outputs/10yr-sim-results.json");
