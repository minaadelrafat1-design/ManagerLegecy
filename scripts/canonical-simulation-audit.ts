import path from "node:path";
import { pathToFileURL } from "node:url";
import { calculateClubStrength } from "../src/lib/ai-fixture-sim";
import { computeClubFinancials } from "../src/state/club-finance";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { simulateSeasonQuick } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";
import type { GameState } from "../src/state/types";
import {
  countCompletedTransfers,
  countPromotions,
  countRelegations,
  countRetirements,
  countYouthGenerated,
  countManagerChanges,
  countMatchesPlayed,
  checkAllInvariants,
} from "../src/state/event-invariants";

export interface SeasonSummary {
  seasonIndex: number;
  seasonLabel: string;
  worldDate: string;
  fixturesScheduled: number;
  fixturesPlayed: number;
  goals: number;
  completedTransfers: number;
  transferAttempts: number;
  promotions: number;
  relegations: number;
  managerChanges: number;
  retirements: number;
  youthGenerated: number;
  uniquePromotedClubs: number;
  uniqueRelegatedClubs: number;
}

export interface SimulationReport {
  mode: "full" | "quick";
  years: number;
  seasonsCompleted: number;
  worldDate: string;
  worldSeason: string;
  fixturesScheduled: number;
  matchesPlayed: number;
  goals: number;
  completedTransfers: number;
  promotions: number;
  relegations: number;
  retirements: number;
  youthGenerated: number;
  managerChanges: number;
  averagePlayerAge: number;
  averageOverall: number;
  averagePotential: number;
  averageClubBalance: number;
  leagueStrength: number;
  playerPopulation: number;
  retiredPlayers: number;
  activePlayers: number;
  aiMemoryItems: number;
  invariantViolations: number;
  invariantBreakdown: Record<string, number>;
  perSeason: SeasonSummary[];
}

function buildRepresentativeState(
  seedOverride: string | undefined,
  clubsPerLeague: number,
): GameState {
  const initial = buildInitialState(seedOverride);
  const selectedClubIds = new Set<string>([initial.currentClub.id]);

  for (const league of Object.values(initial.leagues)) {
    const leagueClubs = Object.values(initial.clubs)
      .filter((club) => club.leagueId === league.id)
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, clubsPerLeague);
    for (const club of leagueClubs) selectedClubIds.add(club.id);
  }

  const clubs = Object.fromEntries(
    [...selectedClubIds]
      .map((clubId) => initial.clubs[clubId])
      .filter((club): club is NonNullable<typeof club> => Boolean(club))
      .map((club) => [club.id, club]),
  );
  const playerIds = new Set(Object.values(clubs).flatMap((club) => club.playerIds ?? []));
  const players = Object.fromEntries(
    [...playerIds]
      .map((playerId) => initial.players[playerId])
      .filter((player): player is NonNullable<typeof player> => Boolean(player))
      .map((player) => [player.id, player]),
  );

  return {
    ...initial,
    clubs,
    players,
    currentClub: clubs[initial.currentClub.id] ?? initial.currentClub,
    fixtures: initial.fixtures.filter(
      (fixture) => clubs[fixture.homeClubId] && clubs[fixture.awayClubId],
    ),
    matches: initial.matches.filter((match) => clubs[match.homeClubId] && clubs[match.awayClubId]),
    transfers: initial.transfers.filter(
      (transfer) => !transfer.sellerClubId || clubs[transfer.sellerClubId],
    ),
  };
}

function compactQuickAuditState(state: GameState): GameState {
  const currentDate = state.time.date;
  const players = Object.fromEntries(
    Object.entries(state.players).map(([playerId, player]) => [
      playerId,
      {
        ...player,
        ...(player.careerHistory ? { careerHistory: player.careerHistory.slice(-12) } : {}),
      },
    ]),
  );

  return {
    ...state,
    players,
    events: state.events.filter((event) => event.date.slice(0, 10) >= currentDate),
    news: state.news.slice(-200),
    ...(state.inbox ? { inbox: state.inbox.slice(-200) } : {}),
    careerHistory: state.careerHistory.slice(-100),
    ...(state.seasonReports ? { seasonReports: state.seasonReports.slice(-10) } : {}),
  };
}

function sumSeasonMetrics<T extends keyof SeasonSummary>(
  key: T,
  seasonData: SeasonSummary[],
): number {
  return seasonData.reduce((total, season) => total + Number(season[key] ?? 0), 0);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + Number(value ?? 0), 0) / values.length;
}

function getAveragePlayerAge(state: any): number {
  const players = Object.values(state.players ?? {});
  if (players.length === 0) return 0;
  return average(players.map((player: any) => Number(player.age ?? 0)));
}

