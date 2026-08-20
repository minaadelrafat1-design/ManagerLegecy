/* =============================================================================
 * AI match engine adapter (Phase B3.1B.1, extended in B3.1B.2)
 * =============================================================================
 * Phase B3.1A gave AI-only fixtures (neither side is the managed club) a
 * fast strength-vs-strength scoreline generator (`lib/ai-fixture-sim.ts`),
 * deliberately NOT the full minute-by-minute engine, "where a full
 * simulation would be wasted work".
 *
 * Phase B3.1B.1 connected them to that full engine instead. This module
 * adds NO new match *logic* of its own — every event, shot, card, goal and
 * final score for an AI fixture is produced by the exact same
 * `lib/match-engine.ts` `simulateMatch()` that `routes/match.tsx` calls for
 * the manager's own games. What this module DOES add is purely on the
 * *input* side: turning a `Club` (which, for an AI-only fixture, usually
 * has no `Player` roster at all — see `Club.simRoster`'s doc comment) into
 * the `SimTeamInput` the engine requires. Three cases, cheapest/most
 * faithful first:
 *
 *  1. `club.simRoster` present (e.g. Westport) -> use it directly, exactly
 *     as `routes/match.tsx` already does for the away side.
 *  2. `club.playerIds` present (a fully-modelled club, i.e. the managed
 *     club) -> reuse `playerToSim` (same function `match.tsx` uses) over
 *     its real `Player` records, picking a starting XI the same way
 *     `state/store.tsx`'s `useStartingXI` does (`p.starter`), falling back
 *     to the 11 best-rated players if that flag isn't set for this club.
 *  3. Neither (every minimal rival club today — see
 *     `state/seed.ts`'s `makeMinimalClub`) -> synthesize a lightweight
 *     roster from the club's existing strength signal
 *     (`ai-fixture-sim.ts`'s `calculateClubStrength`, reused rather than
 *     recomputed) so the engine still has 11+bench real `SimPlayer`s to
 *     run with. This is data adaptation, not match simulation — nothing
 *     here decides who wins; `simulateMatch` still does that.
 *
 * Phase B3.1B.2 closes two real-data gaps left open by B3.1B.1, both still
 * pure data-adaptation (no new decision-making):
 *
 *  - `lib/match-engine.ts`'s `SimPlayer`/`playerToSim` never read a
 *    player's `morale` or `form` — only `fitness` (via `baseFitness`) fed
 *    the sim. `applyCondition` below folds both into a small pre-match
 *    multiplier on `attack`/`defend`/`playmaking` for every AI-fixture
 *    participant (case 2's real `Player` records, and case 3's synthesized
 *    players, which now synthesize a morale/form pair the same way they
 *    already synthesize fitness/overall). This is applied here, in the
 *    adapter, rather than in `playerToSim` itself, so the interactive
 *    match screen's own call to `playerToSim` (`routes/match.tsx`) is
 *    completely untouched.
 *  - Every AI fixture previously got the exact same neutral
 *    `DEFAULT_HOME_TACTICS` / `DEFAULT_AWAY_TACTICS` regardless of which
 *    two clubs were playing, so "tactical approach" wasn't actually real
 *    per-club data. `deriveClubTactics` now derives a small, fixed
 *    tactical identity per club from data already on `Club` (formation
 *    shape, reputation) plus a club-id seed — still a pure function of
 *    static data, not opponent-aware or reactive, so this is NOT the
 *    advanced in-match AI decision-making this phase is scoped to avoid.
 *
 * Explicitly NOT here (later phases): giving every rival club a real,
 * named `Player` roster (case 3 would then simply stop firing); *adaptive*
 * AI tactics that react to the scoreline, the opponent, or minute-by-minute
 * match state; wiring this into `state/calendar.ts`'s daily tick (still
 * blocked on `Fixture.date` not being an ISO date — see
 * `ai-fixture-sim.ts`'s `simulateScheduledAiFixtures` doc comment,
 * unchanged by this phase).
 * ---------------------------------------------------------------------------*/

