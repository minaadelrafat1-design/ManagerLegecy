/**
 * Fixture metrics validation - ensures fixtures are correctly counted per season.
 *
 * Verifies:
 * - Fixtures created during season (not cumulative)
 * - Fixtures played during season
 * - Goals during season
 * - No fixtures are double-counted across seasons
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

interface FixtureMetricsReport {
  season: string;
  fixturesScheduledInSeason: number;
  fixturesPlayedInSeason: number;
  goalsInSeason: number;
  fixturesByCompetition: Record<string, { scheduled: number; played: number; goals: number }>;
  violations: string[];
}

/**
 * Get fixtures scheduled for a specific season
 * Seasons run Aug 1 - Jul 31; filter by fixture.season field
 */
function getFixturesForSeason(state: any, season: string): any[] {
  return (state.fixtures ?? []).filter((f: any) => f.season === season);
}

/**
 * Validate fixture metrics for a season
 */
function validateFixtureMetrics(state: any, season: string): FixtureMetricsReport {
  const violations: string[] = [];

  // Get fixtures for this season only
  const fixturesInSeason = getFixturesForSeason(state, season);
  const fixturesPlayedInSeason = fixturesInSeason.filter((f: any) => f.status === "played");

  // Count goals
  const goalsInSeason = fixturesPlayedInSeason.reduce(
    (sum: number, f: any) => sum + (f.scoreHome ?? 0) + (f.scoreAway ?? 0),
    0,
  );

  // Group by competition
  const fixturesByCompetition: Record<
    string,
    { scheduled: number; played: number; goals: number }
  > = {};
  for (const fixture of fixturesInSeason) {
    const comp = fixture.competitionId ?? "unknown";
    if (!fixturesByCompetition[comp]) {
      fixturesByCompetition[comp] = { scheduled: 0, played: 0, goals: 0 };
    }
    fixturesByCompetition[comp].scheduled++;

    if (fixture.status === "played") {
      fixturesByCompetition[comp].played++;
      fixturesByCompetition[comp].goals += (fixture.scoreHome ?? 0) + (fixture.scoreAway ?? 0);
    }
  }

  // Validations
  if (fixturesInSeason.length === 0) {
    violations.push("No fixtures scheduled for season");
  }

  if (fixturesPlayedInSeason.length === 0 && fixturesInSeason.length > 0) {
    violations.push("Fixtures scheduled but none played");
  }

  // Check fixture consistency: all fixtures in state should belong to exactly one season
  for (const fixture of state.fixtures ?? []) {
    if (!fixture.season) {
      violations.push(`Fixture ${fixture.id} has no season field`);
    }
  }

  return {
    season,
    fixturesScheduledInSeason: fixturesInSeason.length,
    fixturesPlayedInSeason: fixturesPlayedInSeason.length,
    goalsInSeason,
    fixturesByCompetition,
    violations,
  };
}

/**
 * Run multi-season fixture validation
 */
export function validateMultiSeasonFixtures(
  years: number,
  seedOverride?: string,
): FixtureMetricsReport[] {
  let state = buildInitialState(seedOverride);
  const reports: FixtureMetricsReport[] = [];

  for (let i = 0; i < years; i++) {
    const seasonBefore = state.time.season;
    state = simulateSeason(state as any) as any;

    // Validate the season that just completed
    const report = validateFixtureMetrics(state, seasonBefore);
    reports.push(report);

    state = applyWorldSeasonProgression(state as any) as any;
  }

  return reports;
}

// Main entry point
const directScriptPath = process.argv[1];
if (directScriptPath?.endsWith("validate-fixture-metrics.ts")) {
  const years = Number.parseInt(process.argv[2] ?? "3", 10) || 3;
  const seed = process.argv[3];

  const reports = validateMultiSeasonFixtures(years, seed);

  console.log("=== FIXTURE METRICS VALIDATION REPORT ===\n");

  let totalViolations = 0;
  let totalFixtures = 0;
  let totalMatches = 0;
  let totalGoals = 0;

  for (const report of reports) {
    console.log(`Season ${report.season}:`);
    console.log(
      `  Fixtures: ${report.fixturesScheduledInSeason} scheduled, ${report.fixturesPlayedInSeason} played`,
    );
    console.log(`  Goals: ${report.goalsInSeason}`);

    totalFixtures += report.fixturesScheduledInSeason;
    totalMatches += report.fixturesPlayedInSeason;
    totalGoals += report.goalsInSeason;

    // Show by competition
    if (Object.keys(report.fixturesByCompetition).length > 0) {
      console.log(`  By competition:`);
      for (const [comp, metrics] of Object.entries(report.fixturesByCompetition)) {
        console.log(
          `    ${comp}: ${metrics.scheduled} scheduled, ${metrics.played} played, ${metrics.goals} goals`,
        );
      }
    }

    if (report.violations.length > 0) {
      console.log(`  ❌ Violations:`);
      for (const violation of report.violations) {
        console.log(`    - ${violation}`);
      }
      totalViolations += report.violations.length;
    } else {
      console.log(`  ✓ No violations`);
    }
    console.log();
  }

  console.log(`Summary:`);
  console.log(`  Total fixtures: ${totalFixtures}`);
  console.log(`  Total matches played: ${totalMatches}`);
  console.log(`  Total goals: ${totalGoals}`);
  console.log(`  Total violations: ${totalViolations}`);
  console.log();

  if (totalViolations === 0) {
    console.log(`✓ All ${reports.length} season(s) passed fixture validation\n`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${totalViolations} violation(s) across seasons\n`);
    process.exit(1);
  }
}

export default { validateMultiSeasonFixtures, validateFixtureMetrics };
