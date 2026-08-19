#!/usr/bin/env npx tsx
/**
 * PHASE AAA-REPAIR-2: Audit promotion/relegation event generation
 *
 * Purpose: Understand what's happening with promotion/relegation events
 * - Count how many promotion/relegation events are created per season
 * - Verify they match the expected 3-up/3-down per tier
 * - Check for duplicate processing
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

function countPromotionEvents(state: any) {
  const promotions = (state.events ?? []).filter((e: any) => e.type === "PROMOTION");
  return promotions;
}

function countRelegationEvents(state: any) {
  const relegations = (state.events ?? []).filter((e: any) => e.type === "RELEGATION");
  return relegations;
}

function getClubDivisionsSnapshot(state: any) {
  const divisions: Record<string, string[]> = {};
  for (const club of Object.values(state.clubs as any)) {
    const c = club as any;
    const divId = c.leagueId;
    if (!divisions[divId]) divisions[divId] = [];
    divisions[divId].push(c.name);
  }
  return divisions;
}

let state = buildInitialState();

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("PHASE AAA-REPAIR-2: PROMOTION/RELEGATION EVENT AUDIT");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log(`Starting state: Season ${state.time.season}, Date: ${state.time.date}\n`);

// Get division structure
const divisions = (state.meta?.worldConfig?.countries ?? []).flatMap((c: any) => c.divisions ?? []);

console.log("Division structure:");
for (const div of divisions) {
  console.log(
    `  ${div.name} (level ${div.level}):`,
    `promotionTo=${div.promotionTo ?? "none"}`,
    `relegationTo=${div.relegationTo ?? "none"}`,
  );
}

console.log("\n" + "─".repeat(70));

// Simulate multiple seasons and track promotion/relegation
for (let season = 0; season < 3; season++) {
  console.log(`\nSeason ${season + 1}: ${state.time.season}`);
  console.log("─".repeat(70));

  const beforeDivisions = getClubDivisionsSnapshot(state);
  console.log(
    `Division counts before:`,
    Object.entries(beforeDivisions)
      .map(([d, clubs]) => `${d}=${clubs.length}`)
      .join(", "),
  );

  // Simulate full season
  state = simulateSeason(state);
  console.log(`✓ Season simulated`);

  // Count events in this season
  const promoteEvents = countPromotionEvents(state);
  const relegateEvents = countRelegationEvents(state);

  console.log(`Promotion events: ${promoteEvents.length}`);
  for (const evt of promoteEvents.slice(0, 3)) {
    console.log(`  - ${evt.description}`);
  }
  if (promoteEvents.length > 3) {
    console.log(`  ... and ${promoteEvents.length - 3} more`);
  }

  console.log(`Relegation events: ${relegateEvents.length}`);
  for (const evt of relegateEvents.slice(0, 3)) {
    console.log(`  - ${evt.description}`);
  }
  if (relegateEvents.length > 3) {
    console.log(`  ... and ${relegateEvents.length - 3} more`);
  }

  // Count movements by division (from events)
  const promoteByDivision: Record<string, number> = {};
  for (const evt of promoteEvents) {
    const div = evt.meta?.fromDivision ?? "unknown";
    promoteByDivision[div] = (promoteByDivision[div] ?? 0) + 1;
  }

  const relegateByDivision: Record<string, number> = {};
  for (const evt of relegateEvents) {
    const div = evt.meta?.fromDivision ?? "unknown";
    relegateByDivision[div] = (relegateByDivision[div] ?? 0) + 1;
  }

  console.log("\nMovements by division:");
  for (const div of divisions) {
    const promoted = promoteByDivision[div.id] ?? 0;
    const relegated = relegateByDivision[div.id] ?? 0;
    const expected = div.promotionSpots ?? 0;
    const expectedRel = div.relegationSpots ?? 0;

    const promStatus = promoted === expected ? "✓" : "✗";
    const relStatus = relegated === expectedRel ? "✓" : "✗";
    console.log(
      `  ${div.name}: ${promStatus} promoted=${promoted}/${expected}, ${relStatus} relegated=${relegated}/${expectedRel}`,
    );
  }

  const afterDivisions = getClubDivisionsSnapshot(state);
  console.log(
    `\nDivision counts after:`,
    Object.entries(afterDivisions)
      .map(([d, clubs]) => `${d}=${clubs.length}`)
      .join(", "),
  );

  // Progress to next season
  state = applyWorldSeasonProgression(state);
  console.log(`✓ Season progressed to ${state.time.season}`);
}

console.log("\n" + "═".repeat(70));
console.log("AUDIT COMPLETE");
console.log("═".repeat(70));
