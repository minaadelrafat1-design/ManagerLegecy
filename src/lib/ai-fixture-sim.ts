/* =============================================================================
 * AI fixture simulator (Phase B3.1A)
 * =============================================================================
 * Pure functions only, same discipline as `state/standings.ts` and
 * `state/calendar.ts`: (inputs) -> value, no React, no I/O, no mutation of
 * anything passed in. This is deliberately NOT `lib/match-engine.ts` — the
 * managed club's own matches keep going through the full minute-by-minute
 * engine untouched. This module exists only for fixtures the managed club
 * is not part of, where a full simulation would be wasted work: two clubs'
 * relative strength go in, a scoreline and W/D/L outcome come out.
 *
 * Scope (Phase B3.1A):
 *  - Read the two clubs (and, where available, their rosters) from
 *    `GameState`.
 *  - Turn that into a single "team strength" number per club.
 *  - Weight a home/draw/away outcome by the strength gap (plus a small home
 *    advantage), using a seeded RNG so a stronger side wins *more often*,
 *    never *always*.
 *  - Generate a scoreline consistent with that outcome and with each side's
 *    attacking strength, instead of picking two independent random digits.
 *  - Hand back a result shaped exactly like `RECORD_MATCH_RESULT` expects,
 *    so storing it against the fixture reuses the existing reducer action
 *    rather than adding a second code path that writes to `state.fixtures`.
 *
 * Explicitly NOT here (later phases): promotion/relegation, AI transfers,
 * advanced AI tactics, or wiring into `state/calendar.ts`'s `fixtures` daily
 * hook — see the note above `simulateScheduledAiFixtures` below for why.
 *
 * Phase B3.1B.1 update: this module's own scoreline generator
 * (`pickOutcome`/`expectedGoals`/`scoreForOutcome` below) is no longer what
 * actually resolves an AI fixture — `lib/ai-match-adapter.ts`'s
 * `simulateAiFixtureViaEngine` now does that by calling
 * `lib/match-engine.ts`'s real `simulateMatch`, and is the path
 * `simulateScheduledAiFixturesViaEngine`/`simulateAndApplyScheduledAiFixturesViaEngine`
 * use. `calculateClubStrength`, `isAiFixture`, `seedFromFixtureId` and
 * `toRecordMatchResultAction` are all still reused as-is by that module.
 * The functions below are kept, unchanged and still tested
 * (`scripts/test-ai-fixtures.ts`), as the lightweight strength-only
 * estimate they were designed to be — no caller is wired to them for
 * actually resolving a fixture's result anymore.
 * ---------------------------------------------------------------------------*/

import type { Club, Fixture, GameState, Player } from "@/state/types";
import type { GameAction } from "@/state/reducer";
import { calculateMatchPlayerUpdates, gameReducer } from "@/state/reducer";
import { clubStrengthGen } from "./cache-utils";
import { getLeagueStrengthRating } from "@/state/league-strength";

// ---- RNG ---------------------------------------------------------------------
// Same small seedable PRNG (mulberry32) `lib/match-engine.ts` and
// `state/seed.ts` already use, duplicated locally rather than imported —
// this module stays a leaf the same way those two do, and doesn't reach
// across into the match engine for a number generator.

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic seed from a fixture id, so simulating the same
 * not-yet-played fixture twice (e.g. two daily ticks before it's marked
 * `"played"`) is reproducible without any caller having to manage seed
 * state. FNV-1a, small and dependency-free. */
export function seedFromFixtureId(fixtureId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < fixtureId.length; i++) {
    h ^= fixtureId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

interface Weighted<T> {
  v: T;
  w: number;
}

function weightedPick<T>(rng: () => number, items: Array<Weighted<T>>): T {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.w), 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, item.w);
    if (roll <= 0) return item.v;
  }
  return items[items.length - 1]!.v;
}

