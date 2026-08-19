import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

const state = buildInitialState("0");
console.log(`Initial state - Date: ${state.time.date}, Season: ${state.time.season}`);
console.log(`Total players in state: ${Object.keys(state.players ?? {}).length}`);

// Check all players
const allPlayers = Object.values(state.players ?? {});
const ageDistribution: Record<string, number> = {
  "16-20": 0,
  "21-25": 0,
  "26-30": 0,
  "31-34": 0,
  "35+": 0,
};
for (const p of allPlayers) {
  const age = p.age ?? 25;
  if (age <= 20) ageDistribution["16-20"]++;
  else if (age <= 25) ageDistribution["21-25"]++;
  else if (age <= 30) ageDistribution["26-30"]++;
  else if (age <= 34) ageDistribution["31-34"]++;
  else ageDistribution["35+"]++;
}
console.log(`Age distribution: ${JSON.stringify(ageDistribution)}`);
console.log();

// Simulate season 1
let next = simulateSeason(state as any) as any;
console.log(`\nAfter Season 1 - Date: ${next.time.date}`);
console.log(
  `Events with PLAYER_RETIRED: ${(next.events ?? []).filter((e: any) => e.type === "PLAYER_RETIRED").length}`,
);
console.log(
  `Players retired (status=retired): ${Object.values(next.players ?? {}).filter((p: any) => p.status === "retired").length}`,
);

// Progress to season 2
next = applyWorldSeasonProgression(next as any) as any;
console.log(`\nAfter World Progression - Date: ${next.time.date}, Season: ${next.time.season}`);

// Simulate season 2
next = simulateSeason(next as any) as any;
console.log(`\nAfter Season 2 - Date: ${next.time.date}`);
const retiredPlayers = Object.values(next.players ?? {}).filter((p: any) => p.status === "retired");
console.log(`Players retired (status=retired): ${retiredPlayers.length}`);

if (retiredPlayers.length > 0) {
  console.log("\nRetired players:");
  retiredPlayers.slice(0, 3).forEach((p: any) => {
    console.log(`  - ${p.name} (age ${p.age}, overall ${p.overall})`);
  });
}

const retireEvents = (next.events ?? []).filter((e: any) => e.type === "PLAYER_RETIRED");
console.log(`\nPLAYER_RETIRED events: ${retireEvents.length}`);
if (retireEvents.length > 0) {
  console.log("Sample events:");
  retireEvents.slice(0, 3).forEach((e: any) => {
    console.log(`  - ${e.description}`);
  });
}

// Check eligible players
const over34 = Object.values(state.players ?? {}).filter((p: any) => (p.age ?? 25) >= 34);
console.log(`\nInitial state - Players age 34+: ${over34.length}`);
console.log("Sample eligible players:");
over34.slice(0, 3).forEach((p: any) => {
  console.log(`  - ${p.name} (age ${p.age}, overall ${p.overall})`);
});
