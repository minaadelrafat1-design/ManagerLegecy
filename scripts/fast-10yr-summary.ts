import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";
import { writeFileSync } from "fs";

const start = Date.now();
const YEARS = 10;
let state = buildInitialState("0");

const seasonSummaries: any[] = [];
const cumulative = {
  transfers: 0,
  retirements: 0,
  youthGenerated: 0,
  managersFired: 0,
  matchesPlayed: 0,
  goalsScored: 0,
};

for (let season = 1; season <= YEARS; season++) {
  const before = state.events.length;
  const seasonStart = Date.now();

  state = simulateSeasonQuick(state);

  const after = state.events.length;
  const newEvents = state.events.slice(before, after);

  const seasonTransfers = newEvents.filter((e: any) => e.type === "TRANSFER_COMPLETED").length;
  const seasonRetirements = newEvents.filter((e: any) => e.type === "PLAYER_RETIRED").length;
  const seasonYouth = newEvents.filter((e: any) => e.type === "YOUTH_GENERATED").length;
  const seasonManagersFired = newEvents.filter(
    (e: any) =>
      (e.type === "manager" && e.meta?.action === "sacked") ||
      (e.type === "board" && /sacked.*manager/i.test(e.description ?? "")) ||
      (e.type === "board" && /relieve.*manager/i.test(e.description ?? "")),
  ).length;

  // quick mode has no real MATCH_PLAYED events, so 0 is expected here
  const seasonMatches = 0;
  const seasonGoals = 0;

  cumulative.transfers += seasonTransfers;
  cumulative.retirements += seasonRetirements;
  cumulative.youthGenerated += seasonYouth;
  cumulative.managersFired += seasonManagersFired;
  cumulative.matchesPlayed += seasonMatches;
  cumulative.goalsScored += seasonGoals;

  const seasonSummary = {
    season,
    date: state.time.date,
    elapsedSeconds: ((Date.now() - seasonStart) / 1000).toFixed(2),
    transfers: seasonTransfers,
    retirements: seasonRetirements,
    youthGenerated: seasonYouth,
    managersFired: seasonManagersFired,
    matchesPlayed: seasonMatches,
    goalsScored: seasonGoals,
    clubs: Object.keys(state.clubs).length,
    players: Object.keys(state.players).length,
    retiredPlayers: Object.values(state.players).filter((p: any) => p.status === "retired").length,
  };

  seasonSummaries.push(seasonSummary);
  console.log(
    `S${season}: ${seasonSummary.elapsedSeconds}s | transfers=${seasonTransfers} retirements=${seasonRetirements} youth=${seasonYouth} fired=${seasonManagersFired}`,
  );
}

const totalSeconds = (Date.now() - start) / 1000;
const result = {
  mode: "fast-quick-season",
  note: "Uses simulateSeasonQuick() so match and goal totals are intentionally 0; this is a speed-focused long-run summary.",
  years: YEARS,
  totalSeconds: Number(totalSeconds.toFixed(2)),
  avgSecondsPerSeason: Number((totalSeconds / YEARS).toFixed(2)),
  cumulative,
  seasons: seasonSummaries,
  final: {
    date: state.time.date,
    clubs: Object.keys(state.clubs).length,
    players: Object.keys(state.players).length,
    retiredPlayers: Object.values(state.players).filter((p: any) => p.status === "retired").length,
  },
};

writeFileSync("outputs/fast-10yr-summary.json", JSON.stringify(result, null, 2));
console.log("\n=== SUMMARY ===");
console.log(
  JSON.stringify(
    {
      years: YEARS,
      totalSeconds: result.totalSeconds,
      avgSecondsPerSeason: result.avgSecondsPerSeason,
      cumulative,
    },
    null,
    2,
  ),
);
console.log("\nSaved to outputs/fast-10yr-summary.json");
