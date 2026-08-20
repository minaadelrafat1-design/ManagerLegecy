import { performance } from "node:perf_hooks";
import { buildInitialState } from "../src/state/seed";
import { generateLeagueFixtures } from "../src/state/season";
import type { GameState, Fixture, League } from "../src/state/types";
import { addDaysISO, getDayOfWeekLabel } from "../src/state/calendar";

interface Measurement {
  stage: string;
  ms: number;
  count?: number;
  detail?: string;
}

const measurements: Measurement[] = [];

function measure<T>(stage: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  measurements.push({ stage, ms });
  return result;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

// ============================================================================
// Audit 1: Date Pool Generation Cost
// ============================================================================

console.log("=".repeat(90));
console.log("STEP 3D: FIXTURE SCHEDULING ALLOCATION AUDIT");
console.log("=".repeat(90));
console.log();
console.log("SECTION 1: DATE GENERATION COST");
console.log("-".repeat(90));

function isPreferredMatchday(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
  return day === 6 || day === 0;
}

function isFallbackMatchday(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
  return day === 2 || day === 4;
}

function getRealisticSeasonSlots(start: string, end: string): string[] {
  const effectiveStart = addDaysISO(start, 14);
  const slots: string[] = [];
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const cursor = new Date(`${effectiveStart}T00:00:00.000Z`);

  while (cursor <= endDate) {
    const iso = cursor.toISOString().slice(0, 10);
    if (isPreferredMatchday(iso) || isFallbackMatchday(iso)) {
      slots.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return slots;
}

function buildRealisticMatchdayDates(
  totalMatchdays: number,
  seasonStartDate: string,
  seasonEndDate: string,
): string[] {
  if (totalMatchdays <= 0) return [];

  const slotPoolResult = measure("2.1: Slot pool generation", () =>
    getRealisticSeasonSlots(seasonStartDate, seasonEndDate),
  );
  measurements[measurements.length - 1].count = slotPoolResult.length;

  const fallbackPool: string[] = [];
  const fallbackResult = measure("2.2: Fallback pool generation", () => {
    const cursor = new Date(`${addDaysISO(seasonStartDate, 14)}T00:00:00.000Z`);
    const endDate = new Date(`${seasonEndDate}T00:00:00.000Z`);

    const result: string[] = [];
    while (cursor <= endDate) {
      result.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  });
  measurements[measurements.length - 1].count = fallbackResult.length;

  const combinedPoolResult = measure("2.3: Pool combination/spread", () => {
    return slotPoolResult.length >= totalMatchdays
      ? slotPoolResult
      : [...slotPoolResult, ...fallbackResult];
  });
  measurements[measurements.length - 1].count = combinedPoolResult.length;

  const chosenResult = measure("2.4: Date selection and deduplication loop", () => {
    const chosen: string[] = [];
    const used = new Set<string>();

    for (let i = 0; i < totalMatchdays; i += 1) {
      const poolIndex =
        combinedPoolResult.length === 1
          ? 0
          : Math.min(
              combinedPoolResult.length - 1,
              Math.round((i / Math.max(totalMatchdays - 1, 1)) * (combinedPoolResult.length - 1)),
            );
      let candidate: string | undefined = combinedPoolResult[poolIndex];
      let probe = poolIndex;

      while (candidate && used.has(candidate) && probe < combinedPoolResult.length - 1) {
        probe += 1;
        candidate = combinedPoolResult[probe];
      }

      if (candidate && used.has(candidate)) {
        for (let fallbackIndex = 0; fallbackIndex < fallbackResult.length; fallbackIndex += 1) {
          const fallbackDate = fallbackResult[fallbackIndex];
          if (fallbackDate && !used.has(fallbackDate)) {
            candidate = fallbackDate;
            break;
          }
        }
      }

      if (!candidate || used.has(candidate)) {
        continue;
      }

      used.add(candidate);
      chosen.push(candidate);
    }

    return chosen;
  });
  measurements[measurements.length - 1].count = chosenResult.length;

  const finalResult = measure("2.5: Final deduplication and sort", () => {
    return [...new Set(chosenResult)].sort((a, b) => a.localeCompare(b));
  });
  measurements[measurements.length - 1].count = finalResult.length;

  return finalResult;
}

// Run date generation audit for representative league sizes
const dateResults = [
  {
    matchdays: 42,
    label: "Regular league 42 matchdays",
  },
  {
    matchdays: 24,
    label: "Small league 24 matchdays",
  },
];

for (const { matchdays, label } of dateResults) {
  console.log();
  console.log(`Date generation for ${label}:`);
  const dates = measure(`Date gen: ${label}`, () =>
    buildRealisticMatchdayDates(matchdays, "2026-08-01", "2027-05-31"),
  );
  console.log(`  Generated ${dates.length} unique dates in ${formatMs(measurements[measurements.length - 1].ms)}`);
}

// ============================================================================
// Audit 2: Fixture Object Allocation Cost
// ============================================================================

console.log();
console.log("SECTION 2: FIXTURE OBJECT CREATION COST");
console.log("-".repeat(90));

function formatDisplayDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  const weekday = getDayOfWeekLabel(dateISO);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${weekday} ${day} ${month}`;
}

// Sample fixtures creation
const sampleDates = ["2026-08-15", "2026-09-12", "2026-10-03"];
let fixtureId = 1;

const createdFixtures = measure("3.1: Create 1000 fixture objects", () => {
  const fixtures: Fixture[] = [];
  for (let i = 0; i < 1000; i += 1) {
    const dateIdx = i % sampleDates.length;
    const fixture: Fixture = {
      id: `f-${fixtureId++}`,
      competitionId: "test-comp",
      season: "2026/27",
      matchday: Math.floor(i / 20) + 1,
      calendarDate: sampleDates[dateIdx]!,
      date: formatDisplayDate(sampleDates[dateIdx]!),
      homeClubId: `home-${i % 20}`,
      awayClubId: `away-${(i + 1) % 20}`,
      venue: i % 2 === 0 ? "H" : "A",
      status: "scheduled",
      result: null,
    };
    fixtures.push(fixture);
  }
  return fixtures;
});
measurements[measurements.length - 1].count = createdFixtures.length;

console.log(`  Created ${createdFixtures.length} fixtures in ${formatMs(measurements[measurements.length - 1].ms)}`);

// ============================================================================
// Audit 3: Array Operations Cost
// ============================================================================

console.log();
console.log("SECTION 3: ARRAY OPERATIONS COST");
console.log("-".repeat(90));

const baseState = buildInitialState();
const existingFixtures = (baseState.fixtures ?? []).slice(0, 100);

console.log();
console.log("Array append via spread (simulating state update):");
const appendResult = measure(
  "3.2: Spread existing + new array (100 + 1000 items)",
  () => [...existingFixtures, ...createdFixtures],
);
measurements[measurements.length - 1].count = appendResult.length;
console.log(
  `  Result: ${appendResult.length} items in ${formatMs(measurements[measurements.length - 1].ms)}`,
);

// ============================================================================
// Audit 4: Validation Scanning Cost
// ============================================================================

console.log();
console.log("SECTION 4: VALIDATION AND DUPLICATE CHECKING COST");
console.log("-".repeat(90));

console.log();
console.log("Duplicate ID checking (1000 new fixtures):");

const fixtureIdScanResult = measure("4.1: Scan new fixtures for duplicate IDs", () => {
  const ids = new Set<string>();
  for (const fixture of createdFixtures) {
    if (ids.has(fixture.id)) {
      throw new Error(`Duplicate: ${fixture.id}`);
    }
    ids.add(fixture.id);
  }
  return ids;
});
measurements[measurements.length - 1].count = fixtureIdScanResult.size;

console.log(
  `  Scanned ${createdFixtures.length} fixtures, found ${fixtureIdScanResult.size} unique IDs in ${formatMs(measurements[measurements.length - 1].ms)}`,
);

console.log();
console.log("Collision check with existing fixtures:");

const collisionCheckResult = measure("4.2: Check new fixture IDs against existing (100) IDs", () => {
  const existing = new Set((baseState.fixtures ?? []).slice(0, 100).map((f) => f.id));
  for (const fixture of createdFixtures) {
    if (existing.has(fixture.id)) {
      throw new Error(`Collision: ${fixture.id}`);
    }
  }
  return existing;
});
measurements[measurements.length - 1].count = collisionCheckResult.size;

console.log(
  `  Checked against ${collisionCheckResult.size} existing IDs in ${formatMs(measurements[measurements.length - 1].ms)}`,
);

// ============================================================================
// Audit 5: League-wise batch vs global accumulation
// ============================================================================

console.log();
console.log("SECTION 5: LEAGUE PROCESSING ACCUMULATION COST");
console.log("-".repeat(90));

const state = buildInitialState();
const clubsByLeague = new Map<string, string[]>();
for (const [clubId, club] of Object.entries(state.clubs)) {
  if (!clubsByLeague.has(club.leagueId)) {
    clubsByLeague.set(club.leagueId, []);
  }
  clubsByLeague.get(club.leagueId)!.push(clubId);
}

console.log();
console.log(`Number of leagues: ${Object.keys(state.leagues).length}`);
console.log(`Total clubs: ${Object.keys(state.clubs).length}`);

const leagueCount = Object.keys(state.leagues).length;

// Simulate iterating through 81 leagues and generating fixtures
let accumulatedFixtures: Fixture[] = [];
const accumulationCost = measure(
  `5.1: Simulate ${leagueCount} league iterations with array appends`,
  () => {
    for (let league = 0; league < leagueCount; league += 1) {
      // Simulate some fixtures for this league
      const leagueFixtures: Fixture[] = [];
      const clubsInLeague = Array.from(clubsByLeague.values())[league]?.length ?? 10;
      const fixturesForLeague = clubsInLeague * 2 * Math.max(0, clubsInLeague - 1); // rough estimate
      if (fixturesForLeague > 5000) {
        // Avoid massive test data
        continue;
      }

      for (let i = 0; i < Math.min(100, fixturesForLeague); i += 1) {
        leagueFixtures.push({
          id: `f-sim-${league}-${i}`,
          competitionId: `league-${league}`,
          season: "2026/27",
          matchday: 1,
          calendarDate: "2026-08-15",
          date: "Fri 15 Aug",
          homeClubId: `h-${i}`,
          awayClubId: `a-${i}`,
          venue: "H",
          status: "scheduled",
          result: null,
        });
      }

      // Simulate accumulation via spread
      accumulatedFixtures = [...accumulatedFixtures, ...leagueFixtures];
    }
    return accumulatedFixtures;
  },
);
measurements[measurements.length - 1].count = accumulatedFixtures.length;

console.log(
  `  Accumulated ${accumulatedFixtures.length} fixtures over ${leagueCount} leagues in ${formatMs(measurements[measurements.length - 1].ms)}`,
);

// ============================================================================
// Audit 6: Real full-world generation cost breakdown
// ============================================================================

console.log();
console.log("SECTION 6: REAL FULL-WORLD FIXTURE GENERATION");
console.log("-".repeat(90));

const startTime = performance.now();
const fullResult = generateLeagueFixtures(buildInitialState());
const fullDuration = performance.now() - startTime;

const fixtureCount = (fullResult.fixtures ?? []).length;
const priorFixtureCount = (buildInitialState().fixtures ?? []).length;
const generatedCount = fixtureCount - priorFixtureCount;

console.log();
console.log(`Full generateLeagueFixtures() call:`);
console.log(`  Total duration: ${formatMs(fullDuration)}`);
console.log(`  Prior fixtures: ${priorFixtureCount}`);
console.log(`  Generated fixtures: ${generatedCount}`);
console.log(`  Total fixtures: ${fixtureCount}`);
console.log();

// ============================================================================
// Summary and Analysis
// ============================================================================

console.log("SECTION 7: MEASUREMENT SUMMARY");
console.log("=".repeat(90));

const sortedByDuration = [...measurements].sort((a, b) => b.ms - a.ms);

console.log();
console.log("Top 10 costliest operations:");
for (let i = 0; i < Math.min(10, sortedByDuration.length); i += 1) {
  const m = sortedByDuration[i]!;
  const countStr = m.count ? ` (${m.count} items)` : "";
  console.log(`  ${i + 1}. ${m.stage}: ${formatMs(m.ms)}${countStr}`);
}

console.log();
console.log("Cost categories:");
const dateGen = measurements
  .filter((m) => m.stage.includes("Date gen") || m.stage.includes("2."))
  .reduce((sum, m) => sum + m.ms, 0);
const fixtureAlloc = measurements
  .filter((m) => m.stage.includes("3."))
  .reduce((sum, m) => sum + m.ms, 0);
const validation = measurements
  .filter((m) => m.stage.includes("4."))
  .reduce((sum, m) => sum + m.ms, 0);
const arrayOps = measurements
  .filter((m) => m.stage.includes("Array") || m.stage.includes("spread"))
  .reduce((sum, m) => sum + m.ms, 0);

console.log(`  Date generation costs: ${formatMs(dateGen)}`);
console.log(`  Fixture object allocation: ${formatMs(fixtureAlloc)}`);
console.log(`  Validation and scanning: ${formatMs(validation)}`);
console.log(`  Array operations (spread/concat): ${formatMs(arrayOps)}`);
console.log(`  Full generateLeagueFixtures: ${formatMs(fullDuration)}`);

console.log();
console.log("Per-fixture metrics:");
console.log(`  Date generation per 42-matchday season: ${formatMs(dateGen / 2)}`);
console.log(`  Fixture allocation cost: ~${formatMs(fixtureAlloc / 1000)}/fixture`);
console.log(`  Validation cost: ~${formatMs(validation / 1000)}/fixture`);
console.log(`  Full generation cost: ~${formatMs(fullDuration / generatedCount)}/fixture`);

console.log();
console.log("=".repeat(90));
console.log("END DIAGNOSTIC AUDIT");
console.log("=".repeat(90));