function getAverageOverall(state: any): number {
  const players = Object.values(state.players ?? {});
  if (players.length === 0) return 0;
  return average(players.map((player: any) => Number(player.overall ?? 0)));
}

function getAveragePotential(state: any): number {
  const players = Object.values(state.players ?? {});
  if (players.length === 0) return 0;
  return average(players.map((player: any) => Number(player.potential ?? 0)));
}

function getAverageClubBalance(state: any): number {
  const clubs = Object.values(state.clubs ?? {});
  if (clubs.length === 0) return 0;
  return average(
    clubs.map((club: any) => Number(computeClubFinancials(state, club.id).balance ?? 0)),
  );
}

function getLeagueStrength(state: any): number {
  const clubs = Object.values(state.clubs ?? {});
  if (clubs.length === 0) return 0;
  return average(
    clubs.map((club: any) => Number(calculateClubStrength(club, state.players ?? {}))),
  );
}

/**
 * Capture metrics at a point in time for delta calculation
 */
interface MetricsSnapshot {
  completedTransfers: number;
  promotions: number;
  relegations: number;
  retirements: number;
  youthGenerated: number;
  managerChanges: number;
  fixturesPlayed: number;
  goals: number;
}

function captureMetrics(state: any, initialPlayerIds: Set<string>): MetricsSnapshot {
  const fixtures = state.fixtures ?? [];
  const played = fixtures.filter((f: any) => f.status === "played");
  return {
    completedTransfers: countCompletedTransfers(state),
    promotions: countPromotions(state),
    relegations: countRelegations(state),
    retirements: countRetirements(state),
    youthGenerated: countYouthGenerated(state, initialPlayerIds),
    managerChanges: countManagerChanges(state),
    fixturesPlayed: played.length,
    goals: played.reduce((sum: number, f: any) => sum + (f.scoreHome ?? 0) + (f.scoreAway ?? 0), 0),
  };
}

/**
 * Get season date range. Seasons run Aug 1 - Jul 31.
 * For season "2026/27", start = 2026-08-01, end = 2027-07-31
 */
function getSeasonDateRange(season: string): { start: string; end: string } {
  const parts = season.split("/");
  const startYear = parseInt(parts[0], 10);
  const endYear = parseInt(parts[1], 10);
  return {
    start: `${startYear}-08-01`,
    end: `${endYear}-07-31`,
  };
}

/**
 * Check if date falls within season (inclusive)
 */
function isDateInSeason(dateISO: string, season: string): boolean {
  const range = getSeasonDateRange(season);
  return dateISO >= range.start && dateISO <= range.end;
}

/**
 * Get unique clubs that were promoted in a season based on PROMOTION events.
 * Validates that promotion events have correct meta fields.
 */
function getUniquePromotedClubs(state: any, season: string): string[] {
  const range = getSeasonDateRange(season);
  const promotedClubs = new Set<string>();

  for (const event of state.events ?? []) {
    if (
      event.type === "PROMOTION" &&
      event.date >= range.start &&
      event.date <= range.end &&
      event.meta?.clubId
    ) {
      promotedClubs.add(event.meta.clubId);
    }
  }

  return Array.from(promotedClubs);
}

/**
 * Get unique clubs that were relegated in a season based on RELEGATION events.
 * Validates that relegation events have correct meta fields.
 */
function getUniqueRelegatedClubs(state: any, season: string): string[] {
  const range = getSeasonDateRange(season);
  const relegatedClubs = new Set<string>();

  for (const event of state.events ?? []) {
    if (
      event.type === "RELEGATION" &&
      event.date >= range.start &&
      event.date <= range.end &&
      event.meta?.clubId
    ) {
      relegatedClubs.add(event.meta.clubId);
    }
  }

  return Array.from(relegatedClubs);
}

/**
 * Validate promotion/relegation rules for all divisions.
 * Returns list of violations.
 */
function validatePromotionRelegationRules(state: any, season: string): string[] {
  const violations: string[] = [];
  const promotedClubs = getUniquePromotedClubs(state, season);
  const relegatedClubs = getUniqueRelegatedClubs(state, season);

  // Check no club is both promoted and relegated in same season
  for (const clubId of promotedClubs) {
    if (relegatedClubs.includes(clubId)) {
      violations.push(`Club ${clubId} was both promoted and relegated in ${season}`);
    }
  }

  // Check that promoted/relegated clubs only changed division once
  // (count how many times each club appears in promotion/relegation events)
  const range = getSeasonDateRange(season);
  const clubDivisionChanges: Record<string, number> = {};

  for (const event of state.events ?? []) {
    if (
      (event.type === "PROMOTION" || event.type === "RELEGATION") &&
      event.date >= range.start &&
      event.date <= range.end &&
      event.meta?.clubId
    ) {
      const clubId = event.meta.clubId;
      clubDivisionChanges[clubId] = (clubDivisionChanges[clubId] ?? 0) + 1;
    }
  }

  for (const [clubId, count] of Object.entries(clubDivisionChanges)) {
    if (count > 1) {
      violations.push(`Club ${clubId} changed division ${count} times in ${season} (should be 1)`);
    }
  }

  return violations;
}

