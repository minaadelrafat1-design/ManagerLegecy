/* =============================================================================
 * New Career — engine (game rules)
 * =============================================================================
 * Phase C1. Turns the choices made in `routes/new-career.tsx` into a real,
 * fully-populated `GameState` — no demo data, no placeholders. Mirrors the
 * discipline `state/seed.ts` already follows (pure functions, one
 * authoritative object per entity, no React/localStorage here), but this
 * module runs entirely from a user action (the wizard's "Start Career"
 * button) rather than at module-load/SSR time, so — unlike `seed.ts` — it's
 * free to use `Math.random()` directly; there's no hydration-safety
 * constraint to respect.
 *
 * Scope for this phase, deliberately:
 *  - A small, curated set of fictional LOW-DIVISION clubs (`data/starter-
 *    clubs.ts`) — not a full job market. See that file for why.
 *  - The manager always starts with LOW reputation and zero experience —
 *    see `generateManagerProfile` — so there is no path to an unrealistic
 *    "elite club, day one" career.
 *  - A freshly generated, appropriately modest squad for the chosen club
 *    (the other five clubs in its division are lightweight/AI, same
 *    pattern `state/seed.ts` already uses for rival clubs).
 * ---------------------------------------------------------------------------*/

import type { Pos } from "@/data/squad";
import {
  STARTER_CLUBS,
  REGIONAL_THIRD_DIVISION_ID,
  REGIONAL_TROPHY_ID,
  getStarterClub,
  type StarterClub,
} from "@/data/starter-clubs";
import {
  MANAGER_NATIONALITIES,
  MANAGER_PHILOSOPHIES,
  getPhilosophy,
  type ManagerPhilosophy,
  type ManagerSkillKey,
} from "@/data/manager-philosophies";
import { addDaysISO, daysBetweenISO, getDayOfWeekLabel } from "./calendar";
import { generateAIManager } from "./ai-manager";
import { seededUnit } from "./utils";
import { CURRENT_DATE, SEASON_START_DATE, SEASON } from "./seed";
import type {
  Club,
  Board,
  Contract,
  Fixture,
  GameCalendarState,
  GameState,
  League,
  Manager,
  Player,
} from "./types";

const SEASON_START_YEAR = 2026;

// ---- manager identity choices --------------------------------------------------
// `MANAGER_NATIONALITIES`, `MANAGER_PHILOSOPHIES` and friends now live in
// `data/manager-philosophies.ts` (Phase D1 — AI club managers draw from the
// same pool). Re-exported here so nothing importing them from this module
// (e.g. `routes/new-career.tsx`) has to change.
export { MANAGER_NATIONALITIES, MANAGER_PHILOSOPHIES, getPhilosophy };
export type { ManagerPhilosophy, ManagerSkillKey };

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function randIntFromSeed(seedStr: string, min: number, max: number, salt = 0): number {
  const span = max - min + 1;
  return min + Math.floor(seededUnitLocal(seedStr, salt) * span);
}

function pick<T>(seedStr: string, items: readonly T[], salt = 0): T {
  return items[randIntFromSeed(seedStr, 0, items.length - 1, salt)] as T;
}

// ---- manager attribute profile (Phase C1 step: "Review manager attributes") ---

export interface ManagerAttributeProfile {
  reputation: number;
  tactics: number;
  training: number;
  motivation: number;
  scouting: number;
  negotiation: number;
  manManagement: number;
  playerDevelopment: number;
}

/** A brand-new manager's skill profile: modest across the board, with a
 * bump on the two skills their chosen philosophy leans into. Deliberately
 * low-ceilinged — this is what keeps "reputation should be low" true at a
 * data level, not just cosmetically on one field. Pure and re-callable (the
 * wizard calls it once per philosophy selection to render the review
 * step), so it does NOT use `Math.random()` internally in a way that would
 * make re-rendering the same choice jump around — a small deterministic
 * hash of the philosophy id seeds the "randomness" instead. */
function seededUnitLocal(seedStr: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  // xorshift-ish finish, then normalise to [0,1)
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 10_000) / 10_000;
}

