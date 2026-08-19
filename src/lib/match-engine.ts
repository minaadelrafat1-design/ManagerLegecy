import type { Pos, Player as BasePlayer } from "@/data/squad";
import type { Club } from "@/state/types";
import { fatigueMatchModifier, formMatchModifier } from "@/state/fatigue";
import type { MatchEvent, MatchEventMeta, MatchEventType } from "@/components/match-bits";
import { MemoCache } from "./cache-utils";
import { calculateTacticalModifiers, applyTacticalModifier } from "./tactical-influence";
import { assignSquadTactics } from "./ai-tactics";

/* =============================================================================
 * Match simulation engine
 * =============================================================================
 * A small, deterministic (per-seed) state machine that turns two teams' worth
 * of player ratings + a couple of tactical dials into a believable stream of
 * match events — kickoff, spells of possession/attack/defence, chances,
 * shots, saves, goals, fouls, cards, corners, free kicks, substitutions,
 * half-time / second-half / full-time.
 *
 * This is intentionally *not* a full football sim: no true positional
 * physics, no per-pass modelling. It is a weighted event-chain generator —
 * enough variety, driven by real squad data, to feel alive without pretending
 * to be a research project.
 *
 * Two matches with different seeds (or different squads) produce different
 * scorelines, scorers, cards and timelines. The same seed always reproduces
 * the same match, which keeps the simulation debuggable and testable.
 * ---------------------------------------------------------------------------*/

// ---- RNG -------------------------------------------------------------------

/** Small, fast, seedable PRNG (mulberry32). Deterministic per seed. */
function createRng(seed: number) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

interface Weighted<T> {
  v: T;
  w: number;
}

function weightedPick<T>(rng: Rng, items: Array<Weighted<T>>): T {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.w), 0);
  if (total <= 0) {
    const first = items[0];
    if (!first) throw new Error("weightedPick: empty list");
    return first.v;
  }
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, item.w);
    if (roll <= 0) return item.v;
  }
  return items[items.length - 1]!.v;
}

/** Pick a single player weighted by a scoring function. Returns undefined for an empty pool. */
function weightedPlayerPick(
  rng: Rng,
  pool: SimPlayer[],
  weightFn: (p: SimPlayer) => number,
): SimPlayer | undefined {
  if (pool.length === 0) return undefined;
  const items = pool.map((p) => ({ v: p, w: Math.max(0.01, weightFn(p)) }));
  return weightedPick(rng, items);
}

