import type { GameState, Fixture, FixtureResult, SeasonPerformanceTier } from "./types";
import type { SeasonReport } from "./types";
import { computeLeagueTable } from "./standings";
import { runSeasonalPlayerLifecycle } from "./player-development";
import { runSeasonalYouthGeneration } from "./academy";
import { seededUnit } from "./utils";
import { addDaysISO, daysBetweenISO, getDayOfWeekLabel } from "./calendar";
import { runEnhancedTransferWindow } from "./transfers-enhanced";
import { runDomesticCup, getCupChampion } from "./cups";
import { applyEuropeanQualificationRegistrations } from "./qualification";
import { applyPromotionRelegation } from "./promotion";
import { generateSeasonAwards } from "./awards";
import { runEuropeanCompetitions, getEuropeanChampion } from "./european";
import { applyAiFixtureResults, simulateAiFixtureViaEngine } from "../lib/ai-match-adapter";
import { applyLongTermEvolution } from "./evolution";
import { applyWorldSeasonProgression, applyWorldSeasonProgressionWithoutDateChange } from "./world";
import { applySeasonPerformance, describeSeasonReview } from "./manager-progression";
import { evaluateJobSecurity, generateJobOffers } from "./jobs";
import consequences from "./ai-consequences";
import {
  applyWorldHistoryInvariants,
  recordClubAchievement,
  recordCupWinner,
  recordEuropeanWinner,
  recordManagerEra,
  recordSeasonChampion,
  archiveOldWorldHistory,
} from "./world-history";
import { pruneOldFixtures } from "./fixture-maintenance";
import { auditTransferLedgers } from "../lib/ledger-audit";

function isPreferredMatchday(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
  return day === 6 || day === 0; // Saturday/Sunday
}

function isFallbackMatchday(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
  return day === 2 || day === 4; // Tuesday/Thursday
}