/** Samples a small non-negative integer from a Poisson-shaped distribution
 * with the given mean, using `rng()` — controlled randomness rather than a
 * flat `randInt(0, 3)` roll, so a side with a higher expected-goals value
 * actually scores more *on average* while still varying game to game.
 * Capped at 6 (a realistic ceiling for this scale of match) so a very high
 * mean can't run away into an unrealistic scoreline. */
function samplePoissonGoals(rng: () => number, mean: number): number {
  const lambda = Math.max(0.05, mean);
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > l && k < 6);
  return k - 1;
}

// ---- Team strength -------------------------------------------------------------

/** 0-100 team strength for one club. Deliberately modular — three
 * independently-weighted components, each of which degrades gracefully
 * when data isn't available, so a later phase can improve any one input
 * (e.g. give every rival club a real roster) without this function's shape
 * changing:
 *
 *  - `reputation` (the one field every `Club` always has — see
 *    `state/seed.ts`'s `makeMinimalClub`) is the base and dominant signal.
 *  - `facilities` (training/medical/youth/stadium average) nudges it —
 *    minimal rival clubs are seeded flat at 50 across the board, so today
 *    this term mostly matters for the two fully-modelled clubs.
 *  - `roster` (average `overall` of the club's actual players, when any
 *    exist) is the strongest signal where it's available: the managed
 *    club's full squad (`playerIds` -> `players`), or a lightweight
 *    opponent's `simRoster`. Minimal rival clubs have neither, so this term
 *    falls back to `reputation` rather than silently dropping its weight
 *    (which would just hand that weight to `facilities`'s flat 50 and blur
 *    every minimal club toward the same number).
 */
/** Thread-safe cache for club strength results.
 * Keys are club IDs; values are { generation, strength } pairs.
 * The generation is compared against clubStrengthGen to detect staleness.
 * Cleared only when the cache itself grows too large. */
const strengthCache = new Map<string, { gen: number; strength: number }>();
const STRENGTH_CACHE_MAX = 2000;

export function calculateClubStrength(club: Club, players: Record<string, Player>): number {
  const clubId = club.id;
  const cached = strengthCache.get(clubId);
  const currentGen = clubStrengthGen.get(clubId);
  if (cached && cached.gen === currentGen) {
    return cached.strength;
  }

  const reputation = club.reputation;

  const f = club.facilities;
  const facilities = (f.training + f.medical + f.youth + f.stadium) / 4;

  let roster: number | null = null;
  if (club.simRoster && club.simRoster.xi.length > 0) {
    roster = club.simRoster.xi.reduce((sum, p) => sum + p.overall, 0) / club.simRoster.xi.length;
  } else if (club.playerIds.length > 0) {
    const overalls = club.playerIds
      .map((id) => players[id]?.overall)
      .filter((n): n is number => typeof n === "number");
    if (overalls.length > 0) roster = overalls.reduce((sum, n) => sum + n, 0) / overalls.length;
  }

  const baseStrength = reputation * 0.5 + facilities * 0.2 + (roster ?? reputation) * 0.3;
  // League environment is a bounded input to the existing club-strength
  // estimate. It changes the quality context around a club, not the result
  // directly, and reputation/facilities/roster still provide club variation.
  const leagueEnvironment = (getLeagueStrengthRating(club.leagueId) - 50) * 0.2;
  const strength = clamp(Math.round(baseStrength + leagueEnvironment));

  if (strengthCache.size >= STRENGTH_CACHE_MAX) {
    const firstKey = strengthCache.keys().next();
    if (!firstKey.done) strengthCache.delete(firstKey.value);
  }
  strengthCache.set(clubId, { gen: currentGen, strength });

  return strength;
}

/** Invalidate the club strength cache for a single club.
 * Called when reputation, facilities, players, or simRoster changes. */
export function invalidateClubStrength(clubId: string): void {
  clubStrengthGen.bump(clubId);
  strengthCache.delete(clubId);
}

/** Invalidate club strength for all clubs. Use sparingly (e.g. after bulk
 * operations like promotion/relegation or mass transfers). */
export function invalidateAllClubStrengths(): void {
  strengthCache.clear();
}

