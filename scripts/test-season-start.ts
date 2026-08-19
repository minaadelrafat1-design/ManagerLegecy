import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

function isSeasonStart(date: string) {
  return date.endsWith("-08-01");
}

function countPlayersOverAge(state: any, minAge: number) {
  return Object.values(state.players ?? {}).filter((p: any) => (p.age ?? 25) >= minAge).length;
}

let state = buildInitialState("0");
console.log(`=== Initial State ===`);
console.log(`Date: ${state.time.date}`);
console.log(`Players age 34+: ${countPlayersOverAge(state, 34)}`);

console.log(`\n=== After Season 1 Simulation ===`);
state = simulateSeason(state as any) as any;
console.log(`Date: ${state.time.date}`);
console.log(`Players age 34+: ${countPlayersOverAge(state, 34)}`);
console.log(`isSeasonStart: ${isSeasonStart(state.time.date)}`);

console.log(`\n=== After World Progression ===`);
state = applyWorldSeasonProgression(state as any) as any;
console.log(`Date: ${state.time.date}`);
console.log(`Players age 34+: ${countPlayersOverAge(state, 34)}`);
console.log(`isSeasonStart: ${isSeasonStart(state.time.date)}`);
console.log(`Season: ${state.time.season}`);

console.log(`\n=== After Season 2 Simulation ===`);
state = simulateSeason(state as any) as any;
console.log(`Date: ${state.time.date}`);
console.log(`Players age 34+: ${countPlayersOverAge(state, 34)}`);
const retiredPlayers = Object.values(state.players ?? {}).filter(
  (p: any) => p.status === "retired",
);
console.log(`Total retired players: ${retiredPlayers.length}`);
const retireEvents = (state.events ?? []).filter((e: any) => e.type === "PLAYER_RETIRED");
console.log(`PLAYER_RETIRED events: ${retireEvents.length}`);
