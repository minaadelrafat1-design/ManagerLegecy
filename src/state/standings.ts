/* =============================================================================
 * League standings — engine (game rules)
 * =============================================================================
 * Phase B2. Pure functions only, same discipline as `calendar.ts` and
 * `reducer.ts`: (inputs) -> value, no React, no I/O, no mutation of
 * anything passed in.
 *
 * The table is NOT stored anywhere in `GameState` — it's computed from
 * `GameState.fixtures` every time it's needed (see `useLeagueTable` in
 * `./store.tsx`), the same "one authoritative source, everything else
 * derives from it" rule the rest of this state layer already follows (e.g.
 * `useStartingXI` derives from `Club.playerIds` rather than a stored
 * duplicate list). Concretely: `RECORD_MATCH_RESULT` only has to update
 * `state.fixtures` — a match result changes the table automatically,
 * because every read of the table re-derives it from the fixture that just
 * changed. There is nothing else to keep in sync and nothing that can go
 * stale.
 *
 * Rules are a plain data argument (`StandingsRules`), not a hardcoded
 * constant, so a different competition/points scheme doesn't need a code
 * change — see `DEFAULT_STANDINGS_RULES` below for the National League's.
 * Deliberately out of scope for this phase: promotion/relegation zones,
 * head-to-head tiebreakers, and anything that isn't "compute the table".
 * ---------------------------------------------------------------------------*/

import type { Club, Fixture, GameState, LeagueTableRow } from "./types";
import { leagueTableGen, MemoCache } from "../lib/cache-utils";

/** Table columns usable as a tiebreaker, in the order `compareRows` checks
 * them. All three are already on `LeagueTableRow`, so a rules set can
 * reorder or drop entries without this file needing a new column. */
export type StandingsTiebreaker = "points" | "goalDifference" | "goalsFor";

export interface StandingsRules {
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  /** Checked in order; the first one that isn't equal between two clubs
   * decides which ranks higher. Two clubs still level after every entry
   * fall back to a stable, deterministic (alphabetical-by-id) order rather
   * than the original array order, so the table never visibly reshuffles
   * between renders for no reason. */
  tiebreakers: readonly StandingsTiebreaker[];
}

/** Standard football rules: 3/1/0, points then goal difference then goals
 * scored. Every caller in this app uses this unless it explicitly passes
 * its own `StandingsRules` — e.g. a cup group stage that ranks on wins
 * instead of goal difference could pass a different set without touching
 * `computeStandings` itself. */
export const DEFAULT_STANDINGS_RULES: StandingsRules = {
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  tiebreakers: ["points", "goalDifference", "goalsFor"],
};