// ---- Outcome + scoreline ---------------------------------------------------------

// Tuning constants to keep the lightweight estimator aligned with the
// full engine's scale. These can be adjusted if the engine's tuning
// changes.
const HOME_ADVANTAGE = 16; // larger numeric bump applied below (divided by 10 for xG)
const BASE_XG = 0.28; // baseline expected goals per side before strength adjustments

export type FixtureOutcome = "H" | "D" | "A";

export interface AiFixtureResult {
  fixtureId: string;
  homeClubId: string;
  awayClubId: string;
  homeStrength: number;
  awayStrength: number;
  outcome: FixtureOutcome;
  scoreHome: number;
  scoreAway: number;
  seed: number;
  extraTime?: boolean;
  penaltyHome?: number;
  penaltyAway?: number;
}

/** Weighted W/D/L pick. A bigger strength gap makes the stronger side's
 * win more likely, but every weight has a floor — the away side in a
 * 90-vs-40 mismatch still gets a real (if small) chance to win or draw,
 * per the brief's "weaker teams must sometimes win or draw". */
function pickOutcome(
  rng: () => number,
  homeStrength: number,
  awayStrength: number,
): FixtureOutcome {
  const gap = homeStrength + HOME_ADVANTAGE - awayStrength; // roughly -100..100

  const homeWeight = clamp(46 + gap * 2.0, 6, 98);
  const awayWeight = clamp(46 - gap * 2.0, 6, 98);
  // Draw likelihood reduced more sharply on uneven matchups.
  const drawWeight = clamp(18 - Math.abs(gap) * 0.09, 5, 22);

  return weightedPick(rng, [
    { v: "H", w: homeWeight },
    { v: "D", w: drawWeight },
    { v: "A", w: awayWeight },
  ]);
}

/** Expected-goals figure for one side, from its own strength (attacking
 * output scales up with overall strength) and the opponent's (a stronger
 * opponent suppresses it). Kept separate from `pickOutcome` on purpose —
 * the outcome is decided first, the scoreline is generated to fit it, not
 * the other way around. */
function expectedGoals(forStrength: number, againstStrength: number, homeBonus: number): number {
  const base = BASE_XG + (forStrength - 50) / 44 - (againstStrength - 50) / 55;
  return clamp(base + homeBonus, 0.12, 3.0);
}

/** Draws a scoreline from each side's expected goals, then nudges it (never
 * regenerates from scratch) until it actually agrees with the already-
 * chosen `outcome` — keeps the score "reasonable" for the two teams
 * involved while guaranteeing the W/D/L stored on the fixture and the
 * score stored on the fixture never contradict each other. */
function scoreForOutcome(
  rng: () => number,
  outcome: FixtureOutcome,
  homeXg: number,
  awayXg: number,
): { scoreHome: number; scoreAway: number } {
  let scoreHome = samplePoissonGoals(rng, homeXg);
  let scoreAway = samplePoissonGoals(rng, awayXg);

  if (outcome === "H") {
    while (scoreHome <= scoreAway) {
      if (rng() < 0.65 || scoreAway === 0) scoreHome++;
      else scoreAway--;
    }
  } else if (outcome === "A") {
    while (scoreAway <= scoreHome) {
      if (rng() < 0.65 || scoreHome === 0) scoreAway++;
      else scoreHome--;
    }
  } else {
    // Draw: collapse to whichever side's sampled total, alternating so a
    // string of draws in one run doesn't always settle on 0-0.
    if (scoreHome !== scoreAway) {
      if (rng() < 0.5) scoreAway = scoreHome;
      else scoreHome = scoreAway;
    }
  }

  return { scoreHome, scoreAway };
}

/** A fixture the managed club has no part in — the only kind this module
 * simulates. Both `homeClubId` and `awayClubId` must differ from
 * `managedClubId` for a fixture to qualify. */
export function isAiFixture(fixture: Fixture, managedClubId: string): boolean {
  return fixture.homeClubId !== managedClubId && fixture.awayClubId !== managedClubId;
}

