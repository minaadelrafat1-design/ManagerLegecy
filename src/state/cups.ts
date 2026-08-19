import type { Competition, Fixture, GameState, WorldCompetitionConfig } from "./types";
import { seededUnit } from "./utils";
import { addDaysISO, getDayOfWeekLabel } from "./calendar";
import { applyAiFixtureResults, simulateAiFixtureViaEngine } from "../lib/ai-match-adapter";

const ROUND_LABELS: Record<number, string> = {
  2: "Final",
  4: "Semi-final",
  8: "Quarter-final",
  16: "Round of 16",
  32: "Round of 32",
  64: "Round of 64",
};

/** Helper to calculate calendar date for cup fixtures.
 * Cups start after league matchdays end (based on latest league fixture date).
 * Cup rounds are spread starting one week after the final league fixture. */
function calculateCupFixtureDate(
  state: GameState,
  roundIndex: number,
  fixtureIndex: number = 0,
): string {
  // Find the latest league fixture date for the current season to determine when cups start
  const currentSeason = state.time.season;
  const leagueFixtures = (state.fixtures ?? []).filter(
    (f) => (f.season ?? currentSeason) === currentSeason && f.competitionId !== "national-cup",
  );

  if (leagueFixtures.length === 0) {
    // Fallback: if no league fixtures found, use old algorithm
    // (This shouldn't happen in normal operation, but provides safety net)
    const preseasonDays = 14;
    const cupStartMatchday = 39 + roundIndex * 2 + fixtureIndex;
    return addDaysISO(state.time.seasonStartDate, preseasonDays + (cupStartMatchday - 1) * 7);
  }

  // Find latest league fixture date
  const latestLeagueFixture = leagueFixtures.reduce((latest, fixture) => {
    const fixtureDate = fixture.calendarDate ?? fixture.date;
    const latestDate = latest.calendarDate ?? latest.date;
    if (!fixtureDate || !latestDate) return latest;
    return fixtureDate > latestDate ? fixture : latest;
  });

  const latestLeagueDate = latestLeagueFixture.calendarDate ?? latestLeagueFixture.date;
  if (!latestLeagueDate) {
    // Fallback if no date found
    const preseasonDays = 14;
    const cupStartMatchday = 39 + roundIndex * 2 + fixtureIndex;
    return addDaysISO(state.time.seasonStartDate, preseasonDays + (cupStartMatchday - 1) * 7);
  }

  // Cup rounds start 7 days after last league fixture, spread 7 days apart
  const cupStartDate = addDaysISO(latestLeagueDate, 7);
  const cupFixtureIndex = roundIndex * 2 + fixtureIndex;
  const calendarDate = addDaysISO(cupStartDate, cupFixtureIndex * 7);
  return calendarDate;
}