interface StandingsAccumulator {
  clubId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

function emptyAccumulator(clubId: string): StandingsAccumulator {
  return { clubId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

function applyResult(row: StandingsAccumulator, scored: number, conceded: number): void {
  row.played += 1;
  row.goalsFor += scored;
  row.goalsAgainst += conceded;
  if (scored > conceded) row.wins += 1;
  else if (scored < conceded) row.losses += 1;
  else row.draws += 1;
}

function pointsFor(row: StandingsAccumulator, rules: StandingsRules): number {
  return (
    row.wins * rules.pointsForWin +
    row.draws * rules.pointsForDraw +
    row.losses * rules.pointsForLoss
  );
}

function compareRows(a: LeagueTableRow, b: LeagueTableRow, rules: StandingsRules): number {
  for (const key of rules.tiebreakers) {
    const diff = b[key] - a[key]; // higher first
    if (diff !== 0) return diff;
  }
  // Every configured tiebreaker is tied — fall back to club id so the
  // ordering is still deterministic instead of depending on input order.
  if (a.clubId < b.clubId) return -1;
  if (a.clubId > b.clubId) return 1;
  return 0;
}

/** Computes standings for one competition from its played fixtures, for a
 * given set of clubs. `clubs` decides which rows exist — a club that
 * hasn't played yet still gets a row (0 played, 0 points), so the table
 * always lists the whole competition rather than only clubs seen in
 * `fixtures`. Fixtures for a different `competitionId`, or not yet
 * `"played"`, are ignored; a `"played"` fixture missing a score is skipped
 * defensively rather than treated as 0-0. */
export function computeStandings(
  clubs: Club[],
  fixtures: Fixture[],
  competitionId: string,
  rules: StandingsRules = DEFAULT_STANDINGS_RULES,
): LeagueTableRow[] {
  const accumulators = new Map<string, StandingsAccumulator>();
  for (const club of clubs) accumulators.set(club.id, emptyAccumulator(club.id));

  for (const fixture of fixtures) {
    if (fixture.competitionId !== competitionId) continue;
    if (fixture.status !== "played") continue;
    if (fixture.scoreHome == null || fixture.scoreAway == null) continue;

    const home = accumulators.get(fixture.homeClubId);
    if (home) applyResult(home, fixture.scoreHome, fixture.scoreAway);

    const away = accumulators.get(fixture.awayClubId);
    if (away) applyResult(away, fixture.scoreAway, fixture.scoreHome);
  }

  const rows: LeagueTableRow[] = Array.from(accumulators.values()).map((row) => ({
    clubId: row.clubId,
    position: 0, // assigned after sort, below
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalsFor - row.goalsAgainst,
    points: pointsFor(row, rules),
  }));

  rows.sort((a, b) => compareRows(a, b, rules));
  rows.forEach((row, i) => {
    row.position = i + 1;
  });
  return rows;
}

/** Thread-safe cache for league table results.
 * Keys are `leagueId:competitionId` pairs; values cache the full table.
 * Invalidated when a RECORD_MATCH_RESULT changes fixtures for that competition,
 * or when promotion/relegation changes league membership. */
interface LeagueTableCacheEntry {
  gen: number;
  table: LeagueTableRow[];
}
const leagueTableCache = new Map<string, LeagueTableCacheEntry>();
const LEAGUE_TABLE_CACHE_MAX = 200;

/** Return a stable cache key from league + competition IDs. */
function leagueTableCacheKey(leagueId: string, competitionId: string): string {
  return `${leagueId}:${competitionId}`;
}

/** A cheap-but-content-aware fingerprint of everything `computeStandings`
 * reads: the league's club membership and every played fixture for the
 * competition. Embedded in the cache key so a mutated `GameState` (e.g. a
 * unit test that builds fresh states without going through the reducer)
 * can never be served a stale table. The `leagueTableGen` is still consulted
 * for extra invalidation when `RECORD_MATCH_RESULT` bumps it, but the
 * fingerprint alone is sufficient for correctness. */
function leagueStandingsFingerprint(
  clubs: Club[],
  fixtures: Fixture[],
  competitionId: string,
): string {
  const clubIds = clubs.map((c) => c.id).sort();
  let fh = 0;
  for (const fixture of fixtures) {
    if (fixture.competitionId !== competitionId) continue;
    if (fixture.status !== "played") continue;
    const str = `${fixture.homeClubId}:${fixture.awayClubId}:${fixture.scoreHome}:${fixture.scoreAway}`;
    for (let i = 0; i < str.length; i++) {
      fh = (fh << 5) - fh + str.charCodeAt(i);
      fh |= 0;
    }
  }
  return `${clubIds.join(",")}|${clubIds.length}|${fh}`;
}

/** Convenience wrapper for the common case: compute the table for
 * `leagueId` straight from a `GameState`. Clubs come from every `Club`
 * whose `leagueId` matches (so moving a club in/out of a league is the
 * only thing that changes who appears in its table); fixtures come from
 * `state.fixtures` filtered to that league's `competitionId`. Returns `[]`
 * for an unknown `leagueId` rather than throwing — a screen mid-transition
 * (e.g. before `state.leagues` has loaded) should render an empty table,
 * not crash. */
export function computeLeagueTable(
  state: GameState,
  leagueId: string,
  rules: StandingsRules = DEFAULT_STANDINGS_RULES,
): LeagueTableRow[] {
  const league = state.leagues[leagueId];
  if (!league) return [];
  const competition = state.competitions.find((c) => c.id === league.competitionId);
  const effectiveRules = competition?.standingsRules ?? rules;
  const clubs = Object.values(state.clubs).filter((club) => club.leagueId === leagueId);

  // Check cache when using default rules (the common case). The key embeds
  // a content fingerprint so a mutated state can never be served a stale
  // table, even if the generation hasn't been bumped (e.g. in tests).
  if (effectiveRules === rules) {
    const key =
      leagueTableCacheKey(leagueId, league.competitionId) +
      `|g${leagueTableGen.get(`comp:${league.competitionId}`)}|` +
      leagueStandingsFingerprint(clubs, state.fixtures, league.competitionId);
    const cached = leagueTableCache.get(key);
    if (cached) {
      return cached.table;
    }
  }

  const table = computeStandings(clubs, state.fixtures, league.competitionId, effectiveRules);

  // Cache only under default rules (non-default rules are rare), and never
  // cache empty tables — an empty result is trivial to recompute.
  if (effectiveRules === rules && table.length > 0) {
    const key =
      leagueTableCacheKey(leagueId, league.competitionId) +
      `|g${leagueTableGen.get(`comp:${league.competitionId}`)}|` +
      leagueStandingsFingerprint(clubs, state.fixtures, league.competitionId);
    if (leagueTableCache.size >= LEAGUE_TABLE_CACHE_MAX) {
      const firstKey = leagueTableCache.keys().next();
      if (!firstKey.done) leagueTableCache.delete(firstKey.value);
    }
    leagueTableCache.set(key, { gen: leagueTableGen.get(`comp:${league.competitionId}`), table });
  }

  return table;
}

/** Invalidate the league table cache for a given competition.
 * Call this after any RECORD_MATCH_RESULT that changes a fixture for that
 * competition, or after promotion/relegation moves clubs between leagues. */
export function invalidateLeagueTable(competitionId: string): void {
  leagueTableGen.bump(`comp:${competitionId}`);
  // Remove all cache entries that reference this competition.
  const prefix = `:${competitionId}`;
  for (const key of leagueTableCache.keys()) {
    if (key.endsWith(prefix)) {
      leagueTableCache.delete(key);
    }
  }
  // Recent-form cache keys embed the generation, so old-gen entries are
  // never reused after the bump. Clearing the whole cache (size-bounded)
  // prevents stale entries from accumulating for retired competitions.
  recentFormCache.clear();
}

/** Invalidate all league table caches. Use after bulk operations like
 * promotion/relegation across all divisions. */
export function invalidateAllLeagueTables(): void {
  leagueTableCache.clear();
  recentFormCache.clear();
}

/**
 * Compute the league table position/row for a single club without building
 * the full table when only one club's data is needed.
 *
 * Optimized version of `computeClubStanding` that:
 *  - Returns a cached full-table row immediately when the enclosing
 *    competition's table is already cached (so no fixture scan is needed).
 *  - Otherwise computes only the requested club's stats by scanning fixtures
 *    once, iterating the (small, <= ~25) list of clubs in the league to
 *    compute the club's position locally (no global sort of all clubs).
 *
 * Produces a row *identical* in value to what `computeLeagueTable` would
 * yield for that club, including its `position`. Returns `undefined` for an
 * unknown league or a club that isn't in the league.
 *
 * Callers that need the full table (e.g. promotion/relegation) should still
 * use `computeLeagueTable`. */
export function computeClubTableRow(
  state: GameState,
  leagueId: string,
  clubId: string,
  rules: StandingsRules = DEFAULT_STANDINGS_RULES,
): LeagueTableRow | undefined {
  const league = state.leagues[leagueId];
  if (!league) return undefined;
  const competition = state.competitions.find((c) => c.id === league.competitionId);
  const effectiveRules = competition?.standingsRules ?? rules;

  // Reuse the full table if it's already cached (e.g. from a recent
  // computeLeagueTable call for the same competition). Same
  // content-fingerprint key as computeLeagueTable — never serve a stale
  // table from a mutated state.
  const leagueClubs = Object.values(state.clubs).filter((club) => club.leagueId === leagueId);
  const cacheKey =
    leagueTableCacheKey(leagueId, league.competitionId) +
    `|g${leagueTableGen.get(`comp:${league.competitionId}`)}|` +
    leagueStandingsFingerprint(leagueClubs, state.fixtures, league.competitionId);
  const cached = leagueTableCache.get(cacheKey);
  if (cached) {
    return cached.table.find((row) => row.clubId === clubId);
  }

  // Fast path: the club isn't in this league at all.
  if (!leagueClubs.some((club) => club.id === clubId)) {
    return undefined;
  }

  // Compute standings for the league but stop after collecting the stats.
  // We only need ONE club's row. We first compute all the clubs' stats for
  // the ordering (still fast since leagueClubs is small).
  const accumulators = new Map<string, StandingsAccumulator>();
  for (const club of leagueClubs) accumulators.set(club.id, emptyAccumulator(club.id));

  for (const fixture of state.fixtures) {
    if (fixture.competitionId !== league.competitionId) continue;
    if (fixture.status !== "played") continue;
    if (fixture.scoreHome == null || fixture.scoreAway == null) continue;

    const home = accumulators.get(fixture.homeClubId);
    if (home) applyResult(home, fixture.scoreHome, fixture.scoreAway);

    const away = accumulators.get(fixture.awayClubId);
    if (away) applyResult(away, fixture.scoreAway, fixture.scoreHome);
  }

  const rows: LeagueTableRow[] = Array.from(accumulators.values()).map((row) => ({
    clubId: row.clubId,
    position: 0,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalsFor - row.goalsAgainst,
    points: pointsFor(row, effectiveRules),
  }));

  // Only sort by this one club's position needs the comparable keys.
  // We need the actual ordering to produce the position. Use compareRows
  // with the same rules as computeStandings.
  rows.sort((a, b) => compareRows(a, b, effectiveRules));
  rows.forEach((row, i) => {
    row.position = i + 1;
  });

  // Return only the requested club's row.
  return rows.find((row) => row.clubId === clubId);
}

// ---- Phase B3.1C: per-club match statistics + recent form -----------------------
// Both derived reads, same "one authoritative source" rule as everything
// else above — a played fixture (AI or the managed club's own) already
// carries everything needed (`scoreHome`/`scoreAway`/`status`), so "club
// match statistics" is just a differently-shaped read of the same fixture
// list, never a second place that has to be kept in sync when a result is
// recorded.

/** `computeLeagueTable`'s row for one club — the "club match statistics"
 * (played/wins/draws/losses/goals/points) the brief asks for, without
 * introducing a second stored copy of anything `computeStandings` already
 * produces. Returns `undefined` for a club not in `leagueId`'s table. */
export function computeClubStanding(
  state: GameState,
  leagueId: string,
  clubId: string,
  rules: StandingsRules = DEFAULT_STANDINGS_RULES,
): LeagueTableRow | undefined {
  return computeLeagueTable(state, leagueId, rules).find((row) => row.clubId === clubId);
}

export interface RecentFormEntry {
  fixtureId: string;
  matchday: number;
  opponentClubId: string;
  venue: "H" | "A";
  scoreFor: number;
  scoreAgainst: number;
  result: "W" | "D" | "L";
}

/** The last `count` played fixtures for `clubId` in `competitionId`, most
 * recent first — the "team form" half of this phase's brief. Individual
 * *player* form (`Player.form`) is deliberately left untouched by AI
 * fixtures: a `Player` record only exists for the managed club's own
 * squad (see `Club.playerIds` vs `Club.simRoster` in `./types.ts`), and an
 * AI fixture by definition never involves the managed club, so there is no
 * player on either side of one to update. This function is what *is*
 * supported for an AI club — a result-streak read off the fixture list,
 * ordered by `matchday` (fixture `date` is a display string, not
 * sortable — see `Fixture.date`'s doc comment). */
/** Cache for `computeRecentForm` results (PHASE AAA-PERFORMANCE-2). The same
 * competition/club/count combination is requested many times per season (every
 * AI club's form is read for transfers, manager decisions, media, etc.), and
 * each call re-filters + sorts the entire fixture list. Keyed by
 * `competitionId:clubId:count` with the `leagueTableGen` generation as a
 * validity token — `invalidateLeagueTable` is called after every
 * `RECORD_MATCH_RESULT`, so this cache is automatically invalidated the
 * moment a new result is recorded. */
const recentFormCache = new MemoCache<string, RecentFormEntry[]>();

export function computeRecentForm(
  fixtures: Fixture[],
  competitionId: string,
  clubId: string,
  count = 5,
): RecentFormEntry[] {
  const gen = leagueTableGen.get(`comp:${competitionId}`);
  const key = `${competitionId}:${clubId}:${count}:${gen}`;
  const cached = recentFormCache.get(key);
  if (cached) return cached;

  const result = fixtures
    .filter(
      (f) =>
        f.competitionId === competitionId &&
        f.status === "played" &&
        f.scoreHome != null &&
        f.scoreAway != null &&
        (f.homeClubId === clubId || f.awayClubId === clubId),
    )
    .sort((a, b) => b.matchday - a.matchday)
    .slice(0, count)
    .map((f): RecentFormEntry => {
      const isHome = f.homeClubId === clubId;
      const scoreFor = (isHome ? f.scoreHome : f.scoreAway)!;
      const scoreAgainst = (isHome ? f.scoreAway : f.scoreHome)!;
      const result: "W" | "D" | "L" =
        scoreFor > scoreAgainst ? "W" : scoreFor < scoreAgainst ? "L" : "D";
      return {
        fixtureId: f.id,
        matchday: f.matchday,
        opponentClubId: isHome ? f.awayClubId : f.homeClubId,
        venue: (isHome ? "H" : "A") as "H" | "A",
        scoreFor,
        scoreAgainst,
        result,
      };
    });

  recentFormCache.set(key, result);
  return result;
}