function summarizePerSeason(
  state: any,
  seasonIndex: number,
  beforeMetrics: MetricsSnapshot,
  seasonLabel: string,
  initialPlayerIds: Set<string>,
): SeasonSummary {
  const afterMetrics = captureMetrics(state, initialPlayerIds);
  const range = getSeasonDateRange(seasonLabel);

  // Count fixtures created during this season (using fixture.season)
  const fixturesInSeason = (state.fixtures ?? []).filter((f: any) => f.season === seasonLabel);
  const fixturesPlayedInSeason = fixturesInSeason.filter((f: any) => f.status === "played");

  // Count goals from fixtures played in this season
  const goalsInSeason = fixturesPlayedInSeason.reduce(
    (sum: number, f: any) => sum + (f.scoreHome ?? 0) + (f.scoreAway ?? 0),
    0,
  );

  // Count events in this season
  const seasonEvents = (state.events ?? []).filter(
    (e: any) => e.date >= range.start && e.date <= range.end,
  );

  // Calculate deltas - but for transfers, promotions, relegations, we use per-season counts from events
  // Transfer events use lowercase "transfer" type, with "moved" in description for completions
  const transfersInSeason = seasonEvents.filter(
    (e: any) => e.type === "transfer" && e.description?.includes("moved"),
  ).length;
  const promotionsInSeason = seasonEvents.filter((e: any) => e.type === "PROMOTION").length;
  const relegationsInSeason = seasonEvents.filter((e: any) => e.type === "RELEGATION").length;
  const retirementsInSeason = seasonEvents.filter((e: any) => e.type === "PLAYER_RETIRED").length;
  const youthInSeason = seasonEvents.filter((e: any) => e.type === "YOUTH_GENERATED").length;
  const managerChangesInSeason = seasonEvents.filter((e: any) => {
    if (e.type === "manager") return true;
    if (e.type === "milestone" || e.type === "board") {
      const text = `${e.description ?? ""} ${e.meta?.action ?? ""}`.toLowerCase();
      return (
        text.includes("manager") &&
        (text.includes("sacked") || text.includes("appointed") || text.includes("change"))
      );
    }
    return false;
  }).length;

  // Transfer attempts (all transfer events in season, including passed/rejected)
  const transferAttemptsInSeason = seasonEvents.filter((e: any) => e.type === "transfer").length;

  // Unique promoted/relegated clubs
  const promotedClubs = getUniquePromotedClubs(state, seasonLabel);
  const relegatedClubs = getUniqueRelegatedClubs(state, seasonLabel);

  return {
    seasonIndex: seasonIndex,
    seasonLabel: seasonLabel,
    worldDate: state.time?.date ?? "",
    fixturesScheduled: fixturesInSeason.length,
    fixturesPlayed: fixturesPlayedInSeason.length,
    goals: goalsInSeason,
    completedTransfers: transfersInSeason,
    transferAttempts: transferAttemptsInSeason,
    promotions: promotionsInSeason,
    relegations: relegationsInSeason,
    managerChanges: managerChangesInSeason,
    retirements: retirementsInSeason,
    youthGenerated: youthInSeason,
    uniquePromotedClubs: promotedClubs.length,
    uniqueRelegatedClubs: relegatedClubs.length,
  };
}

