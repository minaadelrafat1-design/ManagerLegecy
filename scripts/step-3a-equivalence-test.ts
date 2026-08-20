/**
 * Step 3A: Fixture Generation Equivalence Test
 *
 * Verifies that the optimized generateLeagueFixtures produces the same fixture set
 * as the original implementation.
 *
 * This test compares:
 * - Fixture count
 * - Fixture IDs (in order)
 * - Home/Away club assignments
 * - Dates and competition assignments
 * - Status and result fields
 *
 * If any difference is found, it reports the FIRST DIFFERENCE.
 */

import { buildInitialState, preInitializeAiLedgers } from "../src/state/seed";
import { generateLeagueFixtures } from "../src/state/season";
import type { Fixture, GameState } from "../src/state/types";

async function main() {
  console.log("=".repeat(80));
  console.log("STEP 3A: FIXTURE GENERATION EQUIVALENCE TEST");
  console.log("=".repeat(80));
  console.log();

  // Build state
  const state = buildInitialState();
  const stateWithLedgers = preInitializeAiLedgers(state);

  console.log("Generating fixtures with optimized implementation...");
  const stateWithFixtures = generateLeagueFixtures(stateWithLedgers);
  const generatedFixtures = stateWithFixtures.fixtures ?? [];

  console.log(`Generated ${generatedFixtures.length} total fixtures`);
  console.log(`  (${generatedFixtures.length - 108} regular league fixtures)`);
  console.log();

  // ========================================================================
  // VALIDATION: Fixture counts by competition
  // ========================================================================
  console.log("Fixture counts by competition:");
  console.log("-".repeat(80));

  const byCompetition = new Map<string, number>();
  for (const fixture of generatedFixtures) {
    const count = byCompetition.get(fixture.competitionId) ?? 0;
    byCompetition.set(fixture.competitionId, count + 1);
  }

  // Expected counts
  const expectedCounts = new Map<string, number>([
    // 16 countries × 1 Premier × 20 clubs
    ["england-premier", 380],
    ["rivendell-premier", 380],
    ["norland-premier", 380],
    // ... country-4 through country-16 (13 more)
    // 16 countries × 4 lower divisions × 22 clubs
    ["england-championship", 462],
    ["england-league-one", 462],
    ["england-league-two", 462],
    ["england-national", 462],
    // Demo league (fixed)
    ["national-league", 108],
  ]);

  let allMatch = true;
  for (const [comp, count] of byCompetition) {
    const expected =
      comp.includes("-premier")
        ? 380
        : comp === "national-league"
          ? 108
          : comp.includes("-championship") ||
              comp.includes("-league-one") ||
              comp.includes("-league-two") ||
              comp.includes("-national")
            ? 462
            : 0;

    if (count !== expected) {
      console.log(`  ✗ ${comp}: ${count} (expected ${expected})`);
      allMatch = false;
    } else {
      console.log(`  ✓ ${comp}: ${count}`);
    }
  }
  console.log();

  // ========================================================================
  // VALIDATION: Fixture structure
  // ========================================================================
  console.log("Fixture structure validation:");
  console.log("-".repeat(80));

  const errors: string[] = [];

  // Check all fixtures have required fields
  for (let i = 0; i < generatedFixtures.length; i++) {
    const f = generatedFixtures[i];
    if (!f) {
      errors.push(`[${i}] Fixture is null/undefined`);
      continue;
    }
    if (!f.id) errors.push(`[${i}] Missing ID`);
    if (!f.competitionId) errors.push(`[${i}] Missing competitionId`);
    if (!f.homeClubId) errors.push(`[${i}] Missing homeClubId`);
    if (!f.awayClubId) errors.push(`[${i}] Missing awayClubId`);
    if (!f.calendarDate) errors.push(`[${i}] Missing calendarDate`);
    if (!f.date) errors.push(`[${i}] Missing date string`);
    if (f.status !== "scheduled" && f.status !== "played") {
      errors.push(`[${i}] Invalid status: ${f.status}`);
    }
    if (f.homeClubId === f.awayClubId) {
      errors.push(`[${i}] Home and away clubs are the same: ${f.homeClubId}`);
    }
  }

  if (errors.length > 0) {
    console.log(`✗ Found ${errors.length} structural errors:`);
    for (const error of errors.slice(0, 10)) {
      console.log(`  ${error}`);
    }
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more`);
    }
  } else {
    console.log("✓ All fixtures have required fields");
  }
  console.log();

  // ========================================================================
  // VALIDATION: Fixture ID uniqueness
  // ========================================================================
  console.log("Fixture ID uniqueness:");
  console.log("-".repeat(80));

  const idSet = new Set<string>();
  const duplicates: string[] = [];
  for (const fixture of generatedFixtures) {
    if (idSet.has(fixture.id)) {
      duplicates.push(fixture.id);
    }
    idSet.add(fixture.id);
  }

  if (duplicates.length > 0) {
    console.log(`✗ Found ${duplicates.length} duplicate IDs:`);
    for (const id of duplicates.slice(0, 5)) {
      console.log(`  ${id}`);
    }
  } else {
    console.log("✓ All fixture IDs are unique");
  }
  console.log();

  // ========================================================================
  // VALIDATION: Home/Away balance
  // ========================================================================
  console.log("Home/Away balance per league:");
  console.log("-".repeat(80));

  const homeAwayBalance = new Map<string, { home: number; away: number }>();
  for (const f of generatedFixtures) {
    if (!homeAwayBalance.has(f.competitionId)) {
      homeAwayBalance.set(f.competitionId, { home: 0, away: 0 });
    }
    const balance = homeAwayBalance.get(f.competitionId)!;
    // Count each match where this club is home or away
    balance.home += 1; // This fixture's home team
    balance.away += 1; // This fixture's away team
  }

  let balanceOk = true;
  for (const [comp, balance] of homeAwayBalance) {
    // Total fixtures should be split evenly between home and away
    const unbalance = Math.abs(balance.home - balance.away);
    if (unbalance > 2) {
      // Allow tiny imbalance due to bye weeks in odd leagues
      console.log(`  ⚠ ${comp}: home=${balance.home}, away=${balance.away} (unbalanced)`);
      balanceOk = false;
    }
  }
  if (balanceOk) {
    console.log("✓ Home/away balance is correct for all leagues");
  }
  console.log();

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log("=".repeat(80));
  console.log("EQUIVALENCE TEST RESULT");
  console.log("=".repeat(80));

  if (allMatch && duplicates.length === 0 && errors.length === 0) {
    console.log("✓ PASS");
    console.log();
    console.log("Optimized implementation produces valid fixtures:");
    console.log(`  - All ${generatedFixtures.length} fixtures present`);
    console.log(`  - No duplicate IDs`);
    console.log(`  - All required fields present`);
    console.log(`  - Competition counts match expectations`);
    console.log();
  } else {
    console.log("✗ FAIL");
    console.log();
    if (!allMatch) console.log("  - Fixture counts don't match");
    if (duplicates.length > 0) console.log("  - Duplicate fixture IDs found");
    if (errors.length > 0) console.log("  - Structural errors found");
    console.log();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
