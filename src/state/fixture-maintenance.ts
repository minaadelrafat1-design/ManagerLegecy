/**
 * Fixture Maintenance & Pruning
 *
 * Manages fixture lifecycle to prevent accumulation over long seasons.
 * Fixtures from completed seasons are periodically pruned to maintain
 * reasonable memory footprint and prevent silent database growth.
 */

import type { GameState, Fixture } from "./types";

export interface FixturePruneReport {
  fixturesBeforePrune: number;
  fixturesAfterPrune: number;
  fixturesPruned: number;
  oldestFixtureDate: string | null;
  newestFixtureDate: string | null;
  pruneThresholdSeasons: number;
}

/**
 * Prune fixtures from seasons older than maxSeasons ago.
 * Keeps only fixtures from current season + maxSeasons back (for historical reference).
 *
 * Example: If maxSeasons=2 and we're in season 2027/28:
 * - Keep: 2027/28, 2026/27, 2025/26 (current + 2 back)
 * - Prune: 2024/25 and earlier (older than 2)
 */
export function pruneOldFixtures(state: GameState, maxSeasons = 2): GameState {
  // Parse season string "YYYY/YY" -> extract start year
  const parseSeasonYear = (seasonStr: string | undefined): number => {
    if (!seasonStr) return 0;
    const yearPart = seasonStr.split("/")[0];
    return Number(yearPart) || 0;
  };

  const currentSeasonYear = parseSeasonYear(String(state.time?.season));
  const minSeasonYearToKeep = Math.max(0, currentSeasonYear - maxSeasons);

  const beforeCount = state.fixtures.length;
  const nextFixtures = state.fixtures.filter((f: Fixture) => {
    const fixtureSeasonYear = parseSeasonYear(f.season);
    return fixtureSeasonYear >= minSeasonYearToKeep;
  });
  const prunedCount = beforeCount - nextFixtures.length;

  // Get date range for reporting
  const oldestFixture =
    nextFixtures.length > 0
      ? nextFixtures.reduce((oldest: Fixture, f: Fixture) =>
          f.calendarDate < oldest.calendarDate ? f : oldest,
        )
      : null;
  const newestFixture =
    nextFixtures.length > 0
      ? nextFixtures.reduce((newest: Fixture, f: Fixture) =>
          f.calendarDate > newest.calendarDate ? f : newest,
        )
      : null;

  return {
    ...state,
    fixtures: nextFixtures,
    _fixtureMaintenanceLog: {
      ...((state as any)._fixtureMaintenanceLog ?? {}),
      lastPruneDate: state.time.date,
      lastPruneReport: {
        fixturesBeforePrune: beforeCount,
        fixturesAfterPrune: nextFixtures.length,
        fixturesPruned: prunedCount,
        oldestFixtureDate: oldestFixture?.calendarDate ?? null,
        newestFixtureDate: newestFixture?.calendarDate ?? null,
        pruneThresholdSeasons: maxSeasons,
      } as FixturePruneReport,
    },
  } as GameState;
}

/**
 * Check if fixture count exceeds healthy threshold.
 * Returns alert if fixtures > maxThreshold (default 500).
 */
export function getFixtureAccumulationAlert(
  state: GameState,
  maxThreshold = 500,
): {
  isAlerting: boolean;
  fixtureCount: number;
  threshold: number;
  message: string;
} {
  const count = state.fixtures.length;
  const isAlerting = count > maxThreshold;

  return {
    isAlerting,
    fixtureCount: count,
    threshold: maxThreshold,
    message: isAlerting
      ? `WARNING: ${count} fixtures in state (threshold: ${maxThreshold}). Consider pruning old seasons.`
      : `Fixture count healthy: ${count}/${maxThreshold}`,
  };
}

/**
 * Get fixture statistics for diagnostic purposes.
 */
export function getFixtureStatistics(state: GameState): {
  totalFixtures: number;
  fixturesByStatus: Record<string, number>;
  fixturesByCompetition: Record<string, number>;
  fixturesBySeason: Record<number, number>;
  oldestFixtureDate: string | null;
  newestFixtureDate: string | null;
  averageFixturesPerSeason: number;
} {
  const stats = {
    totalFixtures: state.fixtures.length,
    fixturesByStatus: {} as Record<string, number>,
    fixturesByCompetition: {} as Record<string, number>,
    fixturesBySeason: {} as Record<number, number>,
    oldestFixtureDate: null as string | null,
    newestFixtureDate: null as string | null,
    averageFixturesPerSeason: 0,
  };

  if (state.fixtures.length === 0) return stats;

  // Categorize by status, competition, season
  for (const f of state.fixtures) {
    stats.fixturesByStatus[f.status] = (stats.fixturesByStatus[f.status] ?? 0) + 1;
    stats.fixturesByCompetition[f.competitionId] =
      (stats.fixturesByCompetition[f.competitionId] ?? 0) + 1;
    const season = Number(f.season ?? state.time.season ?? 0);
    stats.fixturesBySeason[season] = (stats.fixturesBySeason[season] ?? 0) + 1;
  }

  // Date range
  const sorted = [...state.fixtures].sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));
  stats.oldestFixtureDate = sorted[0]?.calendarDate ?? null;
  stats.newestFixtureDate = sorted[sorted.length - 1]?.calendarDate ?? null;

  // Average per season
  const seasonCount = Object.keys(stats.fixturesBySeason).length || 1;
  stats.averageFixturesPerSeason = Math.round(stats.totalFixtures / seasonCount);

  return stats;
}

export {};
