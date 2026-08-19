#!/usr/bin/env npx tsx
/**
 * QUICK TEST: One-season promotion/relegation verification
 */

import assert from "node:assert/strict";
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState();
console.log("Running quick 1-season promotion test...");

const season = state.time.season;
const divisions = (state.meta?.worldConfig?.countries ?? []).flatMap((c: any) => c.divisions ?? []);

console.log(`Season: ${season}`);
console.log(`Divisions: ${divisions.length}`);
console.log(
  `Sample divisions: ${divisions
    .slice(0, 3)
    .map((d: any) => d.name)
    .join(", ")}`,
);

// Get initial club counts per division
const initialClubCounts: Record<string, number> = {};
for (const club of Object.values(state.clubs as any)) {
  const c = club as any;
  initialClubCounts[c.leagueId] = (initialClubCounts[c.leagueId] ?? 0) + 1;
}

console.log(`\nInitial club counts:`);
for (const [divId, count] of Object.entries(initialClubCounts)) {
  const div = divisions.find((d: any) => d.id === divId);
  console.log(`  ${div?.name ?? divId}: ${count} clubs`);
}

// Simulate season
state = simulateSeasonQuick(state);
console.log(`\n✓ Season simulated`);

// Check for promotion/relegation events
const promoteEvents = (state.events ?? []).filter(
  (e: any) => e.type === "PROMOTION" && e.meta?.season === season,
);
const relegateEvents = (state.events ?? []).filter(
  (e: any) => e.type === "RELEGATION" && e.meta?.season === season,
);

console.log(`\nPromotion/Relegation Events:`);
console.log(`  Promotions: ${promoteEvents.length}`);
console.log(`  Relegations: ${relegateEvents.length}`);

if (promoteEvents.length > 0) {
  console.log(`  Sample promotions:`);
  for (const evt of promoteEvents.slice(0, 3)) {
    console.log(`    - ${evt.description}`);
  }
}

if (relegateEvents.length > 0) {
  console.log(`  Sample relegations:`);
  for (const evt of relegateEvents.slice(0, 3)) {
    console.log(`    - ${evt.description}`);
  }
}

// Count movements by division
const promoteByDiv: Record<string, number> = {};
const relegateByDiv: Record<string, number> = {};
for (const evt of promoteEvents) {
  const divId = evt.meta?.fromDivision;
  if (divId) promoteByDiv[divId] = (promoteByDiv[divId] ?? 0) + 1;
}
for (const evt of relegateEvents) {
  const divId = evt.meta?.fromDivision;
  if (divId) relegateByDiv[divId] = (relegateByDiv[divId] ?? 0) + 1;
}

console.log(`\nMovements by division:`);
let totalCorrect = 0;
let totalIncorrect = 0;
for (const div of divisions.slice(0, 5)) {
  const promoted = promoteByDiv[div.id] ?? 0;
  const relegated = relegateByDiv[div.id] ?? 0;
  const expProm = div.promotionSpots ?? 0;
  const expRel = div.relegationSpots ?? 0;

  const promStatus = promoted === expProm ? "✓" : "✗";
  const relStatus = relegated === expRel ? "✓" : "✗";

  console.log(`  ${div.name}:`);
  console.log(`    ${promStatus} Promoted: ${promoted}/${expProm}`);
  console.log(`    ${relStatus} Relegated: ${relegated}/${expRel}`);

  if (promoted === expProm) totalCorrect++;
  else totalIncorrect++;
  if (relegated === expRel) totalCorrect++;
  else totalIncorrect++;
}

// Check club counts after
const finalClubCounts: Record<string, number> = {};
for (const club of Object.values(state.clubs as any)) {
  const c = club as any;
  finalClubCounts[c.leagueId] = (finalClubCounts[c.leagueId] ?? 0) + 1;
}

console.log(`\nFinal club counts:`);
let clubCountCorrect = true;
for (const div of divisions.slice(0, 5)) {
  const initial = initialClubCounts[div.id] ?? 0;
  const final = finalClubCounts[div.id] ?? 0;
  const status = initial === final ? "✓" : "✗";
  console.log(`  ${status} ${div.name}: ${initial} -> ${final}`);
  if (initial !== final) clubCountCorrect = false;
}

console.log(`\n${"─".repeat(70)}`);
console.log(
  totalIncorrect === 0 && clubCountCorrect ? "✓ QUICK TEST PASSED" : "✗ QUICK TEST FAILED",
);
console.log(`${"─".repeat(70)}`);

process.exit(totalIncorrect > 0 || !clubCountCorrect ? 1 : 0);
