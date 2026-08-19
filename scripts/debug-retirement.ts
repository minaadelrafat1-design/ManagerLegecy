#!/usr/bin/env npx tsx
/**
 * Debug: Why are retirements not occurring?
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

console.log(`Initial state:`);
console.log(`  Date: ${state.time.date}`);
console.log(`  Season: ${state.time.season}`);

// Check for old players
const oldPlayers = Object.values(state.players as any)
  .filter((p: any) => p.age >= 33)
  .slice(0, 5);

console.log(
  `\nOld players (age 33+): ${Object.values(state.players as any).filter((p: any) => p.age >= 33).length}`,
);
for (const p of oldPlayers) {
  const player = p as any;
  console.log(`  ${player.name}: ${player.age} years old, active: ${player.status !== "retired"}`);
}

// Run season 1
console.log(`\nRunning Season 1...`);
state = simulateSeasonQuick(state);

console.log(`\nAfter Season 1:`);
console.log(`  Date: ${state.time.date}`);
console.log(`  Season: ${state.time.season}`);
console.log(`  Date is season start (ends -08-01)? ${state.time.date.endsWith("-08-01")}`);

const retireEventsS1 = (state.events ?? []).filter((e: any) => e.type === "PLAYER_RETIRED");
console.log(`  Retirements in Season 1: ${retireEventsS1.length}`);

// Check old players again
const oldPlayersAfterS1 = Object.values(state.players as any)
  .filter((p: any) => p.age >= 33 && p.status === "retired")
  .slice(0, 5);

console.log(
  `\nRetired players (was 33+): ${Object.values(state.players as any).filter((p: any) => p.status === "retired").length}`,
);
for (const p of oldPlayersAfterS1) {
  const player = p as any;
  console.log(`  ${player.name}: ${player.age} years old, status: ${player.status}`);
}

// Run season 2
console.log(`\nRunning Season 2...`);
state = simulateSeasonQuick(state);

console.log(`\nAfter Season 2:`);
console.log(`  Date: ${state.time.date}`);
console.log(`  Season: ${state.time.season}`);
console.log(`  Date is season start (ends -08-01)? ${state.time.date.endsWith("-08-01")}`);

const retireEventsS2 = (state.events ?? []).filter(
  (e: any) => e.type === "PLAYER_RETIRED" && e.meta?.season === "2027/28",
);
console.log(`  Retirements in Season 2: ${retireEventsS2.length}`);

// All retirements
const allRetireEvents = (state.events ?? []).filter((e: any) => e.type === "PLAYER_RETIRED");
console.log(`\nTotal retirements across all seasons: ${allRetireEvents.length}`);

process.exit(0);
