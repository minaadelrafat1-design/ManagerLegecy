/* =============================================================================
 * GameState — type definitions
 * =============================================================================
 * This is the "game rules" layer: plain data shapes only, no React, no
 * rendering, no simulation logic. `src/lib/match-engine.ts` (simulation) and
 * the route components (UI) both consume this shape but neither of them
 * owns it.
 *
 * Design rules this file encodes:
 *  - There is exactly ONE `Player` object per player, ONE `Club` object per
 *    club, ONE `Manager` object — all keyed by id in the top-level state and
 *    referenced by id everywhere else (fixtures, contracts, transfers,
 *    training, matches). Nothing below duplicates a Player's stats — a
 *    fixture references `homeClubId`/`awayClubId`, a contract references
 *    `playerId`, etc.
 *  - `Player` (below) extends the base shape from `@/data/squad` — see the
 *    "Player (extended)" section for why it's a superset rather than a
 *    re-export, and how that keeps existing consumers working unchanged.
 * ---------------------------------------------------------------------------*/

import type { Player as BasePlayer, Pos } from "@/data/squad";
import type { SimPlayer } from "@/lib/match-engine";

export type { Pos };
/** The original, unextended shape from `data/squad.ts` — kept available under
 * its own name for code that only needs the base fields (e.g. the match
 * engine's `playerToSim`). Most of the app should use `Player` below. */
export type { BasePlayer };

// ---- Player (extended) -------------------------------------------------------
// Phase A2 re-exported `data/squad.ts`'s `Player` type unchanged. Phase A3
// adds the remaining entity fields the spec calls for, WITHOUT touching
// `data/squad.ts` or its 20-odd hand-authored player records — every field
// below is optional-in-spirit but always populated at seed time by
// `derivePlayerState()` in `./seed.ts`, computed from each player's existing
// base attributes. This keeps "preserve existing data" literal: the source
// file doesn't change, and every existing consumer of the base fields
// (match engine, squad/training/treatment/academy screens) keeps working
// untouched because `Player` is still assignable everywhere `BasePlayer` is
// expected — it only adds fields, never removes or retypes one.

export interface PlayerInjury {
  type: string;
  severity: "minor" | "moderate" | "severe";
  returnDate: string | null;
}

/** Coaching-driven improvement, distinct from the existing week-to-week
 * `trainingFocus`/`trainingProgress` fields (which stay on the base type). */
export interface PlayerDevelopment {
  /** 0-100: how efficiently this player converts training into growth. */
  trainingEfficiency?: number;
  /** 0-100: room left to close the gap to `potential`. */
  growthRate?: number;
  /** Legacy test compatibility */
  form?: number;
  trajectory?: "stable" | "up" | "down" | string;
}

export interface PlayingTime {
  appearancesThisSeason?: number;
  startsThisSeason?: number;
  minutesThisSeason?: number;
  lastSeasonMinutes?: number;
  currentSeasonMinutes?: number;
}

export interface PlayerRelationship {
  teammateId: string;
  /** -100 (friction) .. 100 (strong bond) */
  quality: number;
}

export interface TacticsInstructions {
  outFromBack: boolean;
  counterPress: boolean;
  workIntoBox: boolean;
  fullBacksWide: boolean;
}

export interface TacticsSettings {
  mentality: number; // 0-100, 0 = ultra-defensive .. 100 = ultra-attacking
  width: number; // 0-100
  depth: number; // 0-100, defensive line height
  tempo: number; // 0-100
  pressing: number; // 0-100
  instructions: TacticsInstructions;
}

export interface PlayerCareerEvent {
  id: string;
  date: string;
  type:
    | "development"
    | "transfer"
    | "loan"
    | "award"
    | "retirement"
    | "injury"
    | "appearance"
    | "trophy"
    | "international"
    | string;
  summary: string;
  clubId?: string;
  value?: number;
}

export interface PlayerLoanRecord {
  id: string;
  clubId: string;
  startDate: string;
  endDate: string;
  sourceClubId?: string;
}

export interface PlayerCareerSummary {
  clubHistory: string[];
  appearances: number;
  goals: number;
  assists: number;
  trophies: number;
  transfers: number;
  loans: number;
  awards: string[];
  reputation: number;
  careerPath: string;
  internationalCaps?: number;
  europeanAchievements?: string[];
}

export interface Player extends BasePlayer {
  /** PHASE AAA-REPAIR-4: Date of birth for authoritative age calculation.
   * Format: YYYY-MM-DD. When present, age is derived from this + current date.
   * All new players and retroactively initialized players should have this. */
  dateOfBirth?: string;
  /** Optional club membership pointer used by state helpers and AI modules. */
  clubId?: string;
  /** 0-100: how close performances track true ability match to match. */
  consistency: number;
  /** 0-100: likelihood of picking up injuries; higher = more injury-prone. */
  injuryProneness: number;
  /** 0-100: short-term tiredness from recent matches/training, separate
   * from `fitness` (overall physical conditioning). Match minutes push this
   * up; rest brings it back down. */
  fatigue: number;
  /** Structured detail behind the existing `status === "injured"` flag.
   * `null` when fit. */
  injury: PlayerInjury | null;
  /** Numeric counterpart to the existing display-formatted `value` string,
   * for anything that needs to compute with it (squad value totals, offers,
   * wage-to-value ratios, ...). In euros. */
  marketValue: number;
  development: PlayerDevelopment;
  playingTime: PlayingTime;
  relationships: PlayerRelationship[];
  /** 0-100 familiarity per formation string (e.g. "4-3-3"). Missing entries
   * mean "never trained in that shape" rather than 0 — read with a
   * fallback, don't assume every formation key exists. */
  tacticalFamiliarity: Record<string, number>;
  /** Individual tactical role and instructions (PHASE FINAL-4).
   * Persisted in GameState, consumed by match engine for player behavior. */
  tacticalConfig?: any; // PlayerTacticalConfig (avoiding circular import)
  /** 0-100: veteran reputation in the market and amongst scouts. Grows
   * slowly with strong performances and falls with bad games. */
  reputation: number;
  /** Latest match rating on a 0-10 scale. */
  lastMatchRating: number;
  /** Recent match ratings for shaping form and recruitment. */
  matchRatingHistory: number[];
  /** Season stats maintained per-season by the lifecycle engine. */
  seasonGoals?: number;
  seasonAssists?: number;
  /** Meaningful career history without replacing the existing player model. */
  careerHistory?: PlayerCareerEvent[];
  loanHistory?: PlayerLoanRecord[];
  career?: PlayerCareerSummary;
  status?: "available" | "injured" | "suspended" | "retired";
  // Compatibility shortcuts for accessing attrs properties
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defence?: number;
  defending?: number;
  physical?: number;
}

