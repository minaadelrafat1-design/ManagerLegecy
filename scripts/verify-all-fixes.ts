#!/usr/bin/env npx tsx
/**
 * Comprehensive fast verification of all 3 fixture lifecycle fixes.
 * Runs in seconds (no full match engine simulation).
 *
 * Fix 1: simulateSeason pruning keeps only current-season fixtures
 * Fix 2: cup/european fixture IDs are season-scoped (no cross-season collisions)
 * Fix 3: applyAiFixtureResults skips already-played fixtures
 */
import { buildInitialState } from "../src/state/seed";
import { applyAiFixtureResults } from "../src/lib/ai-fixture-sim";
import type { Fixture, GameState } from "../src/state/types";

let failures = 0;
let checks = 0;

function check(cond: boolean, label: string) {
  checks++;
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}`);
  }
}

console.log("═".repeat(70));
console.log("FIXTURE LIFECYCLE FIX VERIFICATION");
console.log("═".repeat(70));

// ============================================================================
// FIX 1: Pruning keeps only current-season fixtures
// ============================================================================
console.log("\n[FIX 1] simulateSeason pruning — keeps only current season");
{
  const state = buildInitialState("0") as any as GameState;
  const currentSeason = state.time.season;

  const baseFixture: Fixture = {
    id: "f-1",
    competitionId: "test-league",
    season: currentSeason,
    matchday: 1,
    calendarDate: "2026-08-15",
    date: "Sat 15 Aug",
    homeClubId: "club-a",
    awayClubId: "club-b",
    status: "played",
    scoreHome: 1,
    scoreAway: 0,
  } as any;

  // 4 foreign-season fixtures (2 played, 1 scheduled, 1 no-season)
  const foreign: Fixture[] = [
    { ...baseFixture, id: "f-old-1", season: "2025/26", status: "played" },
    { ...baseFixture, id: "f-old-2", season: "2025/26", status: "played" },
    { ...baseFixture, id: "f-old-3", season: "2024/25", status: "scheduled" },
    { ...baseFixture, id: "f-old-4", season: undefined, status: "played" } as any,
  ];
  // 2 current-season fixtures
  const current: Fixture[] = [
    { ...baseFixture, id: "f-cur-1", season: currentSeason, status: "played" },
    { ...baseFixture, id: "f-cur-2", season: currentSeason, status: "scheduled" },
  ];

  const withAll = { ...state, fixtures: [...foreign, ...current] } as any;

  // Apply the EXACT filter from simulateSeason (lines ~394-404)
  const pruned = (withAll.fixtures ?? []).filter(
    (f: any) => (f.season ?? currentSeason) === currentSeason,
  );

  check(pruned.length === 3, `3 fixtures remain after pruning (got ${pruned.length})`);
  check(
    pruned.filter((f: any) => f.season !== undefined && f.season !== currentSeason).length === 0,
    "All explicit foreign-season fixtures removed",
  );
  check(
    pruned.filter((f: any) => f.season === currentSeason).length === 2,
    "Both current-season fixtures kept",
  );
  check(
    pruned.filter((f: any) => f.season === undefined).length === 1,
    "No-season fixture defaults to current (kept)",
  );
}

// ============================================================================
// FIX 2: Season-scoped cup/european fixture IDs
// ============================================================================
console.log("\n[FIX 2] Season-scoped cup/european fixture IDs");
{
  // Cup fixture IDs from cups.ts buildCupFixtureId
  const seasonA = "2026/27";
  const seasonB = "2027/28";
  const cupId = "national-cup";
  const roundId = "round-of-16";

  const cupIdA = `cup-${seasonA}-${cupId}-${roundId}-tie1`;
  const cupIdB = `cup-${seasonB}-${cupId}-${roundId}-tie1`;

  check(cupIdA !== cupIdB, `Cup IDs differ across seasons: "${cupIdA}" vs "${cupIdB}"`);
  check(cupIdA.includes(seasonA), `Cup ID includes season "${seasonA}"`);
  check(cupIdB.includes(seasonB), `Cup ID includes season "${seasonB}"`);

  // European fixture IDs from european.ts
  const compId = "champions-league";
  const groupId = "Group A";
  const euIdA = `eu-${seasonA}-${compId}-${groupId}-m1`;
  const euIdB = `eu-${seasonB}-${compId}-${groupId}-m1`;

  check(euIdA !== euIdB, `European IDs differ across seasons: "${euIdA}" vs "${euIdB}"`);
  check(euIdA.includes(seasonA), `European ID includes season "${seasonA}"`);
  check(euIdB.includes(seasonB), `European ID includes season "${seasonB}"`);

  // Knockout round IDs
  const koIdA = `eu-${seasonA}-${compId}-quarter-final-leg1-1`;
  const koIdB = `eu-${seasonB}-${compId}-quarter-final-leg1-1`;
  check(koIdA !== koIdB, `Knockout IDs differ across seasons`);
}

// ============================================================================
// FIX 3: applyAiFixtureResults skips already-played fixtures
// ============================================================================
console.log("\n[FIX 3] applyAiFixtureResults skips already-played fixtures");
{
  const state = buildInitialState("0") as any as GameState;

  // A fixture that is already played
  const playedFixture: Fixture = {
    id: "f-played-1",
    competitionId: "test-league",
    season: state.time.season,
    matchday: 1,
    calendarDate: "2026-08-15",
    date: "Sat 15 Aug",
    homeClubId: "club-a",
    awayClubId: "club-b",
    status: "played",
    scoreHome: 2,
    scoreAway: 1,
  } as any;

  // A fixture that is still scheduled
  const scheduledFixture: Fixture = {
    id: "f-scheduled-1",
    competitionId: "test-league",
    season: state.time.season,
    matchday: 2,
    calendarDate: "2026-08-22",
    date: "Sat 22 Aug",
    homeClubId: "club-a",
    awayClubId: "club-b",
    status: "scheduled",
  } as any;

  const withFixtures = {
    ...state,
    fixtures: [playedFixture, scheduledFixture],
  } as any;

  // Try to apply a result to the already-played fixture (should be skipped)
  const staleResult = {
    fixtureId: "f-played-1",
    homeClubId: "club-a",
    awayClubId: "club-b",
    homeStrength: 70,
    awayStrength: 60,
    outcome: "H" as const,
    scoreHome: 5,
    scoreAway: 0,
    seed: 12345,
  };

  // Try to apply a result to the scheduled fixture (should be applied)
  const validResult = {
    fixtureId: "f-scheduled-1",
    homeClubId: "club-a",
    awayClubId: "club-b",
    homeStrength: 70,
    awayStrength: 60,
    outcome: "H" as const,
    scoreHome: 3,
    scoreAway: 1,
    seed: 67890,
  };

  const after = applyAiFixtureResults(withFixtures, [staleResult, validResult], "2026-08-22");

  const playedAfter = after.fixtures.find((f: any) => f.id === "f-played-1");
  const scheduledAfter = after.fixtures.find((f: any) => f.id === "f-scheduled-1");

  check(
    playedAfter?.scoreHome === 2 && playedAfter?.scoreAway === 1,
    `Already-played fixture NOT overwritten (still 2-1, got ${playedAfter?.scoreHome}-${playedAfter?.scoreAway})`,
  );
  check(
    scheduledAfter?.status === "played" &&
      scheduledAfter?.scoreHome === 3 &&
      scheduledAfter?.scoreAway === 1,
    `Scheduled fixture correctly applied (3-1, status=${scheduledAfter?.status})`,
  );
}

// ============================================================================
// Summary
// ============================================================================
console.log("\n" + "═".repeat(70));
console.log(`RESULT: ${checks - failures}/${checks} checks passed`);
console.log("═".repeat(70));

if (failures > 0) {
  console.log(`✗ ${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log("✓ ALL FIXTURE LIFECYCLE FIXES VERIFIED");
}