export function generateManagerAttributeProfile(philosophyId: string): ManagerAttributeProfile {
  const philosophy = getPhilosophy(philosophyId);
  const skills: ManagerSkillKey[] = [
    "tactics",
    "training",
    "motivation",
    "scouting",
    "negotiation",
    "manManagement",
    "playerDevelopment",
  ];
  const profile = {} as Record<ManagerSkillKey, number>;
  skills.forEach((skill, i) => {
    const base = 26 + Math.round(seededUnitLocal(philosophyId || "none", i) * 14); // 26-40
    const isFocus = philosophy?.focusSkills.includes(skill);
    const bonus = isFocus ? 12 + Math.round(seededUnitLocal(philosophyId, i + 100) * 6) : 0; // +12-18
    profile[skill] = clamp(base + bonus, 15, 62);
  });
  const reputation = clamp(
    6 + Math.round(seededUnitLocal(philosophyId || "none", 999) * 12),
    5,
    20,
  ); // 6-18
  return { reputation, ...profile };
}

// ---- squad generation -----------------------------------------------------------

const FIRST_NAMES = [
  "Marco",
  "Daniel",
  "Owen",
  "Lucas",
  "Mateo",
  "Kwame",
  "Jonas",
  "Erik",
  "Bruno",
  "Rafael",
  "Milan",
  "Tobias",
  "Nico",
  "Aleksander",
  "Diego",
  "Felix",
  "Samuel",
  "Adrian",
  "Victor",
  "Emil",
  "Theo",
  "Kian",
  "Noah",
  "Callum",
  "Idris",
  "Rory",
  "Santiago",
  "Youssef",
  "Piotr",
  "Hugo",
];

const LAST_NAMES = [
  "Whitmore",
  "Castellano",
  "Brennan",
  "Halvorsen",
  "Ferreira",
  "Sarr",
  "Lindqvist",
  "Mensah",
  "Duarte",
  "Kovac",
  "Arnaud",
  "Novak",
  "Adeyemi",
  "Reyes",
  "Salvatore",
  "Bakker",
  "Traore",
  "Haugen",
  "Colley",
  "Pichler",
  "Marchetti",
  "Osei",
  "Vukovic",
  "Larsen",
  "Dubois",
  "Falk",
  "Costa",
  "Rowntree",
  "Ashby",
  "Kessler",
];

const PERSONALITIES = [
  "Balanced",
  "Professional",
  "Ambitious",
  "Determined",
  "Reserved",
  "Model Citizen",
  "Driven",
  "Temperamental",
  "Leader",
  "Unsettled",
];

const TRAINING_FOCI = [
  "Fitness",
  "Finishing",
  "Distribution",
  "Positioning",
  "Set Pieces",
  "Pace",
  "Tackling",
  "Decision Making",
];

const ROLE_BY_POS: Record<Pos, string[]> = {
  GK: ["Shot Stopper", "Sweeper Keeper"],
  RB: ["Wing Back", "Full Back"],
  CB: ["Stopper", "Ball-Playing Defender"],
  LB: ["Wing Back", "Full Back"],
  CDM: ["Anchor Man", "Deep-Lying Playmaker"],
  CM: ["Box-to-Box", "Central Midfielder"],
  CAM: ["Playmaker", "Attacking Midfielder"],
  RW: ["Winger", "Inverted Winger"],
  LW: ["Winger", "Inverted Winger"],
  ST: ["Target Man", "Poacher"],
};

interface AttrRange {
  pace: [number, number];
  shooting: [number, number];
  passing: [number, number];
  dribbling: [number, number];
  defending: [number, number];
  physical: [number, number];
}