/** Simulates one fixture's result. Deterministic for a given
 * `(fixture, clubs, players, seed)` — same inputs always produce the same
 * result, matching how `lib/match-engine.ts`'s `simulateMatch` behaves for
 * a given seed. `seed` defaults to a hash of the fixture id so callers
 * don't have to invent one. */
export function simulateAiFixture(
  fixture: Fixture,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  seed: number = seedFromFixtureId(fixture.id),
): AiFixtureResult {
  const homeClub = clubs[fixture.homeClubId];
  const awayClub = clubs[fixture.awayClubId];
  if (!homeClub) throw new Error(`simulateAiFixture: unknown home club "${fixture.homeClubId}"`);
  if (!awayClub) throw new Error(`simulateAiFixture: unknown away club "${fixture.awayClubId}"`);

  const rng = createRng(seed);
  const homeStrength = calculateClubStrength(homeClub, players);
  const awayStrength = calculateClubStrength(awayClub, players);

  const outcome = pickOutcome(rng, homeStrength, awayStrength);
  const homeXg = expectedGoals(homeStrength, awayStrength, HOME_ADVANTAGE / 10);
  const awayXg = expectedGoals(awayStrength, homeStrength, 0);
  const { scoreHome, scoreAway } = scoreForOutcome(rng, outcome, homeXg, awayXg);

  return {
    fixtureId: fixture.id,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    homeStrength,
    awayStrength,
    outcome,
    scoreHome,
    scoreAway,
    seed,
  };
}

/** Turns a simulated result into the same reducer action the managed
 * club's own matches are recorded with (`match.tsx` dispatches this after
 * `lib/match-engine.ts` finishes) — storing the result against the
 * fixture is then just `gameReducer(state, action)`, with no second
 * "write the score" code path to keep in sync with `RECORD_MATCH_RESULT`. */
export function toRecordMatchResultAction(
  result: AiFixtureResult,
  playedAt: string,
): Extract<GameAction, { type: "RECORD_MATCH_RESULT" }> {
  return {
    type: "RECORD_MATCH_RESULT",
    fixtureId: result.fixtureId,
    homeClubId: result.homeClubId,
    awayClubId: result.awayClubId,
    scoreHome: result.scoreHome,
    scoreAway: result.scoreAway,
    seed: result.seed,
    playedAt,
  };
}

/** Every currently-`"scheduled"` fixture the managed club isn't part of,
 * simulated. Exposed as a convenience for callers/tests that want "all the
 * AI fixtures right now" rather than looking up one at a time — NOT wired
 * into `state/calendar.ts`'s `dailyHooks.fixtures` yet. That hook fires
 * once per real calendar day (`GameCalendarState.date`, an ISO string),
 * but `Fixture.date` today is a display string ("Sat 6 Dec", "Matchday
 * 14") rather than an ISO date, so there's no reliable "is this fixture
 * today" check to hook on without first giving fixtures a real date field.
 * Left for the phase that does that; this function is what it would call. */
export function simulateScheduledAiFixtures(state: GameState): AiFixtureResult[] {
  const managedClubId = state.currentClub.id;
  return state.fixtures
    .filter((f) => f.status === "scheduled" && isAiFixture(f, managedClubId))
    .map((f) => simulateAiFixture(f, state.clubs, state.players));
}

// ---- Applying results (Phase B3.1C) ---------------------------------------------
// Everything above this point only *computes* a result — nothing is
// authoritative until it's written to `state.fixtures` via
// `RECORD_MATCH_RESULT`. That single write is what standings, club match
// stats (`state/standings.ts`'s `computeClubStanding`) and recent form
// (`computeRecentForm`) all read back out, so "connect the AI match to the
// rest of GameState" is exactly this write and nothing else — there is no
// second place (a stored table, a stored per-club stats blob, ...) that
// also needs updating, and so no second place that could fall out of sync.

