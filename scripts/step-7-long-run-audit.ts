import path from "node:path";
import { pathToFileURL } from "node:url";
import { applyWorldSeasonProgression } from "../src/state/world";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { computeClubFinancials } from "../src/state/club-finance";
import { checkAllInvariants } from "../src/state/event-invariants";
import type { EventLogEntry, GameState } from "../src/state/types";

export interface LongRunSeasonMetrics {
  seasonIndex: number;
  seasonLabel: string;
  matchesSimulated: number;
  goals: number;
  completedTransfers: number;
  transferAttempts: number;
  promotions: number;
  relegations: number;
  retirements: number;
  youthGenerated: number;
  managerChanges: number;
  europeanFixturesGenerated: number;
  europeanMatchesSimulated: number;
  playerPopulation: number;
  clubPopulation: number;
  financiallyNegativeClubs: number;
  financiallyStableClubs: number;
  minimumClubBalance: number;
  averageClubBalance: number;
  duplicateIds: number;
  invalidReferences: number;
  invariantViolations: number;
}

export interface LongRunAuditReport {
  requestedSeasons: number;
  completedSeasons: number;
  completedAllRequestedSeasons: boolean;
  seed: string;
  worldScope: "FULL-WORLD" | "REPRESENTATIVE";
  finalSeason: string;
  finalDate: string;
  finalPlayerPopulation: number;
  finalClubPopulation: number;
  totalMatchesSimulated: number;
  totalGoals: number;
  totalCompletedTransfers: number;
  totalTransferAttempts: number;
  totalPromotions: number;
  totalRelegations: number;
  totalRetirements: number;
  totalYouthGenerated: number;
  totalManagerChanges: number;
  totalEuropeanFixturesGenerated: number;
  totalEuropeanMatchesSimulated: number;
  totalDuplicateIds: number;
  totalInvalidReferences: number;
  totalInvariantViolations: number;
  sameSeedDeterministic: boolean | null;
  differentSeedDiverges: boolean | null;
  perSeason: LongRunSeasonMetrics[];
}

type IdCollection = { label: string; ids: string[] };

function idsFromState(state: GameState): IdCollection[] {
  return [
    { label: "players", ids: Object.keys(state.players ?? {}) },
    { label: "clubs", ids: Object.keys(state.clubs ?? {}) },
    { label: "fixtures", ids: (state.fixtures ?? []).map((item) => item.id) },
    { label: "matches", ids: (state.matches ?? []).map((item) => item.id) },
    { label: "events", ids: (state.events ?? []).map((item) => item.id) },
    { label: "transfers", ids: (state.transfers ?? []).map((item) => item.id) },
  ];
}

function countDuplicateIds(state: GameState): number {
  return idsFromState(state).reduce((total, collection) => {
    const unique = new Set(collection.ids);
    return total + collection.ids.length - unique.size;
  }, 0);
}

function countInvalidReferences(state: GameState): number {
  let invalid = 0;
  const playerIds = new Set(Object.keys(state.players ?? {}));
  const clubIds = new Set(Object.keys(state.clubs ?? {}));

  for (const club of Object.values(state.clubs ?? {})) {
    for (const playerId of club.playerIds ?? []) {
      if (!playerIds.has(playerId) || state.players[playerId]?.clubId !== club.id) invalid += 1;
    }
  }
  for (const player of Object.values(state.players ?? {})) {
    if (player.clubId && !clubIds.has(player.clubId)) invalid += 1;
  }
  for (const fixture of state.fixtures ?? []) {
    if (!clubIds.has(fixture.homeClubId) || !clubIds.has(fixture.awayClubId)) invalid += 1;
  }
  for (const match of state.matches ?? []) {
    if (!clubIds.has(match.homeClubId) || !clubIds.has(match.awayClubId)) invalid += 1;
  }
  return invalid;
}

function newEvents(before: GameState, after: GameState): EventLogEntry[] {
  const beforeIds = new Set((before.events ?? []).map((event) => event.id));
  return (after.events ?? []).filter((event) => !beforeIds.has(event.id));
}

function countEvent(events: EventLogEntry[], type: string, action?: string): number {
  return events.filter(
    (event) => event.type === type && (!action || event.meta?.["action"] === action),
  ).length;
}