const ATTR_PROFILE: Record<Pos, AttrRange> = {
  GK: {
    pace: [35, 55],
    shooting: [15, 30],
    passing: [40, 60],
    dribbling: [25, 45],
    defending: [20, 35],
    physical: [55, 75],
  },
  CB: {
    pace: [40, 60],
    shooting: [15, 30],
    passing: [40, 60],
    dribbling: [30, 45],
    defending: [55, 75],
    physical: [55, 75],
  },
  RB: {
    pace: [55, 75],
    shooting: [20, 35],
    passing: [45, 62],
    dribbling: [45, 62],
    defending: [45, 65],
    physical: [45, 65],
  },
  LB: {
    pace: [55, 75],
    shooting: [20, 35],
    passing: [45, 62],
    dribbling: [45, 62],
    defending: [45, 65],
    physical: [45, 65],
  },
  CDM: {
    pace: [40, 58],
    shooting: [25, 40],
    passing: [50, 68],
    dribbling: [40, 58],
    defending: [50, 68],
    physical: [50, 68],
  },
  CM: {
    pace: [45, 62],
    shooting: [30, 48],
    passing: [52, 70],
    dribbling: [48, 65],
    defending: [38, 55],
    physical: [45, 62],
  },
  CAM: {
    pace: [48, 65],
    shooting: [42, 60],
    passing: [55, 72],
    dribbling: [52, 70],
    defending: [20, 38],
    physical: [35, 52],
  },
  RW: {
    pace: [60, 80],
    shooting: [38, 55],
    passing: [42, 60],
    dribbling: [55, 72],
    defending: [18, 35],
    physical: [35, 55],
  },
  LW: {
    pace: [60, 80],
    shooting: [38, 55],
    passing: [42, 60],
    dribbling: [55, 72],
    defending: [18, 35],
    physical: [35, 55],
  },
  ST: {
    pace: [52, 70],
    shooting: [52, 72],
    passing: [35, 52],
    dribbling: [45, 62],
    defending: [15, 30],
    physical: [48, 68],
  },
};

interface SquadSlot {
  pos: Pos;
  starter: boolean;
  x?: number;
  y?: number;
}

const FORMATION_TEMPLATES: Record<string, SquadSlot[]> = {
  "4-3-3": [
    { pos: "GK", starter: true, x: 50, y: 87 },
    { pos: "RB", starter: true, x: 82, y: 72 },
    { pos: "CB", starter: true, x: 62, y: 76 },
    { pos: "CB", starter: true, x: 38, y: 76 },
    { pos: "LB", starter: true, x: 18, y: 72 },
    { pos: "CDM", starter: true, x: 50, y: 58 },
    { pos: "CM", starter: true, x: 24, y: 48 },
    { pos: "CAM", starter: true, x: 76, y: 48 },
    { pos: "RW", starter: true, x: 84, y: 26 },
    { pos: "ST", starter: true, x: 50, y: 18 },
    { pos: "LW", starter: true, x: 16, y: 26 },
  ],
  "4-4-2": [
    { pos: "GK", starter: true, x: 50, y: 87 },
    { pos: "RB", starter: true, x: 82, y: 72 },
    { pos: "CB", starter: true, x: 62, y: 76 },
    { pos: "CB", starter: true, x: 38, y: 76 },
    { pos: "LB", starter: true, x: 18, y: 72 },
    { pos: "RW", starter: true, x: 82, y: 50 },
    { pos: "CM", starter: true, x: 60, y: 55 },
    { pos: "CM", starter: true, x: 40, y: 55 },
    { pos: "LW", starter: true, x: 18, y: 50 },
    { pos: "ST", starter: true, x: 38, y: 20 },
    { pos: "ST", starter: true, x: 62, y: 20 },
  ],
  "4-2-3-1": [
    { pos: "GK", starter: true, x: 50, y: 87 },
    { pos: "RB", starter: true, x: 82, y: 72 },
    { pos: "CB", starter: true, x: 62, y: 76 },
    { pos: "CB", starter: true, x: 38, y: 76 },
    { pos: "LB", starter: true, x: 18, y: 72 },
    { pos: "CDM", starter: true, x: 38, y: 60 },
    { pos: "CDM", starter: true, x: 62, y: 60 },
    { pos: "CAM", starter: true, x: 50, y: 42 },
    { pos: "RW", starter: true, x: 80, y: 30 },
    { pos: "LW", starter: true, x: 20, y: 30 },
    { pos: "ST", starter: true, x: 50, y: 16 },
  ],
};

const BENCH_TEMPLATE: SquadSlot[] = [
  { pos: "GK", starter: false },
  { pos: "CB", starter: false },
  { pos: "LB", starter: false },
  { pos: "CM", starter: false },
  { pos: "CAM", starter: false },
  { pos: "RW", starter: false },
  { pos: "ST", starter: false },
];