import type { Club, Fixture, GameState, Player } from "@/state/types";
import type { Pos } from "@/data/squad";
import { squadMoraleMatchModifier } from "@/state/fatigue";
import { computeClubStanding } from "@/state/standings";
import {
  simulateMatch,
  playerToSim,
  DEFAULT_HOME_TACTICS,
  DEFAULT_AWAY_TACTICS,
  type SimPlayer,
  type SimTeamInput,
  type TeamTactics,
  type MatchSimulationResult,
} from "@/lib/match-engine";
import {
  calculateClubStrength,
  seedFromFixtureId,
  isAiFixture,
  toRecordMatchResultAction,
  applyAiFixtureResults,
  applyAiFixtureResultsBatched,
  type AiFixtureResult,
} from "@/lib/ai-fixture-sim";

// Re-exported so callers of this module don't also need to reach into
// ai-fixture-sim.ts for the handful of small helpers that still apply
// unchanged (same convention `ai-fixture-sim.ts` itself uses for
// `toRecordMatchResultAction`).
export { isAiFixture, seedFromFixtureId, toRecordMatchResultAction, applyAiFixtureResults };
export type { AiFixtureResult };

// ---- RNG ---------------------------------------------------------------------
// Same small seedable PRNG (mulberry32) `lib/match-engine.ts` and
// `lib/ai-fixture-sim.ts` each already duplicate locally — kept as its own
// copy here too, for the same "stay a leaf" reason `ai-fixture-sim.ts`'s
// header gives. Only used below to jitter synthetic ratings, never for
// anything the engine itself decides.
function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function clampRatio(v: number, min = 0.85, max = 1.15): number {
  return Math.max(min, Math.min(max, v));
}

// ---- Morale / form -------------------------------------------------------------
// `lib/match-engine.ts`'s `SimPlayer` only ever carried `baseFitness` from
// `Player` into the sim — `morale` and `form` (both real `GameState` fields,
// see `data/squad.ts`) never influenced a match. Folded in here, as a small
// pre-match multiplier on attack/defend/playmaking, rather than in
// `playerToSim` itself, so the interactive match screen (which calls
// `playerToSim` directly from `routes/match.tsx`) is unaffected.
//
// Baseline 65 for both — roughly the seeded squad's average — so a squad at
// "reasonably content, average recent form" sees ~no change; a player well
// above/below that on morale and/or form gets a modest (not game-swinging)
// boost/penalty, clamped so it can never turn a poor player into a star or
// vice versa.

/** Exported for tests. */
export function conditionFactor(morale: number, form: number): number {
  const delta = (clamp(morale) - 65) * 0.35 + (clamp(form) - 65) * 0.45;
  return clampRatio(1 + delta / 100);
}

/** Applies the morale/form multiplier to one already-built `SimPlayer`.
 * Exported for tests. */
export function applyCondition(sim: SimPlayer, morale: number, form: number): SimPlayer {
  const factor = conditionFactor(morale, form);
  if (factor === 1) return sim;
  return {
    ...sim,
    attack: clamp(Math.round(sim.attack * factor)),
    defend: clamp(Math.round(sim.defend * factor)),
    playmaking: clamp(Math.round(sim.playmaking * factor)),
  };
}

// ---- Formation templates -----------------------------------------------------
// Only used for the synthetic-roster case (3 above) — clubs with a real
// roster or `simRoster` already carry their own positions per player.
// A handful of known shapes plus a 4-4-2 fallback for anything else, which
// covers every formation currently seeded (`state/seed.ts`'s
// `makeMinimalClub` always uses "4-4-2"; Westport and the managed club both
// have real rosters and never hit this table).

const FORMATION_TEMPLATES: Record<string, Pos[]> = {
  "4-4-2": ["GK", "RB", "CB", "CB", "LB", "RW", "CM", "CM", "LW", "ST", "ST"],
  "4-3-3": ["GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST"],
  "4-2-3-1": ["GK", "RB", "CB", "CB", "LB", "CDM", "CDM", "CAM", "RW", "LW", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "RB", "CM", "CDM", "CM", "LB", "ST", "ST"],
  "5-3-2": ["GK", "RB", "CB", "CB", "CB", "LB", "CM", "CDM", "CM", "ST", "ST"],
  "4-5-1": ["GK", "RB", "CB", "CB", "LB", "RW", "CM", "CDM", "LW", "CAM", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "RB", "CM", "CM", "LB", "RW", "LW", "ST"],
};
const DEFAULT_FORMATION_TEMPLATE = FORMATION_TEMPLATES["4-4-2"]!;
const BENCH_TEMPLATE: Pos[] = ["GK", "CB", "CDM", "CM", "ST"];