/** Helper to format display date from ISO calendar date */
function formatDisplayDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  const weekday = getDayOfWeekLabel(dateISO);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${weekday} ${day} ${month}`;
}

function roundName(teamCount: number): string {
  return ROUND_LABELS[teamCount] ?? `${teamCount}-team round`;
}

function getWorldCompetitionConfig(state: GameState, cupId: string): WorldCompetitionConfig | null {
  return (
    state.meta?.worldConfig?.competitions.find((competition) => competition.id === cupId) ?? null
  );
}

function getCompetitionEligibleEntrants(
  state: GameState,
  competition: WorldCompetitionConfig,
): string[] {
  const entrantIds = new Set<string>();

  if (competition.eligibleClubIds?.length) {
    for (const clubId of competition.eligibleClubIds) {
      if (state.clubs[clubId]) entrantIds.add(clubId);
    }
  }

  if (competition.eligibleDivisionIds?.length) {
    for (const club of Object.values(state.clubs)) {
      if (competition.eligibleDivisionIds.includes(club.leagueId)) entrantIds.add(club.id);
    }
  }

  if (entrantIds.size > 0) {
    return [...entrantIds].sort();
  }

  if (competition.countryId && state.meta?.worldConfig) {
    const country = state.meta.worldConfig.countries.find(
      (item) => item.id === competition.countryId,
    );
    if (country) {
      const divisionIds = country.divisions.map((division) => division.id);
      for (const club of Object.values(state.clubs)) {
        if (divisionIds.includes(club.leagueId)) entrantIds.add(club.id);
      }
      if (entrantIds.size > 0) return [...entrantIds].sort();
    }
  }

  return Object.keys(state.clubs).sort();
}

function getEligibleCupEntrants(state: GameState, cupId: string): string[] {
  const competition = getWorldCompetitionConfig(state, cupId);
  if (competition) {
    return getCompetitionEligibleEntrants(state, competition);
  }

  // The seeded demo cup belongs only to the seeded nine-team demo league.
  // Do not let its legacy fallback accidentally enter every generated club in
  // the world; configured world cups use the branch above.
  if (cupId === "national-cup") {
    return Object.values(state.clubs)
      .filter((club) => club.leagueId === "national-league")
      .map((club) => club.id)
      .sort();
  }

  return Object.keys(state.clubs).sort();
}

function updateCupCompetition(
  state: GameState,
  cupId: string,
  patch: Partial<Competition>,
): GameState {
  return {
    ...state,
    competitions: state.competitions.map((competition) =>
      competition.id === cupId ? { ...competition, ...patch } : competition,
    ),
  };
}

function sortEntrantsForDraw(
  state: GameState,
  cupId: string,
  entrants: string[],
  seeded: boolean,
): string[] {
  const ordered = entrants.slice();
  if (!seeded) {
    return ordered.sort(
      (a, b) =>
        seededUnit(`${state.time.season}:${cupId}:random-draw:${a}`) -
        seededUnit(`${state.time.season}:${cupId}:random-draw:${b}`),
    );
  }

  return ordered.sort(
    (a, b) =>
      seededUnit(`${state.time.season}:${cupId}:seeded-draw:${a}`) -
      seededUnit(`${state.time.season}:${cupId}:seeded-draw:${b}`),
  );
}

function getNextCupRoundConfig(
  state: GameState,
  cupId: string,
): {
  id: string;
  name: string;
  teams?: number;
  twoLegged?: boolean;
  seeded?: boolean;
  byes?: number;
  drawSeed?: "random" | "seeded";
} | null {
  const competition = getWorldCompetitionConfig(state, cupId);
  const knockout = competition?.format?.knockoutStage;
  if (!knockout?.rounds?.length) return null;

  for (const round of knockout.rounds) {
    const existingRoundFixtures = state.fixtures.filter(
      (fixture) => fixture.competitionId === cupId && fixture.round === round.id,
    );
    if (existingRoundFixtures.length === 0) {
      return round;
    }
    if (existingRoundFixtures.some((fixture) => fixture.status === "scheduled")) {
      return null;
    }
  }

  return null;
}

function buildCupFixtureId(
  season: string,
  cupId: string,
  roundId: string,
  tieIndex: number,
  leg?: number,
) {
  const slug = roundId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return leg
    ? `cup-${season}-${cupId}-${slug}-tie${tieIndex + 1}-leg${leg}`
    : `cup-${season}-${cupId}-${slug}-tie${tieIndex + 1}`;
}

function buildCupFixtures(
  state: GameState,
  cupId: string,
  entrants: string[],
  roundConfig: {
    id: string;
    name: string;
    teams?: number;
    twoLegged?: boolean;
    seeded?: boolean;
    byes?: number;
    drawSeed?: "random" | "seeded";
  },
): Fixture[] {
  const stage = roundConfig.name || roundName(entrants.length);
  const seededEntrants = sortEntrantsForDraw(state, cupId, entrants, roundConfig.seeded !== false);

  const fixtures: Fixture[] = [];
  const targetTeams = roundConfig.teams ?? seededEntrants.length;
  const byeCount =
    roundConfig.byes ?? Math.max(0, seededEntrants.length - Math.max(0, targetTeams));
  const actualByeCount = Math.min(byeCount, seededEntrants.length);
  const matchTeams = seededEntrants.slice(actualByeCount);

  let matchIndex = 0;
  for (let i = 0; i < matchTeams.length; i += 2) {
    const home = matchTeams[i]!;
    const away = matchTeams[i + 1]!;
    if (!away) break;

    const homeClubId =
      seededUnit(`${state.time.season}:${cupId}:${roundConfig.id}:home:${home}:${away}`) < 0.5
        ? home
        : away;
    const awayClubId = homeClubId === home ? away : home;
    const tieId = `${cupId}:${roundConfig.id}:tie${matchIndex + 1}`;

    if (roundConfig.twoLegged) {
      const calendarDate1 = calculateCupFixtureDate(state, matchIndex, 0);
      const calendarDate2 = calculateCupFixtureDate(state, matchIndex, 1);
      const seasonStr = String(state.time.season);
      fixtures.push({
        id: buildCupFixtureId(seasonStr, cupId, roundConfig.id, matchIndex, 1),
        competitionId: cupId,
        season: seasonStr,
        homeClubId,
        awayClubId,
        calendarDate: calendarDate1,
        date: formatDisplayDate(calendarDate1),
        matchday: matchIndex * 2 + 1,
        venue: "H",
        status: "scheduled",
        result: null,
        round: roundConfig.id,
        leg: 1,
        tieId,
      });
      fixtures.push({
        id: buildCupFixtureId(seasonStr, cupId, roundConfig.id, matchIndex, 2),
        competitionId: cupId,
        season: seasonStr,
        homeClubId: awayClubId,
        awayClubId: homeClubId,
        calendarDate: calendarDate2,
        date: formatDisplayDate(calendarDate2),
        matchday: matchIndex * 2 + 2,
        venue: "H",
        status: "scheduled",
        result: null,
        round: roundConfig.id,
        leg: 2,
        tieId,
      });
    } else {
      const calendarDate = calculateCupFixtureDate(state, matchIndex, 0);
      const seasonStr = String(state.time.season);
      fixtures.push({
        id: buildCupFixtureId(seasonStr, cupId, roundConfig.id, matchIndex),
        competitionId: cupId,
        season: seasonStr,
        homeClubId,
        awayClubId,
        calendarDate,
        date: formatDisplayDate(calendarDate),
        matchday: matchIndex + 1,
        venue: "H",
        status: "scheduled",
        result: null,
        round: roundConfig.id,
        tieId,
      });
    }

    matchIndex += 1;
  }

  return fixtures;
}

function isCupCompetition(state: GameState, cupId: string): boolean {
  const competition = getWorldCompetitionConfig(state, cupId);
  return competition?.type === "cup" || cupId === "national-cup";
}

function aggregateTwoLegTie(fixtures: Fixture[]): { winner: string | null; loser: string | null } {
  if (fixtures.length !== 2) return { winner: null, loser: null };
  const first = fixtures[0]!;
  const second = fixtures[1]!;
  if (
    first.scoreHome == null ||
    first.scoreAway == null ||
    second.scoreHome == null ||
    second.scoreAway == null
  ) {
    return { winner: null, loser: null };
  }

  const teamA = first.homeClubId;
  const teamB = first.awayClubId;
  const aggregateA = first.scoreHome + second.scoreAway;
  const aggregateB = first.scoreAway + second.scoreHome;
  if (aggregateA > aggregateB) return { winner: teamA, loser: teamB };
  if (aggregateB > aggregateA) return { winner: teamB, loser: teamA };
  return { winner: null, loser: null };
}

function aliveCupClubs(state: GameState, cupId: string): string[] {
  const eligibleEntrants = getEligibleCupEntrants(state, cupId);
  const fixtures = state.fixtures.filter((fixture) => fixture.competitionId === cupId);
  const playedFixtures = fixtures.filter((fixture) => fixture.status === "played");
  const eliminated = new Set<string>();
  const fixturesByTie = new Map<string, Fixture[]>();

  for (const fixture of playedFixtures) {
    const tieId = fixture.tieId ?? fixture.id;
    const group = fixturesByTie.get(tieId) ?? [];
    group.push(fixture);
    fixturesByTie.set(tieId, group);
  }

  for (const fixturesOfTie of fixturesByTie.values()) {
    if (fixturesOfTie.length === 2) {
      const { winner, loser } = aggregateTwoLegTie(fixturesOfTie);
      if (winner && loser) eliminated.add(loser);
      continue;
    }

    for (const fixture of fixturesOfTie) {
      if (fixture.scoreHome == null || fixture.scoreAway == null) continue;
      if (fixture.scoreHome > fixture.scoreAway) eliminated.add(fixture.awayClubId);
      else if (fixture.scoreAway > fixture.scoreHome) eliminated.add(fixture.homeClubId);
      else {
        const winnerSide = seededUnit(`${fixture.id}:cup-winner`) < 0.5 ? "home" : "away";
        if (winnerSide === "home") eliminated.add(fixture.awayClubId);
        else eliminated.add(fixture.homeClubId);
      }
    }
  }

  return eligibleEntrants.filter((clubId) => !eliminated.has(clubId));
}

export function getCupChampion(state: GameState, cupId: string): string | null {
  const alive = aliveCupClubs(state, cupId);
  if (alive.length !== 1) return null;
  const hasPlayed = state.fixtures.some(
    (fixture) => fixture.competitionId === cupId && fixture.status === "played",
  );
  return hasPlayed ? alive[0]! : null;
}

function finalizeCup(state: GameState, cupId: string, championClubId: string | null): GameState {
  const competition = state.competitions.find((c) => c.id === cupId);
  const currentClubId = state.currentClub?.id;
  const competitionStatus = championClubId === currentClubId ? "won" : "eliminated";
  const name = competition?.name ?? cupId;
  let next = updateCupCompetition(state, cupId, { stage: "Completed", status: competitionStatus });

  const alreadyReported = next.events.some(
    (event) =>
      (event.type === "cup" || event.type === "COMPETITION_WINNER") &&
      event.description.includes(`${name} champion:`),
  );
  if (!alreadyReported && championClubId) {
    const championName = state.clubs[championClubId]?.name ?? championClubId;
    next = {
      ...next,
      events: [
        ...(next.events ?? []),
        {
          id: `event-cup-champion-${(next.events ?? []).length + 1}`,
          date: state.time.date,
          type: "COMPETITION_WINNER" as any,
          description: `${name} champion: ${championName}`,
          meta: { competitionId: cupId, winnerId: championClubId, competitionName: name },
        },
      ],
      news: [
        ...(next.news ?? []),
        {
          id: `news-cup-champion-${(next.news ?? []).length + 1}`,
          tag: "CUP",
          time: state.time.date,
          text: `${championName} lifted the ${name}!`,
        },
      ],
    };
  }

  return next;
}

function cupRoundNeedsScheduling(state: GameState, cupId: string): boolean {
  return state.fixtures.some(
    (fixture) => fixture.competitionId === cupId && fixture.status === "scheduled",
  );
}

function scheduleCupRound(
  state: GameState,
  cupId: string,
  entrants: string[],
  roundConfig?: {
    id: string;
    name: string;
    teams?: number;
    twoLegged?: boolean;
    seeded?: boolean;
    byes?: number;
    drawSeed?: "random" | "seeded";
  },
): GameState {
  if (entrants.length < 2) return state;
  const config = roundConfig ??
    getNextCupRoundConfig(state, cupId) ?? {
      id: `auto-${entrants.length}`,
      name: roundName(entrants.length),
      teams: entrants.length,
      twoLegged: false,
      seeded: false,
    };
  const fixtures = buildCupFixtures(state, cupId, entrants, config);
  if (fixtures.length === 0) return state;

  const competition = state.competitions.find((c) => c.id === cupId);
  const name = competition?.name ?? cupId;
  const stage = config.name;

  const next: GameState = {
    ...state,
    fixtures: [...(state.fixtures ?? []), ...fixtures],
    events: [
      ...(state.events ?? []),
      {
        id: `event-cup-draw-${(state.events ?? []).length + 1}`,
        date: state.time.date,
        type: "cup" as const,
        description: `${name} ${stage} draw complete.`,
      } as any,
    ],
    news: [
      ...(state.news ?? []),
      {
        id: `news-cup-draw-${(state.news ?? []).length + 1}`,
        tag: "CUP",
        time: state.time.date,
        text: `The ${name} ${stage} draw has been made.`,
      },
    ],
  };

  return updateCupCompetition(next, cupId, { stage, status: "active" });
}

function knockoutHasExtraTime(state: GameState, cupId: string): boolean {
  return getWorldCompetitionConfig(state, cupId)?.format?.knockoutStage?.extraTime ?? true;
}

function knockoutAllowsPenalties(state: GameState, cupId: string): boolean {
  return getWorldCompetitionConfig(state, cupId)?.format?.knockoutStage?.penalties ?? true;
}

function resolveCupDrawResult(
  state: GameState,
  fixture: Fixture,
  result: ReturnType<typeof simulateAiFixtureViaEngine>,
): ReturnType<typeof simulateAiFixtureViaEngine> {
  const winnerSide = seededUnit(`${fixture.id}:cup-winner`) < 0.5 ? "home" : "away";
  const resolved = { ...result };
  const extraTime = knockoutHasExtraTime(state, fixture.competitionId);
  const penalties = knockoutAllowsPenalties(state, fixture.competitionId);

  if (penalties) {
    resolved.extraTime = extraTime;
    resolved.penaltyHome = winnerSide === "home" ? 4 : 3;
    resolved.penaltyAway = winnerSide === "away" ? 4 : 3;
    resolved.outcome = winnerSide === "home" ? "H" : "A";
    return resolved;
  }

  if (extraTime) {
    resolved.extraTime = true;
    if (winnerSide === "home") resolved.scoreHome += 1;
    else resolved.scoreAway += 1;
    resolved.outcome = winnerSide === "home" ? "H" : "A";
    return resolved;
  }

  if (winnerSide === "home") resolved.scoreHome += 1;
  else resolved.scoreAway += 1;
  resolved.outcome = winnerSide === "home" ? "H" : "A";
  return resolved;
}

function resolveCupTieResults(
  state: GameState,
  results: ReturnType<typeof simulateAiFixtureViaEngine>[],
) {
  const byTie = new Map<
    string,
    { fixture: Fixture; result: ReturnType<typeof simulateAiFixtureViaEngine> }[]
  >();

  for (const result of results) {
    const fixture = state.fixtures.find((f) => f.id === result.fixtureId);
    if (!fixture || !isCupCompetition(state, fixture.competitionId)) continue;
    const tieId =
      fixture.tieId ?? `${fixture.competitionId}:${fixture.round ?? fixture.id}:${fixture.id}`;
    const group = byTie.get(tieId) ?? [];
    group.push({ fixture, result });
    byTie.set(tieId, group);
  }

  for (const group of byTie.values()) {
    if (group.length === 1) {
      const item = group[0];
      if (!item) continue;
      if (item.result.scoreHome === item.result.scoreAway) {
        item.result = resolveCupDrawResult(state, item.fixture, item.result);
      }
      continue;
    }

    if (group.length !== 2) continue;
    const first = group[0]!;
    const second = group[1]!;
    const firstOrdered = first.fixture.leg === 2 ? second : first;
    const secondOrdered = first.fixture.leg === 2 ? first : second;
    if (
      firstOrdered.result.scoreHome == null ||
      firstOrdered.result.scoreAway == null ||
      secondOrdered.result.scoreHome == null ||
      secondOrdered.result.scoreAway == null
    ) {
      continue;
    }

    const aggregateFirst = firstOrdered.result.scoreHome + secondOrdered.result.scoreAway;
    const aggregateSecond = firstOrdered.result.scoreAway + secondOrdered.result.scoreHome;
    if (aggregateFirst !== aggregateSecond) continue;

    const winnerSide = seededUnit(`${second.fixture.id}:cup-winner`) < 0.5 ? "home" : "away";
    const resolved = { ...second.result };
    if (knockoutAllowsPenalties(state, second.fixture.competitionId)) {
      resolved.penaltyHome = winnerSide === "home" ? 4 : 3;
      resolved.penaltyAway = winnerSide === "away" ? 4 : 3;
    } else if (knockoutHasExtraTime(state, second.fixture.competitionId)) {
      resolved.extraTime = true;
      if (winnerSide === "home") resolved.scoreHome += 1;
      else resolved.scoreAway += 1;
    } else {
      if (winnerSide === "home") resolved.scoreHome += 1;
      else resolved.scoreAway += 1;
    }
    resolved.outcome = winnerSide === "home" ? "H" : "A";
    second.result = resolved;
  }

  return results;
}

function cupFixturesForCompetition(state: GameState, cupId: string) {
  return state.fixtures.filter((fixture) => fixture.competitionId === cupId);
}

export function runDomesticCup(state: GameState, cupId = "national-cup"): GameState {
  const competition = state.competitions.find((c) => c.id === cupId);
  if (!competition) return state;

  if (competition.status === "won" || competition.status === "eliminated") {
    return state;
  }

  if (cupRoundNeedsScheduling(state, cupId)) {
    return state;
  }

  const fixtures = cupFixturesForCompetition(state, cupId);
  if (fixtures.length === 0) {
    const entrants = getEligibleCupEntrants(state, cupId);
    return scheduleCupRound(state, cupId, entrants);
  }

  const alive = aliveCupClubs(state, cupId);
  if (alive.length <= 1) {
    return finalizeCup(state, cupId, alive.length === 1 ? alive[0]! : null);
  }

  const nextRound = getNextCupRoundConfig(state, cupId);
  return scheduleCupRound(state, cupId, alive, nextRound ?? undefined);
}

export function simulateAllScheduledCupFixtures(
  state: GameState,
  playedAt: string,
  cupId = "national-cup",
): GameState {
  const scheduledFixtures = state.fixtures.filter(
    (fixture) => fixture.competitionId === cupId && fixture.status === "scheduled",
  );
  if (scheduledFixtures.length === 0) return state;

  let results = scheduledFixtures.map((fixture) =>
    simulateAiFixtureViaEngine(fixture, state.clubs, state.players),
  );
  results = resolveCupTieResults(state, results);
  return applyAiFixtureResults(state, results, playedAt);
}
