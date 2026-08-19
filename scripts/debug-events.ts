#!/usr/bin/env npx tsx
/**
 * Debug: What are the retirement events?
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

console.log(`Running Season 1...`);
state = simulateSeasonQuick(state);

console.log(`\nAll events with 'retire' in description (case-insensitive):`);
const retireRelated = (state.events ?? [])
  .filter((e: any) => e.description?.toLowerCase?.().includes("retir"))
  .slice(0, 10);

console.log(`Found: ${retireRelated.length} events`);
for (const evt of retireRelated) {
  console.log(`  Type: ${evt.type}`);
  console.log(`  Desc: ${evt.description}`);
  console.log(`  Meta: ${JSON.stringify(evt.meta)}`);
  console.log(``);
}

// Count by event type
const eventTypes: Record<string, number> = {};
for (const evt of state.events ?? []) {
  eventTypes[evt.type] = (eventTypes[evt.type] ?? 0) + 1;
}

console.log(`\nEvent types summary:`);
for (const [type, count] of Object.entries(eventTypes).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}

// Check player statuses
const statuses: Record<string, number> = {};
for (const p of Object.values(state.players as any)) {
  const status = (p as any).status ?? "unknown";
  statuses[status] = (statuses[status] ?? 0) + 1;
}

console.log(`\nPlayer statuses:`);
for (const [status, count] of Object.entries(statuses)) {
  console.log(`  ${status}: ${count}`);
}

process.exit(0);