// ---- Manager ----------------------------------------------------------------

export interface ManagerContract {
  clubId: string;
  salary: string;
  until: string;
}

/** How a completed season graded against the board's expectations — the
 * input to the manager's season-end credit/reputation review. See
 * `state/manager-progression.ts`. */
export type SeasonPerformanceTier = "great" | "good" | "expected" | "bad" | "terrible";

export interface Manager {
  id: string;
  name: string;
  nationality?: string;
  /** 0-100. What the football world thinks of this manager — a global,
   * slow-moving measure of standing that follows them between clubs.
   * Reputation is what job offers, player interest and negotiation
   * credibility are actually weighed against; see
   * `state/manager-progression.ts`. Distinct from `credit`, which is
   * local to the current job. */
  reputation?: number; // 0-100
  clubId?: string;
  trophies?: number;
  experience?: number; // seasons managed
  // Coaching/skill profile — 0-100 each. Deliberately separate from the
  // Tactics screen's per-match dials (hooks/use-tactics.ts): those are
  // *this match's* instructions, these are the manager's underlying ability.
  tactics?: number;
  training?: number;
  motivation?: number;
  scouting?: number;
  negotiation?: number;
  manManagement?: number;
  playerDevelopment?: number;
  /** 0-100: trust the manager has earned specifically at the CURRENT club —
   * built up by results there, spent down by risky decisions, and reset by
   * a new job. This is the buffer that lets one bad season be absorbed
   * without erasing years of goodwill; see `state/manager-progression.ts`.
   * Distinct from `reputation`, which is global and travels with the
   * manager. */
  credit?: number;
  /** Free-text managerial identity, e.g. "Possession-based, high press". */
  philosophy?: string;
  // Standing with the three groups whose confidence a manager lives or dies
  // by. Distinct from `GameState.board.confidence` (which tracks progress
  // against season objectives) — these measure trust in the *manager*
  // specifically.
  boardConfidence?: number; // 0-100
  fanConfidence?: number; // 0-100
  squadConfidence?: number; // 0-100
  contract?: ManagerContract;
  // Full season-by-season history lives in `GameState.careerHistory`
  // (already scoped by clubId) rather than duplicated here.
}

// ---- Staff --------------------------------------------------------------

export interface StaffMember {
  id: string;
  name: string;
  role: string; // "Assistant Manager", "Head Physio", "Chief Scout", ...
  nationality: string;
  rating: number; // 0-100 competence
  clubId: string;
  salaryWeekly?: number;
  contractYears?: number;
  contractUntil?: string;
}

// ---- Clubs ----------------------------------------------------------------

export interface ClubFacilities {
  training: number; // 0-100
  medical: number; // 0-100
  youth: number; // 0-100
  stadium: number; // 0-100
}

export type StadiumComponentId =
  | "seating"
  | "pitch"
  | "hospitality"
  | "vip"
  | "corporateBoxes"
  | "press"
  | "parking"
  | "entrances"
  | "floodlights"
  | "scoreboard"
  | "security"
  | "medical"
  | "concessions"
  | "shop"
  | "toilets"
  | "fanAreas";

export interface StadiumUpgrade {
  id: string;
  componentId: StadiumComponentId;
  fromLevel: number;
  toLevel: number;
  cost: number;
  durationDays: number;
  startedOn: string;
  completesOn: string;
  status: "in_progress" | "completed";
  description: string;
}

export interface StadiumState {
  name: string;
  capacity: number;
  condition: number;
  operatingCost: number;
  maintenanceCost: number;
  matchdayOperatingCost: number;
  maintenanceStatus: "excellent" | "good" | "fair" | "poor";
  componentLevels: Record<StadiumComponentId, number>;
  upgrades: StadiumUpgrade[];
  lastMaintenanceDate?: string;
}

export interface FacilityLevels {
  training: number; // 1-5
  youth: number; // 1-5
  medical: number; // 1-5
  scouting: number; // 1-5
}

export interface ClubAcademy {
  rating: number; // 0-100
  /** Players (by id into `GameState.players`) the academy currently rates
   * as prospects — same age<=23 lens the Academy screen already uses. */
  prospectIds: string[];
}

export interface ClubMedical {
  rating: number; // 0-100
  /** Snapshot count, not live-derived — see file header note on scope. */
  playersInTreatment: number;
}

export interface ClubScouting {
  rating: number; // 0-100
  regionsCovered: string[];
}

export interface ScoutTierDefinition {
  id: string;
  label: string;
  description: string;
  cost: number;
  reportSpeedDays: number;
  scoutingAccuracy: number;
  discoveryQuality: number;
  geographicReach: string[];
}

export interface Scout {
  id: string;
  name: string;
  tierId: string;
  hiredOnDate: string;
  status: "active" | "inactive";
  geographicReach: string[];
}

export interface ScoutingAssignment {
  id: string;
  scoutId: string;
  targetCountryId: string;
  assignmentLabel: string;
  durationDays: number;
  startedOnDate: string;
  status: "active" | "completed" | "cancelled";
  progressDays: number;
  lastProcessedDate?: string;
  reportSpeedDays: number;
  scoutingAccuracy: number;
  discoveryQuality: number;
  geographicReach: string[];
  assignedCost: number;
}