function templateFor(formation: string | undefined): Pos[] {
  if (formation && FORMATION_TEMPLATES[formation]) return FORMATION_TEMPLATES[formation];
  return DEFAULT_FORMATION_TEMPLATE;
}

// ---- Per-club tactical identity -------------------------------------------------
// Previously every AI fixture used the exact same `DEFAULT_HOME_TACTICS` /
// `DEFAULT_AWAY_TACTICS` regardless of which two clubs were playing — real
// per-club data (formation, reputation) never actually reached the
// engine's `TeamTactics` dials for AI fixtures. `deriveClubTactics` is a
// pure function of a club's own static data plus a stable per-club seed:
// it does NOT look at the opponent or match state, so it stays data
// adaptation rather than the adaptive/reactive AI tactics this phase is
// scoped to avoid. The home/away baseline gap (`DEFAULT_HOME_TACTICS` is a
// touch more expansive than `DEFAULT_AWAY_TACTICS`) is preserved as the
// centre each club's dials jitter around.

const TACTIC_KEYS: Array<keyof TeamTactics> = [
  "tempo",
  "pressing",
  "directness",
  "mentality",
  "width",
  "depth",
];

/** Attacking formations (fewer nominal defenders, e.g. "3-4-3") nudge a
 * club toward a bolder tactical identity (higher tempo/mentality/
 * directness); defensive formations (e.g. "5-3-2") nudge the other way.
 * Same "fewer at the back = more attacking" reading `formationShapeMods`
 * in `lib/match-engine.ts` already uses for shape, just applied to the
 * tactical dials instead of the raw attack/defend ratings. */
function formationTacticalBias(formation: string | undefined): number {
  const first = formation ? Number(formation.split("-")[0]) : NaN;
  if (!Number.isFinite(first)) return 0;
  return (4 - first) * 4;
}

/** Derives one club's fixed tactical identity for AI fixtures. Deterministic
 * per club id (not per fixture) — a club plays with a consistent style
 * match to match, the same way `buildSyntheticRoster` gives a club a
 * consistent-strength squad. Enhanced to use manager philosophy for
 * meaningful tactical diversity. Exported for tests. */
export function deriveClubTactics(club: Club, homeAdvantage: boolean): TeamTactics {
  const base = homeAdvantage ? DEFAULT_HOME_TACTICS : DEFAULT_AWAY_TACTICS;
  const rng = createRng(seedFromFixtureId(`${club.id}-tactics`));
  const shapeBias = formationTacticalBias(club.formation);

  // REALISM: Manager philosophy influences tactical identity
  // Higher-reputation clubs read as a touch more front-footed (higher
  // tempo/pressing) rather than more error-prone or more accurate
  const repBias = (club.reputation - 55) / 6;

  // Philosophy-based tactical bias
  let philoBias: Record<string, number> = {};
  if (club.aiManager?.philosophy) {
    const phil = club.aiManager.philosophy.toLowerCase();
    // "possession" = patient, controlled, higher pressing precision
    if (phil.includes("possession")) {
      philoBias = { tempo: -6, pressing: -4, directness: -8 }; // slower, more careful
    }
    // "high-press" = aggressive, high tempo, reactive
    else if (phil.includes("high-press") || phil.includes("aggressive")) {
      philoBias = { tempo: 8, pressing: 12, mentality: 6 }; // faster, more aggressive
    }
    // "youth" = creative, less structured
    else if (phil.includes("youth")) {
      philoBias = { width: 6, directness: 4 }; // wider play, more creative
    }
    // "counter" = direct, low block
    else if (phil.includes("counter")) {
      philoBias = { directness: 10, depth: 8, tempo: -6 }; // deep, direct
    }
    // "man-management" = balanced, stable
    else if (phil.includes("man-management")) {
      philoBias = {}; // no strong bias, stay balanced
    }
  }

  const tactics: Record<string, number> = {};
  for (const key of TACTIC_KEYS) {
    const jitter = (rng() - 0.5) * 16; // +/- 8, deterministic per club+key
    let bias = 0;
    if (key === "mentality" || key === "tempo" || key === "directness") bias += shapeBias;
    if (key === "tempo" || key === "pressing") bias += repBias;
    bias += philoBias[key] ?? 0; // Apply philosophy bias
    const baseValue = (base as unknown as Record<string, number>)[key] ?? 50;
    const nextValue = clamp(Math.round(baseValue + bias + jitter));
    tactics[key] = nextValue;
  }
  return {
    tempo: clamp(Math.round((tactics["tempo"] ?? base.tempo) + (homeAdvantage ? 1 : 0))),
    pressing: clamp(Math.round((tactics["pressing"] ?? base.pressing) + (homeAdvantage ? 1 : 0))),
    directness: clamp(
      Math.round((tactics["directness"] ?? base.directness) + (homeAdvantage ? 1 : 0)),
    ),
    mentality: clamp(
      Math.round((tactics["mentality"] ?? base.mentality) + (homeAdvantage ? 1 : 0)),
    ),
    width: clamp(Math.round((tactics["width"] ?? base.width) + (homeAdvantage ? 1 : 0))),
    depth: clamp(Math.round((tactics["depth"] ?? base.depth) + (homeAdvantage ? 1 : 0))),
  } as TeamTactics;
}