export function collectCanonicalSimulationReport(
  years: number,
  seedOverride?: string,
  mode: "full" | "quick" = "full",
  representative = false,
): SimulationReport {
  const representativeClubsPerLeague = years >= 30 ? 2 : years >= 10 ? 4 : 8;
  let state = representative
    ? buildRepresentativeState(seedOverride, representativeClubsPerLeague)
    : buildInitialState(seedOverride);
  const perSeason: SeasonSummary[] = [];

  const initialPlayerIds = new Set(Object.keys(state.players ?? {}));
  let beforeMetrics = captureMetrics(state, initialPlayerIds);

  for (let i = 0; i < years; i++) {
    const seasonBefore = state.time.season;
    if (mode === "quick") {
      state = simulateSeasonQuick(state);
    } else {
      state = simulateSeason(state as any) as any;
    }

    // Use the season BEFORE progression (the one just completed)
    perSeason.push(summarizePerSeason(state, i + 1, beforeMetrics, seasonBefore, initialPlayerIds));

    if (mode === "quick") {
      state = compactQuickAuditState(state);
    }

    if (mode === "full") {
      state = applyWorldSeasonProgression(state as any) as any;
    }
    beforeMetrics = captureMetrics(state, initialPlayerIds);
  }

  const allFixtures = state.fixtures ?? [];
  const played = allFixtures.filter((f: any) => f.status === "played");
  const totalGoals = played.reduce(
    (sum: number, f: any) => sum + (f.scoreHome ?? 0) + (f.scoreAway ?? 0),
    0,
  );
  const allEvents = state.events ?? [];
  const players = Object.values(state.players ?? {});
  const invariantViolations = checkAllInvariants(state);
  const invariantBreakdown = invariantViolations.reduce<Record<string, number>>(
    (counts, violation) => {
      counts[violation.type] = (counts[violation.type] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const aiMemoryItems = Object.values(state.clubs ?? {}).reduce(
    (total, club) => total + (club.aiMemory?.items?.length ?? 0),
    0,
  );

  // Use authoritative event-based metrics
  const completedTransfers = countCompletedTransfers(state);
  const promotions = countPromotions(state);
  const relegations = countRelegations(state);
  const managerChanges = countManagerChanges(state);
  const retirements = countRetirements(state);
  const youthGenerated = countYouthGenerated(state, initialPlayerIds);

  const cumulativeFixturesScheduled = sumSeasonMetrics("fixturesScheduled", perSeason);
  const cumulativeMatchesPlayed = sumSeasonMetrics("fixturesPlayed", perSeason);
  const cumulativeGoals = sumSeasonMetrics("goals", perSeason);
  const cumulativeTransfers = sumSeasonMetrics("completedTransfers", perSeason);
  const cumulativePromotions = sumSeasonMetrics("promotions", perSeason);
  const cumulativeRelegations = sumSeasonMetrics("relegations", perSeason);
  const cumulativeRetirements = sumSeasonMetrics("retirements", perSeason);
  const cumulativeYouthGenerated = sumSeasonMetrics("youthGenerated", perSeason);
  const cumulativeManagerChanges = sumSeasonMetrics("managerChanges", perSeason);

  return {
    years,
    mode,
    seasonsCompleted: perSeason.length,
    worldDate: state.time?.date ?? "",
    worldSeason: state.time?.season ?? "",
    fixturesScheduled: cumulativeFixturesScheduled,
    matchesPlayed: cumulativeMatchesPlayed,
    goals: cumulativeGoals,
    completedTransfers: cumulativeTransfers,
    promotions: cumulativePromotions,
    relegations: cumulativeRelegations,
    retirements: cumulativeRetirements,
    youthGenerated: cumulativeYouthGenerated,
    managerChanges: cumulativeManagerChanges,
    averagePlayerAge: getAveragePlayerAge(state),
    averageOverall: getAverageOverall(state),
    averagePotential: getAveragePotential(state),
    averageClubBalance: getAverageClubBalance(state),
    leagueStrength: getLeagueStrength(state),
    playerPopulation: players.length,
    retiredPlayers: players.filter((player) => player.status === "retired").length,
    activePlayers: players.filter((player) => player.status !== "retired").length,
    aiMemoryItems,
    invariantViolations: invariantViolations.length,
    invariantBreakdown,
    perSeason,
  };
}

const directScriptPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";

if (import.meta.url === directScriptPath) {
  const years = Number.parseInt(process.argv[2] ?? "10", 10) || 10;
  const seed = process.argv[3];
  const report = collectCanonicalSimulationReport(years, seed);

  // Print detailed per-season report
  console.log(JSON.stringify(report, null, 2));

  // Also print a validation summary
  console.log("\n\n=== VALIDATION SUMMARY ===\n");

  let hasViolations = false;
  for (const season of report.perSeason) {
    const seasonViolations: string[] = [
      season.fixturesScheduled === 0 ? "No fixtures scheduled" : "",
      season.fixturesPlayed === 0 ? "No fixtures played" : "",
      season.completedTransfers === 0 ? "No completed transfers (check if expected)" : "",
    ].filter((v) => v);

    if (seasonViolations.length > 0) {
      console.log(`Season ${season.seasonLabel}:`);
      for (const v of seasonViolations) {
        console.log(`  ⚠️ ${v}`);
      }
      hasViolations = true;
    } else {
      console.log(`Season ${season.seasonLabel}: ✓ OK`);
      console.log(
        `  Fixtures: ${season.fixturesScheduled} scheduled, ${season.fixturesPlayed} played`,
      );
      console.log(
        `  Goals: ${season.goals}, Transfers: ${season.completedTransfers}, Promotions: ${season.promotions}, Relegations: ${season.relegations}`,
      );
    }
  }

  if (!hasViolations) {
    console.log("\n✓ All seasons have activity\n");
  }
}
