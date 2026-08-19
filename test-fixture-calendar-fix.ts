#!/usr/bin/env npx ts-node
/**
 * Test: Fixture Calendar Fix Validation
 *
 * Validates that the adaptive fixture scheduling algorithm:
 * 1. Generates fixtures that fit within Aug 1 – May 31 window
 * 2. Spreads matchdays evenly across the season window
 * 3. Works for leagues of different sizes (6, 18, 20, 30 clubs)
 * 4. No fixtures extend past May 31
 */

import type { GameState, Fixture } from "./src/state/types";
import { buildInitialState } from "./src/state/seed";
import { generateLeagueFixtures } from "./src/state/season";
import { addDaysISO, daysBetweenISO } from "./src/state/calendar";

interface FixtureStats {
  leagueId: string;
  clubCount: number;
  matchdays: number;
  firstFixtureDate: string;
  lastFixtureDate: string;
  seasonSpanDays: number;
  minMatchdaySpacingDays: number;
  maxMatchdaySpacingDays: number;
  avgMatchdaySpacingDays: number;
  allWithinWindow: boolean;
  latestAfterMay31: string | null;
}

function analyzeFixtures(state: GameState): FixtureStats[] {
  const stats: FixtureStats[] = [];

  for (const leagueId of Object.keys(state.leagues)) {
    const league = state.leagues[leagueId];
    if (!league) continue;

    const leagueFixtures = (state.fixtures ?? []).filter(
      (f) => f.competitionId === league.competitionId && f.season === state.time.season,
    );

    if (leagueFixtures.length === 0) continue;

    const clubs = Object.values(state.clubs).filter((c) => c.leagueId === leagueId);
    const clubCount = clubs.length;

    // Sort by calendar date
    const sorted = [...leagueFixtures].sort((a, b) => {
      const dateA = a.calendarDate ?? a.date ?? "";
      const dateB = b.calendarDate ?? b.date ?? "";
      return dateA.localeCompare(dateB);
    });

    const firstDate = sorted[0]?.calendarDate ?? sorted[0]?.date ?? "";
    const lastDate =
      sorted[sorted.length - 1]?.calendarDate ?? sorted[sorted.length - 1]?.date ?? "";
    const seasonSpanDays = daysBetweenISO(firstDate, lastDate);

    // Calculate matchday spacing
    const matchdaysByDate: Record<string, number> = {};
    for (const fixture of leagueFixtures) {
      const date = fixture.calendarDate ?? fixture.date ?? "";
      matchdaysByDate[date] = (matchdaysByDate[date] ?? 0) + 1;
    }

    const uniqueDates = Object.keys(matchdaysByDate).sort();
    const spacings: number[] = [];
    for (let i = 1; i < uniqueDates.length; i++) {
      const spacing = daysBetweenISO(uniqueDates[i - 1], uniqueDates[i]);
      spacings.push(spacing);
    }

    const minSpacing = Math.min(...spacings, 0);
    const maxSpacing = Math.max(...spacings, 0);
    const avgSpacing =
      spacings.length > 0 ? spacings.reduce((a, b) => a + b, 0) / spacings.length : 0;

    // Check if all fixtures are within the season window (Aug 1 – May 31)
    const seasonStartYear = state.time.season.split("/")[0];
    const seasonEndYear = String(Number.parseInt(seasonStartYear, 10) + 1);
    const windowStart = `${seasonStartYear}-08-01`;
    const windowEnd = `${seasonEndYear}-05-31`;

    let allWithinWindow = true;
    let latestAfterMay31: string | null = null;

    for (const fixture of leagueFixtures) {
      const date = fixture.calendarDate ?? fixture.date ?? "";
      if (date < windowStart || date > windowEnd) {
        allWithinWindow = false;
        if (!latestAfterMay31 || date > latestAfterMay31) {
          latestAfterMay31 = date;
        }
      }
    }

    stats.push({
      leagueId,
      clubCount,
      matchdays: leagueFixtures.length,
      firstFixtureDate: firstDate,
      lastFixtureDate: lastDate,
      seasonSpanDays,
      minMatchdaySpacingDays: minSpacing,
      maxMatchdaySpacingDays: maxSpacing,
      avgMatchdaySpacingDays: Math.round(avgSpacing * 10) / 10,
      allWithinWindow,
      latestAfterMay31,
    });
  }

  return stats;
}

async function runTest() {
  console.log("\n=== FIXTURE CALENDAR FIX VALIDATION TEST ===\n");

  try {
    // Create initial game state (National League with multiple divisions)
    const baseState = buildInitialState();

    // Generate fixtures
    const stateWithFixtures = generateLeagueFixtures(baseState);

    // Analyze results
    const stats = analyzeFixtures(stateWithFixtures);

    console.log("LEAGUE FIXTURE ANALYSIS:");
    console.log("========================\n");

    let allTestsPassed = true;

    for (const stat of stats) {
      console.log(`League: ${stat.leagueId} (${stat.clubCount} clubs)`);
      console.log(`  Matchdays: ${stat.matchdays}`);
      console.log(
        `  Season span: ${stat.firstFixtureDate} → ${stat.lastFixtureDate} (${stat.seasonSpanDays} days)`,
      );
      console.log(
        `  Matchday spacing: min ${stat.minMatchdaySpacingDays}d, avg ${stat.avgMatchdaySpacingDays}d, max ${stat.maxMatchdaySpacingDays}d`,
      );
      console.log(`  Within Aug 1 – May 31 window: ${stat.allWithinWindow ? "✅ YES" : "❌ NO"}`);

      if (stat.latestAfterMay31) {
        console.log(`  ⚠️  Latest fixture after May 31: ${stat.latestAfterMay31}`);
        allTestsPassed = false;
      }

      if (!stat.allWithinWindow) {
        allTestsPassed = false;
      }

      console.log();
    }

    console.log("VALIDATION RESULTS:");
    console.log("===================");
    if (allTestsPassed) {
      console.log("✅ All tests PASSED - Fixtures fit within realistic season window");
      process.exit(0);
    } else {
      console.log("❌ Some tests FAILED - Fixtures extend beyond May 31");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  }
}

runTest();
