/* =============================================================================
 * AI club decision framework
 * =============================================================================
 * Phase D2.1. Continues from D1 (`state/ai-manager.ts`), which gave every
 * AI club a static `AIManagerProfile` but deliberately implemented no
 * behaviour. This phase builds the ARCHITECTURE that future phases will use
 * to make actual decisions (transfers, contract offers, tactical changes,
 * ...) — it does not make any of those decisions itself. Nothing in this
 * module writes to `GameState`, dispatches an action, or lists an actual
 * transfer target; it only scores and ranks abstract PRIORITIES ("this club
 * currently leans toward strengthening its squad") that a later phase can
 * read from when it decides what to actually do about it.
 *
 * The brief's six inputs, and where each one currently comes from:
 *
 *  - CLUB FINANCES  — only the player's own club has a real `Finances`
 *    ledger (`GameState.finances`, see `state/types.ts`'s note on `Club`).
 *    AI clubs have no ledger yet, so `buildFinancialProfile` ESTIMATES one
 *    from `reputation` + the club's `aiManager.financialTendency`, the same
 *    deterministic-hash approach `state/ai-manager.ts` uses. `source` on
 *    the result says which kind of number you got — never silently treat
 *    an estimate as if it were real money.
 *  - SQUAD NEEDS — only the player's club has full `Player` records
 *    (`Club.playerIds`). The next opponent has a lightweight `simRoster`.
 *    Every other AI club has neither. `assessSquadNeeds` reads whichever of
 *    those is available and is honest about it via `dataConfidence`
 *    ("full" / "partial" / "none") rather than inventing needs for a squad
 *    it can't see.
 *  - CLUB PHILOSOPHY vs MANAGER PHILOSOPHY — these are kept as two
 *    genuinely different things, on purpose. `deriveClubPhilosophy` is the
 *    boardroom's long-run institutional identity: derived once from the
 *    club's own id (deterministic, independent of who's currently in the
 *    dugout — same pattern as `generateAIManager`, just salted
 *    differently). `readManagerPhilosophy` is whoever is CURRENTLY
 *    managing — `AIManagerProfile.philosophy` for an AI club, or the
 *    player's own `Manager.philosophy` free text for the club they manage.
 *    The two can agree or clash; `philosophyAlignment` scores how much.
 *  - CLUB REPUTATION — read straight off `Club.reputation`.
 *  - LEAGUE POSITION — read via `state/standings.ts`'s existing
 *    `computeClubStanding`, not recomputed here.
 *
 * Determinism vs randomness: every INPUT above is either read straight off
 * `GameState` or derived with the same seeded-hash technique
 * `state/ai-manager.ts` already uses — never `Math.random()`, so a given
 * save always produces the same context. `evaluateClubPriorities`, the one
 * function that produces a final ranking, is the only place any
 * randomness-flavoured jitter enters, and even that is a seeded hash (see
 * `seededJitter`) rather than real randomness — same club + same
 * `seedSalt` always reproduces the same ranking (debuggable), while
 * changing `seedSalt` (e.g. to the current matchday) gives controlled
 * variation without the outcome becoming untestable.
 * ---------------------------------------------------------------------------*/

import { getPhilosophy, MANAGER_PHILOSOPHIES } from "@/data/manager-philosophies";
import { computeClubTableRow, computeLeagueTable } from "./standings";
import type {
  Club,
  FinancialTendency,
  GameState,
  Player,
  Pos,
  TransferListing,
  ClubMemory,
} from "./types";
import computeClubFinancials from "./club-finance";
import { getPersonalityPriorityBoosts } from "./ai-personality";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// ---- deterministic hash helpers ------------------------------------------------
// Deliberately a separate local copy rather than a shared import — same
// reasoning `state/ai-manager.ts` gives for its own copy of this: this
// module shouldn't depend on the (unrelated) wizard/AI-manager generation
// code just to get a seeded random unit.

function seededUnit(seedStr: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 10_000) / 10_000;
}

function hashInt(seedStr: string, salt: number, min: number, max: number): number {
  return min + Math.floor(seededUnit(seedStr, salt) * (max - min + 1));
}

// ---- money strings -------------------------------------------------------------

/** Parses the finance display strings seeded in `state/seed.ts`
 * ("€24.5M", "€480,000 / wk", "€61.2M") into a plain number of euros.
 * Deliberately its own small parser rather than reusing `seed.ts`'s
 * player-value one: that one is tuned for compact "€41.0M"/"€520K" values
 * and would misparse a "/ wk" suffix (its "strip everything but digits/M/K"
 * step would grab the "k" out of "wk"). This version only reads an M/K
 * unit when it's directly adjacent to the number. */