/** Information revealed by a scout about a target player, affected by scout tier and accuracy. */
export interface ScoutReport {
  id: string;
  /** When this report was generated. */
  completedDate: string;
  /** Which assignment generated this report. */
  assignmentId: string;
  /** The scout who filed the report. */
  scoutId: string;
  /** The target country where the scout was deployed. */
  targetCountryId: string;
  /** The player ID if already known; otherwise null for scouted targets not in the database. */
  playerId: string | null;
  /** Scout quality affects all revealed information. */
  scoutTierId: string;
  scoutingAccuracy: number; // 0-100: affects uncertainty ranges
  discoveryQuality: number; // 1-4: determines how many players found
  /** Confidence the scout has in their assessment (0-100). */
  confidence: number;
  /** Player info (name, age, position, club, etc.) with scout-tier-appropriate accuracy. */
  playerInfo: {
    name: string;
    age: number;
    position: string;
    nationality: string;
    /** Current club ID if scouted player is in the database; null for prospects. */
    currentClubId: string | null;
    personality?: string;
  };
  /** Ability range (lowEstimate, highEstimate) affected by scout accuracy. */
  abilityRange: [number, number]; // [low, high] - 0-100
  /** Potential range if supported by scout tier. */
  potentialRange?: [number, number];
  /** Key attributes the scout identified. */
  keyAttributes: {
    name: string;
    value: number; // 0-100
    confidence: number; // 0-100: scout's confidence in this measurement
  }[];
  /** Recommendation text from the scout. */
  recommendation: string;
  /** Whether the manager has taken action on this report. */
  status: "new" | "shortlisted" | "dismissed" | "academy_added" | "continued_scouting";
  /** Optional note from the manager about the player. */
  managerNote?: string;
}

export interface ScoutingNetwork {
  scouts: Scout[];
  assignments: ScoutingAssignment[];
  /** Completed scouting reports. */
  reports?: ScoutReport[];
  /** Player IDs the manager has shortlisted from scout reports. */
  shortlistedPlayerIds?: string[];
  /** Player IDs dismissed from reports (don't show again). */
  dismissedPlayerIds?: string[];
}

/** A club the player's own squad is measured against. Rival clubs are not
 * fully modelled (no contracts/training/etc. — see `simRoster`), matching
 * how the away side already worked before this state layer existed.
 *
 * Squad, staff, finances, board and fans are deliberately NOT duplicated
 * here even though the spec lists them as things a club "supports" — they
 * already live at `GameState.players`/`playerIds` (squad), `GameState.staff`
 * filtered by `clubId` (staff), `GameState.finances` (finances, currentClub
 * only for now), `GameState.board` and `GameState.fans` (board/fans),
 * `GameState.board.expectations` (objectives). Adding a second copy on
 * `Club` would break the "one authoritative object" rule from Phase A2.
 */
export interface Club {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  ground: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  formation: string;
  leagueId: string;
  /** 0-100: standing in the game world, independent of current form. */
  reputation: number;
  facilities: ClubFacilities;
  facilityLevels?: FacilityLevels;
  stadium?: StadiumState;
  trainingGround?: any;
  academy: ClubAcademy;
  medical: ClubMedical;
  scouting: ClubScouting;
  /** The single authoritative list of this club's managed players, by id
   * into `GameState.players`. A player belongs to at most one club. */
  playerIds: string[];
  /** Lightweight roster for clubs that aren't fully simulated (no Player
   * records) — currently just the next opponent. Undefined for the user's
   * own club. */
  simRoster?: { xi: SimPlayer[]; bench: SimPlayer[] };
  /** Configurable identity/traits for the club. These traits are intended
   * to be read by AI decision modules and board logic rather than UI.
   */
  identity?: ClubIdentity;
  /** Phase D1. Every club the player does NOT manage has one of these —
   * a simple, decision-ready profile for its (AI-controlled) manager.
   * Undefined for `GameState.currentClub`: the player IS that club's
   * manager, modelled by `GameState.manager` instead (see that field's
   * doc comment) — a club is never described by both at once. See
   * `state/ai-manager.ts` for how these are generated and why the shape
   * stays deliberately simple for now. */
  aiManager?: AIManagerProfile;
  /** Lightweight strategic memory for AI use. Bounded, structured, and
   * intentionally small — decision logic reads this but other systems
   * must never treat it as an authoritative event log. */
  aiMemory?: ClubMemory;

  // ---- Enhanced Revenue Systems (Phase D2.1) ----
  /** Merchandise sales channels (T-shirts, jerseys, apparel, etc.) */
  merchandise?: ClubMerchandise;
  /** Broadcasting rights deals per competition */
  broadcastingRights?: BroadcastingRights[];
  /** Training/facility partnerships with other clubs */
  trainingPartnerships?: TrainingPartnership[];
  /** Season tickets and VIP packages */
  ticketPackages?: TicketPackage[];
  /** Multi-year commercial sponsorship deals */
  commercialPartnerships?: CommercialPartnership[];
  /** Youth academy players available for sale */
  youthProspects?: YouthProspect[];
  /** Players loaned out with associated fees */
  loanOutPlayers?: LoanOutPlayer[];
}

// ---- AI memory (strategic, structured, bounded) ---------------------------
export type MemoryKind =
  | "tactical"
  | "transfer"
  | "development"
  | "injury"
  | "finance"
  | "board"
  | "season"
  | "strategy"
  | "rivalry"
  | "weakness";

export interface MemoryItem {
  id: string;
  date: string; // ISO date string
  kind: MemoryKind;
  /** Short human-readable summary. */
  summary: string;
  /** Structured metadata for programmatic queries (playerId, opponentId, fee, etc). */
  meta?: Record<string, any>;
  /** 0-100: how important/strongly this should influence decisions. */
  relevance: number;
}

export interface ClubMemory {
  /** Chronological (most-recent last) bounded list of memories. */
  items: MemoryItem[];
  /** Optional per-kind quick index counts kept for consumers/tests. */
  counts?: Partial<Record<MemoryKind, number>>;
}

// ---- Club identity / traits -------------------------------------------------

export type ClubArchetype = "youth" | "ambitious" | "traditional" | "balanced";

export interface ClubIdentity {
  archetype?: ClubArchetype;
  /** 0-100: how strongly the club invests in its academy and youth pathway. */
  academyFocus: number;
  /** 0-100: how patient the board is before demanding changes. */
  boardPatience: number;
  /** Optional confidence tuning per-club. Allows overrides for fan/board weights and patience alpha. */
  confidence?: {
    fanWeights?: Partial<{
      results: number;
      rival: number;
      style: number;
      transfers: number;
      identity: number;
      stars: number;
    }>;
    boardWeights?: Partial<{
      results: number;
      objectives: number;
      finances: number;
      managerCredit: number;
      development: number;
    }>;
    /** Optional per-club patience alpha override (0..1). When present this value is used instead of the global base+boardPatience calculation. */
    patienceAlpha?: number;
  };
  /** Multiplier applied when estimating available transfer budget (e.g. 0.6 for small-budget clubs, 1.5 for wealthy). */
  transferBudgetFactor: number;
  /** Expectations level: influences objective difficulty and manager credit. */
  expectations: "low" | "normal" | "high";
  /** 0-100: weight toward signing experienced/older players rather than youth. */
  preferExperienced: number;
}