function ageFactorOf(age: number): number {
  return clamp(100 - Math.abs(age - 24) * 3) / 100;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1000)}K`;
  return `€${Math.round(n)}`;
}

function stableHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generatePlayer(slot: SquadSlot, number: number, club: StarterClub): Player {
  const seed = `${club.id}:${slot.pos}:${number}`;
  const first = pick(`${seed}:first`, FIRST_NAMES);
  const last = pick(`${seed}:last`, LAST_NAMES);
  const name = `${first} ${last}`;
  const id = `${last.toLowerCase()}-${stableHash(seed).toString(36)}`;

  const isYouth = seededUnitLocal(seed, 1) < 0.3;
  const age = isYouth ? randIntFromSeed(seed, 17, 21, 2) : randIntFromSeed(seed, 20, 33, 3);
  const range = ATTR_PROFILE[slot.pos];
  const qualityShift = slot.starter
    ? randIntFromSeed(seed, 0, 6, 4)
    : -randIntFromSeed(seed, 0, 8, 5);

  const attrs = {
    pace: clamp(randIntFromSeed(seed, range.pace[0], range.pace[1], 10) + qualityShift),
    shooting: clamp(randIntFromSeed(seed, range.shooting[0], range.shooting[1], 11) + qualityShift),
    passing: clamp(randIntFromSeed(seed, range.passing[0], range.passing[1], 12) + qualityShift),
    dribbling: clamp(
      randIntFromSeed(seed, range.dribbling[0], range.dribbling[1], 13) + qualityShift,
    ),
    defending: clamp(
      randIntFromSeed(seed, range.defending[0], range.defending[1], 14) + qualityShift,
    ),
    physical: clamp(randIntFromSeed(seed, range.physical[0], range.physical[1], 15) + qualityShift),
  };
  const overall = clamp(
    (attrs.pace +
      attrs.shooting +
      attrs.passing +
      attrs.dribbling +
      attrs.defending +
      attrs.physical) /
      6,
    38,
    69,
  );
  const potential = isYouth
    ? clamp(overall + randIntFromSeed(seed, 6, 20, 20), overall, 82)
    : age <= 25
      ? clamp(overall + randIntFromSeed(seed, 0, 8, 21))
      : clamp(overall + randIntFromSeed(seed, -2, 2, 22), overall - 2, overall + 2);

  const professionalism = randIntFromSeed(seed, 35, 85, 30);
  const ageFactor = ageFactorOf(age);
  const marketValue = clamp(
    Math.round((overall - 35) ** 2.1 * 90 * (0.6 + ageFactor)),
    12_000,
    900_000,
  );
  const contractYears = randIntFromSeed(seed, 1, 4, 31);
  const weeklySalary =
    Math.round((marketValue * (0.003 + seededUnitLocal(seed, 32) * 0.003)) / 10) * 10;
  const fitness = randIntFromSeed(seed, 80, 97, 33);

  return {
    id,
    name,
    shortName: last,
    number,
    pos: slot.pos,
    role: pick(`${seed}:role`, ROLE_BY_POS[slot.pos]),
    nationality: pick(`${seed}:nationality`, MANAGER_NATIONALITIES),
    age,
    overall,
    potential,
    fitness,
    morale: randIntFromSeed(seed, 58, 84, 34),
    form: randIntFromSeed(seed, 45, 68, 35),
    formTrend: "flat",
    attrs,
    professionalism,
    personality: pick(`${seed}:personality`, PERSONALITIES),
    value: formatMoney(marketValue),
    salary: `€${weeklySalary.toLocaleString("en-US")}`,
    contractUntil: `Jun ${SEASON_START_YEAR + contractYears}`,
    contractYears,
    trainingFocus: pick(`${seed}:training`, TRAINING_FOCI),
    trainingProgress: randIntFromSeed(seed, 5, 45, 36),
    status: "available",
    starter: slot.starter,
    ...(slot.x !== undefined ? { x: slot.x } : {}),
    ...(slot.y !== undefined ? { y: slot.y } : {}),
    // ---- extended fields (state/types.ts) ----
    consistency: clamp(professionalism * 0.6 + overall * 0.4),
    injuryProneness: clamp(100 - ageFactor * 100 * 0.5 - professionalism * 0.3, 5, 90),
    fatigue: clamp(100 - fitness),
    injury: null,
    marketValue,
    development: {
      trainingEfficiency: clamp(ageFactor * 100 * 0.7 + professionalism * 0.3),
      growthRate: clamp((potential - overall) * 8),
    },
    playingTime: { appearancesThisSeason: 0, startsThisSeason: 0, minutesThisSeason: 0 },
    relationships: [],
    tacticalFamiliarity: { [club.formation]: slot.starter ? 60 : 40 },
    reputation: clamp(professionalism * 0.4 + overall * 0.3 + (age <= 21 ? 8 : 0)),
    lastMatchRating: 5,
    matchRatingHistory: [],
  };
}

export function generateSquad(club: StarterClub): Player[] {
  const template = FORMATION_TEMPLATES[club.formation] ?? FORMATION_TEMPLATES["4-3-3"]!;
  const slots = [...template, ...BENCH_TEMPLATE];
  return slots.map((slot, i) => generatePlayer(slot, i + 1, club));
}

// ---- fixtures (pre-season: nothing played yet) -----------------------------------

const BYE = "__bye__";

function roundRobinRounds(clubIds: string[]): Array<Array<[string, string]>> {
  const slots = clubIds.length % 2 === 0 ? [...clubIds] : [...clubIds, BYE];
  const n = slots.length;
  let arr = [...slots];
  const rounds: Array<Array<[string, string]>> = [];
  for (let round = 0; round < n - 1; round++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b && a !== BYE && b !== BYE) {
        pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
      }
    }
    rounds.push(pairs);
    const first = arr[0];
    const last = arr[n - 1];
    if (first !== undefined && last !== undefined) {
      arr = [first, last, ...arr.slice(1, n - 1)];
    }
  }
  return rounds;
}

const FIRST_MATCHDAY_OFFSET_DAYS = 13; // two weeks of pre-season before ball kicks off
const MATCHDAY_INTERVAL_DAYS = 7;

function formatDisplayDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  const weekday = getDayOfWeekLabel(dateISO);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekday} ${d.getUTCDate()} ${month}`;
}

