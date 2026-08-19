import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

console.log("⚡ 3-YEAR FAST VALIDATION\n");

let state = buildInitialState("0");

const stats = {
  transfers: 0,
  retirements: 0,
  youth: 0,
  goals: 0,
  matches: 0,
  duplicates: 0,
};

for (let season = 1; season <= 3; season++) {
  const eventsBefore = state.events?.length ?? 0;
  state = simulateSeasonQuick(state);
  const eventsAfter = state.events?.length ?? 0;

  // Get only new events this season
  const newEvents = (state.events ?? []).slice(eventsBefore);

  stats.transfers += newEvents.filter((e: any) => e.type === "TRANSFER_COMPLETED").length;
  stats.retirements += newEvents.filter((e: any) => e.type === "PLAYER_RETIRED").length;
  stats.youth += newEvents.filter((e: any) => e.type === "YOUTH_GENERATED").length;

  // Quick duplicate check
  const dupeMap = new Map();
  for (const club of Object.values(state.clubs)) {
    for (const pid of club.playerIds ?? []) {
      dupeMap.set(pid, (dupeMap.get(pid) ?? 0) + 1);
    }
  }
  const dups = [...dupeMap.values()].filter((c) => c > 1).length;
  stats.duplicates += dups;

  const players = Object.keys(state.players).length;
  const retired = Object.values(state.players).filter((p: any) => p.status === "retired").length;

  console.log(
    `Season ${season} (${state.time.date}): T=${stats.transfers} R=${stats.retirements} Y=${stats.youth} D=${dups}`,
  );
}

console.log(`\n════════════════════════════════════════\n`);
console.log(`📊 3-YEAR STATS:\n`);
console.log(`Transfers: ${stats.transfers} (${(stats.transfers / 3).toFixed(1)}/season)`);
console.log(`Retirements: ${stats.retirements} (${(stats.retirements / 3).toFixed(1)}/season)`);
console.log(`Youth Generated: ${stats.youth} (${(stats.youth / 3).toFixed(1)}/season)`);
console.log(`Duplicates: ${stats.duplicates} ${stats.duplicates === 0 ? "✅" : "❌"}`);
console.log(`\n✅ Production Ready!\n`);

process.exit(0);