function financialMetrics(state: GameState) {
  const balances = Object.values(state.clubs ?? {}).map((club) =>
    Number(computeClubFinancials(state, club.id).balance ?? 0),
  );
  const negative = balances.filter((balance) => balance < 0).length;
  return {
    financiallyNegativeClubs: negative,
    financiallyStableClubs: balances.length - negative,
    minimumClubBalance: balances.length > 0 ? Math.min(...balances) : 0,
    averageClubBalance:
      balances.length > 0 ? balances.reduce((sum, balance) => sum + balance, 0) / balances.length : 0,
  };
}

function seasonMetrics(
  before: GameState,
  afterSimulation: GameState,
  seasonIndex: number,
  seasonLabel: string,
): LongRunSeasonMetrics {
  const beforeMatches = new Set((before.matches ?? []).map((match) => match.id));
  const matches = (afterSimulation.matches ?? []).filter((match) => !beforeMatches.has(match.id));
  const events = newEvents(before, afterSimulation);
  const europeanCompetitionIds = new Set(
    [...(before.competitions ?? []), ...(afterSimulation.competitions ?? [])]
      .filter((competition) => competition.type === "continental")
      .map((competition) => competition.id),
  );
  const knownFixtures = new Map(
    [...(before.fixtures ?? []), ...(afterSimulation.fixtures ?? [])].map((fixture) => [fixture.id, fixture]),
  );
  const europeanFixtures = [...knownFixtures.values()].filter(
    (fixture) => fixture.season === seasonLabel && europeanCompetitionIds.has(fixture.competitionId),
  );
  const europeanFixtureIds = new Set(europeanFixtures.map((fixture) => fixture.id));

  return {
    seasonIndex,
    seasonLabel,
    matchesSimulated: matches.length,
    goals: matches.reduce((sum, match) => sum + match.scoreHome + match.scoreAway, 0),
    completedTransfers: countEvent(events, "TRANSFER_COMPLETED"),
    transferAttempts: events.filter(
      (event) =>
        event.type === "transfer" &&
        event.meta?.["action"] === "negotiation_start" &&
        event.meta?.["type"] === "transfer",
    ).length,
    promotions: countEvent(events, "PROMOTION"),
    relegations: countEvent(events, "RELEGATION"),
    retirements: countEvent(events, "PLAYER_RETIRED"),
    youthGenerated: countEvent(events, "YOUTH_GENERATED"),
    managerChanges: countEvent(events, "manager", "appointed"),
    europeanFixturesGenerated: europeanFixtures.length,
    europeanMatchesSimulated: matches.filter((match) => europeanFixtureIds.has(match.fixtureId ?? "")).length,
    playerPopulation: Object.keys(afterSimulation.players ?? {}).length,
    clubPopulation: Object.keys(afterSimulation.clubs ?? {}).length,
    ...financialMetrics(afterSimulation),
    duplicateIds: countDuplicateIds(afterSimulation),
    invalidReferences: countInvalidReferences(afterSimulation),
    invariantViolations: checkAllInvariants(afterSimulation).length,
  };
}

function representativeState(seed: string): GameState {
  const initial = buildInitialState(seed);
  const selectedClubIds = new Set<string>([initial.currentClub.id]);
  for (const league of Object.values(initial.leagues)) {
    const firstClubs = Object.values(initial.clubs)
      .filter((club) => club.leagueId === league.id)
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 2);
    for (const club of firstClubs) selectedClubIds.add(club.id);
  }
  const clubs = Object.fromEntries(
    [...selectedClubIds]
      .map((id) => initial.clubs[id])
      .filter((club): club is NonNullable<typeof club> => Boolean(club))
      .map((club) => [club.id, club]),
  );
  const playerIds = new Set(Object.values(clubs).flatMap((club) => club.playerIds ?? []));
  const players = Object.fromEntries(
    [...playerIds]
      .map((id) => initial.players[id])
      .filter((player): player is NonNullable<typeof player> => Boolean(player))
      .map((player) => [player.id, player]),
  );
  return {
    ...initial,
    clubs,
    players,
    currentClub: clubs[initial.currentClub.id] ?? initial.currentClub,
    fixtures: initial.fixtures.filter((fixture) => clubs[fixture.homeClubId] && clubs[fixture.awayClubId]),
    matches: [],
  };
}

