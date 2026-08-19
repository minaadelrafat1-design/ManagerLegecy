#!/usr/bin/env npx tsx
/**
 * Check youth generation
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

const initialYouth = Object.values(state.players as any).filter((p: any) => p.age <= 18).length;
const initialTotal = Object.keys(state.players).length;

console.log(`Before Season 1:`);
console.log(`  Total players: ${initialTotal}`);
console.log(`  Youth (age ≤18): ${initialYouth}`);

state = simulateSeasonQuick(state);

const afterS1Youth = Object.values(state.players as any).filter((p: any) => p.age <= 18).length;
const afterS1Total = Object.keys(state.players).length;
const afterS1YouthEvents = (state.events ?? []).filter(
  (e: any) => e.type === "YOUTH_GENERATED",
).length;

console.log(`\nAfter Season 1:`);
console.log(`  Total players: ${afterS1Total} (change: ${afterS1Total - initialTotal})`);
console.log(`  Youth (age ≤18): ${afterS1Youth} (change: ${afterS1Youth - initialYouth})`);
console.log(`  YOUTH_GENERATED events: ${afterS1YouthEvents}`);

// Check development events
const devEvents = (state.events ?? []).filter(
  (e: any) => e.description?.includes("develop") || e.type?.includes("develop"),
);
console.log(`  Development-related events: ${devEvents.length}`);

state = simulateSeasonQuick(state);

const afterS2Youth = Object.values(state.players as any).filter((p: any) => p.age <= 18).length;
const afterS2Total = Object.keys(state.players).length;

console.log(`\nAfter Season 2:`);
console.log(`  Total players: ${afterS2Total} (change: ${afterS2Total - afterS1Total})`);
console.log(`  Youth (age ≤18): ${afterS2Youth} (change: ${afterS2Youth - afterS1Youth})`);

// All event types
const allTypes = new Set((state.events ?? []).map((e: any) => e.type));
console.log(`\nAll event types: ${Array.from(allTypes).sort().join(", ")}`);

process.exit(0);
