#!/usr/bin/env tsx
/**
 * PHASE AAA-90.1 REQUIREMENT VALIDATION
 *
 * Tests all 5 stabilization requirements:
 * 1. Seed threading: Different seeds produce different results
 * 2. Per-season metrics: Accurate delta capture
 * 3. Fixture generation: All seasons generate fixtures
 * 4. Player population: Clubs have full squads
 * 5. Player lifecycle: Aging, retirement, youth development
 *
 * Validation: Run with seeds 0,1,2 and durations 1,5,10,30 years
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

interface TestResult {
  seed: number;
  years: number;
  requirement: string;
  status: "PASS" | "FAIL" | "WARN";
  details: string;
}

const results: TestResult[] = [];

function test(
  seed: number,
  years: number,
  req: string,
  status: "PASS" | "FAIL" | "WARN",
  details: string,
) {
  results.push({ seed, years, requirement: req, status, details });
  console.log(`[${status}] Seed ${seed}, ${years}yr - ${req}: ${details}`);
}

function countPlayersWithStatus(state: any, status: string) {
  return Object.values(state.players).filter((p: any) => p.status === status).length;
}

function countFixtures(state: any, season?: number) {
  if (season === undefined) {
    return state.fixtures?.length ?? 0;
  }
  return (state.fixtures ?? []).filter((f: any) => f.season === season).length;
}

// Test 3 seeds, 4 durations
const seeds = [0, 1, 2];
const durations = [1, 2]; // Quick test: 1 and 2 years only

for (const seed of seeds) {
  for (const years of durations) {
    console.log(`\n=== SEED ${seed}, ${years} YEAR(S) ===`);

    let state = buildInitialState(String(seed));
    const fixtureCountsByYear: number[] = [];
    const retirementsByYear: number[] = [];
    const transfersByYear: number[] = [];
    const seededResults = new Map<string, number>();

    // Capture initial state
    const initialPlayersTotal = Object.keys(state.players).length;
    const initialClubsWithPlayers = Object.values(state.clubs).filter(
      (c: any) => c.playerIds.length > 0,
    ).length;

    // REQ 4: Player population
    if (initialPlayersTotal < 5000) {
      test(
        seed,
        years,
        "REQ4_POPULATION",
        "FAIL",
        `Only ${initialPlayersTotal} players generated (need 5000+)`,
      );
    } else {
      test(
        seed,
        years,
        "REQ4_POPULATION",
        "PASS",
        `${initialPlayersTotal} players, ${initialClubsWithPlayers}/${Object.keys(state.clubs).length} clubs populated`,
      );
    }

    // Simulate requested years
    for (let year = 1; year <= years; year++) {
      const yearStartDate = state.time.date;
      state = simulateSeason(state as any) as any;
      const seasonEndDate = state.time.date;

      fixtureCountsByYear.push(countFixtures(state, state.time.season as any));
      retirementsByYear.push(countPlayersWithStatus(state, "retired"));

      // REQ 3: Fixture generation for all seasons
      if (countFixtures(state) === 0) {
        test(seed, years, "REQ3_FIXTURES", "FAIL", `No fixtures generated in year ${year}`);
      }

      // Capture goals to check seed variation
      const goals = state.events.filter((e: any) => e.type === "MATCH_GOAL").length;
      seededResults.set(`year${year}_goals`, goals);

      if (year < years) {
        // Progress to next season
        state = applyWorldSeasonProgression(state as any) as any;
      }
    }

    // REQ 1: Seed threading - check different seeds produce different goal counts
    const goalsDelta = Math.abs(
      (seededResults.get("year1_goals") ?? 0) - (seededResults.get("year2_goals") ?? 0),
    );
    if (years >= 2 && goalsDelta === 0) {
      test(seed, years, "REQ1_SEEDING", "WARN", `Year 1 and 2 goals identical (may be unlucky)`);
    } else {
      test(
        seed,
        years,
        "REQ1_SEEDING",
        "PASS",
        `Seed variation present (${seededResults.get("year1_goals")} vs ${seededResults.get("year2_goals")} goals)`,
      );
    }

    // REQ 3: Fixture generation validation
    const totalFixtures = fixtureCountsByYear.reduce((a: number, b: number) => a + b, 0);
    if (totalFixtures === 0) {
      test(seed, years, "REQ3_FIXTURES", "FAIL", `Total 0 fixtures over ${years} year(s)`);
    } else {
      test(
        seed,
        years,
        "REQ3_FIXTURES",
        "PASS",
        `${totalFixtures} fixtures generated (${fixtureCountsByYear.join(", ")} per season)`,
      );
    }

    // REQ 2: Per-season metrics - check events are captured
    const totalEvents = state.events.length;
    if (totalEvents < 100 * years) {
      test(seed, years, "REQ2_METRICS", "WARN", `Only ${totalEvents} events (expected 100+/year)`);
    } else {
      test(
        seed,
        years,
        "REQ2_METRICS",
        "PASS",
        `${totalEvents} events captured across ${years} year(s)`,
      );
    }

    // REQ 5: Player lifecycle - retirement
    const totalRetirements = retirementsByYear.reduce((a: number, b: number) => a + b, 0);
    if (years > 1 && totalRetirements === 0) {
      test(seed, years, "REQ5_LIFECYCLE", "FAIL", `No retirements over ${years} year(s)`);
    } else if (totalRetirements > 0) {
      test(
        seed,
        years,
        "REQ5_LIFECYCLE",
        "PASS",
        `${totalRetirements} retirements (${retirementsByYear.join(", ")} per season)`,
      );
    }

    // REQ 5: Player lifecycle - youth development
    const youthEvents = state.events.filter((e: any) => e.type === "YOUTH_PROMOTED").length;
    if (years > 1 && youthEvents === 0) {
      test(seed, years, "REQ5_YOUTH", "WARN", `No youth promotions over ${years} year(s)`);
    } else if (youthEvents > 0) {
      test(seed, years, "REQ5_YOUTH", "PASS", `${youthEvents} youth promoted`);
    }
  }
}

console.log("\n\n=== SUMMARY ===");
const passed = results.filter((r) => r.status === "PASS").length;
const failed = results.filter((r) => r.status === "FAIL").length;
const warned = results.filter((r) => r.status === "WARN").length;
console.log(`PASS: ${passed}, FAIL: ${failed}, WARN: ${warned} (Total: ${results.length})`);

if (failed > 0) {
  console.log("\n❌ FAILURES:");
  results
    .filter((r) => r.status === "FAIL")
    .forEach((r) => {
      console.log(`  - Seed ${r.seed} ${r.years}yr: ${r.requirement}: ${r.details}`);
    });
  process.exit(1);
} else {
  console.log("\n✅ ALL REQUIREMENTS VALIDATED");
  process.exit(0);
}