function buildFixtures(clubIds: string[]): Fixture[] {
  const rounds = roundRobinRounds(clubIds);
  const fixtures: Fixture[] = [];
  for (let cycle = 0; cycle < 2; cycle += 1) {
    rounds.forEach((pairs, roundIndex) => {
      const matchday = cycle * rounds.length + roundIndex + 1;
      const date = addDaysISO(
        SEASON_START_DATE,
        FIRST_MATCHDAY_OFFSET_DAYS + (matchday - 1) * MATCHDAY_INTERVAL_DAYS,
      );
      pairs.forEach(([homeClubId, awayClubId], pairIndex) => {
        fixtures.push({
          id: `career-fx-md${matchday}-${pairIndex + 1}`,
          competitionId: REGIONAL_THIRD_DIVISION_ID,
          season: SEASON,
          homeClubId: cycle === 0 ? homeClubId! : awayClubId!,
          awayClubId: cycle === 0 ? awayClubId! : homeClubId!,
          calendarDate: date,
          date: formatDisplayDate(date),
          matchday,
          venue: "H",
          status: "scheduled",
          result: null,
        });
      });
    });
  }
  return fixtures;
}

// ---- minimal (AI) clubs for the rest of the division -----------------------------

function makeRivalClub(source: StarterClub | Club): Club {
  return {
    id: source.id,
    name: source.name,
    shortName: source.shortName,
    abbr: source.abbr,
    ground: source.ground,
    primaryColor: source.primaryColor,
    secondaryColor: source.secondaryColor,
    textColor: source.textColor,
    formation: source.formation,
    leagueId: source.leagueId,
    reputation: source.reputation,
    facilities: source.facilities,
    academy: { rating: source.facilities.youth, prospectIds: [] },
    medical: { rating: source.facilities.medical, playersInTreatment: 0 },
    scouting: { rating: clamp(source.reputation - 5, 15, 45), regionsCovered: ["Domestic"] },
    playerIds: [],
    // Phase D1: every club but the player's own gets an AI manager.
    aiManager: generateAIManager(source as StarterClub),
  };
}

const GENERATED_REGIONAL_NAMES = [
  "Ashford Borough",
  "Brookmere FC",
  "Cedar Vale",
  "Dunwich Athletic",
  "Eastmere United",
  "Foxley Town",
  "Greyhaven Rovers",
  "Highmoor FC",
  "Ivybridge City",
  "Juniper Athletic",
  "Kingsfield Town",
  "Lakeside Borough",
  "Moorland United",
  "Northmere FC",
  "Oakridge Rovers",
  "Pinehurst Town",
];

