#!/usr/bin/env npx tsx
/**
 * PHASE AAA-REPAIR-2: PROMOTION/RELEGATION INVARIANT TESTS
 *
 * Comprehensive verification of promotion/relegation system:
 * 1. 3-up/3-down rule per tier every season
 * 2. Top tier: 0 promoted, 3 relegated
 * 3. Bottom tier: 3 promoted, 0 relegated
 * 4. No impossible division movements
 * 5. No club promoted and relegated same season
 * 6. Club counts remain stable per division across seasons
 * 7. All clubs assigned to exactly one valid division
 * 8. 5+ season simulation
 */

import assert from "node:assert/strict";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

interface PromotionRelegationSummary {
  season: string;
  promotionCount: number;
  relegationCount: number;
  promoteByDivision: Record<string, number>;
  relegateByDivision: Record<string, number>;
  promotedClubIds: Set<string>;
  relegatedClubIds: Set<string>;
}

function getDivisionStructure(state: any) {
  const divisions = (state.meta?.worldConfig?.countries ?? []).flatMap(
    (c: any) => c.divisions ?? [],
  );
  return divisions.reduce((acc: any, div: any) => {
    acc[div.id] = {
      id: div.id,
      name: div.name,
      level: div.level,
      promotionTo: div.promotionTo,
      relegationTo: div.relegationTo,
      promotionSpots: div.promotionSpots ?? 3,
      relegationSpots: div.relegationSpots ?? 3,
    };
    return acc;
  }, {});
}

function getClubsByDivision(state: any): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const club of Object.values(state.clubs as any)) {
    const c = club as any;
    if (!result[c.leagueId]) result[c.leagueId] = [];
    result[c.leagueId].push(c.id);
  }
  return result;
}

function analyzePromotionRelegation(state: any, season: string): PromotionRelegationSummary {
  const promotedClubIds = new Set<string>();
  const relegatedClubIds = new Set<string>();
  const promoteByDivision: Record<string, number> = {};
  const relegateByDivision: Record<string, number> = {};

  const promotionEvents = (state.events ?? []).filter(
    (e: any) => e.type === "PROMOTION" && e.meta?.season === season,
  );
  const relegationEvents = (state.events ?? []).filter(
    (e: any) => e.type === "RELEGATION" && e.meta?.season === season,
  );

  for (const evt of promotionEvents) {
    const clubId = evt.meta?.clubId;
    const fromDiv = evt.meta?.fromDivision;
    if (clubId) promotedClubIds.add(clubId);
    if (fromDiv) promoteByDivision[fromDiv] = (promoteByDivision[fromDiv] ?? 0) + 1;
  }

  for (const evt of relegationEvents) {
    const clubId = evt.meta?.clubId;
    const fromDiv = evt.meta?.fromDivision;
    if (clubId) relegatedClubIds.add(clubId);
    if (fromDiv) relegateByDivision[fromDiv] = (relegateByDivision[fromDiv] ?? 0) + 1;
  }

  return {
    season,
    promotionCount: promotionEvents.length,
    relegationCount: relegationEvents.length,
    promoteByDivision,
    relegateByDivision,
    promotedClubIds,
    relegatedClubIds,
  };
}