function parseFinanceAmount(display: string): number {
  const cleaned = display.replace(/[€$£,]/g, "").trim();
  const match = /^(-?[\d.]+)\s*([MK])?/i.exec(cleaned);
  if (!match?.[1]) return 0;
  const n = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

// ---- 1. club finances ------------------------------------------------------------

export type ClubFinancialTier = "crisis" | "tight" | "stable" | "comfortable" | "wealthy";

export interface ClubFinancialProfile {
  tier: ClubFinancialTier;
  /** 0-100: how free this club feels to spend on transfers right now. */
  spendingPower: number;
  /** 0-100: wage-bill room before wages become a board concern. */
  wageHeadroom: number;
  tendency: FinancialTendency;
  /** "modeled" — read from a real `Finances` ledger (only ever true for
   * the player's own club today). "estimated" — derived from reputation
   * and `financialTendency` because no AI club has a ledger yet. */
  source: "modeled" | "estimated";
}

function tierFor(spendingPower: number): ClubFinancialTier {
  if (spendingPower >= 75) return "wealthy";
  if (spendingPower >= 55) return "comfortable";
  if (spendingPower >= 35) return "stable";
  if (spendingPower >= 15) return "tight";
  return "crisis";
}

const TENDENCY_BONUS: Record<FinancialTendency, number> = {
  frugal: -10,
  balanced: 0,
  spender: 15,
};

/** Builds a `ClubFinancialProfile` for `club`. `financesLedger` is the
 * player's own `GameState.finances` — pass it only for the club the player
 * manages; every other club falls back to the reputation/tendency
 * estimate. `financialTendency` defaults to "balanced" for the player's
 * own club (which has no `aiManager` and therefore no tendency of its
 * own). */
export function buildFinancialProfile(
  club: Pick<Club, "id" | "reputation" | "identity">,
  financialTendency: FinancialTendency = "balanced",
  financesLedger?: { transferBudget: string; balance: string },
  state?: GameState,
): ClubFinancialProfile {
  // If we have an authoritative GameState, prefer the computed club financials
  if (state) {
    try {
      const cf = computeClubFinancials(state, club.id);
      const transferBudget = cf.transferBudget;
      const wageHeadroom = clamp(50 + ((cf.wageBudgetWeekly * 52) / 20_000_000) * 25);
      const spendingPower = clamp((transferBudget / 50_000_000) * 100);
      return {
        tier: tierFor(spendingPower),
        spendingPower,
        wageHeadroom,
        tendency: financialTendency,
        source: "modeled",
      };
    } catch (err) {
      // fallthrough to legacy behaviour if computation fails

      console.error("buildFinancialProfile: computeClubFinancials failed", err);
    }
  }

  if (financesLedger) {
    const transferBudget = parseFinanceAmount(financesLedger.transferBudget);
    const balance = parseFinanceAmount(financesLedger.balance);
    const spendingPower = clamp((transferBudget / 50_000_000) * 100);
    const wageHeadroom = clamp(50 + (balance / 20_000_000) * 25);
    return {
      tier: tierFor(spendingPower),
      spendingPower,
      wageHeadroom,
      tendency: financialTendency,
      source: "modeled",
    };
  }

  const seed = `aifin:${club.id}`;
  const tendencyBonus = TENDENCY_BONUS[financialTendency];
  let spendingPower = clamp(club.reputation * 0.6 + tendencyBonus + hashInt(seed, 1, 0, 15));
  const wageHeadroom = clamp(club.reputation * 0.5 + tendencyBonus * 0.5 + hashInt(seed, 2, 0, 20));
  if ((club as any).identity?.transferBudgetFactor) {
    const factor = (club as any).identity.transferBudgetFactor || 1;
    spendingPower = clamp(Math.round(spendingPower * factor));
  }
  return {
    tier: tierFor(spendingPower),
    spendingPower,
    wageHeadroom,
    tendency: financialTendency,
    source: "estimated",
  };
}

// ---- 2. squad needs ---------------------------------------------------------------

export type PositionGroup = "goalkeeper" | "defense" | "midfield" | "attack";

const POSITION_GROUP: Record<Pos, PositionGroup> = {
  GK: "goalkeeper",
  RB: "defense",
  CB: "defense",
  LB: "defense",
  CDM: "midfield",
  CM: "midfield",
  CAM: "midfield",
  RW: "attack",
  LW: "attack",
  ST: "attack",
};

/** Baseline "healthy" headcount per group, calibrated off the one squad
 * this codebase fully models (`data/squad.ts`'s 18 players: 2 GK / 6 def /
 * 5 mid / 5 att) — a reasonable depth reference, not a rule the game
 * enforces anywhere. Used only to judge whether a group looks thin. */
const EXPECTED_GROUP_COUNT: Record<PositionGroup, number> = {
  goalkeeper: 2,
  defense: 6,
  midfield: 5,
  attack: 5,
};

const ALL_POSITION_GROUPS: PositionGroup[] = ["goalkeeper", "defense", "midfield", "attack"];

export type SquadDataConfidence = "full" | "partial" | "none";

export interface SquadGroupNeed {
  group: PositionGroup;
  count: number;
  averageOverall: number;
  /** 0-100: higher = more urgent to strengthen this group. Always 0 when
   * `dataConfidence` is "none" — see `assessSquadNeeds`. */
  need: number;
}

export interface SquadNeedsAssessment {
  dataConfidence: SquadDataConfidence;
  groups: SquadGroupNeed[]; // always one entry per PositionGroup, in ALL_POSITION_GROUPS order
  mostUrgentGroup: PositionGroup | null;
}

/** The minimal per-player slice this needs — satisfied by both a full
 * `Player` and a lightweight `SimPlayer`. */
export interface RosterEntryInput {
  pos: Pos;
  overall: number;
}

function needScore(count: number, averageOverall: number, expected: number): number {
  const countGap = clamp(((expected - count) / expected) * 100, 0, 100);
  const qualityGap = clamp(100 - averageOverall, 0, 100);
  return clamp(countGap * 0.6 + qualityGap * 0.4);
}

/** Scores how urgently each position group needs strengthening, from
 * whatever roster data is actually available for this club — see the
 * module header on why that varies by club. Never fabricates a need for a
 * club with no visible roster; it reports `dataConfidence: "none"` and
 * zeroes every group instead. */
export function assessSquadNeeds(
  entries: RosterEntryInput[],
  dataConfidence: SquadDataConfidence,
): SquadNeedsAssessment {
  if (dataConfidence === "none" || entries.length === 0) {
    return {
      dataConfidence: "none",
      groups: ALL_POSITION_GROUPS.map((group) => ({ group, count: 0, averageOverall: 0, need: 0 })),
      mostUrgentGroup: null,
    };
  }

  const groups = ALL_POSITION_GROUPS.map((group): SquadGroupNeed => {
    const inGroup = entries.filter((e) => POSITION_GROUP[e.pos] === group);
    const count = inGroup.length;
    const averageOverall =
      count === 0 ? 0 : Math.round(inGroup.reduce((sum, e) => sum + e.overall, 0) / count);
    return {
      group,
      count,
      averageOverall,
      need: needScore(count, averageOverall, EXPECTED_GROUP_COUNT[group]),
    };
  });

  const mostUrgentGroup =
    groups.reduce((a, b) => (b.need > a.need ? b : a)).need > 0
      ? groups.reduce((a, b) => (b.need > a.need ? b : a)).group
      : null;

  return { dataConfidence, groups, mostUrgentGroup };
}

/** Picks the right roster source for `club` and turns it into
 * `RosterEntryInput[]` + an honest `SquadDataConfidence` — "full" for the
 * player's own club (real `Player` records via `playerIds`), "partial" for
 * a club with only a lightweight `simRoster` (e.g. the next opponent — no
 * age/development data behind those ratings), "none" for everyone else. */
export function buildRosterInputs(
  club: Pick<Club, "playerIds" | "simRoster">,
  players: Record<string, Player>,
): { entries: RosterEntryInput[]; dataConfidence: SquadDataConfidence } {
  if (club.playerIds.length > 0) {
    const entries = club.playerIds
      .map((id) => players[id])
      .filter((p): p is Player => Boolean(p))
      .map((p) => ({ pos: p.pos, overall: p.overall }));
    return { entries, dataConfidence: entries.length > 0 ? "full" : "none" };
  }
  if (club.simRoster) {
    const entries = [...club.simRoster.xi, ...club.simRoster.bench].map((p) => ({
      pos: p.pos,
      overall: p.overall,
    }));
    return { entries, dataConfidence: "partial" };
  }
  return { entries: [], dataConfidence: "none" };
}

// ---- 3. club philosophy vs manager philosophy --------------------------------

export interface PhilosophyProfile {
  /** A `MANAGER_PHILOSOPHIES` id, or `null` if this manager/club has no
   * resolvable philosophy yet (e.g. the player picked "Still finding an
   * identity" and hasn't settled on one of the named philosophies). */
  id: string | null;
  label: string;
}

/** The club's own long-run institutional identity — see the module header
 * for why this is deliberately independent of whoever currently manages
 * it. Derived once from the club's id with its own salt (distinct from
 * `state/ai-manager.ts`'s `philosophy` salt), so a club's institutional
 * identity and its current manager's personal one are two independent
 * draws that can agree or clash. */
export function deriveClubPhilosophy(club: Pick<Club, "id">): PhilosophyProfile {
  const seed = `clubphil:${club.id}`;
  const idx = hashInt(seed, 1, 0, MANAGER_PHILOSOPHIES.length - 1);
  const philosophy = MANAGER_PHILOSOPHIES[idx]!;
  return { id: philosophy.id, label: philosophy.label };
}

/** Reads whoever is CURRENTLY managing `club` — the AI manager's
 * philosophy id if it has one, or (for the player's own club) the
 * player's free-text `Manager.philosophy`, matched back to an id where
 * possible so it can still be compared against `deriveClubPhilosophy`. */
export function readManagerPhilosophy(
  club: Pick<Club, "aiManager">,
  managerPhilosophyText?: string,
): PhilosophyProfile {
  if (club.aiManager) {
    const philosophy = getPhilosophy(club.aiManager.philosophy);
    return { id: club.aiManager.philosophy, label: philosophy?.label ?? club.aiManager.philosophy };
  }
  const match = MANAGER_PHILOSOPHIES.find((p) => p.philosophyText === managerPhilosophyText);
  return { id: match?.id ?? null, label: match?.label ?? managerPhilosophyText ?? "Unproven" };
}

/** 0-100: how closely a club's institutional identity and its current
 * manager's personal philosophy agree. Exact match scores highest; a
 * partial match (they lean on at least one shared skill, via
 * `focusSkills`) scores moderately; a clean mismatch scores low. Either
 * side being unresolved (`id === null`) is treated as neutral, not as a
 * mismatch — there's nothing concrete to clash with. */
export function philosophyAlignment(club: PhilosophyProfile, manager: PhilosophyProfile): number {
  if (!club.id || !manager.id) return 50;
  if (club.id === manager.id) return 100;
  const clubPhilosophy = getPhilosophy(club.id);
  const managerPhilosophy = getPhilosophy(manager.id);
  const sharesFocus = Boolean(
    clubPhilosophy &&
    managerPhilosophy &&
    clubPhilosophy.focusSkills.some((s) => managerPhilosophy.focusSkills.includes(s)),
  );
  return sharesFocus ? 60 : 25;
}

// ---- putting it together: the decision context ---------------------------------

export interface ClubDecisionContext {
  clubId: string;
  clubName: string;
  reputation: number;
  leaguePosition: { position: number; points: number; played: number; totalClubs: number } | null;
  finances: ClubFinancialProfile;
  squadNeeds: SquadNeedsAssessment;
  clubPhilosophy: PhilosophyProfile;
  managerPhilosophy: PhilosophyProfile;
  philosophyAlignment: number;
  /** 0-100: how readily this club hands minutes to academy players over
   * established pros. From `aiManager.youthPreference` where one exists;
   * otherwise estimated from `facilities.youth`, since that field exists
   * for every club (including the player's own). */
  youthLean: number;
  /** Recent structured memories the club holds (bounded, most-recent last). */
  memory: ClubMemory;
  /** Optional club personality generated by Phase 6.3 layer. */
  personality?: import("./ai-personality").ClubPersonality | null;
}

/** Assembles a `ClubDecisionContext` for `clubId` from the current
 * `GameState` — the one function everything else in this module (and any
 * future decision logic) is meant to be called with. Pure read: never
 * mutates `state`. */
export function buildClubDecisionContext(state: GameState, clubId: string): ClubDecisionContext {
  const club = state.clubs[clubId];
  if (!club) {
    throw new Error(`buildClubDecisionContext: unknown clubId "${clubId}"`);
  }

  const isPlayerClub = club.id === state.currentClub.id;

  // PERFORMANCE: Use the targeted single-club row lookup instead of
  // computing the full league table (which scans all fixtures) twice.
  // `computeClubTableRow` returns the same row `computeClubStanding` would
  // (including position), but avoids building the full table when the
  // enclosing competition's table isn't already cached.
  const leagueTable = computeClubTableRow(state, club.leagueId, club.id);
  const leaguePosition = leagueTable
    ? {
        position: leagueTable.position,
        points: leagueTable.points,
        played: leagueTable.played,
        totalClubs: computeLeagueTable(state, club.leagueId).length,
      }
    : null;

  const financialTendency: FinancialTendency = club.aiManager?.financialTendency ?? "balanced";
  const finances = buildFinancialProfile(
    club,
    financialTendency,
    isPlayerClub
      ? { transferBudget: state.finances.transferBudget, balance: String(state.finances.balance) }
      : undefined,
  );

  const { entries, dataConfidence } = buildRosterInputs(club, state.players);
  const squadNeeds = assessSquadNeeds(entries, dataConfidence);

  const clubPhilosophy = deriveClubPhilosophy(club);
  const managerPhilosophy = readManagerPhilosophy(
    club,
    isPlayerClub ? state.manager.philosophy : undefined,
  );
  const alignment = philosophyAlignment(clubPhilosophy, managerPhilosophy);

  const youthLean = club.aiManager
    ? club.aiManager.youthPreference
    : clamp(club.facilities.youth * 0.9);

  return {
    clubId: club.id,
    clubName: club.name,
    reputation: club.reputation,
    leaguePosition,
    finances,
    squadNeeds,
    clubPhilosophy,
    managerPhilosophy,
    philosophyAlignment: alignment,
    youthLean,
    memory: club.aiMemory ?? { items: [] },
    personality: (club.aiManager as any)?.personality ?? null,
  };
}

// ---- reusable decision-signal functions -----------------------------------------
// Each one reads a `ClubDecisionContext` and returns a single 0-100 signal.
// Deliberately small and single-purpose (not one big scoring function) so
// a later phase can call any one of these on its own — e.g. a "should we
// sell this player" check might only ever need `scoreFinancialFlexibility`
// and `scoreSquadUrgency`, not the full priority ranking below.

/** How free this club is to spend right now. */
export function scoreFinancialFlexibility(context: ClubDecisionContext): number {
  return clamp(context.finances.spendingPower * 0.7 + context.finances.wageHeadroom * 0.3);
}

/** How urgently the squad (as far as it's visible) needs strengthening.
 * 0 when there's no roster data to judge from — see `SquadDataConfidence`;
 * an unknown squad is not the same thing as a squad with no problems. */
export function scoreSquadUrgency(context: ClubDecisionContext): number {
  if (context.squadNeeds.dataConfidence === "none") return 0;
  return Math.max(0, ...context.squadNeeds.groups.map((g) => g.need));
}

/** How much the gap between the club's institutional identity and its
 * current manager's own philosophy is pulling the club toward changing
 * something (personnel, tactics, ...) to close that gap. */
export function scorePhilosophyPressure(context: ClubDecisionContext): number {
  return clamp(100 - context.philosophyAlignment);
}

/** A reputable club sets itself a higher bar and is less patient with
 * falling short of it. */
export function scoreReputationAmbition(context: ClubDecisionContext): number {
  return clamp(context.reputation);
}

/** How much the league table is under-delivering relative to what this
 * club's reputation would lead the board to expect. Unknown position (no
 * table row, e.g. a cup-only club) is treated as neutral, not urgent. */
export function scoreLeaguePositionPressure(context: ClubDecisionContext): number {
  if (!context.leaguePosition || context.leaguePosition.totalClubs <= 1) return 30;
  const { position, totalClubs } = context.leaguePosition;
  const relativeRank = (position - 1) / (totalClubs - 1); // 0 = top, 1 = bottom
  const expectedRelativeRank = clamp(1 - context.reputation / 100, 0, 1);
  const underperformance = relativeRank - expectedRelativeRank; // -1..1
  return clamp(50 + underperformance * 100);
}

// ---- priority aggregation ---------------------------------------------------------

export type ClubPriority =
  "strengthen-squad" | "develop-youth" | "balance-books" | "chase-promotion" | "consolidate";

/** A club whose institutional philosophy matches one of these keys leans
 * further toward the paired priority — e.g. a "youth-development" club
 * needs less other evidence to lean on `develop-youth`. Simple, explicit,
 * and easy to extend; not a scoring model in its own right. */
const PHILOSOPHY_PRIORITY_BOOST: Partial<Record<string, Partial<Record<ClubPriority, number>>>> = {
  "youth-development": { "develop-youth": 20 },
  "recruitment-led": { "strengthen-squad": 15 },
  "pragmatic-counter": { consolidate: 15 },
  "possession-control": { "chase-promotion": 10 },
  "high-press": { "strengthen-squad": 10 },
  "man-management": { consolidate: 10 },
};

export interface ClubPriorityScore {
  priority: ClubPriority;
  score: number;
  /** Short, human-readable reason this scored the way it did — for
   * debugging/logging, not shown to players. */
  note: string;
}

export interface ClubDecisionResult {
  clubId: string;
  topPriority: ClubPriority;
  ranked: ClubPriorityScore[];
  signals: {
    financialFlexibility: number;
    squadUrgency: number;
    philosophyPressure: number;
    reputationAmbition: number;
    leaguePositionPressure: number;
  };
}

export interface EvaluatePrioritiesOptions {
  /** Max points of seeded jitter applied to each priority's score (see the
   * module header on controlled randomness). 0 disables jitter entirely
   * for a fully deterministic comparison. Default 6. */
  randomness?: number;
  /** Advances the jitter's seed without touching anything else — e.g. pass
   * the current matchday so the same club's jitter can drift week to week
   * while still being exactly reproducible for that matchday. Default 0. */
  seedSalt?: number | string;
}

function seededJitter(
  clubId: string,
  priority: ClubPriority,
  options: EvaluatePrioritiesOptions,
): number {
  const randomness = options.randomness ?? 6;
  if (randomness <= 0) return 0;
  const seed = `aiprio:${clubId}:${priority}:${options.seedSalt ?? 0}`;
  return hashInt(seed, 1, -randomness, randomness);
}

/** Ranks the small, closed set of `ClubPriority` categories for one club
 * from its `ClubDecisionContext`. This is the top of the decision
 * architecture — everything above exists to feed this — but its OUTPUT is
 * still just a ranked list of abstract leanings, not a transfer, a bid, or
 * a squad change. Turning "this club currently leans toward
 * strengthen-squad" into an actual action is deliberately left to a later
 * phase (see module header).
 *
 * Deterministic for a given `context` + `options.seedSalt`: same inputs,
 * same ranking, every time — see `seededJitter`. */
export function evaluateClubPriorities(
  context: ClubDecisionContext,
  options: EvaluatePrioritiesOptions = {},
): ClubDecisionResult {
  const financialFlexibility = scoreFinancialFlexibility(context);
  const squadUrgency = scoreSquadUrgency(context);
  const philosophyPressure = scorePhilosophyPressure(context);
  const reputationAmbition = scoreReputationAmbition(context);
  const leaguePositionPressure = scoreLeaguePositionPressure(context);

  const boosts = context.clubPhilosophy.id
    ? (PHILOSOPHY_PRIORITY_BOOST[context.clubPhilosophy.id] ?? {})
    : {};
  const personalityBoostMap = getPersonalityPriorityBoosts(context.personality ?? undefined);
  const boost = (priority: ClubPriority) => {
    const phBoost = boosts[priority] ?? 0;
    const pBoostInner = personalityBoostMap[priority as string] ?? {};
    const pBoost = (pBoostInner as any)[priority] ?? 0;
    return phBoost + pBoost;
  };

  const base: Record<ClubPriority, { score: number; note: string }> = {
    "strengthen-squad": {
      score: squadUrgency * 0.5 + leaguePositionPressure * 0.3 + financialFlexibility * 0.2,
      note: `squad urgency ${squadUrgency}, league pressure ${leaguePositionPressure}`,
    },
    "develop-youth": {
      score: context.youthLean * 0.6 + squadUrgency * 0.2 + (100 - financialFlexibility) * 0.2,
      note: `youth lean ${context.youthLean}, tight finances push toward the academy`,
    },
    "balance-books": {
      score: (100 - financialFlexibility) * 0.7 + (context.finances.tendency === "frugal" ? 20 : 0),
      note: `financial flexibility ${financialFlexibility} (${context.finances.tier})`,
    },
    "chase-promotion": {
      score:
        reputationAmbition * 0.4 +
        financialFlexibility * 0.3 +
        (100 - leaguePositionPressure) * 0.3,
      note: `ambition ${reputationAmbition}, financial flexibility ${financialFlexibility}`,
    },
    consolidate: {
      score:
        100 -
        (squadUrgency +
          philosophyPressure +
          leaguePositionPressure +
          (100 - financialFlexibility)) /
          4,
      note: "low pressure across the board",
    },
  };

  const ranked: ClubPriorityScore[] = (Object.keys(base) as ClubPriority[])
    .map((priority) => ({
      priority,
      score: clamp(
        base[priority].score + boost(priority) + seededJitter(context.clubId, priority, options),
      ),
      note: base[priority].note,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    clubId: context.clubId,
    topPriority: ranked[0]!.priority,
    ranked,
    signals: {
      financialFlexibility,
      squadUrgency,
      philosophyPressure,
      reputationAmbition,
      leaguePositionPressure,
    },
  };
}

// ---- D2.2.1: simple squad-need detector -------------------------------------
export type SimpleSquadNeed =
  "goalkeeper" | "defender" | "midfielder" | "winger" | "striker" | "no-urgent-need";

/**
 * Determine a single, simple squad need for `clubId` using only
 * positions, current squad depth and player quality. Re-uses
 * `buildRosterInputs` + `assessSquadNeeds` so it integrates with the
 * existing D2.1 architecture and respects data confidence.
 */
export function determineSquadNeedForClub(state: GameState, clubId: string): SimpleSquadNeed {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`determineSquadNeedForClub: unknown clubId "${clubId}"`);

  const { entries, dataConfidence } = buildRosterInputs(club, state.players);
  const assessment = assessSquadNeeds(entries, dataConfidence);

  if (assessment.dataConfidence === "none") return "no-urgent-need";

  // pick the most urgent position group
  const topGroup = assessment.groups.reduce((a, b) => (b.need > a.need ? b : a));
  if (!topGroup || topGroup.need === 0) return "no-urgent-need";

  switch (topGroup.group) {
    case "goalkeeper":
      return "goalkeeper";
    case "defense":
      return "defender";
    case "midfield":
      return "midfielder";
    case "attack": {
      // differentiate between winger and striker by inspecting the
      // underlying entries: prefer the sub-role with fewer bodies or
      // lower average overall.
      const stEntries = entries.filter((e) => e.pos === "ST");
      const wingEntries = entries.filter((e) => e.pos === "RW" || e.pos === "LW");

      const stCount = stEntries.length;
      const wingCount = wingEntries.length;

      if (stCount === 0 && wingCount === 0) return "striker"; // default toward striker when unknown
      if (stCount < wingCount) return "striker";
      if (wingCount < stCount) return "winger";

      const avg = (arr: { overall: number }[]) =>
        arr.length ? arr.reduce((s, x) => s + x.overall, 0) / arr.length : 0;
      const stAvg = avg(stEntries);
      const wingAvg = avg(wingEntries);
      return stAvg < wingAvg ? "striker" : "winger";
    }
    default:
      return "no-urgent-need";
  }
}

export interface SellCandidate {
  playerId: string;
  score: number;
  reason: string;
}

export interface ContractRenewalPriority {
  playerId: string;
  score: number;
  priority: "high" | "medium" | "low";
  reason: string;
}

export interface TransferTarget {
  listingId: string;
  playerId: string | undefined;
  name: string;
  position: string;
  score: number;
  reason: string;
}

export interface BudgetAllocation {
  transfer: number;
  wages: number;
  reserves: number;
  note: string;
}

export interface TrainingDecision {
  focus: string;
  intensity: "low" | "medium" | "high";
  target: "whole squad" | "youth" | "seniors";
  note: string;
}

const NEED_TO_POS: Record<SimpleSquadNeed, Pos[]> = {
  goalkeeper: ["GK"],
  defender: ["CB", "RB", "LB"],
  midfielder: ["CDM", "CM", "CAM"],
  winger: ["RW", "LW"],
  striker: ["ST"],
  "no-urgent-need": [],
};

function positionMatchScore(pos: Pos, need: SimpleSquadNeed): number {
  return NEED_TO_POS[need].includes(pos) ? 20 : 0;
}

function normalizeAllocation(values: BudgetAllocation): BudgetAllocation {
  const total = values.transfer + values.wages + values.reserves;
  if (total === 100) return values;
  const multiplier = 100 / Math.max(1, total);
  const transfer = Math.round(values.transfer * multiplier);
  const wages = Math.round(values.wages * multiplier);
  const reserves = 100 - transfer - wages;
  return { transfer, wages, reserves, note: values.note };
}

export function determineSellCandidatesForClub(
  state: GameState,
  clubId: string,
  maxCandidates = 3,
): SellCandidate[] {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`determineSellCandidatesForClub: unknown clubId "${clubId}"`);
  const players = club.playerIds
    .map((id) => state.players[id])
    .filter((p): p is Player => Boolean(p));
  if (players.length === 0) return [];

  const context = buildClubDecisionContext(state, clubId);
  const need = determineSquadNeedForClub(state, clubId);

  return players
    .map((player) => {
      const salary = parseFinanceAmount(player.salary ?? "€0");
      const agePenalty = clamp((player.age - 26) * 2);
      const benchBonus = player.starter ? 0 : 25;
      const qualityPenalty = clamp(100 - player.overall) * 0.25;
      let score = benchBonus + agePenalty + qualityPenalty + clamp(salary / 10_000 - 5);
      if (player.age <= 23 && player.overall >= 70) score -= 20;
      if (context.finances.tier === "crisis") score += 15;
      if (context.finances.tier === "wealthy") score -= 15;
      if (need !== "no-urgent-need") score -= 10;
      score = clamp(Math.round(score));
      return {
        playerId: player.id,
        score,
        reason: `${player.starter ? "non-starter" : "bench"} ${player.overall} overall, age ${player.age}, salary ${player.salary}`,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates);
}

export function evaluateContractRenewalPriorities(
  state: GameState,
  clubId: string,
  maxResults = 5,
): ContractRenewalPriority[] {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`evaluateContractRenewalPriorities: unknown clubId "${clubId}"`);
  const players = club.playerIds
    .map((id) => state.players[id])
    .filter((p): p is Player => Boolean(p));
  return players
    .map((player) => {
      const years = player.contractYears ?? 0;
      const base = years <= 1 ? 100 : years === 2 ? 75 : years === 3 ? 50 : 25;
      const youthBoost = player.age <= 23 ? 15 : 0;
      const starterBoost = player.starter ? 10 : 0;
      const qualityBoost = player.overall >= 75 ? 10 : 0;
      const score = clamp(Math.round(base + youthBoost + starterBoost + qualityBoost));
      const priority: "high" | "medium" | "low" =
        score >= 75 ? "high" : score >= 45 ? "medium" : "low";
      return {
        playerId: player.id,
        score,
        priority,
        reason: `${years} year(s) left, ${player.age} years old, ${player.starter ? "starter" : "squad"}`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

function transferPreferenceScore(listing: TransferListing, pref: string): number {
  const age = listing.age;
  const value = parseFinanceAmount(listing.value ?? "€0");
  const rating = listing.rating;
  switch (pref) {
    case "youth-potential":
      return age <= 23 ? 25 : 0;
    case "proven-experience":
      return age >= 27 ? 20 + Math.round((rating - 60) * 0.4) : 0;
    case "value-for-money":
      return Math.max(0, 30 - Math.round(value / 500_000)) + Math.round(rating / 10);
    case "reputation-and-profile":
      return Math.round(rating / 5 + Math.min(15, age / 2));
    case "physical-presence":
      return ["CB", "RB", "LB", "ST"].includes(listing.position) ? 15 : 5;
    case "technical-creativity":
      return ["CAM", "CM", "RW", "LW", "ST"].includes(listing.position) ? 20 : 5;
    default:
      return 0;
  }
}

export interface TransferMarketIndex {
  all: TransferListing[];
  byPosition: Map<string, TransferListing[]>;
  byPlayerId: Map<string, TransferListing>;
  listingById: Map<string, TransferListing>;
  freeAgents: TransferListing[];
}

function isActiveTransferListing(listing: TransferListing): boolean {
  return listing.status !== "agreed" && listing.status !== "rejected";
}

export function buildTransferMarketIndex(state: GameState): TransferMarketIndex {
  const all = (state.transfers ?? []).filter(isActiveTransferListing);
  const byPosition = new Map<string, TransferListing[]>();
  const byPlayerId = new Map<string, TransferListing>();
  const listingById = new Map<string, TransferListing>();

  for (const listing of all) {
    const positionKey = String(listing.position ?? "");
    if (positionKey) {
      const existing = byPosition.get(positionKey) ?? [];
      existing.push(listing);
      byPosition.set(positionKey, existing);
    }

    if (listing.playerId) {
      byPlayerId.set(listing.playerId, listing);
    }
    listingById.set(listing.id, listing);
  }

  const freeAgents = all.filter((listing) => Boolean(listing.playerId) && !listing.sellerClubId);

  return { all, byPosition, byPlayerId, listingById, freeAgents };
}

function getCandidatePoolForNeed(
  index: TransferMarketIndex,
  need: SimpleSquadNeed,
): TransferListing[] {
  if (need === "no-urgent-need") {
    return index.all;
  }

  const positions = NEED_TO_POS[need];
  if (!positions.length) return index.all;

  const seen = new Set<string>();
  const candidates: TransferListing[] = [];

  for (const position of positions) {
    const matches = index.byPosition.get(position) ?? [];
    for (const listing of matches) {
      if (seen.has(listing.id)) continue;
      seen.add(listing.id);
      candidates.push(listing);
    }
  }

  return candidates.length ? candidates : index.all;
}

function selectTopTransferTargets(
  scored: Array<{ listing: TransferListing; score: number; reason: string }>,
  maxTargets: number,
): TransferTarget[] {
  return scored
    .sort(
      (a, b) =>
        b.score - a.score || a.listing.id.localeCompare(b.listing.id),
    )
    .slice(0, maxTargets)
    .map(({ listing, score, reason }) => ({
      listingId: listing.id,
      playerId: listing.playerId,
      name: listing.name,
      position: listing.position,
      score,
      reason,
    }));
}

export function identifyTransferTargets(
  state: GameState,
  clubId: string,
  maxTargets = 5,
  suppliedNeed?: SimpleSquadNeed,
  marketIndex?: TransferMarketIndex,
): TransferTarget[] {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`identifyTransferTargets: unknown clubId "${clubId}"`);
  const need = suppliedNeed ?? determineSquadNeedForClub(state, clubId);
  const preferences = club.aiManager?.transferPriorities ?? [
    "value-for-money",
    "youth-potential",
    "proven-experience",
  ];

  const index = marketIndex ?? buildTransferMarketIndex(state);
  const scored: Array<{ listing: TransferListing; score: number; reason: string }> = [];

  for (const listing of getCandidatePoolForNeed(index, need)) {
    const basePosition = positionMatchScore(listing.position as Pos, need);
    const prefScore = preferences.reduce(
      (sum, pref) => sum + transferPreferenceScore(listing, pref),
      0,
    );
    const ageScore = listing.age <= 23 ? 10 : listing.age >= 28 ? 5 : 0;
    const overallScore = clamp(Math.round(listing.rating * 0.8));
    const score = clamp(basePosition + prefScore + ageScore + overallScore * 0.1);

    if (score <= 0) continue;

    scored.push({
      listing,
      score,
      reason: `need ${need}, prefs ${preferences.join(", ")}, rating ${listing.rating}`,
    });
  }

  return selectTopTransferTargets(scored, maxTargets);
}

export function recommendBudgetAllocation(
  context: ClubDecisionContext,
  options: EvaluatePrioritiesOptions = { randomness: 0 },
): BudgetAllocation {
  const priorities = evaluateClubPriorities(context, options);
  const base: BudgetAllocation = {
    transfer: 20,
    wages: 30,
    reserves: 50,
    note: "Balanced budget allocation.",
  };

  switch (priorities.topPriority) {
    case "strengthen-squad":
      base.transfer = 45;
      base.wages = 30;
      base.reserves = 25;
      base.note = "Prioritise signings to address urgent squad needs.";
      break;
    case "develop-youth":
      base.transfer = 20;
      base.wages = 35;
      base.reserves = 45;
      base.note = "Invest in youth development while preserving financial stability.";
      break;
    case "balance-books":
      base.transfer = 10;
      base.wages = 25;
      base.reserves = 65;
      base.note = "Conserve resources and rebuild financial reserves.";
      break;
    case "chase-promotion":
      base.transfer = 35;
      base.wages = 35;
      base.reserves = 30;
      base.note = "Push for results with a more aggressive spend profile.";
      break;
    case "consolidate":
      base.transfer = 15;
      base.wages = 30;
      base.reserves = 55;
      base.note = "Maintain stability and avoid risky spending.";
      break;
  }

  if (context.finances.tier === "crisis") {
    base.transfer = Math.max(5, base.transfer - 10);
    base.wages = Math.max(15, base.wages - 5);
    base.reserves = Math.min(80, base.reserves + 15);
    base.note += " Finances are weak, so reserve building takes priority.";
  }
  if (context.finances.tier === "wealthy") {
    base.transfer = Math.min(60, base.transfer + 10);
    base.note += " Strong finances allow more transfer ambition.";
  }
  if (context.clubPhilosophy.id === "youth-development") {
    base.wages = Math.min(45, base.wages + 5);
    base.reserves = Math.max(35, base.reserves - 5);
    base.note += " Youth identity nudges spending toward development.";
  }

  return normalizeAllocation(base);
}

export function getClubPlayerIds(state: GameState, clubId: string): string[] {
  const club = state.clubs[clubId];
  if (!club) return [];

  if (club.simRoster) {
    const simIds = [...club.simRoster.xi, ...club.simRoster.bench].map((player) => player.id);
    if (simIds.length > 0) return simIds;
  }

  const roster = (club.playerIds ?? [])
    .map((id) => state.players[id])
    .filter((p): p is Player => Boolean(p));

  if (roster.length > 0) {
    return roster.map((player) => player.id);
  }

  return [];
}

export function selectStartingXI(state: GameState, clubId: string): string[] {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`selectStartingXI: unknown clubId "${clubId}"`);

  const fullRoster = (club.playerIds ?? [])
    .map((id) => state.players[id])
    .filter((p): p is Player => Boolean(p))
    .filter((p) => p.status !== "injured");

  if (fullRoster.length >= 11) {
    const starters = fullRoster.filter((player) => player.starter);
    const selected =
      starters.length === 11
        ? starters
        : [
            ...starters,
            ...fullRoster.filter((player) => !player.starter).sort((a, b) => b.overall - a.overall),
          ];
    return selected.slice(0, 11).map((player) => player.id);
  }

  if (club.simRoster) {
    const simRoster = [...club.simRoster.xi, ...club.simRoster.bench].filter(
      (p) => !p.isGK || p.isGK,
    );
    if (simRoster.length > 0) {
      return simRoster.slice(0, 11).map((player) => player.id);
    }
  }

  if (fullRoster.length === 0) return [];

  const starters = fullRoster.filter((player) => player.starter);
  const selected =
    starters.length === 11
      ? starters
      : [
          ...starters,
          ...fullRoster.filter((player) => !player.starter).sort((a, b) => b.overall - a.overall),
        ];
  return selected.slice(0, 11).map((player) => player.id);
}

export function recommendTrainingDecision(state: GameState, clubId: string): TrainingDecision {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`recommendTrainingDecision: unknown clubId "${clubId}"`);
  const context = buildClubDecisionContext(state, clubId);
  const priorities = evaluateClubPriorities(context, { randomness: 0 });
  const squadNeed = determineSquadNeedForClub(state, clubId);

  if (squadNeed !== "no-urgent-need") {
    const focus =
      squadNeed === "goalkeeper"
        ? "Goalkeeping"
        : squadNeed === "defender"
          ? "Defensive shape"
          : squadNeed === "midfielder"
            ? "Midfield cohesion"
            : squadNeed === "winger"
              ? "Attacking width"
              : "Finishing";
    const intensity =
      priorities.topPriority === "strengthen-squad" || priorities.topPriority === "chase-promotion"
        ? "high"
        : "medium";
    return {
      focus,
      intensity,
      target: context.youthLean >= 60 ? "youth" : "whole squad",
      note: `Training focus chosen to support urgent ${squadNeed} need.`,
    };
  }

  if (context.finances.tier === "crisis") {
    return {
      focus: "Recovery",
      intensity: "low",
      target: "whole squad",
      note: "Conservative training while finances are stabilised.",
    };
  }

  if (priorities.topPriority === "develop-youth" || context.youthLean >= 55) {
    return {
      focus: "Youth development",
      intensity: "medium",
      target: "youth",
      note: "Youth priority guides training toward the academy pathway.",
    };
  }

  if (priorities.topPriority === "chase-promotion") {
    return {
      focus: "Tactical awareness",
      intensity: "high",
      target: "whole squad",
      note: "Training emphasises tactical cohesion for upcoming results.",
    };
  }

  return {
    focus: "Fitness & conditioning",
    intensity: "medium",
    target: "whole squad",
    note: "Balanced training to maintain squad readiness.",
  };
}