function getRealisticSeasonSlots(
  seasonStartDate: string | undefined,
  seasonEndDate: string | undefined,
): string[] {
  const start: string = seasonStartDate || "2026-08-01";
  const end: string = seasonEndDate || "2027-05-31";
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
  seasonStartDate: string | undefined,
  seasonEndDate: string | undefined,
): string[] {
  const start: string = seasonStartDate || "2026-08-01";
  const end: string = seasonEndDate || "2027-05-31";
  if (totalMatchdays <= 0) return [];

  const slotPool = getRealisticSeasonSlots(start, end);
  const fallbackPool: string[] = [];
  const cursor = new Date(`${addDaysISO(start, 14)}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);

  while (cursor <= endDate) {
    fallbackPool.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const combinedPool =
    slotPool.length >= totalMatchdays ? slotPool : [...slotPool, ...fallbackPool];
  const chosen: string[] = [];
  const used = new Set<string>();

  for (let i = 0; i < totalMatchdays; i += 1) {
    const poolIndex =
      combinedPool.length === 1
        ? 0
        : Math.min(
            combinedPool.length - 1,
            Math.round((i / Math.max(totalMatchdays - 1, 1)) * (combinedPool.length - 1)),
          );
    let candidate: string | undefined = combinedPool[poolIndex];
    let probe = poolIndex;

    while (candidate && used.has(candidate) && probe < combinedPool.length - 1) {
      probe += 1;
      candidate = combinedPool[probe];
    }

    if (candidate && used.has(candidate)) {
      for (let fallbackIndex = 0; fallbackIndex < fallbackPool.length; fallbackIndex += 1) {
        const fallbackDate = fallbackPool[fallbackIndex];
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

  return [...new Set(chosen)].sort((a, b) => a.localeCompare(b));
}

// Simple round-robin scheduler: double round-robin, each pair plays home/away
export function generateLeagueFixtures(state: GameState): GameState {
  let next = { ...state } as GameState;
  const fixtures: Fixture[] = [];
  const existingFixtureNumbers = (state.fixtures ?? []).reduce((max, fixture) => {
    const match = /^f-(\d+)$/.exec(fixture.id);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  let fixtureId = existingFixtureNumbers + 1;
  const seasonLabel: string = String(state.time.season);

  // Realistic domestic season structure: August preparation/start, league
  // fixtures from mid-August through late May, with weekend slots preferred
  // and selected midweeks only when a match congestion requires it.
  const seasonStartDate: string = String(
    state.time.seasonStartDate ?? `${Number(state.time.date.slice(0, 4))}-08-01`,
  );
  const [seasonYear = "2024"] = seasonStartDate.split("-");
  const nextYear = String(Number.parseInt(seasonYear, 10) + 1);
  const leagueEndDate = `${nextYear}-05-31`;

  // Helper to format display date from ISO date
  function formatDisplayDate(dateISO: string): string {
    const d = new Date(`${dateISO}T00:00:00.000Z`);
    const weekday = getDayOfWeekLabel(dateISO);
    const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const day = d.getUTCDate();
    return `${weekday} ${day} ${month}`;
  }

  for (const leagueId of Object.keys(state.leagues)) {
    const league = state.leagues[leagueId];
    if (!league) continue;
    const existingLeagueFixtures = (state.fixtures ?? []).filter(
      (f) =>
        f.competitionId === league.competitionId &&
        (f.season ?? state.time.season) === state.time.season,
    );
    if (existingLeagueFixtures.length > 0) continue;

    const clubs = Object.values(state.clubs).filter((c) => c.leagueId === leagueId);
    const n = clubs.length;
    if (n < 2) continue;

    const teams = clubs.map((c) => c.id);
    const slots = n % 2 === 0 ? teams : [...teams, "__bye__"];
    const rounds = slots.length - 1;
    const isDemoLeague = leagueId === "national-league" && n === 9;
    const cycles = isDemoLeague ? 3 : 1;
    const totalMatchdays = isDemoLeague ? cycles * rounds : 2 * rounds;
    const pivot = slots[0];
    const rest = slots.slice(1);
    if (!pivot) continue;

    const roundDates = buildRealisticMatchdayDates(totalMatchdays, seasonStartDate, leagueEndDate);

    for (let cycle = 0; cycle < cycles; cycle += 1) {
      for (let r = 0; r < rounds; r += 1) {
        const pairings: [string, string][] = [];
        const arr: string[] = [pivot, ...rest];
        for (let i = 0; i < slots.length / 2; i += 1) {
          const a = arr[i];
          const b = arr[slots.length - 1 - i];
          if (!a || !b || a === "__bye__" || b === "__bye__") continue;
          pairings.push([a, b]);
        }

        const matchday = cycle * rounds + r + 1;
        const homeLegDate = isDemoLeague ? roundDates[matchday - 1] : roundDates[r];
        const awayLegDate = isDemoLeague ? roundDates[matchday - 1] : roundDates[r + rounds];

        for (const [home, away] of pairings) {
          const firstDate = String(homeLegDate ?? roundDates[0] ?? "");
          const secondDate = String(awayLegDate ?? roundDates[roundDates.length - 1] ?? "");

          const firstFixture: Fixture = {
            id: `f-${fixtureId++}`,
            competitionId: league.competitionId,
            season: seasonLabel,
            matchday,
            calendarDate: firstDate,
            date: formatDisplayDate(firstDate),
            homeClubId: home,
            awayClubId: away,
            venue: "H",
            status: "scheduled",
            result: null,
          };
          fixtures.push(firstFixture);

          if (isDemoLeague) continue;

          const secondFixture: Fixture = {
            id: `f-${fixtureId++}`,
            competitionId: league.competitionId,
            season: seasonLabel,
            matchday: matchday + rounds,
            calendarDate: secondDate,
            date: formatDisplayDate(secondDate),
            homeClubId: away,
            awayClubId: home,
            venue: "A",
            status: "scheduled",
            result: null,
          };
          fixtures.push(secondFixture);
        }

        rest.push(rest.shift()!);
      }
    }
  }

  if (fixtures.length === 0) return next;

  // Validate: No duplicate fixture IDs in newly generated fixtures
  const fixtureIds = new Set<string>();
  for (const fixture of fixtures) {
    if (fixtureIds.has(fixture.id)) {
      throw new Error(`Duplicate fixture ID generated: ${fixture.id} (league fixture generation)`);
    }
    fixtureIds.add(fixture.id);
  }

  // Validate: No collision with existing fixtures
  const existingIds = new Set((next.fixtures ?? []).map((f) => f.id));
  for (const fixture of fixtures) {
    if (existingIds.has(fixture.id)) {
      throw new Error(`Fixture ID collision: ${fixture.id} already exists in state`);
    }
  }

  next = { ...next, fixtures: [...(next.fixtures ?? []), ...fixtures] };
  return next;
}

/** Initializes a season only when the natural calendar reaches August 1.
 * The marker makes this safe across repeated ADVANCE_DAY calls and reloads. */
export function initializeSeasonFixturesIfNeeded(state: GameState): GameState {
  const season = String(state.time.season);
  const [startYear] = season.split("/");
  const seasonStartDate = `${startYear}-08-01`;
  if (state.time.date !== seasonStartDate) return state;
  if (state.meta?.["fixturesInitializedSeason"] === season) return state;

  const currentSeasonFixtures = (state.fixtures ?? []).some(
    (fixture) => String(fixture.season ?? "") === season,
  );
  let next: GameState = {
    ...state,
    time: {
      ...state.time,
      seasonStartDate,
      day: 1,
      week: 1,
    },
    meta: {
      ...(state.meta ?? {}),
      fixturesInitializedSeason: season,
    },
  };

  if (!currentSeasonFixtures) {
    next = generateLeagueFixtures(next);
    next = runDomesticCup(next);
  }

  return next;
}

function resultForManagedClub(
  fixture: Fixture,
  scoreHome: number,
  scoreAway: number,
  managedClubId: string | undefined,
): FixtureResult {
  if (!managedClubId) return null;
  const isHome = fixture.homeClubId === managedClubId;
  const isAway = fixture.awayClubId === managedClubId;
  if (!isHome && !isAway) return null;
  const scored = isHome ? scoreHome : scoreAway;
  const conceded = isHome ? scoreAway : scoreHome;
  if (scored > conceded) return "W";
  if (scored < conceded) return "L";
  return "D";
}

function simulateScheduledFixturesViaEngine(state: GameState): GameState {
  const scheduledFixtures = state.fixtures.filter((fixture) => fixture.status === "scheduled");
  if (scheduledFixtures.length === 0) return state;

  // Validate: No duplicate fixture IDs in scheduled fixtures
  const fixtureIds = new Set(scheduledFixtures.map((f) => f.id));
  if (fixtureIds.size !== scheduledFixtures.length) {
    throw new Error(
      `Duplicate fixture IDs in scheduled fixtures: ${scheduledFixtures.length} fixtures but only ${fixtureIds.size} unique IDs`,
    );
  }

  const results = scheduledFixtures.map((fixture) => {
    // Combine game seed with fixture ID for deterministic but seed-aware results
    const gameSeed = state.gameSeed ?? "0";
    const seedStr = `${fixture.id}:${gameSeed}`;
    const result = simulateAiFixtureViaEngine(fixture, state.clubs, state.players, seedStr);
    if (fixture.competitionId === "national-cup" && result.scoreHome === result.scoreAway) {
      const winnerSide = seededUnit(`${fixture.id}:cup-winner:${gameSeed}`) < 0.5 ? "home" : "away";
      return {
        ...result,
        scoreHome: result.scoreHome + (winnerSide === "home" ? 1 : 0),
        scoreAway: result.scoreAway + (winnerSide === "away" ? 1 : 0),
      };
    }
    return result;
  });

  const resultIds = new Set(results.map((r) => r.fixtureId));
  if (resultIds.size !== results.length) {
    throw new Error(
      `Duplicate result IDs after simulation: ${results.length} results but only ${resultIds.size} unique IDs`,
    );
  }

  const next = applyAiFixtureResults(state, results, state.time.date);
  return next;
}

export function isSeasonComplete(state: GameState): boolean {
  const season = state.time.season;
  const seasonFixtures = (state.fixtures ?? []).filter(
    (fixture) => (fixture.season ?? state.time.season) === season,
  );

  // If no fixtures at all for this season, don't trigger rollover.
  if (seasonFixtures.length === 0) return false;

  // A league season should only end in the realistic off-season window after
  // the final league fixtures are completed. In the normal European model the
  // league run runs August through May; the season must not roll over in
  // December just because the latest played fixture happened earlier.
  const allPlayed = !seasonFixtures.some((fixture) => fixture.status === "scheduled");
  if (!allPlayed) return false;

  const [seasonStartYearRaw = ""] = String(season).split("/");
  const seasonStartYear = Number.parseInt(seasonStartYearRaw, 10);
  if (!Number.isFinite(seasonStartYear)) return false;

  const seasonEndDate = `${seasonStartYear + 1}-05-31`;
  const currentDate = state.time.date;

  // The season is only complete after the final realistic league window has
  // passed. This keeps the campaign in the Aug-May cycle rather than allowing
  // an early rollover in winter.
  if (currentDate < seasonEndDate) return false;

  return true;
}

function parseMoneyAmount(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : 0;
  if (!value) return 0;
  const normalized = String(value).replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-") return 0;
  const asNumber = Number.parseFloat(normalized);
  return Number.isFinite(asNumber) ? Math.round(asNumber) : 0;
}

function seasonStartForLabel(season: string): string {
  const [year = "2026"] = season.split("/");
  return `${year}-08-01`;
}

export function buildEndOfSeasonReport(state: GameState): SeasonReport | null {
  if (state?.seasonReport) return state.seasonReport;
  if (!state?.time || !state.currentClub) return null;

  const season = String(state.time.season ?? "");
  if (!season || !isSeasonComplete(state)) return null;

  const club = state.currentClub;
  const leagueId = club.leagueId;
  const table = leagueId ? computeLeagueTable(state, leagueId) : [];
  const clubRow = table.find((row) => row.clubId === club.id);
  const playerIds = club.playerIds ?? [];
  const players = playerIds
    .map((id) => state.players[id])
    .filter((player): player is NonNullable<GameState["players"][string]> => Boolean(player));
  const starters = players.filter((player) => player.starter).length;
  const avgRating =
    players.length > 0
      ? Math.round(players.reduce((sum, player) => sum + (player.overall ?? 0), 0) / players.length)
      : 0;
  const rankedPlayers = [...players].sort((a, b) => {
    const score = (player: (typeof players)[number]) =>
      (player.seasonGoals ?? 0) * 4 +
      (player.seasonAssists ?? 0) * 3 +
      (player.playingTime?.startsThisSeason ?? 0) * 0.5 +
      (player.lastMatchRating ?? 0) * 2;
    return (
      score(b) - score(a) || (b.seasonGoals ?? 0) - (a.seasonGoals ?? 0) || a.id.localeCompare(b.id)
    );
  });
  const topPerformerPlayer = rankedPlayers[0];
  const topScorerPlayer = [...players].sort(
    (a, b) => (b.seasonGoals ?? 0) - (a.seasonGoals ?? 0) || a.id.localeCompare(b.id),
  )[0];
  const topAssistsPlayer = [...players].sort(
    (a, b) => (b.seasonAssists ?? 0) - (a.seasonAssists ?? 0) || a.id.localeCompare(b.id),
  )[0];

  const seasonStart = seasonStartForLabel(season);
  const seasonEvents = (state.events ?? []).filter(
    (event) => event.date.slice(0, 10) >= seasonStart && event.date.slice(0, 10) <= state.time.date,
  );
  const transferEvents = seasonEvents.filter((event) => event.type === "TRANSFER_COMPLETED");
  const arrivals = transferEvents.filter((event) => event.meta?.["toClubId"] === club.id).length;
  const departures = transferEvents.filter(
    (event) => event.meta?.["fromClubId"] === club.id,
  ).length;
  const transferCount = arrivals + departures;
  const transferAgreed = (state.transfers ?? []).filter(
    (transfer) => transfer.status === "agreed",
  ).length;
  const transferInterested = (state.transfers ?? []).filter(
    (transfer) => transfer.status === "interested",
  ).length;
  const transferRejected = (state.transfers ?? []).filter(
    (transfer) => transfer.status === "rejected",
  ).length;

  const seasonTransactions = (state.financialTransactions ?? []).filter(
    (transaction) => transaction.date >= seasonStart && transaction.date <= state.time.date,
  );
  const revenue = seasonTransactions
    .filter((transaction) => transaction.category === "revenue")
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0);
  const expenses = seasonTransactions
    .filter((transaction) => transaction.category === "expense")
    .reduce((sum, transaction) => sum + Math.abs(Math.min(0, transaction.amount)), 0);
  const transferIncome = seasonTransactions
    .filter((transaction) => transaction.type === "transfer_sell")
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0);
  const transferSpending = seasonTransactions
    .filter((transaction) => transaction.type === "transfer_fee")
    .reduce((sum, transaction) => sum + Math.abs(Math.min(0, transaction.amount)), 0);
  const wages = seasonTransactions
    .filter(
      (transaction) => transaction.type === "player_salary" || transaction.type === "staff_wages",
    )
    .reduce((sum, transaction) => sum + Math.abs(Math.min(0, transaction.amount)), 0);
  const matchdayIncome = seasonTransactions
    .filter((transaction) => transaction.type === "match_revenue")
    .reduce((sum, transaction) => sum + Math.max(0, transaction.amount), 0);
  const otherRevenue = Math.max(0, revenue - transferIncome - matchdayIncome);
  const balance = Number.parseFloat(String(state.finances?.balance ?? 0)) || 0;
  const transferBudget = parseMoneyAmount(state.finances?.transferBudget);
  const wageBudget = parseMoneyAmount(state.finances?.wageBudget);
  const financeStatus = balance >= 0 ? "strong" : balance >= -5_000_000 ? "stable" : "strained";

  const seasonTier = determineSeasonTierForManager(state);
  const managerReview = applySeasonPerformance(state.manager, seasonTier);

  const competitions = (state.competitions ?? []).map((competition) => {
    const competitionTable =
      competition.type === "league" ? computeLeagueTable(state, competition.id) : [];
    const standing = competitionTable.findIndex((row) => row.clubId === club.id) + 1;
    return {
      competitionId: competition.id,
      name: competition.name,
      type: competition.type,
      status: competition.status,
      ...(competition.type === "league" && standing > 0 ? { standing } : {}),
    };
  });

  const highlights: string[] = [];
  if (clubRow && clubRow.position <= 3) {
    highlights.push(
      `Finished ${clubRow.position}${clubRow.position === 1 ? "st" : clubRow.position === 2 ? "nd" : "rd"} in ${state.leagues[leagueId]?.name ?? "the league"}.`,
    );
  }
  if (clubRow && clubRow.wins > 0) {
    highlights.push(`Won ${clubRow.wins} matches and scored ${clubRow.goalsFor} goals.`);
  }
  if (transferAgreed > 0) {
    highlights.push(`Completed ${transferAgreed} transfer moves during the window.`);
  }
  if (clubRow && clubRow.goalDifference > 0) {
    highlights.push(`Goal difference finished at +${clubRow.goalDifference}.`);
  }
  if (highlights.length === 0) {
    highlights.push(
      `The campaign ended with ${clubRow?.points ?? 0} points and a finish of ${clubRow?.position ?? "-"}.`,
    );
  }

  return {
    season,
    generatedAt: state.time.date,
    clubName: club.name,
    managerName: state.manager?.name ?? "Manager",
    tier: seasonTier,
    overview: {
      ...(clubRow?.position !== undefined ? { leaguePosition: clubRow.position } : {}),
      ...(state.leagues[leagueId]?.name ? { leagueName: state.leagues[leagueId].name } : {}),
      totalMatches: clubRow?.played ?? 0,
      wins: clubRow?.wins ?? 0,
      draws: clubRow?.draws ?? 0,
      losses: clubRow?.losses ?? 0,
      points: clubRow?.points ?? 0,
      goalsFor: clubRow?.goalsFor ?? 0,
      goalsAgainst: clubRow?.goalsAgainst ?? 0,
      goalDifference: clubRow?.goalDifference ?? 0,
    },
    competitions: competitions.filter((competition) => {
      if (competition.type !== "league") return true;
      return (state.fixtures ?? []).some(
        (fixture) =>
          fixture.competitionId === competition.competitionId && fixture.season === season,
      );
    }),
    squad: {
      players: players.length,
      starters,
      averageRating: avgRating,
      youthPlayers: players.filter((player) => Number(player.age ?? 0) <= 21).length,
      ...(topPerformerPlayer?.name ? { topPerformer: topPerformerPlayer.name } : {}),
      ...(topScorerPlayer && (topScorerPlayer.seasonGoals ?? 0) > 0
        ? { topScorer: { name: topScorerPlayer.name, goals: topScorerPlayer.seasonGoals ?? 0 } }
        : {}),
      ...(topAssistsPlayer && (topAssistsPlayer.seasonAssists ?? 0) > 0
        ? {
            topAssists: {
              name: topAssistsPlayer.name,
              assists: topAssistsPlayer.seasonAssists ?? 0,
            },
          }
        : {}),
    },
    transfers: {
      total: transferCount,
      agreed: transferAgreed,
      interested: transferInterested,
      rejected: transferRejected,
      arrivals,
      departures,
      spending: transferSpending,
      income: transferIncome,
    },
    finances: {
      balance: Math.round(balance),
      revenue,
      expenses,
      transferIncome,
      transferSpending,
      wages,
      matchdayIncome,
      otherRevenue,
      netResult: revenue - expenses,
      transferBudget,
      wageBudget,
      status: financeStatus,
    },
    manager: {
      tier: seasonTier,
      creditDelta: managerReview.creditDelta,
      creditAfter: managerReview.creditAfter,
      reputationDelta: managerReview.reputationDelta,
      reputationAfter: managerReview.reputationAfter,
      boardConfidence: managerReview.boardConfidenceAfter,
    },
    highlights,
  };
}

function determineSeasonTierForManager(state: GameState): SeasonPerformanceTier {
  const clubId = state.currentClub?.id ?? state.manager?.clubId;
  if (!clubId) return "expected";
  const leagueId = state.clubs[clubId]?.leagueId ?? state.currentClub?.leagueId;
  if (!leagueId) return "expected";
  const table = computeLeagueTable(state, leagueId);
  const position = table.findIndex((row) => row.clubId === clubId) + 1;
  const total = table.length;
  if (!total) return "expected";
  if (position <= 1) return "great";
  if (position <= 3) return "good";
  if (position >= total - 2) return "terrible";
  if (position >= Math.max(4, Math.ceil(total * 0.6))) return "bad";
  return "expected";
}

export function finalizeSeasonIfNeeded(state: GameState): GameState {
  if (!isSeasonComplete(state)) return state;

  const { seasonReport: _previousSeasonReport, ...stateWithoutSeasonReport } = state;
  const report = buildEndOfSeasonReport(stateWithoutSeasonReport);

  // Guard: prevent duplicate finalization for the same date.
  const currentSeason = String(state.time.season);
  const currentDate = state.time.date;
  const lastFinalizedSeason = state.meta?.lastSeasonFinalizedSeason;
  const lastFinalizedDate = state.meta?.lastSeasonFinalizedDate;
  if (lastFinalizedSeason === currentSeason && lastFinalizedDate === currentDate) {
    return state;
  }

  // CRITICAL: Use the version that does NOT change the calendar date.
  // The calendar has already advanced correctly to today. We only update
  // season metadata. The calendar will continue advancing naturally.
  let next = applyWorldSeasonProgressionWithoutDateChange(state);

  const seasonTier = determineSeasonTierForManager(state);
  const seasonReview = applySeasonPerformance(state.manager, seasonTier);
  const clubName = state.currentClub?.name ?? "Your club";

  const { seasonReport: _oldReport, ...nextWithoutReport } = next;
  next = {
    ...nextWithoutReport,
    time: {
      ...next.time,
      // Keep the existing calendar anchor through the off-season. The anchor
      // is advanced naturally by initializeSeasonFixturesIfNeeded on August 1.
      seasonStartDate: state.time.seasonStartDate,
    },
    manager: {
      ...state.manager,
      credit: seasonReview.creditAfter,
      reputation: seasonReview.reputationAfter,
      experience: (state.manager?.experience ?? 0) + 1,
      boardConfidence: seasonReview.boardConfidenceAfter,
    },
    careerHistory: [
      ...(state.careerHistory ?? []),
      {
        id: `career-season-${currentSeason}-${(state.careerHistory?.length ?? 0) + 1}`,
        season: String(currentSeason),
        clubId: state.currentClub?.id ?? state.manager?.clubId,
        summary: describeSeasonReview(clubName, seasonReview),
        seasonReview: {
          tier: seasonReview.tier,
          creditDelta: seasonReview.creditDelta,
          creditAfter: seasonReview.creditAfter,
          reputationDelta: seasonReview.reputationDelta,
          reputationAfter: seasonReview.reputationAfter,
        },
      },
    ],
    fixtures: (next.fixtures ?? []).filter(
      (fixture) => (fixture.season ?? next.time.season) !== currentSeason,
    ),
    leagues: Object.fromEntries(
      Object.entries(next.leagues ?? {}).map(([id, league]) => [
        id,
        { ...league, season: String(next.time.season) },
      ]),
    ),
    meta: {
      ...(next.meta ?? {}),
      lastFinalizedSeason: currentSeason,
      lastFinalizedDate: currentDate,
      lastSeasonFinalizedSeason: currentSeason,
      lastSeasonFinalizedDate: currentDate,
    },
    ...(report ? { seasonReport: report } : {}),
    ...(report && !(next.seasonReports ?? []).some((item) => item.season === report.season)
      ? { seasonReports: [...(next.seasonReports ?? []), report] }
      : next.seasonReports
        ? { seasonReports: next.seasonReports }
        : {}),
  };

  // OPTIMIZATION: Archive world history records older than 5 seasons to prevent unbounded growth
  next = archiveOldWorldHistory(next);

  return next;
}

export function simulateSeason(state: GameState): GameState {
  let next = generateLeagueFixtures(state);

  // preseason: run transfer window (enhanced)
  next = runEnhancedTransferWindow(next);

  next = runDomesticCup(next);

  let seasonLoopIterations = 0;
  const maxSeasonIterations = 500;
  while (seasonLoopIterations < maxSeasonIterations) {
    seasonLoopIterations += 1;
    const scheduledFixtures = (next.fixtures ?? []).filter(
      (fixture) => fixture.status === "scheduled",
    );
    if (scheduledFixtures.length > 0) {
      next = simulateScheduledFixturesViaEngine(next);
      continue;
    }

    const nextCup = runDomesticCup(next);
    if (nextCup === next) {
      break;
    }
    next = nextCup;
  }
  if (seasonLoopIterations >= maxSeasonIterations) {
    console.warn(`[Season] Regular season loop hit iteration limit (${maxSeasonIterations})`);
  }

  const events = [...(next.events ?? [])];
  for (const leagueId of Object.keys(next.leagues)) {
    const league = next.leagues[leagueId];
    if (!league) continue;
    const table = computeLeagueTable(next, leagueId);
    if (table.length === 0) continue;
    const champion = table[0];
    if (!champion) continue;
    events.push({
      id: `event-champ-${events.length + 1}`,
      date: next.time.date,
      type: "milestone",
      description: `Champion of ${league.name}: ${champion.clubId}`,
    });
  }

  next = { ...next, events };

  next = runSeasonalPlayerLifecycle(next);
  next = runSeasonalYouthGeneration(next);
  next = {
    ...next,
    events: [
      ...(next.events ?? []),
      {
        id: `event-season-review-1`,
        date: next.time.date,
        type: "milestone",
        description: `Season reviews complete`,
      },
    ],
  };
  next = applyEuropeanQualificationRegistrations(next);
  next = runEuropeanCompetitions(next);

  // Simulate European competitions with iteration limit to prevent infinite loops
  let europeanLoopIterations = 0;
  const maxEuropeanIterations = 1000;
  while (
    (next.fixtures ?? []).some((fixture) => fixture.status === "scheduled") &&
    europeanLoopIterations < maxEuropeanIterations
  ) {
    europeanLoopIterations += 1;
    const prevFixtureCount = next.fixtures.filter((f) => f.status === "scheduled").length;
    next = simulateScheduledFixturesViaEngine(next);
    next = runEuropeanCompetitions(next);
    const newFixtureCount = next.fixtures.filter((f) => f.status === "scheduled").length;

    // Safety: if we've made many iterations and still have scheduled fixtures, break
    // to avoid infinite loop
    if (europeanLoopIterations > 100 && newFixtureCount >= prevFixtureCount) {
      console.warn(
        `[Season] European competition loop stalled after ${europeanLoopIterations} iterations with ${newFixtureCount} scheduled fixtures remaining`,
      );
      break;
    }
  }

  next = applyPromotionRelegation(next);
  next = generateSeasonAwards(next);

  // long-term world evolution: reputation, facilities, retirements, manager churn
  next = applyLongTermEvolution(next);

  // FIX (fixture lifecycle): prune completed/previous-season fixtures so they
  // don't accumulate across seasons. Mirrors finalizeSeasonIfNeeded()'s safe
  // pruning, but keeps the current season's fixtures (including any cup /
  // european fixtures still scheduled) available for downstream processing.
  const previousSeason = state.time.season;
  next = {
    ...next,
    fixtures: (next.fixtures ?? []).filter((fixture) => {
      const fixtureSeason = fixture.season ?? previousSeason;
      return fixtureSeason !== previousSeason;
    }),
  };

  return next;
}

export function simulateSeasonQuick(state: GameState): GameState {
  let next = { ...state } as GameState;

  // run a quick transfer window
  next = runEnhancedTransferWindow(next);

  // For each league, build a deterministic table without simulating matches
  const events = [...(next.events ?? [])];
  for (const leagueId of Object.keys(next.leagues)) {
    const league = next.leagues[leagueId];
    if (!league) continue;
    const clubs = Object.values(next.clubs).filter((c) => c.leagueId === leagueId);
    if (clubs.length === 0) continue;
    // deterministic score per club
    const scores = clubs.map((c) => ({
      id: c.id,
      score: seededUnit(`${leagueId}:${next.time.season}:${c.id}`),
    }));
    scores.sort((a, b) => b.score - a.score);
    const champion = scores[0];
    if (!champion) continue;
    events.push({
      id: `event-champ-${events.length + 1}`,
      date: next.time.date,
      type: "milestone",
      description: `Champion of ${league.name}: ${champion.id}`,
    });
  }

  next = { ...next, events };

  next = runSeasonalPlayerLifecycle(next);
  next = runSeasonalYouthGeneration(next);
  next = {
    ...next,
    events: [
      ...(next.events ?? []),
      {
        id: `event-season-review-quick`,
        date: next.time.date,
        type: "milestone",
        description: `Quick season reviews complete`,
      },
    ],
  };

  next = applyEuropeanQualificationRegistrations(next);
  // skip full European competitions in quick mode

  next = applyPromotionRelegation(next);
  next = generateSeasonAwards(next);

  for (const leagueId of Object.keys(next.leagues ?? {})) {
    const league = next.leagues[leagueId];
    if (!league) continue;
    const table = computeLeagueTable(next, leagueId);
    const champion = table[0];
    if (champion)
      next = recordSeasonChampion(next, champion.clubId, league.name, String(next.time.season));
  }

  next = applyLongTermEvolution(next);
  next = applyWorldHistoryInvariants(next);

  // CRITICAL: Advance to next season
  next = applyWorldSeasonProgression(next);
  const previousSeason = state.time.season;
  next = {
    ...next,
    fixtures: (next.fixtures ?? []).filter((fixture) => {
      const fixtureSeason = fixture.season ?? previousSeason;
      return fixtureSeason !== previousSeason;
    }),
    leagues: Object.fromEntries(
      Object.entries(next.leagues).map(([id, league]) => [
        id,
        { ...league, season: String(next.time.season) },
      ]),
    ),
  };

  // Generate new season fixtures
  next = generateLeagueFixtures(next);

  return next;
}