// Small position biases so a synthesized player's attack/defend split
// reflects their slot, the same qualitative shape `data/opponent.ts`'s
// hand-authored ratings already follow (strikers high-attack/low-defend,
// centre-backs the reverse) — just generated instead of hand-authored.
const ATTACK_BIAS: Record<Pos, number> = {
  GK: -45,
  CB: -22,
  RB: -8,
  LB: -8,
  CDM: -6,
  CM: 4,
  CAM: 14,
  RW: 16,
  LW: 16,
  ST: 20,
};
const DEFEND_BIAS: Record<Pos, number> = {
  GK: 30,
  CB: 22,
  RB: 10,
  LB: 10,
  CDM: 10,
  CM: 0,
  CAM: -14,
  RW: -18,
  LW: -18,
  ST: -22,
};

/** One synthesized player. Deterministic for a given `(seed, index)` —
 * called with a running `rng`, not a fresh one per player, so a club's
 * whole roster is one reproducible draw rather than 16 independent ones. */
function synthesizePlayer(
  clubId: string,
  abbr: string,
  number: number,
  pos: Pos,
  overallBase: number,
  rng: () => number,
): SimPlayer {
  const jitter = (spread: number) => (rng() - 0.5) * spread;
  const overall = clamp(Math.round(overallBase + jitter(12)));
  const attack = clamp(Math.round(overall + ATTACK_BIAS[pos] + jitter(6)));
  const defend = clamp(Math.round(overall + DEFEND_BIAS[pos] + jitter(6)));
  const playmakingBias = pos === "CM" || pos === "CAM" || pos === "CDM" ? 6 : -6;
  const playmaking = clamp(Math.round(overall + playmakingBias + jitter(6)));
  const discipline = clamp(Math.round(62 + jitter(24)));
  const baseFitness = clamp(Math.round(88 + jitter(10)), 70, 99);
  // No real Player record exists for a synthesized player, so morale/form
  // are drawn the same way fitness/overall already are — deterministic per
  // (seed, index), not tied to any real GameState field, since there isn't
  // one. Applied immediately below via the same `applyCondition` real
  // Player-backed players get, so a synthesized roster's spread of morale
  // and form still measurably affects its output.
  const morale = clamp(Math.round(66 + jitter(28)));
  const form = clamp(Math.round(64 + jitter(30)));
  const base: SimPlayer = {
    id: `${clubId}-p${number}`,
    shortName: `${abbr}${number}`,
    number,
    pos,
    x: 50,
    y: 50,
    baseFitness,
    overall,
    attack,
    defend,
    playmaking,
    discipline,
    isGK: pos === "GK",
  };
  return applyCondition(base, morale, form);
}

/** Builds a full XI + bench of `SimPlayer`s for a club with no real roster
 * and no `simRoster`, from its existing strength signal
 * (`calculateClubStrength`) — deterministic per club id, NOT per fixture,
 * so the same club fields a consistent-strength (if not literally
 * identical) squad whichever fixture it's playing, the same way a real
 * club's ability doesn't reset between matches. Exported for tests. */