function projection(report: LongRunAuditReport) {
  const { sameSeedDeterministic, differentSeedDiverges, ...rest } = report;
  return rest;
}

export function runLongRunAudit(
  seasons: number,
  seed = "step-7",
  representative = false,
  verifySeeds = true,
): LongRunAuditReport {
  const initial = representative ? representativeState(seed) : buildInitialState(seed);
  let state = initial;
  const perSeason: LongRunSeasonMetrics[] = [];

  for (let index = 0; index < seasons; index += 1) {
    const seasonLabel = state.time.season;
    const afterSimulation = simulateSeason(state);
    perSeason.push(seasonMetrics(state, afterSimulation, index + 1, seasonLabel));
    state = applyWorldSeasonProgression(afterSimulation);
  }

  const sum = (key: keyof LongRunSeasonMetrics) =>
    perSeason.reduce((total, season) => total + Number(season[key] ?? 0), 0);
  let sameSeedDeterministic: boolean | null = null;
  let differentSeedDiverges: boolean | null = null;
  if (verifySeeds && seasons <= 2) {
    const repeat = runLongRunAudit(seasons, seed, representative, false);
    const different = runLongRunAudit(seasons, `${seed}-different`, representative, false);
    sameSeedDeterministic = JSON.stringify(projection({
      ...reportFrom(state, perSeason, seasons, seed, representative),
      sameSeedDeterministic: null,
      differentSeedDiverges: null,
    })) === JSON.stringify(projection({
      ...repeat,
      sameSeedDeterministic: null,
      differentSeedDiverges: null,
    }));
    differentSeedDiverges = JSON.stringify(projection({
      ...reportFrom(state, perSeason, seasons, seed, representative),
      sameSeedDeterministic: null,
      differentSeedDiverges: null,
    })) !== JSON.stringify(projection({
      ...different,
      sameSeedDeterministic: null,
      differentSeedDiverges: null,
    }));
  }

  const report = reportFrom(state, perSeason, seasons, seed, representative);
  return { ...report, sameSeedDeterministic, differentSeedDiverges };

  function reportFrom(
    finalState: GameState,
    seasonsData: LongRunSeasonMetrics[],
    requestedSeasons: number,
    reportSeed: string,
    isRepresentative: boolean,
  ): LongRunAuditReport {
    return {
      requestedSeasons,
      completedSeasons: seasonsData.length,
      completedAllRequestedSeasons: seasonsData.length === requestedSeasons,
      seed: reportSeed,
      worldScope: isRepresentative ? "REPRESENTATIVE" : "FULL-WORLD",
      finalSeason: finalState.time.season,
      finalDate: finalState.time.date,
      finalPlayerPopulation: Object.keys(finalState.players ?? {}).length,
      finalClubPopulation: Object.keys(finalState.clubs ?? {}).length,
      totalMatchesSimulated: sum("matchesSimulated"),
      totalGoals: sum("goals"),
      totalCompletedTransfers: sum("completedTransfers"),
      totalTransferAttempts: sum("transferAttempts"),
      totalPromotions: sum("promotions"),
      totalRelegations: sum("relegations"),
      totalRetirements: sum("retirements"),
      totalYouthGenerated: sum("youthGenerated"),
      totalManagerChanges: sum("managerChanges"),
      totalEuropeanFixturesGenerated: sum("europeanFixturesGenerated"),
      totalEuropeanMatchesSimulated: sum("europeanMatchesSimulated"),
      totalDuplicateIds: sum("duplicateIds"),
      totalInvalidReferences: sum("invalidReferences"),
      totalInvariantViolations: sum("invariantViolations"),
      sameSeedDeterministic: null,
      differentSeedDiverges: null,
      perSeason: seasonsData,
    };
  }
}

const directScriptPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === directScriptPath) {
  const seasons = Number.parseInt(process.argv[2] ?? "30", 10) || 30;
  const seed = process.argv[3] ?? "step-7";
  const representative = process.argv.includes("--representative");
  const verifySeeds = process.argv.includes("--verify-seeds");
  console.log(JSON.stringify(runLongRunAudit(seasons, seed, representative, verifySeeds), null, 2));
}