function pick<T>(rng: Rng, arr: T[]): T {
  const item = arr[Math.floor(rng() * arr.length)];
  if (item === undefined) throw new Error("pick: empty array");
  return item;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

/** Clamp a multiplier around 1.0 so tactical dials nudge ratings rather than
 * ever swinging them wildly — the sim should stay "obviously the same two
 * squads", just leaning attacking/defensive/wide/etc. */
function clampRatio(v: number, min = 0.72, max = 1.32): number {
  return Math.max(min, Math.min(max, v));
}

// ----- Simulation tuning constants (exposed for easy balance) ------------
const TUNING = {
  EVENT_BASE: 0.36, // baseline chance per minute for a notable event
  ONTARGET_BASE: 0.42, // base chance a shot is on target
  GOAL_BASE: 0.14, // base chance a shot on target becomes a goal (before quality-vs-gk)
};

function roleAttackModifier(role?: string): number {
  if (!role) return 1;
  const low = [
    "Def",
    "Stopper",
    "Anchor",
    "No-Nonsense",
    "Sweeper",
    "Full Back",
    "Central Defender",
    "Guard",
    "Keeper",
  ];
  const high = [
    "Attacking",
    "Forward",
    "Striker",
    "Poacher",
    "Shadow",
    "Inside",
    "Advanced",
    "Playmaker",
    "Winger",
    "Wide",
    "Complete",
  ];
  const text = role.toLowerCase();
  if (low.some((term) => text.includes(term.toLowerCase()))) return 0.92;
  if (high.some((term) => text.includes(term.toLowerCase()))) return 1.08;
  return 1;
}

function roleDefendModifier(role?: string): number {
  if (!role) return 1;
  const low = ["Attacking", "Forward", "Winger", "Poacher", "Shadow", "Complete"];
  const high = ["Def", "Stopper", "Anchor", "No-Nonsense", "Sweeper", "Back", "Guard", "Keeper"];
  const text = role.toLowerCase();
  if (low.some((term) => text.includes(term.toLowerCase()))) return 0.92;
  if (high.some((term) => text.includes(term.toLowerCase()))) return 1.08;
  return 1;
}

function familiarityFactor(player: SimPlayer): number {
  const fam =
    typeof player.tacticalFamiliarity === "number"
      ? player.tacticalFamiliarity
      : typeof player.tacticalFamiliarity === "object" && player.tacticalFamiliarity !== null
        ? (Object.values(player.tacticalFamiliarity)[0] ?? 50)
        : 50;
  return clampRatio(1 + (fam - 65) / 360, 0.86, 1.14);
}

function chemistryFactor(teamChem: number): number {
  return clampRatio(1 + (teamChem - 60) / 240, 0.86, 1.14);
}

// ---- Player / team model ----------------------------------------------------

/** Lightweight per-player ratings the engine actually needs. Both squads
 * (the fully modelled home roster and the leaner away roster) are adapted
 * into this shape so the simulation logic never cares which side it's on. */
export interface SimPlayer {
  id: string;
  shortName: string;
  number: number;
  pos: Pos;
  role?: string;
  x: number;
  y: number;
  baseFitness: number; // starting condition 0-100
  overall: number; // 0-100 general quality
  attack: number; // finishing / creation threat, 0-100
  defend: number; // defensive solidity, 0-100
  playmaking: number; // passing / vision, 0-100
  discipline: number; // 0-100, higher = less foul/card-prone
  isGK: boolean;
  tacticalFamiliarity?: number | Record<string, number>;
  tacticalConfig?: {
    roleId?: string;
    instructions?: string[];
    roleFamiliarity?: number; // 0-100
  };
}

export interface TeamTactics {
  tempo: number; // 0-100, higher = more attacking sequences per minute
  pressing: number; // 0-100, higher = more fouls committed + more turnovers forced, but burns stamina faster
  directness: number; // 0-100, higher = more shots/crosses, fewer patient corners
  mentality: number; // 0-100, 0 = ultra-defensive .. 100 = ultra-attacking. Shifts the attack/defend balance both ways at once.
  width: number; // 0-100, higher = more crossing/wide play, more attacking space, but a more stretched (leakier) defensive shape
  depth: number; // 0-100, defensive line height. Higher = more territory pushed onto the opponent, but more space in behind for them to counter into
  // Advanced tactical knobs (optional):
  pressingSystem?: "zonal" | "man" | "mixed"; // affects pressing efficiency vs stamina cost
  defensiveBlock?: "low" | "mid" | "high"; // shapes how depth is interpreted defensively
  buildUp?: "possession" | "direct" | "mixed"; // influences chance-to-build sequences vs quick transitions
  counterTendency?: number; // 0-100 how likely team is to attempt counters when turning over possession
  chemistry?: number; // 0-100 team cohesion — boosts passing/playmaking and reduces mistakes
}

export interface SimTeamInput {
  id: "home" | "away";
  name: string;
  xi: SimPlayer[];
  bench: SimPlayer[];
  tactics: TeamTactics;
  homeAdvantage?: boolean;
  /** Optional club data for auto-assigning AI tactics to players without configured tactics */
  club?: Club;
  /** e.g. "4-3-3". Only the defensive-line count is read — fewer nominal
   * defenders reads as a more attacking shape (more threat, thinner cover),
   * more defenders reads as a more defensive shape. Everything else about
   * formation (space, passing lanes) is already implicit in each player's
   * `pos` via ATTACK_WEIGHT/DEFEND_WEIGHT below. */
  formation?: string;
  // optional team-level chemistry (0-100) to override tactics.chemistry
  chemistry?: number;
}

export type MatchInterventionType = "tactics" | "formation" | "sub";

export interface MatchIntervention {
  minute: number; // minute at which to apply (applies before that minute's play)
  side: "home" | "away";
  type: MatchInterventionType;
  payload: any;
}

/** Adapt a full squad-management `Player` (src/data/squad.ts) into the
 * lightweight ratings the engine consumes. Keeps the engine decoupled from
 * the richer roster data model while still driving off real attributes. */
type MatchEnginePlayer = BasePlayer & {
  fatigue?: number;
  form?: number;
  tacticalFamiliarity?: number | Record<string, number>;
};

export function playerToSim(p: MatchEnginePlayer): SimPlayer {
  const a = p.attrs;
  const overallLift = Math.max(0, (p.overall ?? 50) - 50) * 0.5;
  const attack = clamp(a.shooting * 0.38 + a.dribbling * 0.24 + a.pace * 0.2 + overallLift);
  const defend = clamp(
    a.defending * 0.46 + a.physical * 0.24 + a.passing * 0.12 + overallLift * 0.7,
  );
  const playmaking = clamp(a.passing * 0.52 + a.dribbling * 0.28 + overallLift * 0.6);
  const volatilePersonality =
    p.personality === "Temperamental" ||
    p.personality === "Volatile" ||
    p.personality === "Unsettled";
  const discipline = clamp(p.professionalism - (volatilePersonality ? 16 : 0));
  const fatigueMod = fatigueMatchModifier(p.fatigue ?? 0);
  const formMod = formMatchModifier(p.form ?? 50); // default form 50 = neutral
  const combinedMod = fatigueMod * formMod; // both modifiers multiply (compound effect)
  const simPlayer: SimPlayer = {
    id: p.id,
    shortName: p.shortName,
    number: p.number,
    pos: p.pos,
    role: p.role,
    x: p.x ?? 50,
    y: p.y ?? 50,
    baseFitness: p.fitness,
    overall: Math.round(p.overall * combinedMod),
    attack: Math.round(attack * combinedMod),
    defend: Math.round(defend * combinedMod),
    playmaking: Math.round(playmaking * combinedMod),
    discipline,
    isGK: p.pos === "GK",
  };
  if (p.tacticalFamiliarity !== undefined) {
    simPlayer.tacticalFamiliarity = p.tacticalFamiliarity;
  }
  if ((p as any).tacticalConfig !== undefined) {
    simPlayer.tacticalConfig = (p as any).tacticalConfig;
  }
  return simPlayer;
}

// ---- Output shape ------------------------------------------------------------

export interface SimMatchEvent extends MatchEvent {
  meta?: MatchEventMeta;
}

export interface TeamMatchStats {
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellow: number;
  red: number;
}

export interface MatchMinuteSnapshot {
  home: TeamMatchStats;
  away: TeamMatchStats;
  /** Cumulative average home possession share (0-100) up to and including this minute. */
  possessionHome: number;
}

export interface MatchSimulationResult {
  seed: number;
  events: SimMatchEvent[];
  fullTimeMinute: number;
  halfTimeMinute: number;
  secondHalfStartMinute: number;
  /** Indexed by minute, 0..fullTimeMinute inclusive. */
  snapshots: MatchMinuteSnapshot[];
  finalScore: { home: number; away: number };
  playerRatings: Record<string, number>;
}

interface PlayerMatchCounts {
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  chances: number;
  saves: number;
  fouls: number;
  yellow: number;
  red: number;
}

function normalizeRating(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function calcPlayerRating(
  player: SimPlayer,
  stats: PlayerMatchCounts,
  sideGoalsFor: number,
  sideGoalsAgainst: number,
  result: "W" | "D" | "L",
): number {
  const position = player.pos;
  const base = 5 + (player.overall - 50) / 18;
  let contribution = 0;

  if (position === "GK") {
    contribution += stats.saves * 0.24;
    contribution += stats.goals * 0.5;
    contribution -= stats.fouls * 0.05;
    contribution -= stats.yellow * 0.25;
    contribution -= stats.red * 1.1;
    if (sideGoalsAgainst === 0) contribution += 0.5;
    if (sideGoalsAgainst > 2) contribution -= 0.4;
    contribution += stats.shotsOnTarget * 0.06;
  } else {
    const attackWeight =
      position === "ST" || position === "LW" || position === "RW" || position === "CAM"
        ? 1.2
        : 0.85;
    const defendWeight =
      position === "CB" || position === "RB" || position === "LB" || position === "CDM" ? 1.1 : 0.7;
    contribution += stats.goals * (0.75 * attackWeight);
    contribution += stats.assists * (0.6 * attackWeight);
    contribution += stats.shotsOnTarget * 0.1 * attackWeight;
    contribution += stats.chances * 0.08 * attackWeight;
    contribution += stats.fouls * -0.04 * defendWeight;
    contribution += stats.yellow * -0.25;
    contribution += stats.red * -1.0;
    if (position === "CB" || position === "CDM") {
      if (sideGoalsAgainst === 0) contribution += 0.35;
      if (sideGoalsAgainst > 1) contribution -= 0.25;
    }
    if (position === "CM" || position === "CAM") {
      contribution += stats.shots * 0.02;
      contribution += stats.chances * 0.05;
    }
  }

  if (result === "W") contribution += 0.4;
  else if (result === "D") contribution += 0.15;
  else contribution -= 0.3;

  const raw = base + Math.max(-2.2, Math.min(2.0, contribution));
  return normalizeRating(raw);
}

function buildPlayerRatings(
  home: SimTeamInput,
  away: SimTeamInput,
  events: SimMatchEvent[],
  finalScore: { home: number; away: number },
): Record<string, number> {
  const counts: Record<string, PlayerMatchCounts> = {};
  const ensureCounts = (id: string) => {
    if (!counts[id]) {
      counts[id] = {
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        chances: 0,
        saves: 0,
        fouls: 0,
        yellow: 0,
        red: 0,
      };
    }
    return counts[id];
  };

  const sideById: Record<string, "home" | "away"> = {};
  [...home.xi, ...home.bench].forEach((p) => (sideById[p.id] = "home"));
  [...away.xi, ...away.bench].forEach((p) => (sideById[p.id] = "away"));
  [...home.xi, ...home.bench, ...away.xi, ...away.bench].forEach((p) => ensureCounts(p.id));

  for (const event of events) {
    if (!event.meta) continue;
    const id = event.meta.playerId;
    if (id) {
      const stat = ensureCounts(id);
      if (event.type === "goal") {
        stat.goals += 1;
        stat.shots += 1;
        stat.shotsOnTarget += 1;
        if (event.meta.assistId) {
          ensureCounts(event.meta.assistId).assists += 1;
        }
      } else if (event.type === "save") {
        stat.saves += 1;
        stat.shots += 1;
        stat.shotsOnTarget += 1;
      } else if (event.type === "shot") {
        stat.shots += 1;
        stat.shotsOnTarget += 1;
      } else if (event.type === "chance") {
        stat.chances += 1;
      } else if (event.type === "foul" || event.type === "freekick") {
        stat.fouls += 1;
      } else if (event.type === "yellow") {
        stat.yellow += 1;
      } else if (event.type === "red") {
        stat.red += 1;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(counts).map(([id, stats]) => {
      const side = sideById[id] ?? "home";
      const result =
        side === "home"
          ? finalScore.home > finalScore.away
            ? "W"
            : finalScore.home < finalScore.away
              ? "L"
              : "D"
          : finalScore.away > finalScore.home
            ? "W"
            : finalScore.away < finalScore.home
              ? "L"
              : "D";
      const sideGoalsFor = side === "home" ? finalScore.home : finalScore.away;
      const sideGoalsAgainst = side === "home" ? finalScore.away : finalScore.home;
      const player = [...home.xi, ...home.bench, ...away.xi, ...away.bench].find(
        (p) => p.id === id,
      );
      return [
        id,
        player ? calcPlayerRating(player, stats, sideGoalsFor, sideGoalsAgainst, result) : 5.0,
      ];
    }),
  );
}

// ---- Position weighting -------------------------------------------------------

const ATTACK_WEIGHT: Record<Pos, number> = {
  ST: 1.35,
  RW: 1.15,
  LW: 1.15,
  CAM: 1.2,
  CM: 0.9,
  CDM: 0.55,
  RB: 0.55,
  LB: 0.55,
  CB: 0.3,
  GK: 0.05,
};

const DEFEND_WEIGHT: Record<Pos, number> = {
  CB: 1.3,
  GK: 1.4,
  CDM: 1.15,
  RB: 1.0,
  LB: 1.0,
  CM: 0.7,
  CAM: 0.4,
  RW: 0.35,
  LW: 0.35,
  ST: 0.25,
};

function weightedAvg(
  players: SimPlayer[],
  valueFn: (p: SimPlayer) => number,
  weightFn: (p: SimPlayer) => number,
): number {
  let sum = 0;
  let wsum = 0;
  for (const p of players) {
    const w = weightFn(p);
    sum += valueFn(p) * w;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : 50;
}

function teamAttackRating(xi: SimPlayer[]): number {
  return weightedAvg(
    xi,
    (p) => p.attack * roleAttackModifier(p.role) * familiarityFactor(p),
    (p) => (ATTACK_WEIGHT[p.pos] ?? 0.6) * familiarityFactor(p),
  );
}

function teamDefendRating(xi: SimPlayer[]): number {
  return weightedAvg(
    xi,
    (p) => p.defend * roleDefendModifier(p.role) * familiarityFactor(p),
    (p) => (DEFEND_WEIGHT[p.pos] ?? 0.6) * familiarityFactor(p),
  );
}

function findGK(xi: SimPlayer[]): SimPlayer | undefined {
  return xi.find((p) => p.isGK) ?? xi[0];
}

/** Reads the defensive-line count out of a formation string (e.g. "4-3-3" →
 * 4, "3-5-2" → 3, "5-3-2" → 5) and turns it into a small attack/defend
 * multiplier pair, relative to a 4-at-the-back baseline. Fewer defenders =
 * a more attacking shape (extra body forward, thinner cover); more
 * defenders = a more defensive shape. */
function formationShapeMods(formation: string | undefined): { attack: number; defend: number } {
  const first = formation ? Number(formation.split("-")[0]) : NaN;
  if (!Number.isFinite(first)) return { attack: 1, defend: 1 };
  const delta = 4 - first; // >0 for attacking shapes (e.g. 3-5-2), <0 for defensive shapes (e.g. 5-3-2)
  return {
    attack: clampRatio(1 + delta * 0.045),
    defend: clampRatio(1 - delta * 0.05),
  };
}

// ---- Flavour text --------------------------------------------------------------

const CHANCE_MISS = [
  "{p} drags the effort wide",
  "{p} can't keep the header down",
  "{p} fires over the bar",
  "{p} sees the shot deflect behind",
  "{p} snatches at the chance and skies it",
  "{p} just can't find the target",
];

const SHOT_ONTARGET = [
  "{p} tests the keeper from range",
  "{p} forces a routine stop",
  "{p} shoots straight at the keeper",
  "{p} gets an effort away on goal",
];

const SAVE_TEXT = [
  "{gk} makes a smart stop",
  "{gk} pushes the effort round the post",
  "{gk} gets down well to save",
  "{gk} produces a fine reflex save",
  "{gk} is equal to it, tipping over the bar",
];

const GOAL_TEXT = [
  "{p} finishes clinically",
  "{p} finds the bottom corner",
  "{p} heads it home",
  "{p} curls a beauty into the top corner",
  "{p} slots it under the keeper",
  "{p} smashes it into the roof of the net",
];

const FOUL_TEXT = [
  "{p} concedes a needless foul",
  "{p} is caught late in the challenge",
  "{p} brings the run to a halt illegally",
  "{p} clips the heels of the attacker",
];

const CORNER_TEXT = [
  "Corner won after the last touch went behind",
  "Whipped in from the flag",
  "Another set piece to work with",
];

const FREEKICK_TEXT = [
  "{p} stands over a dangerous free kick",
  "{p} lines up a direct effort at goal",
  "A promising position to attack from",
];

const SUB_TEXT = "{in} replaces {out}";

function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

// ---- Simulation core -------------------------------------------------------

interface RuntimeSide {
  id: "home" | "away";
  name: string;
  onPitch: SimPlayer[];
  benchLeft: SimPlayer[];
  tactics: TeamTactics;
  homeAdvantage: boolean;
  cards: Map<string, "yellow">;
  subsUsed: number;
  score: number;
  stats: TeamMatchStats;
  // Player-level tactical instructions and familiarity
  playerInstructions: Map<string, string[]>; // playerId -> instruction IDs
  playerRoleFamiliarity: Map<string, number>; // playerId -> familiarityValue (0-100)
}

function makeRuntimeSide(
  input: SimTeamInput,
  playerInstructions?: Map<string, string[]>,
  playerRoleFamiliarity?: Map<string, number>,
): RuntimeSide {
  return {
    id: input.id,
    name: input.name,
    onPitch: [...input.xi],
    benchLeft: [...input.bench],
    tactics: input.tactics,
    homeAdvantage: input.homeAdvantage ?? false,
    cards: new Map(),
    subsUsed: 0,
    score: 0,
    stats: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellow: 0, red: 0 },
    playerInstructions: playerInstructions ?? new Map(),
    playerRoleFamiliarity: playerRoleFamiliarity ?? new Map(),
  };
}

/** How fast a team burns stamina, per minute. A high-tempo, high-press team
 * runs its players into the ground faster than one happy to sit off, especially
 * if players lack tactical familiarity with the system. */
function fatigueRate(tactics: TeamTactics, avgTacticalFamiliarity: number = 50): number {
  const aggressionFactor = (tactics.tempo + tactics.pressing - 100) / 480;
  const baseFatigue = clamp(0.22 + aggressionFactor, 0.16, 0.52); // increased max for aggressive tactics

  // Low tactical familiarity increases fatigue burn - players don't understand the system
  const familiarityPenalty = Math.max(0, 1 - Math.max(0, avgTacticalFamiliarity - 50) / 150);
  return baseFatigue * (1 + familiarityPenalty * 0.25); // up to 25% more fatigue with poor familiarity
}

function avgTacticalFamiliarity(team: RuntimeSide): number {
  if (team.onPitch.length === 0) return 50;
  const sum = team.onPitch.reduce((acc, p) => {
    const fam = typeof p.tacticalFamiliarity === "number" ? p.tacticalFamiliarity : 50;
    return acc + fam;
  }, 0);
  return Math.round(sum / team.onPitch.length);
}

function currentFitness(p: SimPlayer, minute: number, rate = 0.28): number {
  return clamp(p.baseFitness - minute * rate, 15, 100);
}

function gameStateModifiers(side: RuntimeSide, opponent: RuntimeSide, minute: number) {
  const diff = side.score - opponent.score;
  const late = minute >= 70;
  const leading = diff > 0;
  const trailing = diff < 0;
  const urgency = Math.min(1.16, 1 + Math.abs(diff) * 0.03 + Math.max(0, minute - 70) * 0.0025);
  const protection = Math.max(
    0.84,
    1 - Math.max(0, diff) * 0.03 - Math.max(0, minute - 75) * 0.0025,
  );
  const chasing = trailing && late;
  return {
    attackMultiplier: chasing ? urgency : leading && late ? protection : 1,
    defendMultiplier: leading && late ? 1.08 : chasing ? 0.95 : 1,
    pressingModifier: trailing ? 1.08 : leading && late ? 0.92 : 1,
    directnessModifier: trailing ? 1.08 : leading && late ? 0.92 : 1,
    mentalityModifier: trailing ? 1.06 : leading && late ? 0.92 : 1,
  };
}

/** Simulates a full match and returns the complete event timeline plus
 * per-minute aggregate stats. Deterministic for a given seed + inputs. */
const matchResultCache = new MemoCache<string, MatchSimulationResult>();

/** Build a cache key that captures the full match inputs — club ids, the
 * exact XI/bench player attributes (so a changed roster or a player's
 * form/fatigue shift invalidates the entry), tactics, formation, home
 * advantage and seed. Deterministic and cheap: a few string concats. */
function matchCacheKey(
  home: SimTeamInput,
  away: SimTeamInput,
  seed: number,
  interventions?: MatchIntervention[],
): string {
  const playerKey = (p: SimPlayer) =>
    `${p.id}:${p.overall}:${p.attack}:${p.defend}:${p.playmaking}:${p.baseFitness}:${p.discipline}`;
  const sideKey = (s: SimTeamInput) =>
    `${s.id}:${s.formation ?? ""}:${s.homeAdvantage ? 1 : 0}:${s.xi.map(playerKey).join("|")}:${s.bench.map(playerKey).join("|")}:${JSON.stringify(s.tactics)}`;
  const ivKey = interventions ? JSON.stringify(interventions) : "";
  return `${sideKey(home)}::${sideKey(away)}::${seed}::${ivKey}`;
}

export function simulateMatch(
  home: SimTeamInput,
  away: SimTeamInput,
  seed: number,
  interventions?: MatchIntervention[],
): MatchSimulationResult {
  const cacheKey = matchCacheKey(home, away, seed, interventions);
  const cached = matchResultCache.get(cacheKey);
  if (cached) return cached;
  const result = simulateMatchUncached(home, away, seed, interventions);
  matchResultCache.set(cacheKey, result);
  return result;
}

function simulateMatchUncached(
  home: SimTeamInput,
  away: SimTeamInput,
  seed: number,
  interventions?: MatchIntervention[],
): MatchSimulationResult {
  const rng = createRng(seed);
  const events: SimMatchEvent[] = [];

  // Apply AI tactics to teams that don't have them configured
  const applyAITacticsIfNeeded = (teamInput: SimTeamInput, teamSeed: number): void => {
    if (!teamInput.club) return;

    // Reconstruct a Player-like object for each SimPlayer to use with assignSquadTactics
    const playersWithClub = teamInput.xi.map((sp) => {
      // Convert SimPlayer back to Player-like structure for AI assignment
      // We only need enough info for the AI system to work
      const mockPlayer = {
        id: sp.id,
        pos: sp.pos,
        attrs: {
          pace: sp.overall * 0.7 + rng() * 20,
          shooting: sp.attack * 0.8 + rng() * 20,
          passing: sp.playmaking * 0.8 + rng() * 20,
          defending: sp.defend * 0.8 + rng() * 20,
          physical: sp.overall * 0.6 + rng() * 20,
          dribbling: sp.playmaking * 0.6 + sp.attack * 0.4 + rng() * 20,
          gk_positioning: sp.overall * (sp.isGK ? 0.8 : 0.3),
          gk_distribution: sp.playmaking * (sp.isGK ? 0.8 : 0.3),
          gk_reflexes: sp.overall * (sp.isGK ? 0.8 : 0.3),
          gk_handling: sp.overall * (sp.isGK ? 0.8 : 0.3),
        },
      } as any;
      return mockPlayer;
    });

    const aiTactics = assignSquadTactics(playersWithClub, teamInput.club, teamSeed);

    // Apply assigned tactics to SimPlayers that don't have them
    for (const player of teamInput.xi) {
      if (!player.tacticalConfig || !player.tacticalConfig.roleId) {
        const aiConfig = aiTactics.get(player.id);
        if (aiConfig && aiConfig.roleId) {
          player.tacticalConfig = {
            roleId: aiConfig.roleId,
            instructions: aiConfig.instructions,
            roleFamiliarity: aiConfig.roleFamiliarity,
          };
        }
      }
    }
  };

  // Apply AI tactics with deterministic seeds based on team ID and match seed
  applyAITacticsIfNeeded(home, seed ^ 0x12345678);
  applyAITacticsIfNeeded(away, seed ^ 0x87654321);

  // Extract player instructions and familiarity for both teams
  const extractPlayerTactics = (
    squad: SimPlayer[],
  ): [Map<string, string[]>, Map<string, number>] => {
    const instructions = new Map<string, string[]>();
    const familiarity = new Map<string, number>();
    for (const player of squad) {
      if (player.tacticalConfig?.instructions) {
        instructions.set(player.id, player.tacticalConfig.instructions);
      }
      if (player.tacticalConfig?.roleFamiliarity !== undefined) {
        familiarity.set(player.id, player.tacticalConfig.roleFamiliarity);
      }
    }
    return [instructions, familiarity];
  };

  const [homeInstructions, homeFamiliarity] = extractPlayerTactics(home.xi);
  const [awayInstructions, awayFamiliarity] = extractPlayerTactics(away.xi);

  const H = makeRuntimeSide(home, homeInstructions, homeFamiliarity);
  const A = makeRuntimeSide(away, awayInstructions, awayFamiliarity);
  const sides: Record<"home" | "away", RuntimeSide> = { home: H, away: A };

  const homeShape = formationShapeMods(home.formation);
  const awayShape = formationShapeMods(away.formation);
  const baseAttack: Record<"home" | "away", number> = {
    home: teamAttackRating(home.xi) * homeShape.attack,
    away: teamAttackRating(away.xi) * awayShape.attack,
  };
  const baseDefend: Record<"home" | "away", number> = {
    home: teamDefendRating(home.xi) * homeShape.defend,
    away: teamDefendRating(away.xi) * awayShape.defend,
  };

  // interventions indexed by minute
  const byMinute: Record<number, MatchIntervention[]> = {};
  (interventions ?? []).forEach((iv) => {
    const m = Math.max(1, Math.floor(iv.minute));
    byMinute[m] = [...(byMinute[m] ?? []), iv];
  });

  function applyInterventions(minute: number) {
    const list = byMinute[minute];
    if (!list) return;
    for (const iv of list) {
      const side = sides[iv.side];
      if (!side) continue;
      if (iv.type === "tactics") {
        // merge tactical changes into existing tactics
        side.tactics = { ...side.tactics, ...(iv.payload ?? {}) };
        // clamp values
        side.tactics.tempo = clamp(side.tactics.tempo);
        side.tactics.pressing = clamp(side.tactics.pressing);
        side.tactics.directness = clamp(side.tactics.directness);
        side.tactics.mentality = clamp(side.tactics.mentality);
        side.tactics.width = clamp(side.tactics.width);
        side.tactics.depth = clamp(side.tactics.depth);
        pushEvent(
          minute,
          "info",
          iv.side,
          `Manager changes tactics`,
          JSON.stringify(iv.payload),
          {} as any,
        );
      } else if (iv.type === "formation") {
        // update formation-based shape mods and recompute baseAttack/defend
        if (iv.payload && typeof iv.payload === "string") {
          if (iv.side === "home") {
            const ns = formationShapeMods(iv.payload);
            homeShape.attack = ns.attack;
            homeShape.defend = ns.defend;
            baseAttack.home = teamAttackRating(H.onPitch) * homeShape.attack;
            baseDefend.home = teamDefendRating(H.onPitch) * homeShape.defend;
          } else {
            const ns = formationShapeMods(iv.payload);
            awayShape.attack = ns.attack;
            awayShape.defend = ns.defend;
            baseAttack.away = teamAttackRating(A.onPitch) * awayShape.attack;
            baseDefend.away = teamDefendRating(A.onPitch) * awayShape.defend;
          }
          pushEvent(minute, "info", iv.side, `Manager changes formation to ${iv.payload}`);
        }
      } else if (iv.type === "sub") {
        // payload: { outId, inId }
        const outId = iv.payload?.outId;
        const inId = iv.payload?.inId;
        if (!outId || !inId) continue;
        if (side.subsUsed >= 3) continue;
        const outPlayer = side.onPitch.find((p) => p.id === outId);
        const inPlayer = side.benchLeft.find((p) => p.id === inId);
        if (!outPlayer || !inPlayer) continue;
        side.onPitch = side.onPitch.map((p) =>
          p.id === outId ? { ...inPlayer, baseFitness: 100, x: p.x, y: p.y } : p,
        );
        side.benchLeft = side.benchLeft.filter((p) => p.id !== inId);
        side.subsUsed += 1;
        pushEvent(
          minute,
          "sub",
          iv.side,
          `Manager substitution`,
          fmt(SUB_TEXT, { in: inPlayer.shortName, out: outPlayer.shortName }),
          { playerOffId: outId, playerInId: inId },
        );
        // recompute base attack/defend as personnel changed
        baseAttack[iv.side] =
          teamAttackRating(side.onPitch) *
          (iv.side === "home" ? homeShape.attack : awayShape.attack);
        baseDefend[iv.side] =
          teamDefendRating(side.onPitch) *
          (iv.side === "home" ? homeShape.defend : awayShape.defend);
      }
    }
  }

  const snapshots: MatchMinuteSnapshot[] = [];
  let possessionAccum = 0;
  let possessionSamples = 0;

  function pushEvent(
    minute: number,
    type: MatchEventType,
    side: "home" | "away" | "neutral",
    text: string,
    detail?: string,
    meta?: MatchEventMeta,
  ) {
    const evt: SimMatchEvent = { minute, type, side, text };
    if (detail !== undefined) evt.detail = detail;
    if (meta !== undefined) evt.meta = meta;
    events.push(evt);
  }

  function snapshot(minute: number, possessionHomeThisMinute: number) {
    possessionAccum += possessionHomeThisMinute;
    possessionSamples += 1;
    snapshots[minute] = {
      home: { ...H.stats },
      away: { ...A.stats },
      possessionHome: Math.round(possessionAccum / Math.max(1, possessionSamples)),
    };
  }

  function opponentOf(side: "home" | "away"): RuntimeSide {
    return side === "home" ? A : H;
  }

  /** `opponentPressing` lets a high-press opponent choke off this side's
   * attacking output (turnovers won before an attack ever develops).
   * `opponentDepth` is the space-in-behind trade-off: the higher the
   * *opponent's* defensive line, the more room this side has to exploit
   * in behind it. */
  function liveAttack(
    side: RuntimeSide,
    minute: number,
    opponentPressing: number,
    opponentDepth: number,
  ): number {
    const tacticalFam = avgTacticalFamiliarity(side);
    const rate = fatigueRate(side.tactics, tacticalFam);
    const avgFitness = side.onPitch.length
      ? side.onPitch.reduce((s, p) => s + currentFitness(p, minute, rate), 0) / side.onPitch.length
      : 70;
    const t = side.tactics;
    const stateMods = gameStateModifiers(side, opponentOf(side.id), minute);
    const tacticalBoost =
      1 +
      ((t.tempo - 55) / 260) * stateMods.mentalityModifier +
      ((t.directness - 55) / 400) * stateMods.directnessModifier +
      ((t.mentality - 55) / 240) * stateMods.mentalityModifier +
      ((t.width - 55) / 480) * (t.buildUp === "direct" ? 1.05 : 1) +
      ((t.depth - 55) / 900) *
        (t.defensiveBlock === "high" ? 0.9 : t.defensiveBlock === "low" ? 1.05 : 1);
    const pressDisruption = clampRatio(1 - (opponentPressing - 55) / 380, 0.78, 1.15);
    const spaceInBehind = clampRatio(
      1 + (opponentDepth - 55) / 380 - (t.defensiveBlock === "high" ? 0.05 : 0),
      0.82,
      1.18,
    );
    const advantage = side.homeAdvantage ? 1.18 : 1;
    const fatigue = 0.86 + 0.14 * (avgFitness / 100);
    const manpower = side.onPitch.length < 11 ? 0.82 : 1;
    const teamChem = chemistryFactor(side.tactics.chemistry ?? stateChem(side));
    const buildUp = side.tactics.buildUp ?? "mixed";
    const buildFactor = buildUp === "possession" ? 0.94 : buildUp === "direct" ? 1.08 : 1.0;
    const pressingSys = side.tactics.pressingSystem ?? "mixed";
    const pressingSystemFactor =
      pressingSys === "man" ? 1.07 : pressingSys === "zonal" ? 1.03 : 1.0;
    return (
      baseAttack[side.id] *
      tacticalBoost *
      pressDisruption *
      spaceInBehind *
      advantage *
      fatigue *
      manpower *
      buildFactor *
      pressingSystemFactor *
      teamChem *
      stateMods.attackMultiplier
    );
  }

  function liveDefend(side: RuntimeSide, minute: number): number {
    const tacticalFam = avgTacticalFamiliarity(side);
    const rate = fatigueRate(side.tactics, tacticalFam);
    const avgFitness = side.onPitch.length
      ? side.onPitch.reduce((s, p) => s + currentFitness(p, minute, rate), 0) / side.onPitch.length
      : 70;
    const t = side.tactics;
    const stateMods = gameStateModifiers(side, opponentOf(side.id), minute);
    const block = t.defensiveBlock ?? "mid";
    const blockFactor = block === "low" ? 0.92 : block === "high" ? 1.08 : 1.0;
    const tacticalPenalty = clampRatio(
      1 - (t.mentality - 55) / 320 - (t.width - 55) / 640 - (t.depth - 55) / 560,
    );
    const fatigue = 0.88 + 0.12 * (avgFitness / 100);
    const manpower = side.onPitch.length < 11 ? 0.82 : 1;
    return (
      baseDefend[side.id] *
      tacticalPenalty *
      fatigue *
      manpower *
      blockFactor *
      stateMods.defendMultiplier
    );
  }

  // helper to read chemistry, prefers explicit team value then tactics then default
  function stateChem(side: RuntimeSide) {
    return side.tactics.chemistry ?? (side.homeAdvantage ? 56 : 50);
  }

  /** Resolves a shot attempt for `attacker` on `side`, taking on the
   * opposing goalkeeper. Emits shot/save/goal + chance(miss) events. */
  function resolveShot(
    minute: number,
    side: "home" | "away",
    attacker: SimPlayer,
    assist?: SimPlayer,
  ) {
    const def = opponentOf(side);
    const gk = findGK(def.onPitch);
    const gkAbility = gk ? gk.defend : 55;
    const quality = clamp(attacker.attack + randInt(rng, -14, 14));
    sides[side].stats.shots += 1;

    const onTargetChance = clamp(TUNING.ONTARGET_BASE + (quality - 50) / 160, 0.15, 0.92);
    const onTarget = rng() < onTargetChance;

    const nameAttacker = attacker.shortName;

    if (!onTarget) {
      pushEvent(
        minute,
        "chance",
        side,
        fmt(pick(rng, CHANCE_MISS), { p: nameAttacker }),
        undefined,
        { playerId: attacker.id },
      );
      return;
    }

    sides[side].stats.shotsOnTarget += 1;

    const goalChance = clamp(TUNING.GOAL_BASE + (quality - gkAbility) / 130, 0.05, 0.78);
    if (rng() < goalChance) {
      sides[side].score += 1;
      const detail = assist ? `Assist: ${assist.shortName}` : undefined;
      const meta: MatchEventMeta = { playerId: attacker.id };
      if (assist) meta.assistId = assist.id;
      pushEvent(
        minute,
        "goal",
        side,
        `GOAL! ${fmt(pick(rng, GOAL_TEXT), { p: nameAttacker })}`,
        detail,
        meta,
      );
      return;
    }

    // On target but not in: either a save or a well-struck effort straight
    // at the keeper, depending on how sharp the attempt was.
    if (quality - gkAbility > 6 && rng() < 0.6) {
      pushEvent(
        minute,
        "save",
        side === "home" ? "away" : "home",
        fmt(pick(rng, SAVE_TEXT), { gk: gk?.shortName ?? "The keeper" }),
        `Denies ${nameAttacker}`,
        gk ? { playerId: gk.id } : undefined,
      );
    } else {
      pushEvent(
        minute,
        "shot",
        side,
        fmt(pick(rng, SHOT_ONTARGET), { p: nameAttacker }),
        undefined,
        { playerId: attacker.id },
      );
    }
  }

  function resolveFoul(minute: number, foulingSide: "home" | "away") {
    const fouler = weightedPlayerPick(rng, sides[foulingSide].onPitch, (p) => {
      const baseWeight = 100 - p.discipline + 10;
      // Apply tactical modifiers for pressing tendency
      const instructions = sides[foulingSide].playerInstructions.get(p.id) ?? [];
      const familiarity = sides[foulingSide].playerRoleFamiliarity.get(p.id) ?? 50;
      const mods = calculateTacticalModifiers(p, instructions, familiarity);
      return baseWeight * mods.pressingWeight * mods.foulTendency;
    });
    if (!fouler) return;
    sides[foulingSide].stats.fouls += 1;
    pushEvent(
      minute,
      "foul",
      foulingSide,
      fmt(pick(rng, FOUL_TEXT), { p: fouler.shortName }),
      undefined,
      { playerId: fouler.id },
    );

    const existingCard = sides[foulingSide].cards.get(fouler.id);
    const cardRoll = rng();
    const cardThreshold = 0.1 + (100 - fouler.discipline) / 260 + (minute > 75 ? 0.05 : 0);

    if (existingCard === "yellow") {
      // Second yellow → red, weighted a bit more likely than a fresh red.
      if (cardRoll < cardThreshold + 0.35) {
        sides[foulingSide].cards.delete(fouler.id);
        sides[foulingSide].onPitch = sides[foulingSide].onPitch.filter((p) => p.id !== fouler.id);
        sides[foulingSide].stats.red += 1;
        pushEvent(
          minute,
          "red",
          foulingSide,
          `Second yellow — ${fouler.shortName} is off!`,
          "Down to ten men",
          { playerId: fouler.id },
        );
        return;
      }
    } else if (cardRoll < cardThreshold) {
      if (cardRoll < cardThreshold * 0.08) {
        // Rare straight red for a reckless challenge.
        sides[foulingSide].onPitch = sides[foulingSide].onPitch.filter((p) => p.id !== fouler.id);
        sides[foulingSide].stats.red += 1;
        pushEvent(
          minute,
          "red",
          foulingSide,
          `Red card! ${fouler.shortName} is sent off`,
          "A reckless, high challenge",
          { playerId: fouler.id },
        );
        return;
      }
      sides[foulingSide].cards.set(fouler.id, "yellow");
      sides[foulingSide].stats.yellow += 1;
      pushEvent(minute, "yellow", foulingSide, `Booking — ${fouler.shortName}`, undefined, {
        playerId: fouler.id,
      });
    }

    // Dangerous positions sometimes turn the foul into a direct free kick chance.
    const dangerousSpot = rng() < 0.22;
    if (dangerousSpot) {
      const attackingSide = foulingSide === "home" ? "away" : "home";
      const taker = weightedPlayerPick(
        rng,
        sides[attackingSide].onPitch.filter((p) => !p.isGK),
        (p) => {
          const baseWeight = p.playmaking + p.attack * 0.4;
          // Apply tactical modifiers for playmaking availability
          const instructions = sides[attackingSide].playerInstructions.get(p.id) ?? [];
          const familiarity = sides[attackingSide].playerRoleFamiliarity.get(p.id) ?? 50;
          const mods = calculateTacticalModifiers(p, instructions, familiarity);
          return baseWeight * mods.passingAvailabilityWeight;
        },
      );
      if (taker) {
        pushEvent(
          minute,
          "freekick",
          attackingSide,
          fmt(pick(rng, FREEKICK_TEXT), { p: taker.shortName }),
          undefined,
          { playerId: taker.id },
        );
        if (rng() < 0.3) resolveShot(minute, attackingSide, taker);
      }
    }
  }

  function resolveCorner(minute: number, side: "home" | "away") {
    sides[side].stats.corners += 1;
    pushEvent(minute, "corner", side, `Corner — ${sides[side].name}`, pick(rng, CORNER_TEXT));
    if (rng() < 0.4) {
      // Outfield players only — goalkeepers don't go up for corners.
      const header = weightedPlayerPick(
        rng,
        sides[side].onPitch.filter((p) => !p.isGK),
        (p) => {
          const baseWeight = (p.pos === "CB" ? 1.1 : 0.6) + p.attack * 0.25;
          // Apply tactical modifiers for shooting/attacking
          const instructions = sides[side].playerInstructions.get(p.id) ?? [];
          const familiarity = sides[side].playerRoleFamiliarity.get(p.id) ?? 50;
          const mods = calculateTacticalModifiers(p, instructions, familiarity);
          return baseWeight * mods.shootingWeight;
        },
      );
      if (header) resolveShot(minute, side, header);
    }
  }

  function maybeSubstitution(minute: number, half: 1 | 2) {
    if (half !== 2) return;
    if (minute < 45 || minute > 88) return;
    (["home", "away"] as const).forEach((sideId) => {
      const side = sides[sideId];
      if (side.subsUsed >= 3) return;
      if (side.benchLeft.length === 0) return;
      const opponent = opponentOf(sideId);
      const scoreDiff = side.score - opponent.score;
      const rate = fatigueRate(side.tactics);
      const tiredCandidates = [...side.onPitch].filter(
        (p) => !p.isGK && currentFitness(p, minute, rate) < 88,
      );
      const tired = tiredCandidates.length
        ? tiredCandidates.sort(
            (a, b) => currentFitness(a, minute, rate) - currentFitness(b, minute, rate),
          )[0]
        : undefined;
      const urgent = scoreDiff < 0 && minute >= 60;
      const protection = scoreDiff > 0 && minute >= 75;
      const baseChance = urgent ? 0.45 : protection ? 0.12 : 0.08;
      if (rng() > baseChance) return;
      const benchSorted = [...side.benchLeft].sort((a, b) => {
        const aFam =
          typeof a.tacticalFamiliarity === "number"
            ? a.tacticalFamiliarity
            : typeof a.tacticalFamiliarity === "object"
              ? (Object.values(a.tacticalFamiliarity)[0] ?? 50)
              : (a.tacticalFamiliarity ?? 50);
        const bFam =
          typeof b.tacticalFamiliarity === "number"
            ? b.tacticalFamiliarity
            : typeof b.tacticalFamiliarity === "object"
              ? (Object.values(b.tacticalFamiliarity)[0] ?? 50)
              : (b.tacticalFamiliarity ?? 50);
        return bFam - aFam;
      });
      const replacement =
        side.score < opponent.score
          ? (benchSorted.find(
              (p) => p.pos === "ST" || p.pos === "CAM" || p.pos === "RW" || p.pos === "LW",
            ) ?? benchSorted[0])
          : protection
            ? (benchSorted.find(
                (p) => p.pos === "CB" || p.pos === "CDM" || p.pos === "RB" || p.pos === "LB",
              ) ?? benchSorted[0])
            : (benchSorted.find((p) => p.pos === tired?.pos) ?? benchSorted[0]);
      if (!replacement || !tired) return;
      side.benchLeft = side.benchLeft.filter((p) => p.id !== replacement.id);
      side.onPitch = side.onPitch.map((p) =>
        p.id === tired.id ? { ...replacement, x: tired.x, y: tired.y, baseFitness: 100 } : p,
      );
      side.subsUsed += 1;
      pushEvent(
        minute,
        "sub",
        sideId,
        `Substitution — ${side.name}`,
        fmt(SUB_TEXT, { in: replacement.shortName, out: tired.shortName }),
        { playerOffId: tired.id, playerInId: replacement.id },
      );
    });
  }

  function autoAdjustTactics(minute: number) {
    (["home", "away"] as const).forEach((sideId) => {
      const side = sides[sideId];
      const opponent = opponentOf(sideId);
      if (side.subsUsed < 3 && minute >= 70 && side.score < opponent.score && rng() < 0.28) {
        side.tactics.mentality = clamp(side.tactics.mentality + 8);
        side.tactics.directness = clamp(side.tactics.directness + 6);
        side.tactics.pressing = clamp(side.tactics.pressing + 5);
        side.tactics.width = clamp(side.tactics.width + 4);
        pushEvent(minute, "info", sideId, `Manager urges ${side.name} forward`, undefined, {
          kind: "chase",
          mentality: side.tactics.mentality,
        } as any);
      }
      if (minute >= 80 && side.score > opponent.score && rng() < 0.22) {
        side.tactics.mentality = clamp(side.tactics.mentality - 10);
        side.tactics.tempo = clamp(side.tactics.tempo - 6);
        side.tactics.width = clamp(side.tactics.width - 5);
        side.tactics.depth = clamp(side.tactics.depth + 6);
        side.tactics.defensiveBlock = "high";
        pushEvent(minute, "info", sideId, `Manager asks ${side.name} to sit deeper`, undefined, {
          kind: "protect",
          mentality: side.tactics.mentality,
        } as any);
      }
    });
  }

  function simulateMinute(minute: number, half: 1 | 2) {
    autoAdjustTactics(minute);
    const homeAtk = liveAttack(H, minute, A.tactics.pressing, A.tactics.depth);
    const awayAtk = liveAttack(A, minute, H.tactics.pressing, H.tactics.depth);
    const homeDef = liveDefend(H, minute);
    const awayDef = liveDefend(A, minute);

    // Territory/possession this minute, driven by relative strength + noise.
    const homePressure = homeAtk + homeDef * 0.3 + H.tactics.pressing * 0.1;
    const awayPressure = awayAtk + awayDef * 0.3 + A.tactics.pressing * 0.1;
    const noise = (rng() - 0.5) * 14;
    const possessionHome = clamp(50 + (homePressure - awayPressure) * 0.55 + noise, 30, 72);
    snapshot(minute, possessionHome);

    // Chance of a notable event this minute.
    const eventChance = TUNING.EVENT_BASE + (H.tactics.tempo + A.tactics.tempo - 110) / 900;
    if (rng() > clamp(eventChance, 0.12, 0.4)) {
      maybeSubstitution(minute, half);
      return;
    }

    // momentum: simple short-term gauge based on score difference and possession trend
    const recentScoreDiff =
      H.score - A.score - (snapshots[Math.max(0, minute - 6)]?.home?.shots ?? 0) * 0 + 0; // placeholder small-term
    const momentumHome = clamp(
      0.5 + (H.score - A.score) * 0.06 + (possessionHome - 50) / 220,
      0.6,
      1.4,
    );
    const homeBias = H.homeAdvantage ? 1.18 : 1;
    const awayBias = A.homeAdvantage ? 1.18 : 1;
    const homeNoise = (rng() - 0.5) * 1.2;
    const awayNoise = (rng() - 0.5) * 1.2;
    const homeWeight = Math.max(
      0.12,
      Math.min(
        2.3,
        (homeAtk / Math.max(1, awayDef) + (possessionHome - 50) / 20) * momentumHome * homeBias +
          homeNoise,
      ),
    );
    const awayWeight = Math.max(
      0.12,
      Math.min(
        2.3,
        (awayAtk / Math.max(1, homeDef) + (50 - possessionHome) / 20) *
          (2 - momentumHome) *
          awayBias +
          awayNoise,
      ),
    );
    const side: "home" | "away" = weightedPick(rng, [
      { v: "home", w: Math.max(0.08, homeWeight) },
      { v: "away", w: Math.max(0.08, awayWeight) },
    ]);
    const attackingSide = sides[side];
    const defendingSideId: "home" | "away" = side === "home" ? "away" : "home";

    const directness = attackingSide.tactics.directness;
    const width = attackingSide.tactics.width;
    const kind = weightedPick(rng, [
      { v: "shot" as const, w: 34 + directness * 0.15 },
      { v: "chance" as const, w: 16 },
      // Wider play manufactures more crosses/corners; a narrow, direct team
      // skips straight to shooting instead.
      { v: "corner" as const, w: 16 - directness * 0.05 + width * 0.06 },
      { v: "foul" as const, w: 26 + sides[defendingSideId].tactics.pressing * 0.1 },
      { v: "quiet" as const, w: 18 },
    ]);

    if (kind === "shot") {
      const attacker = weightedPlayerPick(
        rng,
        attackingSide.onPitch.filter((p) => !p.isGK),
        (p) => {
          const baseWeight =
            ATTACK_WEIGHT[p.pos] * p.attack +
            currentFitness(
              p,
              minute,
              fatigueRate(attackingSide.tactics, avgTacticalFamiliarity(attackingSide)),
            ) *
              0.15;
          // Apply tactical modifiers for attacking runs and shooting
          const instructions = attackingSide.playerInstructions.get(p.id) ?? [];
          const familiarity = attackingSide.playerRoleFamiliarity.get(p.id) ?? 50;
          const mods = calculateTacticalModifiers(p, instructions, familiarity);
          return baseWeight * mods.attackingRunWeight * mods.shootingWeight;
        },
      );
      if (!attacker) return;
      let assist: SimPlayer | undefined;
      if (rng() < 0.62) {
        const pool = attackingSide.onPitch.filter((p) => p.id !== attacker.id && !p.isGK);
        assist = weightedPlayerPick(rng, pool, (p) => {
          const baseWeight = p.playmaking;
          // Apply tactical modifiers for playmaking
          const instructions = attackingSide.playerInstructions.get(p.id) ?? [];
          const familiarity = attackingSide.playerRoleFamiliarity.get(p.id) ?? 50;
          const mods = calculateTacticalModifiers(p, instructions, familiarity);
          return baseWeight * mods.passingAvailabilityWeight;
        });
      }
      resolveShot(minute, side, attacker, assist);
    } else if (kind === "chance") {
      const attacker = weightedPlayerPick(
        rng,
        attackingSide.onPitch.filter((p) => !p.isGK),
        (p) => {
          const baseWeight = ATTACK_WEIGHT[p.pos] * p.attack + 5;
          // Apply tactical modifiers for attacking runs
          const instructions = attackingSide.playerInstructions.get(p.id) ?? [];
          const familiarity = attackingSide.playerRoleFamiliarity.get(p.id) ?? 50;
          const mods = calculateTacticalModifiers(p, instructions, familiarity);
          return baseWeight * mods.attackingRunWeight;
        },
      );
      if (attacker) {
        pushEvent(
          minute,
          "chance",
          side,
          fmt(pick(rng, CHANCE_MISS), { p: attacker.shortName }),
          undefined,
          { playerId: attacker.id },
        );
      }
    } else if (kind === "corner") {
      resolveCorner(minute, side);
    } else if (kind === "foul") {
      resolveFoul(minute, defendingSideId);
    }
    // "quiet": build-up play that fizzles out — no discrete event, just possession/fatigue.

    maybeSubstitution(minute, half);
  }

  // ---- Kickoff -----------------------------------------------------------
  pushEvent(0, "whistle", "neutral", "Kick-off", `${H.name} get us underway`);
  snapshot(0, 52 + (rng() - 0.5) * 6);

  // ---- First half ----------------------------------------------------------
  for (let minute = 1; minute <= 45; minute++) {
    applyInterventions(minute);
    simulateMinute(minute, 1);
  }

  const firstHalfStoppage = randInt(rng, 1, 3);
  const halfTimeMinute = 45 + firstHalfStoppage;
  if (firstHalfStoppage > 0) {
    pushEvent(
      44,
      "info",
      "neutral",
      `${firstHalfStoppage} minute${firstHalfStoppage > 1 ? "s" : ""} added`,
      "Fourth official's board goes up",
    );
    for (let minute = 46; minute <= halfTimeMinute; minute++) {
      applyInterventions(minute);
      simulateMinute(minute, 1);
    }
  }
  pushEvent(
    halfTimeMinute,
    "whistle",
    "neutral",
    "Half-time",
    `${H.name} ${H.score}-${A.score} ${A.name}`,
  );
  snapshot(halfTimeMinute, snapshots[halfTimeMinute - 1]?.possessionHome ?? 50);

  // ---- Second half ---------------------------------------------------------
  const secondHalfStartMinute = halfTimeMinute + 1;
  pushEvent(
    secondHalfStartMinute,
    "whistle",
    "neutral",
    "Second half underway",
    "Players re-emerge for the restart",
  );
  for (let minute = secondHalfStartMinute + 1; minute <= 90; minute++) {
    applyInterventions(minute);
    simulateMinute(minute, 2);
  }

  const stoppageDrivers =
    H.stats.yellow +
    A.stats.yellow +
    H.stats.red +
    A.stats.red +
    H.subsUsed +
    A.subsUsed +
    H.score +
    A.score;
  const secondHalfStoppage = clamp(
    2 + Math.round(stoppageDrivers * 0.4) + randInt(rng, 0, 2),
    2,
    8,
  );
  const fullTimeMinute = 90 + secondHalfStoppage;
  pushEvent(
    89,
    "info",
    "neutral",
    `${secondHalfStoppage} minutes added`,
    "Fourth official raises the board",
  );
  for (let minute = 91; minute <= fullTimeMinute; minute++) {
    applyInterventions(minute);
    simulateMinute(minute, 2);
  }

  pushEvent(
    fullTimeMinute,
    "whistle",
    "neutral",
    "Full-time",
    `${H.name} ${H.score}-${A.score} ${A.name}`,
  );
  snapshot(fullTimeMinute, snapshots[fullTimeMinute - 1]?.possessionHome ?? 50);

  // Fill any minute gaps in the snapshot array (minutes with no explicit
  // event still need a carried-forward stats/possession snapshot).
  let last: MatchMinuteSnapshot = snapshots[0] ?? {
    home: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellow: 0, red: 0 },
    away: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellow: 0, red: 0 },
    possessionHome: 50,
  };
  for (let minute = 0; minute <= fullTimeMinute; minute++) {
    const existing = snapshots[minute];
    if (existing) {
      last = existing;
    } else {
      snapshots[minute] = last;
    }
  }

  events.sort((a, b) => a.minute - b.minute);

  return {
    seed,
    events,
    fullTimeMinute,
    halfTimeMinute,
    secondHalfStartMinute,
    snapshots,
    finalScore: { home: H.score, away: A.score },
    playerRatings: buildPlayerRatings(home, away, events, { home: H.score, away: A.score }),
  };
}

// Home defaults match the baseline shown on the Tactics screen (Width 68 /
// Depth 55 / Tempo 72 / Pressing 60) so the very first match plays out
// consistently with what the manager sees before touching anything.
export const DEFAULT_HOME_TACTICS: TeamTactics = {
  tempo: 72,
  pressing: 60,
  directness: 48,
  mentality: 55,
  width: 68,
  depth: 55,
};
export const DEFAULT_AWAY_TACTICS: TeamTactics = {
  tempo: 54,
  pressing: 56,
  directness: 60,
  mentality: 50,
  width: 55,
  depth: 50,
};
// Extended defaults to include new knobs for compatibility
export const EXTENDED_DEFAULT_HOME_TACTICS: TeamTactics = {
  ...DEFAULT_HOME_TACTICS,
  pressingSystem: "mixed",
  defensiveBlock: "mid",
  buildUp: "mixed",
  counterTendency: 48,
  chemistry: 56,
};

export const EXTENDED_DEFAULT_AWAY_TACTICS: TeamTactics = {
  ...DEFAULT_AWAY_TACTICS,
  pressingSystem: "mixed",
  defensiveBlock: "mid",
  buildUp: "mixed",
  counterTendency: 44,
  chemistry: 50,
};