/** How highly an AI manager weighs a kind of transfer target, relative to
 * the others in their (short, unranked-beyond-order) `transferPriorities`
 * list. Deliberately just a small closed vocabulary, not a scoring model —
 * see the file header on `state/ai-manager.ts` for why. */
export type TransferPriority =
  | "youth-potential"
  | "proven-experience"
  | "value-for-money"
  | "reputation-and-profile"
  | "physical-presence"
  | "technical-creativity";

export type FinancialTendency = "frugal" | "balanced" | "spender";

/** Phase D1. An AI-controlled club's manager — deliberately simple (a
 * handful of numbers/labels the world can read from later, not a
 * behavioural engine). Nothing in the codebase acts on these yet; that's
 * the next phase's job. See `state/ai-manager.ts`. */
export interface AIManagerProfile {
  id: string;
  /** Stable career identity for this appointment, distinct from the club. */
  careerId?: string;
  /** Appointment generation at this club; increments when a new manager joins. */
  generation?: number;
  name: string;
  nationality: string;
  /** 0-100 — same scale and meaning as `Manager.reputation`: what the
   * football world thinks of this manager. */
  reputation: number;
  /** 0-100 — quality of in-match decision-making/setup. */
  tacticalAbility: number;
  /** One of the ids in `data/manager-philosophies.ts` — the same pool the
   * player chooses from in the New Career wizard, so AI and human managers
   * share one vocabulary of identities. */
  philosophy: string;
  preferredFormation: string;
  /** Ordered, most important first. Short by design — see `TransferPriority`. */
  transferPriorities: TransferPriority[];
  /** 0-100 — how readily this manager gives academy players first-team
   * minutes over an established senior pro. */
  youthPreference: number;
  financialTendency: FinancialTendency;
  /** 0-100 — how long this manager sticks with a plan (or is backed by
   * their board) through a downturn before changing course. Mirrors the
   * spirit of `Manager.credit`'s buffer, but for an AI club it's modelled
   * as a personality trait rather than a number that moves with results. */
  patience: number;
  /** Coaching skills used by AI development logic (0-100). */
  training?: number;
  /** 0-100: how effective the manager is at developing players. */
  playerDevelopment?: number;
  /** Optional generated club personality used by Phase 6.3 decision layer. */
  personality?: import("./ai-personality").ClubPersonality;
}

// ---- Leagues & competitions -------------------------------------------------

/** One row of a computed table. Nothing here is stored authoritative
 * data — `state/standings.ts` derives the whole table from `GameState.fixtures`
 * on read (same "one authoritative source" rule as `Club`'s squad-value
 * total or `useStartingXI`), so this shape only describes the OUTPUT of
 * that computation, never something a reducer writes directly. */
export type StandingsTiebreaker = "points" | "goalDifference" | "goalsFor";

export interface StandingsRules {
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  /** Checked in order; the first one that isn't equal between two clubs
   * decides which ranks higher. */
  tiebreakers: readonly StandingsTiebreaker[];
}

export interface LeagueTableRow {
  clubId: string;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface League {
  id: string;
  name: string;
  /** The `Competition` (see below) whose fixtures count toward this
   * league's table — `state/standings.ts` filters `GameState.fixtures` by
   * this id. Kept explicit (rather than assuming `League.id ===
   * Competition.id`) so a league and its competition can be renamed or
   * re-keyed independently. */
  competitionId: string;
  season: string; // "2026/27"
  matchday: number;
}

export interface Competition {
  id: string;
  name: string;
  type: "league" | "cup" | "continental";
  stage: string; // "Round of 16", "Group stage", ...
  status: "active" | "eliminated" | "won" | "upcoming";
  standingsRules?: StandingsRules;
  reputation?: number;
}

/**
 * Explicitly typed events for canonical game state transitions.
 * Each event type MUST include authoritative proof of state change in meta.
 * For example, TRANSFER_COMPLETED must include fromClubId, toClubId, playerId proof.
 */
export type EventLogType =
  // Transfer events (explicit state transitions, not just descriptions)
  | "TRANSFER_OFFER" // buyer → seller: offer made
  | "TRANSFER_REJECTED" // seller rejects offer
  | "TRANSFER_ACCEPTED" // seller accepts offer
  | "TRANSFER_COMPLETED" // player actually moved (authoritative: playerId, fromClubId, toClubId)
  | "PLAYER_MOVEMENT" // explicit player club change (proof: playerId, clubId change)

  // Promotion/relegation (explicit division changes, not text inferences)
  | "PROMOTION" // club changed to higher division (proof: clubId, fromDivision, toDivision)
  | "RELEGATION" // club changed to lower division (proof: clubId, fromDivision, toDivision)

  // Player lifecycle
  | "PLAYER_RETIRED" // player retired (proof: playerId, retired: true)
  | "YOUTH_GENERATED" // new prospect generated (proof: playerId, age <= 21)
  | "PLAYER_CREATED" // new player created (proof: playerId exists)

  // Match/fixture
  | "MATCH_SCHEDULED" // fixture scheduled (proof: fixtureId)
  | "MATCH_PLAYED" // fixture completed (proof: fixtureId, status: played, score)
  | "SEASON_COMPLETED" // season finished (proof: season date, fixtures played)

  // Competition
  | "EUROPEAN_QUALIFICATION" // club qualified for European competition
  | "EUROPEAN_MATCH" // European fixture played
  | "EUROPEAN_WINNER" // European competition won (proof: competition, winner)
  | "COMPETITION_WINNER" // competition winner determined (proof: competitionId, winnerId)