/** Folds a batch of already-simulated `AiFixtureResult`s into `state`, one
 * `RECORD_MATCH_RESULT` dispatch each. Idempotent two ways at once:
 *  - here, results are pre-filtered to fixtures still `"scheduled"` in the
 *    *current* `state` (so calling this again after a prior call already
 *    applied a result — which flips that fixture to `"played"` — is a
 *    silent no-op for it, even if the same `AiFixtureResult` is passed in
 *    again);
 *  - defense in depth, `gameReducer`'s `RECORD_MATCH_RESULT` case has its
 *    own "already played -> no-op" guard, so even a caller that skips this
 *    function and dispatches a stale result directly can't double-count.
 * Results for fixtures not found in `state.fixtures` at all are skipped
 * (nothing to attach them to) rather than thrown on. */
export function applyAiFixtureResults(
  state: GameState,
  results: AiFixtureResult[],
  playedAt: string,
): GameState {
  let next = state;
  const scheduledFixtureIds = new Set(
    next.fixtures.filter((fixture) => fixture.status === "scheduled").map((fixture) => fixture.id),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result) {
      continue; // defensive: no result to apply
    }
    // FIX (fixture lifecycle): match the intended fixture by id AND require it
    // to still be scheduled, so an already-played fixture sharing the same id
    // can never swallow a result meant for a scheduled fixture. The reducer's
    // own idempotency guard is preserved unchanged.
    if (!scheduledFixtureIds.has(result.fixtureId)) {
      continue; // unknown or already-applied fixture
    }

    next = gameReducer(next, toRecordMatchResultAction(result, playedAt));
    scheduledFixtureIds.delete(result.fixtureId);
  }

  return next;
}

/** Applies same-day AI results with one player-map commit while retaining the
 * existing reducer sequence for every non-player consequence. */
export function applyAiFixtureResultsBatched(
  state: GameState,
  results: AiFixtureResult[],
  playedAt: string,
): GameState {
  if (results.length === 0) return state;

  const scheduledFixtureIds = new Set(
    state.fixtures.filter((fixture) => fixture.status === "scheduled").map((fixture) => fixture.id),
  );
  const playerUpdates = new Map<string, Player>();

  for (const result of results) {
    if (!result || !scheduledFixtureIds.has(result.fixtureId)) return applyAiFixtureResults(state, results, playedAt);
    const fixture = state.fixtures.find((item) => item.id === result.fixtureId);
    if (!fixture) return applyAiFixtureResults(state, results, playedAt);

    const updates = calculateMatchPlayerUpdates(
      state,
      state.clubs[fixture.homeClubId]?.playerIds ?? [],
      state.clubs[fixture.awayClubId]?.playerIds ?? [],
      result.scoreHome,
      result.scoreAway,
    );
    for (const [playerId, player] of updates) {
      if (playerUpdates.has(playerId)) return applyAiFixtureResults(state, results, playedAt);
      playerUpdates.set(playerId, player);
    }
    scheduledFixtureIds.delete(result.fixtureId);
  }

  const players = { ...state.players };
  for (const [playerId, player] of playerUpdates) players[playerId] = player;
  let next: GameState = { ...state, players };

  for (const result of results) {
    next = gameReducer(next, {
      ...toRecordMatchResultAction(result, playedAt),
      batchPlayerUpdates: true,
    });
  }
  return next;
}

/** The one-call version: simulate every currently-scheduled AI fixture and
 * apply all of the results, in one pass. Safe to call repeatedly (e.g. once
 * per daily tick, once per screen open) — the first call resolves every AI
 * fixture that's due; every call after that finds nothing left in
 * `"scheduled"` status and returns `state` unchanged. Still not wired into
 * `state/calendar.ts`'s `dailyHooks.fixtures` — see `simulateScheduledAiFixtures`'s
 * doc comment for why (`Fixture.date` isn't an ISO date yet). */
export function simulateAndApplyScheduledAiFixtures(state: GameState, playedAt: string): GameState {
  return applyAiFixtureResults(state, simulateScheduledAiFixtures(state), playedAt);
}
