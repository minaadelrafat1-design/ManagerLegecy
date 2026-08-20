import path from "node:path";
import { pathToFileURL } from "node:url";
import { calculateClubStrength } from "../src/lib/ai-fixture-sim";
import { computeClubFinancials } from "../src/state/club-finance";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { simulateSeasonQuick } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";
import { daysBetweenISO } from "../src/state/calendar";
import type { GameState } from "../src/state/types";
import {
  checkAllInvariants,
} from "../src/state/event-invariants";

export interface SeasonSummary {
  seasonIndex: number;
  seasonLabel: string;
  daysAdvanced: number;
  worldDate: string;
  fixturesGenerated: number;
  fixturesScheduled: number;
  fixturesPlayed: number;
  matchesCompleted: number;
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

export type AuthoritativeSeasonMetrics = Pick<
  SeasonSummary,
  | "fixturesGenerated"
  | "fixturesPlayed"
  | "matchesCompleted"
  | "goals"
  | "completedTransfers"
  | "transferAttempts"
  | "promotions"
  | "relegations"
  | "managerChanges"
  | "retirements"
  | "youthGenerated"
>;

export interface SimulationReport {
  mode: "full" | "quick";
  worldScope: "REPRESENTATIVE" | "FULL-WORLD";
  years: number;
  daysAdvanced: number;
  seasonsCompleted: number;
  worldDate: string;
  worldSeason: string;
  fixturesScheduled: number;
  matchesPlayed: number;
  goals: number;
  completedTransfers: number;
  transferAttempts: number;
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

export interface CanonicalAuditDiagnostic {
  phase: string;
  elapsedMs: number;
  metrics?: Record<string, number>;
}

export type CanonicalAuditObserver = (diagnostic: CanonicalAuditDiagnostic) => void;

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

function getNewEvents(beforeState: GameState, afterState: GameState) {
  const beforeEventIds = new Set((beforeState.events ?? []).map((event) => event.id));
  return (afterState.events ?? []).filter((event) => !beforeEventIds.has(event.id));
}

export function collectAuthoritativeSeasonMetrics(
  beforeState: GameState,
  afterState: GameState,
  seasonLabel: string,
): AuthoritativeSeasonMetrics {
  const range = getSeasonDateRange(seasonLabel);
  const fixturesGenerated = (beforeState.fixtures ?? []).filter(
    (fixture) => fixture.season === seasonLabel,
  ).length;
  const beforeMatchIds = new Set((beforeState.matches ?? []).map((match) => match.id));
  const seasonMatches = (afterState.matches ?? []).filter(
    (match) =>
      !beforeMatchIds.has(match.id) &&
      match.playedAt >= range.start &&
      match.playedAt <= range.end,
  );
  const seasonEvents = getNewEvents(beforeState, afterState).filter(
    (event) => event.date.slice(0, 10) >= range.start && event.date.slice(0, 10) <= range.end,
  );
  const countEvents = (type: string) => seasonEvents.filter((event) => event.type === type).length;

  return {
    fixturesGenerated,
    fixturesPlayed: seasonEvents.filter((event) => event.type === "MATCH_PLAYED").length,
    matchesCompleted: seasonMatches.length,
    goals: seasonMatches.reduce(
      (sum, match) => sum + match.scoreHome + match.scoreAway,
      0,
    ),
    transferAttempts: seasonEvents.filter(
      (event) =>
        event.type === "transfer" &&
        event.meta?.["action"] === "negotiation_start" &&
        event.meta?.["type"] === "transfer",
    ).length,
    completedTransfers: countEvents("TRANSFER_COMPLETED"),
    promotions: countEvents("PROMOTION"),
    relegations: countEvents("RELEGATION"),
    retirements: countEvents("PLAYER_RETIRED"),
    youthGenerated: countEvents("YOUTH_GENERATED"),
    managerChanges: seasonEvents.filter(
      (event) => event.type === "manager" && event.meta?.["action"] === "appointed",
    ).length,
  };
}

function summarizePerSeason(
  state: any,
  seasonIndex: number,
  beforeState: GameState,
  seasonLabel: string,
): SeasonSummary {
  const metrics = collectAuthoritativeSeasonMetrics(beforeState, state, seasonLabel);
  const newEvents = getNewEvents(beforeState, state);
  const promotedClubs = new Set(
    newEvents
      .filter((event) => event.type === "PROMOTION" && event.meta?.["clubId"])
      .map((event) => String(event.meta?.["clubId"])),
  );
  const relegatedClubs = new Set(
    newEvents
      .filter((event) => event.type === "RELEGATION" && event.meta?.["clubId"])
      .map((event) => String(event.meta?.["clubId"])),
  );

  return {
    seasonIndex,
    seasonLabel,
    daysAdvanced: daysBetweenISO(beforeState.time.date, state.time.date),
    worldDate: state.time?.date ?? "",
    ...metrics,
    fixturesScheduled: metrics.fixturesGenerated,
    uniquePromotedClubs: promotedClubs.size,
    uniqueRelegatedClubs: relegatedClubs.size,
  };
}

export function collectCanonicalSimulationReport(
  years: number,
  seedOverride?: string,
  mode: "full" | "quick" = "full",
  representative = false,
  observer?: CanonicalAuditObserver,
): SimulationReport {
  const observe = (phase: string, startMs: number, currentState?: GameState) => {
    observer?.({
      phase,
      elapsedMs: performance.now() - startMs,
      ...(currentState
        ? {
            metrics: {
              players: Object.keys(currentState.players ?? {}).length,
              clubs: Object.keys(currentState.clubs ?? {}).length,
              fixtures: (currentState.fixtures ?? []).length,
              matches: (currentState.matches ?? []).length,
              events: (currentState.events ?? []).length,
              transfers: (currentState.transfers ?? []).length,
              negotiations: (currentState.negotiations ?? []).length,
              inbox: (currentState.inbox ?? []).length,
              news: (currentState.news ?? []).length,
            },
          }
        : {}),
    });
  };
  const initializationStart = performance.now();
  const representativeClubsPerLeague = years >= 30 ? 2 : years >= 10 ? 4 : 8;
  let state = representative
    ? buildRepresentativeState(seedOverride, representativeClubsPerLeague)
    : buildInitialState(seedOverride);
  observe("initial-state", initializationStart, state);
  const initialSerializationStart = performance.now();
  const initialSerializedState = JSON.stringify(state);
  observer?.({
    phase: "initial-state-serialization",
    elapsedMs: performance.now() - initialSerializationStart,
    metrics: { bytes: initialSerializedState.length },
  });
  const perSeason: SeasonSummary[] = [];

  const initialDate = state.time.date;

  for (let i = 0; i < years; i++) {
    const seasonBefore = state.time.season;
    const beforeState = state;
    const simulationStart = performance.now();
    if (mode === "quick") {
      state = simulateSeasonQuick(state);
    } else {
      state = simulateSeason(state as any) as any;
    }
    observe(`simulation-season-${i + 1}`, simulationStart, state);

    if (mode === "quick") {
      state = compactQuickAuditState(state);
    }

    if (mode === "full") {
      state = applyWorldSeasonProgression(state as any) as any;
    }

    // Summarize after the existing calendar progression so daysAdvanced
    // reflects the completed season, while match/fixture evidence still
    // comes from beforeState and the appended match records.
    const metricsStart = performance.now();
    perSeason.push(summarizePerSeason(state, i + 1, beforeState, seasonBefore));
    observe(`metrics-season-${i + 1}`, metricsStart, state);
  }

  const players = Object.values(state.players ?? {});
  const invariantStart = performance.now();
  const invariantViolations = checkAllInvariants(state);
  observe("invariants", invariantStart, state);
  const serializationStart = performance.now();
  const serializedState = JSON.stringify(state);
  observer?.({
    phase: "state-serialization",
    elapsedMs: performance.now() - serializationStart,
    metrics: { bytes: serializedState.length },
  });
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

  const cumulativeFixturesScheduled = sumSeasonMetrics("fixturesScheduled", perSeason);
  const cumulativeMatchesPlayed = sumSeasonMetrics("matchesCompleted", perSeason);
  const cumulativeGoals = sumSeasonMetrics("goals", perSeason);
  const cumulativeTransfers = sumSeasonMetrics("completedTransfers", perSeason);
  const cumulativeTransferAttempts = sumSeasonMetrics("transferAttempts", perSeason);
  const cumulativePromotions = sumSeasonMetrics("promotions", perSeason);
  const cumulativeRelegations = sumSeasonMetrics("relegations", perSeason);
  const cumulativeRetirements = sumSeasonMetrics("retirements", perSeason);
  const cumulativeYouthGenerated = sumSeasonMetrics("youthGenerated", perSeason);
  const cumulativeManagerChanges = sumSeasonMetrics("managerChanges", perSeason);

  return {
    years,
    mode,
    worldScope: representative ? "REPRESENTATIVE" : "FULL-WORLD",
    daysAdvanced: daysBetweenISO(initialDate, state.time?.date ?? initialDate),
    seasonsCompleted: perSeason.length,
    worldDate: state.time?.date ?? "",
    worldSeason: state.time?.season ?? "",
    fixturesScheduled: cumulativeFixturesScheduled,
    matchesPlayed: cumulativeMatchesPlayed,
    goals: cumulativeGoals,
    completedTransfers: cumulativeTransfers,
    transferAttempts: cumulativeTransferAttempts,
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
        `  Days: ${season.daysAdvanced}, Fixtures: ${season.fixturesGenerated} generated, ${season.fixturesPlayed} played, Matches: ${season.matchesCompleted}`,
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