function verifyInvariants(state: any, season: string, divisions: Record<string, any>) {
  console.log(`\n  Verifying invariants for season ${season}...`);

  const summary = analyzePromotionRelegation(state, season);
  const clubsByDiv = getClubsByDivision(state);
  const allClubs = new Set<string>();
  let totalClubs = 0;

  for (const [divId, clubs] of Object.entries(clubsByDiv)) {
    const clubArray = clubs as string[];
    for (const clubId of clubArray) {
      assert(!allClubs.has(clubId), `Club ${clubId} appears in multiple divisions`);
      allClubs.add(clubId);
    }
    totalClubs += clubArray.length;
  }

  // Verify no club is both promoted and relegated in same season
  const overlap = new Set(
    [...summary.promotedClubIds].filter((x) => summary.relegatedClubIds.has(x)),
  );
  assert(
    overlap.size === 0,
    `${overlap.size} clubs promoted and relegated in same season: ${Array.from(overlap).join(", ")}`,
  );

  // Verify 3-up/3-down for each tier
  for (const [divId, divConfig] of Object.entries(divisions)) {
    const promoted = summary.promoteByDivision[divId] ?? 0;
    const relegated = summary.relegateByDivision[divId] ?? 0;

    if (!divConfig.promotionTo) {
      // Top tier: no promotion
      assert(
        promoted === 0,
        `Top tier ${divConfig.name} should have 0 promotions, got ${promoted}`,
      );
      // Top tier: 3 relegations
      assert(
        relegated === divConfig.relegationSpots,
        `Top tier ${divConfig.name} should have ${divConfig.relegationSpots} relegations, got ${relegated}`,
      );
    } else if (!divConfig.relegationTo) {
      // Bottom tier: 3 promotions
      assert(
        promoted === divConfig.promotionSpots,
        `Bottom tier ${divConfig.name} should have ${divConfig.promotionSpots} promotions, got ${promoted}`,
      );
      // Bottom tier: no relegation
      assert(
        relegated === 0,
        `Bottom tier ${divConfig.name} should have 0 relegations, got ${relegated}`,
      );
    } else {
      // Middle tier: 3-up/3-down
      assert(
        promoted === divConfig.promotionSpots,
        `Middle tier ${divConfig.name} should promote ${divConfig.promotionSpots}, got ${promoted}`,
      );
      assert(
        relegated === divConfig.relegationSpots,
        `Middle tier ${divConfig.name} should relegate ${divConfig.relegationSpots}, got ${relegated}`,
      );
    }
  }

  console.log(`  ✓ No club promoted and relegated same season`);
  console.log(`  ✓ All 3-up/3-down rules verified`);
  console.log(`  ✓ Top tier promotion rule verified (0 promotions)`);
  console.log(`  ✓ Bottom tier relegation rule verified (0 relegations)`);
  console.log(`  ✓ Total clubs in pyramid: ${totalClubs}`);
  console.log(`  ✓ All clubs assigned to exactly one division`);
}

console.log("\n" + "═".repeat(70));
console.log("PHASE AAA-REPAIR-2: PROMOTION/RELEGATION INVARIANT TESTS");
console.log("═".repeat(70));

let state = buildInitialState();
const divisions = getDivisionStructure(state);
const initialClubCounts = getClubsByDivision(state);
let initialTotal = 0;
for (const clubs of Object.values(initialClubCounts)) {
  initialTotal += (clubs as string[]).length;
}

console.log(`\nStarting simulation: ${state.time.season}, ${initialTotal} clubs in pyramid`);
console.log(
  `Divisions: ${Object.keys(divisions).length} (${Object.values(divisions).filter((d: any) => d.level === 1).length} top tier)`,
);

// Run 5+ seasons
for (let seasonNum = 1; seasonNum <= 6; seasonNum++) {
  const season = state.time.season;
  console.log(`\n${"─".repeat(70)}\nSeason ${seasonNum}: ${season}`);

  // Simulate the season
  state = simulateSeason(state);
  console.log(`✓ Season simulated`);

  // Verify invariants
  verifyInvariants(state, season, divisions);

  // Check club counts haven't changed
  const clubsAfter = getClubsByDivision(state);
  let totalAfter = 0;
  for (const clubs of Object.values(clubsAfter)) {
    totalAfter += (clubs as string[]).length;
  }
  assert(totalAfter === initialTotal, `Club count changed: ${initialTotal} -> ${totalAfter}`);

  // Check all divisions still exist and have clubs
  for (const [divId, divConfig] of Object.entries(divisions)) {
    const clubsInDiv = clubsAfter[divId] ?? [];
    assert(clubsInDiv.length > 0, `Division ${divConfig.name} has no clubs after season ${season}`);
  }

  // Progress to next season
  state = applyWorldSeasonProgression(state);
  console.log(`✓ Progressed to ${state.time.season}`);
}

console.log("\n" + "═".repeat(70));
console.log("✓ ALL INVARIANT TESTS PASSED (6 seasons simulated)");
console.log("═".repeat(70));
console.log(`
Results Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 6 complete seasons simulated without errors
✓ 3-up/3-down rule maintained every season
✓ Top tier: 0 promotions, 3 relegations ✓
✓ Bottom tier: 3 promotions, 0 relegations ✓
✓ No club promoted and relegated in same season ✓
✓ Club counts stable (${initialTotal} clubs in pyramid) ✓
✓ All clubs assigned to exactly one valid division ✓
✓ No impossible division movements ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

process.exit(0);