  // Legacy types (kept for backwards compat, but audit should use explicit types above)
  | "match"
  | "transfer"
  | "cup"
  | "milestone"
  | "board"
  | "injury"
  | "news"
  | "manager";

export interface EventLogEntry {
  id: string;
  date: string;
  type: EventLogType;
  description: string;
  /** Authoritative proof of state transition. Varies by event type:
   * - TRANSFER_COMPLETED: { playerId, fromClubId, toClubId, fee? }
   * - PROMOTION: { clubId, fromDivision, toDivision }
   * - RELEGATION: { clubId, fromDivision, toDivision }
   * - PLAYER_RETIRED: { playerId, retired: true, age }
   * - YOUTH_GENERATED: { playerId, age, potential }
   * - MATCH_PLAYED: { fixtureId, homeClubId, awayClubId, scoreHome, scoreAway }
   * - etc.
   */
  meta?: Record<string, any>;
}

export interface NewsItem {
  id: string;
  tag: string;
  time: string;
  text: string;
}

// ---- Manager Inbox -------------------------------------------------------

export type InboxMessageCategory =
  "transfers" | "squad" | "training" | "scouting" | "youth" | "board" | "matches" | "world";

export type InboxMessagePriority = "low" | "normal" | "high" | "critical";

export type InboxMessageAction =
  | "view_player"
  | "view_club"
  | "view_transfer"
  | "view_negotiation"
  | "view_scout_report"
  | "view_fixture"
  | "respond_offer"
  | "view_training";

export interface InboxMessage {
  id: string;
  /** Game date (ISO string) when message was created. */
  date: string;
  category: InboxMessageCategory;
  /** Short subject line. */
  title: string;
  /** Full message body. */
  body: string;
  priority: InboxMessagePriority;
  /** Has manager read this message? */
  isRead: boolean;
  /** Optional related entity ID (playerId, clubId, fixtureId, etc). */
  relatedEntityId?: string;
  /** Optional action the manager can take. */
  action?: InboxMessageAction;
  /** Source event ID that triggered this message. */
  sourceEventId?: string;
  /** Archive/delete timestamp (null = active). */
  archivedAt?: string | null;
}

export interface InboxSettings {
  /** Don't auto-create messages older than this many days. */
  archiveOldAfterDays: number;
  /** Categories to suppress (e.g. minor injuries). */
  mutedCategories?: InboxMessageCategory[];
  /** Filter out duplicate message types within N days. */
  dedupeWindowDays: number;
}

export interface BoardExpectation {
  title: string;
  progress: number; // 0-100
  note: string;
}

export interface Board {
  confidence: number; // 0-100
  expectations: BoardExpectation[];
  reputation: number;
}

export interface Fans {
  approval: number; // 0-100
  attendanceAvg: number;
}

export type EntityType = "manager" | "player" | "staff" | "board" | "fans";

export interface CalendarEntry {
  id: string;
  date: string;
  type: "match" | "training" | "media" | "board" | "other";
  description: string;
}

// ---- Fixtures & matches -----------------------------------------------------

export type FixtureResult = "W" | "D" | "L" | null;

/** `"scheduled"` — not yet played, still to come. `"played"` — full time
 * reached, `result`/`scoreHome`/`scoreAway` are populated. `"postponed"` —
 * was scheduled, isn't happening on `date` after all; not counted by
 * `state/standings.ts` and skipped by `selectNextFixture`. No
 * promotion/relegation status here by design — Phase B2 scope stops at the
 * table itself. */
export type FixtureStatus = "scheduled" | "played" | "postponed";

export interface Fixture {
  id: string;
  competitionId: string;
  /** Same format as `League.season` / `GameCalendarState.season`, e.g.
   * "2026/27". Carried on the fixture itself (not just inferred from the
   * league) so a fixture's season is unambiguous even if it's read outside
   * the context of one particular `League` object. */
  season: string;
  homeClubId: string;
  awayClubId: string;
  /** AUTHORITATIVE: Real ISO calendar date (YYYY-MM-DD) when this fixture
   * is scheduled. Used to determine if fixture matches current game date. */
  calendarDate: string;
  /** Display date for UI, e.g. "Sat 6 Dec". Derived from calendarDate;
   * no gameplay logic depends on this field. */
  date: string;
  /** Round/matchday number as metadata, separate from calendarDate. */
  matchday: number;
  venue: "H" | "A";
  status: FixtureStatus;
  /** Outcome from the save's managed club's perspective (W/D/L) once
   * played — `null` for a fixture the managed club isn't part of, or one
   * that hasn't been played yet. Kept alongside `scoreHome`/`scoreAway`
   * (the club-agnostic actual score) rather than replacing them, since the
   * league table is computed from the scores, not from this field. */
  result: FixtureResult;
  scoreHome?: number;
  scoreAway?: number;
  groupId?: string;
  round?: string;
  leg?: number;
  tieId?: string;
  extraTime?: boolean;
  penaltyHome?: number;
  penaltyAway?: number;
}

/** A completed simulation, kept so Fixtures/Matches screens can show what
 * actually happened instead of a fixed mock result. Written by
 * `RECORD_MATCH_RESULT` once `match.tsx`'s simulation reaches full time. */
export interface MatchRecord {
  id: string;
  fixtureId: string | null;
  seed: number;
  homeClubId: string;
  awayClubId: string;
  scoreHome: number;
  scoreAway: number;
  playedAt: string;
}

// ---- Transfers & contracts ---------------------------------------------------

export interface TransferListing {
  id: string;
  playerId?: string; // set once a scouted target is linked to a Player record
  sellerClubId?: string;
  loan?: boolean;
  loanDurationWeeks?: number;
  releaseClause?: string | null;
  name: string;
  position: Pos | string;
  rating: number;
  nationality: string;
  age: number;
  value: string;
  status: "new" | "interested" | "bid" | "agreed" | "rejected";
}

/**
 * Contract *lifecycle* state (renewal/negotiation status). A player's
 * current terms (salary, contractUntil, contractYears) live on the Player
 * record itself — that stays the single authoritative source for "what a
 * player is currently paid and until when". This slice tracks the
 * negotiation status around those terms so it doesn't need to be
 * shoehorned onto `Player`.
 */
export interface ContractOffer {
  salaryWeekly: number;
  years: number;
  signingBonus?: number;
  guaranteedStarts?: boolean;
}

export interface Contract {
  playerId: string;
  clubId: string;
  status: "active" | "expiring" | "negotiating" | "released";
}

// ---- Training ----------------------------------------------------------------

export interface TrainingPlan {
  id: string;
  name: string;
  focus: string;
  intensity: "low" | "medium" | "high";
  assignedPlayerIds: string[];
  /** Drill ids when this plan was created from an individual preset. */
  drillIds?: string[];
}

// ---- Training Presets (Individual Training System) ----------------------------

export type TrainingDrillCategory =
  "shooting" | "passing" | "dribbling" | "physical" | "defending" | "mental";

export interface TrainingDrill {
  id: string;
  name: string;
  category: TrainingDrillCategory;
  /** Primary attribute focus (e.g., "shooting", "passing", "pace") */
  attributeFocus: string;
  /** Attributes that benefit from this drill */
  affectedAttributes: string[];
  /** Workload coefficient (how much fatigue this drill adds) */
  workloadCoefficient: number;
  /** Injury risk coefficient (how much additional injury risk) */
  injuryRiskCoefficient: number;
}

export interface TrainingPreset {
  id: string;
  name: string;
  drills: string[]; // drill IDs
  intensity: "low" | "medium" | "high";
  /** How often to apply this preset (days between applications) */
  frequencyDays: number;
  /** Last date this preset was applied */
  lastAppliedDate?: string;
  /** Selected players for this preset */
  selectedPlayerIds: string[];
}

// ---- Finances, board, fans ----------------------------------------------------

export interface Finances {
  transferBudget: string;
  wageBudget: string;
  squadValue?: string;
  balance: string | number;
  debt?: string;
  loans?: {
    id: string;
    principal: number;
    remaining: number;
    weeklyPayment: number;
    annualRatePct: number;
    termWeeks: number;
    startedAt?: string;
    approved: boolean;
  }[];
  income?: {
    matchRevenue: number;
    sponsorship: number;
    prizeMoney: number;
    playerSales: number;
    competitionRevenue: number;
    television?: number;
    other?: number;
    total: number;
  };
  expenses?: {
    playerSalaries: number;
    staff: number;
    transfers: number;
    facilities: number;
    scouting: number;
    medical: number;
    operations: number;
    total: number;
  };
  lastUpdatedDate?: string;
  lastUpdatedWeek?: number;
}

export type FinancialTransactionType =
  | "match_revenue"
  | "sponsorship"
  | "prize_money"
  | "competition_revenue"
  | "player_salary"
  | "staff_wages"
  | "transfer_fee"
  | "transfer_sell"
  | "facilities"
  | "scouting"
  | "medical"
  | "operations"
  | "loan_payment"
  | "loan_interest"
  | "loan_received"
  // New revenue types (8 systems)
  | "merchandise_sales"
  | "broadcasting_rights"
  | "training_partnership"
  | "season_ticket_sales"
  | "vip_package_sales"
  | "commercial_partnership"
  | "youth_academy_sale"
  | "loan_out_fee";

export interface FinancialTransaction {
  id: string;
  date: string;
  type: FinancialTransactionType;
  description: string;
  amount: number; // positive for income, negative for expenses
  category: "revenue" | "expense" | "debt";
  relatedEntityId?: string; // playerId, clubId, loanId, fixtureId, etc.
}

// ---- Enhanced Revenue Systems (8 new systems) ----------------------------------

export interface MerchandiseChannel {
  id: string;
  name: string; // "Official Store", "Stadium Shop", "Online", etc.
  type: "official" | "stadium" | "online" | "licensing";
  monthlyRevenue: number; // Average monthly revenue
  profitMargin: number; // 0-1 (60% margin = 0.6)
  isActive: boolean;
  startedAt?: string;
}

export interface ClubMerchandise {
  channels: MerchandiseChannel[];
  designs: { id: string; name: string; sales: number }[]; // T-shirt designs, jerseys, etc.
  totalMonthlyRevenue: number;
  lastUpdatedDate?: string;
}

export interface BroadcastingRights {
  leagueId: string;
  competitionId: string;
  domesticDealPerWeek: number; // National TV revenue per week
  internationalDealPerWeek: number; // International broadcast revenue per week
  streamingDealPerWeek: number; // Streaming platform rights
  totalPerWeek: number;
  dealStartDate?: string;
  dealEndDate?: string;
}

export interface TrainingPartnership {
  id: string;
  partnerClubId: string;
  partnerClubName: string;
  monthlyFee: number;
  details: string; // "Youth development partnership", "Facility rental", etc.
  isActive: boolean;
  startedAt?: string;
  endsAt?: string;
}

export interface TicketPackage {
  id: string;
  name: string; // "Premium Season Pass", "Family Bundle", "VIP Hospitality"
  type: "season_ticket" | "vip" | "family" | "corporate";
  pricePerSeason: number;
  seatsIncluded: number;
  perks: string[]; // ["Priority booking", "Free parking", "Lounge access"]
  currentHolders: number;
  maxAvailable: number;
}

export interface CommercialPartnership {
  id: string;
  partnerId: string;
  partnerName: string;
  type: "kit_sponsor" | "main_sponsor" | "sleeve_sponsor" | "naming_rights" | "other";
  annualValue: number;
  weeklyPayment: number;
  startYear: number;
  endYear: number;
  status: "active" | "pending" | "expired";
  renewalChance: number; // 0-100, probability of renewal
}

export interface YouthProspect {
  id: string;
  playerId: string;
  name: string;
  age: number;
  potential: number; // 0-100
  marketValue: number;
  interested: string[]; // Club IDs interested in buying
  saleValue?: number; // If being sold
  isSelling?: boolean;
  buyerClubId?: string;
  saleFeeAgreed?: number;
}

export interface LoanOutPlayer {
  id: string;
  playerId: string;
  playerName: string;
  loanToClubId: string;
  loanToClubName: string;
  weeklyFee: number;
  totalFeePerSeason: number;
  startedAt: string;
  endsAt: string;
  status: "active" | "completed" | "terminated";
}

// ---- Game calendar ------------------------------------------------------------
// Phase B1. The single authoritative "what day is it" clock for the save —
// plain data only, no logic (the engine that reads/advances it lives in
// `src/state/calendar.ts`, mirroring how `lib/match-engine.ts` owns match
// logic while this file only owns shapes). Distinct from `CalendarEntry`
// below (the forward-looking schedule list shown on-screen) and from
// `League.season`/`League.matchday` (which describe league progress, not
// the manager's real-world clock) — those can drift out of sync with this
// clock in later phases (e.g. a postponed fixture) without this file
// needing to change.

export interface GameCalendarState {
  /** ISO date (YYYY-MM-DD) — the single "today" for the save. */
  date: string;
  /** Same format as `League.season`, e.g. "2026/27". Kept on the clock
   * itself (not derived from `League`) so the calendar is still valid for
   * code that doesn't have a league loaded, and so a future "new season"
   * transition has one obvious place to write. */
  season: string | number;
  /** 1-based day count since `seasonStartDate` (i.e. day 1 is the first day
   * of the season). Drives the daily extension points in `calendar.ts`. */
  day: number;
  /** 1-based week count since `seasonStartDate`, `Math.floor((day-1)/7)+1`. */
  week: number;
  /** Anchor date the `day`/`week` counters are computed from. Explicit
   * rather than assumed-Aug-1, so a future season rollover just writes a
   * new anchor instead of special-casing the math. */
  seasonStartDate: string;
}

// ---- News, calendar, events, career history ------------------------------------

export interface RelationshipEntry {
  id: string;
  aType: EntityType;
  aId?: string;
  bType: EntityType;
  bId?: string;
  /** 0-100 */
  value: number;
}

export interface CareerEvent {
  id: string;
  season: string;
  clubId: string;
  summary: string;
  /** Present only for season-end review entries (see
   * `state/manager-progression.ts`) — lets the UI show exactly how a
   * season moved the manager's credit/reputation, not just the summary
   * text. Absent for other kinds of career events (appointments, etc). */
  seasonReview?: {
    tier: SeasonPerformanceTier;
    creditDelta: number;
    creditAfter: number;
    reputationDelta: number;
    reputationAfter: number;
  };
}

export interface SeasonReport {
  season: string;
  generatedAt: string;
  clubName: string;
  managerName: string;
  tier: SeasonPerformanceTier;
  overview: {
    leaguePosition?: number;
    leagueName?: string;
    totalMatches: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
  };
  competitions: Array<{
    competitionId?: string;
    name: string;
    type: string;
    status: string;
    standing?: number;
  }>;
  squad: {
    players: number;
    starters: number;
    averageRating: number;
    youthPlayers: number;
    topPerformer?: string;
    topScorer?: { name: string; goals: number };
    topAssists?: { name: string; assists: number };
  };
  transfers: {
    total: number;
    agreed: number;
    interested: number;
    rejected: number;
    arrivals: number;
    departures: number;
    spending: number;
    income: number;
  };
  finances: {
    balance: number;
    revenue: number;
    expenses: number;
    transferIncome: number;
    transferSpending: number;
    wages: number;
    matchdayIncome: number;
    otherRevenue: number;
    netResult: number;
    transferBudget: number;
    wageBudget: number;
    status: "strong" | "stable" | "strained";
  };
  manager: {
    tier: SeasonPerformanceTier;
    creditDelta: number;
    creditAfter: number;
    reputationDelta: number;
    reputationAfter: number;
    boardConfidence: number;
  };
  highlights: string[];
}

export interface WorldDivisionIdentity {
  prestige: string;
  developmentPath: string;
  competitiveLevel: string;
}

export interface WorldCountryIdentity {
  footballStyle: string;
  financialPower: string;
  youthProduction: string;
  reputation: string;
  culture: string;
}

export interface WorldDivisionConfig {
  id: string;
  name: string;
  countryId: string;
  level: number;
  identity?: WorldDivisionIdentity;
  qualificationSlots?: number;
  promotionTo?: string | null;
  relegationTo?: string | null;
  promotionSpots?: number;
  relegationSpots?: number;
}

export type EuropeanQualificationRuleType = "leaguePosition" | "cupWinner";

export interface EuropeanQualificationRule {
  type: EuropeanQualificationRuleType;
  sourceCompetitionId: string;
  positions?: number[];
  fallbackToCompetitionId?: string;
}

export interface EuropeanGroupStageConfig {
  numGroups: number;
  teamsPerGroup: number;
  homeAndAway: boolean;
  advancePerGroup: number;
  standingsRules?: StandingsRules;
  drawSeed?: "random" | "seeded";
  countryRestrictions?: boolean;
  pots?: string[][];
}

export interface EuropeanKnockoutRoundConfig {
  id: string;
  name: string;
  teams: number;
  twoLegged: boolean;
}

export interface CupRoundConfig {
  id: string;
  name: string;
  teams?: number;
  twoLegged?: boolean;
  seeded?: boolean;
  byes?: number;
  drawSeed?: "random" | "seeded";
}

export interface KnockoutStageConfig {
  rounds: CupRoundConfig[];
  extraTime?: boolean;
  penalties?: boolean;
  drawSeed?: "random" | "seeded";
}

export interface CompetitionFormat {
  groupStage?: EuropeanGroupStageConfig;
  knockoutStage?: KnockoutStageConfig;
  prizeMoney?: Record<string, number>;
  reputationRewards?: Record<string, number>;
}

export type EuropeanCompetitionFormat = CompetitionFormat;

export interface WorldCompetitionConfig {
  id: string;
  name: string;
  type: "league" | "cup" | "continental";
  countryId?: string;
  divisionIds?: string[];
  eligibleClubIds?: string[];
  eligibleDivisionIds?: string[];
  qualificationFrom?: string[];
  qualificationSlots?: number;
  qualificationRules?: EuropeanQualificationRule[];
  format?: CompetitionFormat;
  stage?: string;
}

export interface WorldCountryConfig {
  id: string;
  name: string;
  /** Configurable key into `state/league-strength.ts`; preserves the world's
   * existing country and club ids while allowing hierarchy rebalancing. */
  strengthKey?: string;
  identity?: WorldCountryIdentity;
  divisions: WorldDivisionConfig[];
}

export interface WorldConfig {
  countries: WorldCountryConfig[];
  competitions: WorldCompetitionConfig[];
}

export interface EuropeanQualificationRegistration {
  season: string;
  competitionId: string;
  clubId: string;
  reason: string;
  registeredAt: string;
  stage: "qualification";
}

export interface HistoricalClubRecord {
  id: string;
  clubId: string;
  competitionId?: string | undefined;
  season: string;
  date: string;
  kind:
    "league" | "cup" | "european" | "promotion" | "relegation" | "record" | "financial" | "other";
  title: string;
  summary: string;
  value?: number | undefined;
  uniqueKey?: string | undefined;
}

export interface HistoricalPlayerRecord {
  id: string;
  playerId: string;
  clubId?: string | undefined;
  season?: string | undefined;
  date: string;
  kind: "transfer" | "award" | "retirement" | "trophy" | "appearance" | "record" | "other";
  title: string;
  summary: string;
  value?: number | undefined;
  uniqueKey?: string | undefined;
}

export interface HistoricalManagerRecord {
  id: string;
  managerId: string;
  clubId: string;
  fromDate: string;
  toDate?: string | undefined;
  season?: string | undefined;
  title: string;
  summary: string;
  trophies?: number | undefined;
  active?: boolean | undefined;
  uniqueKey?: string | undefined;
}

export interface HistoricalRecordSummary {
  id: string;
  category: "titles" | "scorers" | "transfers" | "managers" | "clubs" | "records";
  title: string;
  value: string;
  entityId?: string | undefined;
  entityType?: "club" | "player" | "manager" | undefined;
  season?: string | undefined;
}

export interface WorldHistory {
  lastUpdated: string;
  snapshotVersion: number;
  clubRecords: HistoricalClubRecord[];
  playerRecords: HistoricalPlayerRecord[];
  managerRecords: HistoricalManagerRecord[];
  records: HistoricalRecordSummary[];
}

export interface GameStateMeta {
  leagueHierarchy?: Record<string, string>;
  worldConfig?: WorldConfig;
  worldYear?: number;
  aiLedgers?: Record<
    string,
    {
      transferBudget: number;
      wageBudgetWeekly: number;
      currentWageCommitment: number;
      balance?: number;
      lastUpdatedDate?: string;
      lastUpdatedWeek?: number;
    }
  >;
  europeanQualifications?: EuropeanQualificationRegistration[];
  lastSeasonFinalizedDate?: string;
  lastSeasonFinalizedSeason?: string;
  history?: WorldHistory | undefined;
  [key: string]: any;
}

// ---- Root state ----------------------------------------------------------------

export interface GameState {
  manager: Manager;
  time: GameCalendarState;
  currentClub: Club;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  staff: StaffMember[];
  leagues: Record<string, League>;
  competitions: Competition[];
  fixtures: Fixture[];
  matches: MatchRecord[];
  transfers: TransferListing[];
  contracts: Contract[];
  training: TrainingPlan[];
  selectedTrainingPlanId?: string;
  /** Individual training presets (up to 3). */
  trainPresets?: TrainingPreset[];
  /** Available training drills for use in presets. */
  trainDrills?: TrainingDrill[];
  finances: Finances;
  board: Board;
  fans: Fans;
  events: EventLogEntry[];
  news: NewsItem[];
  /** Manager inbox: messages derived from game events. */
  inbox?: InboxMessage[];
  /** Inbox configuration and metadata. */
  inboxSettings?: InboxSettings;
  calendar: CalendarEntry[];
  careerHistory: CareerEvent[];
  seasonReport?: SeasonReport;
  seasonReports?: SeasonReport[];
  tactics: TacticsSettings;
  /** Structured world history for long-term memory. */
  history?: WorldHistory | undefined;
  /** World-model metadata used by the long-term simulation. */
  meta?: GameStateMeta | undefined;
  /** Persisted negotiation sessions for multi-step transfers. */
  negotiations?: NegotiationSession[];
  /** Foundation scouting network: hired scouts, active assignments, reports, and shortlist. */
  scoutingNetwork?: ScoutingNetwork;
  /** Global shortlist of players the manager is tracking (across all sources). */
  shortlistPlayerIds?: string[];
  /** Hidden relationship graph between entities (manager/player/staff/board/fans). */
  relationships?: RelationshipEntry[];
  /** Stable ids for trophy celebrations already shown to the manager. */
  seenAchievementIds?: string[];
  /** Ledger of all financial transactions for office overview. */
  financialTransactions?: FinancialTransaction[];
  /** Authoritative matchday state: when the manager's club has a fixture on
   * the current game date, this holds the fixture ID. Time cannot advance
   * past this fixture until it is played or simulated. Cleared after the
   * fixture is resolved. */
  pendingManagerFixtureId?: string;
  /** Game world seed for deterministic but varying simulation. */
  gameSeed?: string;
}

export interface NegotiationEntry {
  id: string;
  fromClubId: string;
  offer: {
    // transfer-style offer
    fee?: number;
    installments?: number;
    bonuses?: number;
    addOns?: number;
    performanceBonuses?: number;
    appearanceBonuses?: number;
    goalBonuses?: number;
    assistBonuses?: number;
    cleanSheetBonuses?: number;
    sellOnPercent?: number;
    sellOnClause?: boolean;
    upfrontPayment?: number;
    futurePayment?: number;
    playerExchangeId?: string;
    playerPlusCash?: number;
    releaseClause?: number | null;
    loan?: boolean;
    loanDurationWeeks?: number;
    loanFee?: number;
    wageContribution?: number;
    optionalPurchase?: number;
    mandatoryPurchase?: number;
    // contract-style offer
    salaryWeekly?: number;
    years?: number;
    signingBonus?: number;
    guaranteedStarts?: boolean;
  };
  message: string;
  date: string; // ISO
}

export type NegotiationStatus =
  "open" | "active" | "progressing" | "accepted" | "rejected" | "withdrawn" | "expired" | "closed";

export type TransferNegotiationStage = "club" | "player";

export interface NegotiationSession {
  id: string;
  playerId: string;
  /** 'transfer' for club-to-club fee negotiations, 'contract' for player terms */
  type?: "transfer" | "contract";
  /** Optional staged flow; omitted on legacy AI sessions. */
  stage?: TransferNegotiationStage;
  buyerClubId: string;
  sellerClubId: string;
  status: NegotiationStatus;
  entries: NegotiationEntry[];
}