export function buildSyntheticRoster(
  club: Club,
  players: Record<string, Player>,
): { xi: SimPlayer[]; bench: SimPlayer[] } {
  const rng = createRng(seedFromFixtureId(club.id));
  const baseline = calculateClubStrength(club, players);
  const template = templateFor(club.formation);

  const xi = template.map((pos, i) =>
    synthesizePlayer(club.id, club.abbr, i + 1, pos, baseline, rng),
  );
  const bench = BENCH_TEMPLATE.map((pos, i) =>
    synthesizePlayer(club.id, club.abbr, xi.length + i + 1, pos, baseline - 6, rng),
  );
  return { xi, bench };
}

/** Turns any `Club` into the `SimTeamInput` `lib/match-engine.ts` needs —
 * home club, away club (via which `club` is passed), starting players,
 * formation and tactical approach all resolve here; home/away status is
 * the caller's `side`/`homeAdvantage` args. Exported for tests. */
export function buildSimTeamInput(
  side: "home" | "away",
  club: Club,
  players: Record<string, Player>,
  homeAdvantage: boolean,
  state?: import("@/state/types").GameState,
): SimTeamInput {
  let xi: SimPlayer[];
  let bench: SimPlayer[];

  if (club.simRoster && club.simRoster.xi.length > 0) {
    // Case 1 — a club already modelled at the SimPlayer level (Westport).
    xi = club.simRoster.xi;
    bench = club.simRoster.bench;
  } else if (club.playerIds.length > 0) {
    // Case 2 — a fully-modelled club with real Player records. Prefer the
    // squad's own `starter` flags (same signal `useStartingXI` reads);
    // fall back to the 11 best-rated players if that doesn't land on
    // exactly 11 for this club.
    const roster = club.playerIds.map((id) => players[id]).filter((p): p is Player => !!p);
    const flaggedStarters = roster.filter((p) => p.starter);
    const xiPlayers =
      flaggedStarters.length === 11
        ? flaggedStarters
        : [...roster].sort((a, b) => b.overall - a.overall).slice(0, 11);
    const xiIds = new Set(xiPlayers.map((p) => p.id));
    // Same `playerToSim` the interactive match screen uses, then the
    // real `morale`/`form` GameState fields (never read by `playerToSim`
    // itself) are folded in here as a small multiplier — see the
    // "Morale / form" section above.
    xi = xiPlayers.map((p) => {
      const base = applyCondition(playerToSim(p), p.morale, p.form);
      // tactical familiarity for the chosen formation (if present on Player)
      const famValue = p.tacticalFamiliarity;
      const fam =
        typeof famValue === "object" && famValue !== null
          ? (famValue[club.formation] ?? 50)
          : (famValue ?? 50);
      const mgr = club.aiManager;
      const mgrSkill = mgr?.playerDevelopment ?? 50;
      const mgrFactor = mgr
        ? Math.max(
            0.92,
            Math.min(1.1, 1 + (mgrSkill - 50) / 600 + (mgr.tacticalAbility - 50) / 900),
          )
        : 1;
      return {
        ...base,
        tacticalFamiliarity: fam,
        attack: Math.round(Math.max(1, Math.min(100, base.attack * mgrFactor))),
        defend: Math.round(Math.max(1, Math.min(100, base.defend * mgrFactor))),
        playmaking: Math.round(Math.max(1, Math.min(100, base.playmaking * mgrFactor))),
      } as SimPlayer;
    });
    bench = roster
      .filter((p) => !xiIds.has(p.id))
      .map((p) => {
        const base = applyCondition(playerToSim(p), p.morale, p.form);
        const famValue = p.tacticalFamiliarity;
        const fam =
          typeof famValue === "object" && famValue !== null
            ? (famValue[club.formation] ?? 50)
            : (famValue ?? 50);
        const mgr = club.aiManager;
        const mgrSkill = mgr?.playerDevelopment ?? 50;
        const mgrFactor = mgr
          ? Math.max(
              0.92,
              Math.min(1.1, 1 + (mgrSkill - 50) / 600 + (mgr.tacticalAbility - 50) / 900),
            )
          : 1;
        return {
          ...base,
          tacticalFamiliarity: fam,
          attack: Math.round(Math.max(1, Math.min(100, base.attack * mgrFactor))),
          defend: Math.round(Math.max(1, Math.min(100, base.defend * mgrFactor))),
          playmaking: Math.round(Math.max(1, Math.min(100, base.playmaking * mgrFactor))),
        } as SimPlayer;
      });
  } else {
    // Case 3 — no roster data at all (every minimal rival club today).
    const synth = buildSyntheticRoster(club, players);
    xi = synth.xi;
    bench = synth.bench;
  }

  // ensure synthetic/simRoster players have a tacticalFamiliarity field
  xi = xi.map((p) => ({ ...p, tacticalFamiliarity: p.tacticalFamiliarity ?? 50 }));

  const squadMorale = calculateAiSquadMorale(club, players, state);
  // Apply the morale multiplier to all players on the team
  const moraleFactor = squadMoraleMatchModifier(squadMorale);
  if (moraleFactor !== 1) {
    xi = xi.map((p) => ({
      ...p,
      attack: Math.round(p.attack * moraleFactor),
      defend: Math.round(p.defend * moraleFactor),
      playmaking: Math.round(p.playmaking * moraleFactor),
    }));
    bench = bench.map((p) => ({
      ...p,
      attack: Math.round(p.attack * moraleFactor),
      defend: Math.round(p.defend * moraleFactor),
      playmaking: Math.round(p.playmaking * moraleFactor),
    }));
  }
  bench = bench.map((p) => ({ ...p, tacticalFamiliarity: p.tacticalFamiliarity ?? 50 }));

  return {
    id: side,
    name: club.name,
    xi,
    bench,
    // Each club's own fixed tactical identity (formation + reputation +
    // a per-club seed) — see `deriveClubTactics` above. Still not
    // adaptive/opponent-aware, just real per-club data instead of a
    // shared neutral default for every AI fixture.
    tactics: deriveClubTactics(club, homeAdvantage),
    homeAdvantage,
    formation: club.formation,
  };
}