function makeGeneratedRegionalClub(source: StarterClub, index: number): Club {
  const seed = `${source.id}:regional-generated:${index}`;
  const variation = Math.round((seededUnit(seed) - 0.5) * 12);
  const name = GENERATED_REGIONAL_NAMES[index] ?? `Regional Third Club ${index + 1}`;
  const reputation = clamp(source.reputation + variation, 15, 45);
  const facilities = {
    training: clamp(source.facilities.training + variation),
    medical: clamp(source.facilities.medical + variation),
    youth: clamp(source.facilities.youth + variation),
    stadium: clamp(source.facilities.stadium + variation),
  };
  return makeRivalClub({
    ...source,
    id: `regional-third-club-${index + 1}`,
    name,
    shortName: name.split(" ")[0]!,
    abbr: name
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase(),
    ground: `${name} Ground`,
    reputation,
    facilities,
  });
}

// ---- top-level assembly -----------------------------------------------------------

export interface NewCareerChoices {
  managerName: string;
  nationality: string;
  philosophyId: string;
  clubId: string;
}

function buildManager(choices: NewCareerChoices, club: StarterClub): Manager {
  const philosophy = getPhilosophy(choices.philosophyId);
  const profile = generateManagerAttributeProfile(choices.philosophyId);
  const wage = clamp(Math.round(400 + club.reputation * 30), 400, 2200);
  return {
    id: "manager-1",
    name: choices.managerName.trim() || "New Manager",
    nationality: choices.nationality,
    reputation: profile.reputation,
    clubId: club.id,
    trophies: 0,
    experience: 0,
    tactics: profile.tactics,
    training: profile.training,
    motivation: profile.motivation,
    scouting: profile.scouting,
    negotiation: profile.negotiation,
    manManagement: profile.manManagement,
    playerDevelopment: profile.playerDevelopment,
    credit: 55,
    philosophy: philosophy?.philosophyText ?? "Still finding an identity",
    boardConfidence: 55,
    fanConfidence: 50,
    squadConfidence: 50,
    contract: {
      clubId: club.id,
      salary: `€${wage.toLocaleString("en-US")} / wk`,
      until: `Jun ${SEASON_START_YEAR + 2}`,
    },
  };
}

/** The one function this whole module exists to expose: turns the wizard's
 * choices into a complete, real `GameState` — every field populated from
 * either the choice itself or a generator above, nothing copied from the
 * `state/seed.ts` demo save. Pass `squad` when the wizard already generated
 * (and showed the manager) a preview squad in the "review club" step, so
 * the club the manager actually starts with is exactly what they reviewed
 * rather than a second, different random roll. */
