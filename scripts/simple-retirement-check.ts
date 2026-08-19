#!/usr/bin/env npx tsx
/**
 * Simple check: Are retirements happening at all?
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

const initialRetired = Object.values(state.players as any).filter(
  (p: any) => p.status === "retired",
).length;
const initialOld = Object.values(state.players as any).filter((p: any) => p.age >= 35).length;

console.log(`Before Season 1:`);
console.log(`  Retired players: ${initialRetired}`);
console.log(`  Players age 35+: ${initialOld}`);
console.log(`  Date: ${state.time.date}`);

state = simulateSeasonQuick(state);

const afterS1Retired = Object.values(state.players as any).filter(
  (p: any) => p.status === "retired",
).length;
const afterS1Old = Object.values(state.players as any).filter((p: any) => p.age >= 35).length;

console.log(`\nAfter Season 1:`);
console.log(`  Retired players: ${afterS1Retired} (change: ${afterS1Retired - initialRetired})`);
console.log(`  Players age 35+: ${afterS1Old} (change: ${afterS1Old - initialOld})`);
console.log(`  Date: ${state.time.date}`);

// List all events with "PLAYER_RETIRED" type
const retiredEvents = state.events.filter((e: any) => e.type === "PLAYER_RETIRED");
console.log(`  PLAYER_RETIRED events: ${retiredEvents.length}`);

// List all event types
const types = new Set((state.events ?? []).map((e: any) => e.type));
console.log(`  Event types: ${Array.from(types).sort().join(", ")}`);

state = simulateSeasonQuick(state);

const afterS2Retired = Object.values(state.players as any).filter(
  (p: any) => p.status === "retired",
).length;
console.log(`\nAfter Season 2:`);
console.log(`  Retired players: ${afterS2Retired} (change: ${afterS2Retired - afterS1Retired})`);
console.log(`  Date: ${state.time.date}`);

const retiredEvents2 = state.events.filter((e: any) => e.type === "PLAYER_RETIRED");
console.log(`  PLAYER_RETIRED events total: ${retiredEvents2.length}`);

process.exit(0);