/** Calculate bounded deterministic team morale from existing game state. */
export function calculateAiSquadMorale(
  club: Club,
  players: Record<string, Player>,
  state?: import("@/state/types").GameState,
): number {
  const roster = club.playerIds
    .map((id) => players[id])
    .filter((player): player is Player => !!player);
  const averagePlayerMorale = roster.length
    ? roster.reduce((sum, player) => sum + player.morale, 0) / roster.length
    : 42 + (club.reputation ?? 50) * 0.16;
  let morale =
    averagePlayerMorale * 0.55 +
    (club.reputation ?? 50) * 0.25 +
    (club.aiManager?.reputation ?? 50) * 0.2;

  if (state) {
    const standing = computeClubStanding(state, club.leagueId, club.id);
    if (standing) {
      const totalClubs = Math.max(1, standing.position);
      morale += Math.max(-12, Math.min(12, (totalClubs / 2 - standing.position) * 2));
    }

    const recentMatches = (state.matches ?? [])
      .filter((match) => match.homeClubId === club.id || match.awayClubId === club.id)
      .slice(-5);
    if (recentMatches.length) {
      const points = recentMatches.reduce((sum, match) => {
        const scored = match.homeClubId === club.id ? match.scoreHome : match.scoreAway;
        const conceded = match.homeClubId === club.id ? match.scoreAway : match.scoreHome;
        return sum + (scored > conceded ? 3 : scored === conceded ? 1 : 0);
      }, 0);
      morale += (points / recentMatches.length - 1.5) * 8;
    }

    const injured = roster.filter((player) => player.status === "injured").length;
    morale -= Math.min(12, injured * 3);
  }

  const expiringContracts = roster.filter((player) => (player.contractYears ?? 3) <= 1).length;
  morale -= Math.min(6, expiringContracts);
  return Math.max(20, Math.min(85, Math.round(morale)));
}

/** Simulates one AI-only fixture through the real match engine and returns
 * a result shaped exactly like `ai-fixture-sim.ts`'s `AiFixtureResult` —
 * so `applyAiFixtureResults` / `toRecordMatchResultAction` (Phase B3.1C)
 * keep working completely unchanged; only *how* `scoreHome`/`scoreAway`
 * are produced has changed, not what's done with them afterwards.
 * `homeStrength`/`awayStrength` are kept on the result for the same
 * display/back-compat reasons `ai-fixture-sim.ts` computes them — they no
 * longer drive the scoreline directly (the engine does), but still
 * describe the matchup. Deterministic for a given `(fixture, seed)`, same
 * contract as `ai-fixture-sim.ts`'s `simulateAiFixture`. */