export function buildCareerState(choices: NewCareerChoices, squad?: Player[]): GameState {
  const club = getStarterClub(choices.clubId) ?? STARTER_CLUBS[0]!;
  const authoredRivals = STARTER_CLUBS.filter((c) => c.id !== club.id);
  const rivals = [
    ...authoredRivals,
    ...Array.from({ length: 16 }, (_, index) => makeGeneratedRegionalClub(club, index)),
  ];
  const divisionClubIds = [club.id, ...rivals.map((r) => r.id)];
  const staffSeed = `${club.id}:staff`;

  const finalSquad = squad ?? generateSquad(club);
  const squadValue = finalSquad.reduce((sum, p) => sum + p.marketValue, 0);
  const academyProspectIds = finalSquad
    .filter((p) => p.age <= 21)
    .sort((a, b) => b.potential - b.overall - (a.potential - a.overall))
    .map((p) => p.id);

  const currentClub: Club = {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    abbr: club.abbr,
    ground: club.ground,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    textColor: club.textColor,
    formation: club.formation,
    leagueId: club.leagueId,
    reputation: club.reputation,
    facilities: club.facilities,
    academy: { rating: club.facilities.youth, prospectIds: academyProspectIds },
    medical: { rating: club.facilities.medical, playersInTreatment: 0 },
    scouting: { rating: clamp(club.reputation - 2, 15, 45), regionsCovered: ["Domestic"] },
    playerIds: finalSquad.map((p) => p.id),
  };

  const clubs: Record<string, Club> = { [currentClub.id]: currentClub };
  for (const rival of rivals) clubs[rival.id] = makeRivalClub(rival);

  const players: GameState["players"] = Object.fromEntries(finalSquad.map((p) => [p.id, p]));

  const contracts: Contract[] = finalSquad.map((p) => ({
    playerId: p.id,
    clubId: club.id,
    status: "active",
  }));

  const league: League = {
    id: club.leagueId,
    name: club.division,
    competitionId: REGIONAL_THIRD_DIVISION_ID,
    season: SEASON,
    matchday: 1,
  };

  const fixtures = buildFixtures(divisionClubIds);
  const firstFixture = fixtures.find((f) => f.homeClubId === club.id || f.awayClubId === club.id);

  const initialDaysSinceStart = daysBetweenISO(SEASON_START_DATE, CURRENT_DATE);
  const time: GameCalendarState = {
    date: CURRENT_DATE,
    season: SEASON,
    day: initialDaysSinceStart + 1,
    week: Math.floor(initialDaysSinceStart / 7) + 1,
    seasonStartDate: SEASON_START_DATE,
  };

  const manager = buildManager(choices, club);

  return {
    manager,
    time,
    currentClub,
    clubs,
    players,
    meta: {
      worldYear: 2026,
      leagueHierarchy: {
        championship: "premier-league",
        "league-one": "championship",
        "league-two": "league-one",
        "national-league": "league-two",
      },
      worldConfig: {
        countries: [
          {
            id: "england",
            name: "England",
            divisions: [
              {
                id: "premier-league",
                name: "Premier League",
                countryId: "england",
                level: 1,
                qualificationSlots: 4,
                relegationTo: "championship",
                relegationSpots: 3,
              },
              {
                id: "championship",
                name: "Championship",
                countryId: "england",
                level: 2,
                promotionTo: "premier-league",
                relegationTo: "league-one",
                promotionSpots: 3,
                relegationSpots: 3,
              },
              {
                id: "league-one",
                name: "League One",
                countryId: "england",
                level: 3,
                promotionTo: "championship",
                relegationTo: "league-two",
                promotionSpots: 3,
                relegationSpots: 3,
              },
              {
                id: "league-two",
                name: "League Two",
                countryId: "england",
                level: 4,
                promotionTo: "league-one",
                relegationTo: "national-league",
                promotionSpots: 3,
                relegationSpots: 3,
              },
              {
                id: "national-league",
                name: "National League",
                countryId: "england",
                level: 5,
                promotionTo: "league-two",
                promotionSpots: 3,
              },
            ],
          },
        ],
        competitions: [
          {
            id: "premier-league",
            name: "Premier League",
            type: "league",
            countryId: "england",
            divisionIds: ["premier-league"],
          },
          {
            id: "championship",
            name: "Championship",
            type: "league",
            countryId: "england",
            divisionIds: ["championship"],
          },
          {
            id: "uefa-champions-league",
            name: "UEFA Champions League",
            type: "continental",
            qualificationSlots: 4,
            qualificationRules: [
              {
                type: "leaguePosition",
                sourceCompetitionId: "premier-league",
                positions: [1, 2, 3, 4],
              },
            ],
            format: {
              groupStage: {
                numGroups: 2,
                teamsPerGroup: 2,
                homeAndAway: true,
                advancePerGroup: 2,
              },
              knockoutStage: {
                rounds: [
                  { id: "semi-final", name: "Semi-final", teams: 4, twoLegged: true },
                  { id: "final", name: "Final", teams: 2, twoLegged: false },
                ],
                extraTime: true,
                penalties: true,
              },
            },
          },
          {
            id: "uefa-europa-league",
            name: "UEFA Europa League",
            type: "continental",
            qualificationSlots: 2,
            qualificationRules: [
              {
                type: "cupWinner",
                sourceCompetitionId: "national-cup",
                fallbackToCompetitionId: "premier-league",
              },
              { type: "leaguePosition", sourceCompetitionId: "premier-league", positions: [5] },
            ],
            format: {
              groupStage: {
                numGroups: 2,
                teamsPerGroup: 1,
                homeAndAway: true,
                advancePerGroup: 1,
              },
              knockoutStage: {
                rounds: [{ id: "final", name: "Final", teams: 2, twoLegged: false }],
                extraTime: true,
                penalties: true,
              },
            },
          },
        ],
      },
    },
    staff: [
      {
        id: "staff-asst",
        name: `${pick(`${staffSeed}:asst-first`, FIRST_NAMES)} ${pick(`${staffSeed}:asst-last`, LAST_NAMES)}`,
        role: "Assistant Manager",
        nationality: pick(`${staffSeed}:asst-nat`, MANAGER_NATIONALITIES),
        rating: randIntFromSeed(`${staffSeed}:asst-rating`, 35, 60),
        clubId: club.id,
      },
      {
        id: "staff-physio",
        name: `${pick(`${staffSeed}:physio-first`, FIRST_NAMES)} ${pick(`${staffSeed}:physio-last`, LAST_NAMES)}`,
        role: "Head Physio",
        nationality: pick(`${staffSeed}:physio-nat`, MANAGER_NATIONALITIES),
        rating: randIntFromSeed(`${staffSeed}:physio-rating`, 35, 60),
        clubId: club.id,
      },
      {
        id: "staff-scout",
        name: `${pick(`${staffSeed}:scout-first`, FIRST_NAMES)} ${pick(`${staffSeed}:scout-last`, LAST_NAMES)}`,
        role: "Chief Scout",
        nationality: pick(`${staffSeed}:scout-nat`, MANAGER_NATIONALITIES),
        rating: randIntFromSeed(`${staffSeed}:scout-rating`, 30, 55),
        clubId: club.id,
      },
    ],
    leagues: { [league.id]: league },
    competitions: [
      {
        id: REGIONAL_THIRD_DIVISION_ID,
        name: club.division,
        type: "league",
        stage: "Matchday 1",
        status: "upcoming",
      },
      {
        id: REGIONAL_TROPHY_ID,
        name: "Regional Trophy",
        type: "cup",
        stage: "First Round",
        status: "upcoming",
      },
    ],
    fixtures,
    matches: [],
    transfers: [],
    contracts,
    training: [
      {
        id: "plan-fitness",
        name: "Fitness & Conditioning",
        focus: "Conditioning",
        intensity: "medium",
        assignedPlayerIds: finalSquad.map((p) => p.id),
      },
    ],
    finances: {
      transferBudget: club.finances.transferBudget,
      wageBudget: club.finances.wageBudget,
      squadValue: formatMoney(squadValue),
      balance: club.finances.balance,
      income: {
        matchRevenue: 0,
        sponsorship: 0,
        prizeMoney: 0,
        playerSales: 0,
        competitionRevenue: 0,
        total: 0,
      },
      expenses: {
        playerSalaries: 0,
        staff: 0,
        transfers: 0,
        facilities: 0,
        scouting: 0,
        medical: 0,
        operations: 0,
        total: 0,
      },
      lastUpdatedDate: "2026-08-10",
      lastUpdatedWeek: 1,
    },
    board: ((): Board => {
      const baseConfidence = 55;
      const boardPatience = (club.identity?.boardPatience ?? 50) as number;
      const expectationsLevel = club.identity?.expectations ?? "normal";
      const confidence = Math.max(
        10,
        Math.min(95, Math.round(baseConfidence + (boardPatience - 50) * 0.5)),
      );
      const expectations = club.objectives.map((o) => ({
        ...o,
        note: `${o.note}${expectationsLevel === "high" ? " (High expectations)" : expectationsLevel === "low" ? " (Low expectations)" : ""}`,
      }));
      return { confidence, expectations, reputation: club.reputation ?? 50 };
    })(),
    fans: {
      approval: 55,
      attendanceAvg: Math.round(1200 + club.facilities.stadium * 40),
    },
    events: [],
    news: [
      {
        id: "news-appointment",
        tag: "CLUB",
        time: "Just now",
        text: `${manager.name} appointed as the new manager of ${club.name}.`,
      },
    ],
    calendar: firstFixture
      ? [
          {
            id: "cal-1",
            date: firstFixture.date,
            type: "match",
            description: `${firstFixture.homeClubId === club.id ? (clubs[firstFixture.awayClubId]?.name ?? firstFixture.awayClubId) : (clubs[firstFixture.homeClubId]?.name ?? firstFixture.homeClubId)} (${firstFixture.homeClubId === club.id ? "H" : "A"}) — ${league.name}, Matchday 1`,
          },
        ]
      : [],
    careerHistory: [
      {
        id: "career-1",
        season: SEASON,
        clubId: club.id,
        summary: `Appointed manager of ${club.name}.`,
      },
    ],
    tactics: {
      mentality: 55,
      width: 68,
      depth: 55,
      tempo: 72,
      pressing: 60,
      instructions: {
        outFromBack: false,
        counterPress: false,
        workIntoBox: false,
        fullBacksWide: false,
      },
    },
  };
}