export function simulateAiFixtureViaEngine(
  fixture: Fixture,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  seed: number | string = seedFromFixtureId(fixture.id),
  state?: import("@/state/types").GameState,
): AiFixtureResult {
  const homeClub = clubs[fixture.homeClubId];
  const awayClub = clubs[fixture.awayClubId];
  if (!homeClub)
    throw new Error(`simulateAiFixtureViaEngine: unknown home club "${fixture.homeClubId}"`);
  if (!awayClub)
    throw new Error(`simulateAiFixtureViaEngine: unknown away club "${fixture.awayClubId}"`);

  // Convert string seed to number using FNV-1a hash
  const numericSeed = typeof seed === "string" ? seedFromFixtureId(seed) : seed;

  const homeStrength = calculateClubStrength(homeClub, players);
  const awayStrength = calculateClubStrength(awayClub, players);

  const homeInput = buildSimTeamInput("home", homeClub, players, true, state);
  const awayInput = buildSimTeamInput("away", awayClub, players, false, state);

  const sim: MatchSimulationResult = simulateMatch(homeInput, awayInput, numericSeed);
  const { home: scoreHome, away: scoreAway } = sim.finalScore;
  const outcome = scoreHome > scoreAway ? "H" : scoreHome < scoreAway ? "A" : "D";

  return {
    fixtureId: fixture.id,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    homeStrength,
    awayStrength,
    outcome,
    scoreHome,
    scoreAway,
    seed: numericSeed,
  };
}

/** Same convenience shape as `ai-fixture-sim.ts`'s `simulateScheduledAiFixtures`,
 * routed through the engine instead. Every currently-`"scheduled"` fixture
 * the managed club isn't part of. Still not wired into
 * `state/calendar.ts`'s daily tick — see this file's header comment. */
export function simulateScheduledAiFixturesViaEngine(
  state: GameState,
  eligibleFixtures?: Fixture[],
): AiFixtureResult[] {
  const managedClubId = state.currentClub.id;
  const today = state.time.date;
  const season = String(state.time.season);
  const fixtures =
    eligibleFixtures ??
    state.fixtures.filter(
      (f) =>
        f.status === "scheduled" &&
        f.calendarDate === today &&
        String(f.season ?? season) === season &&
        isAiFixture(f, managedClubId),
    );
  const results = fixtures
    .map((f) =>
      simulateAiFixtureViaEngine(f, state.clubs, state.players, seedFromFixtureId(f.id), state),
    );
  return results;
}

/** Same convenience shape as `ai-fixture-sim.ts`'s
 * `simulateAndApplyScheduledAiFixtures`: simulate every currently-scheduled
 * AI fixture through the engine and apply all the results in one pass.
 * Reuses `applyAiFixtureResults` unchanged — idempotency (safe to call
 * repeatedly) comes from there, same as the Phase B3.1A/C path. */
export function simulateAndApplyScheduledAiFixturesViaEngine(
  state: GameState,
  playedAt: string,
  eligibleFixtures?: Fixture[],
): GameState {
  return applyAiFixtureResultsBatched(
    state,
    simulateScheduledAiFixturesViaEngine(state, eligibleFixtures),
    playedAt,
  );
}

/** For callers/tests that want to inspect the full engine output (events,
 * per-minute snapshots, ...) for an AI fixture rather than just the final
 * score — e.g. to confirm the same engine the interactive match screen
 * uses actually ran. `applyAiFixtureResults` never needs this; it only
 * ever consumes the `AiFixtureResult` shape above. */
export function simulateAiFixtureFull(
  fixture: Fixture,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  seed: number = seedFromFixtureId(fixture.id),
): MatchSimulationResult {
  const homeClub = clubs[fixture.homeClubId];
  const awayClub = clubs[fixture.awayClubId];
  if (!homeClub)
    throw new Error(`simulateAiFixtureFull: unknown home club "${fixture.homeClubId}"`);
  if (!awayClub)
    throw new Error(`simulateAiFixtureFull: unknown away club "${fixture.awayClubId}"`);

  const homeInput = buildSimTeamInput("home", homeClub, players, true);
  const awayInput = buildSimTeamInput("away", awayClub, players, false);
  return simulateMatch(homeInput, awayInput, seed);
}
