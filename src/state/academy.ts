import type { GameState, Player } from "./types";
import { seededUnit } from "./utils";
import { getFacilityEffectMultiplier } from "./facilities";
import { generateDOBFromAge } from "./calendar";
import { getLeagueDevelopmentEnvironment, getLeagueStrengthRating } from "./league-strength";

function clampPercent(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampValue(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function seededRandInt(seed: string, min: number, max: number, index: number) {
  const v = seededUnit(`${seed}:${index}`);
  return Math.floor(v * (max - min + 1)) + min;
}

function seededPick<T>(seed: string, items: readonly T[], index: number) {
  if (items.length === 0) throw new Error("Cannot pick from an empty array");
  const v = seededUnit(`${seed}:pick:${index}`);
  return items[Math.floor(v * items.length)] as T;
}

const POSITIONS: Player["pos"][] = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];
const PERSONALITIES = ["Driven", "Determined", "Quiet", "Ambitious", "Composed", "Sparkling"];

function stableSeedHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildYouthPlayerId(seed: string, lastName: string, age: number): string {
  const normalizedSeed = String(seed)
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
  const normalizedLast = String(lastName)
    .replace(/[^a-z]+/gi, "")
    .toLowerCase();

  // Keep IDs short and deterministic while preserving uniqueness across clubs and generation slots.
  // The old implementation truncated the tail of the seed, which collapsed several distinct clubs
  // that shared the same suffix (for example "-championship-club-3").
  const seedToken = stableSeedHash(`${normalizedSeed}:${age}`).slice(0, 10);
  return `${normalizedLast}-${seedToken}-${age}`;
}

const FIRST_NAMES = [
  "Luca",
  "Noah",
  "Mateo",
  "Kian",
  "Ari",
  "Theo",
  "Milo",
  "Elias",
  "Zane",
  "Sam",
];
const LAST_NAMES = [
  "Mendes",
  "Alvarez",
  "Silva",
  "Hansen",
  "Okafor",
  "Bennett",
  "Rossi",
  "Duarte",
  "Ibrahim",
  "Parker",
];
const ROLE_BY_POS: Record<string, string[]> = {
  GK: ["Shot Stopper", "Sweeper Keeper"],
  RB: ["Wing Back", "Full-Back"],
  CB: ["Ball-Playing Def.", "No-Nonsense CB"],
  LB: ["Wing Back", "Defensive Full-Back"],
  CDM: ["Ball Winner", "Destroyer"],
  CM: ["Deep Playmaker", "Box-to-Box"],
  CAM: ["Creative No.10", "Playmaker"],
  RW: ["Wide Forward", "Winger"],
  LW: ["Wide Forward", "Winger"],
  ST: ["Poacher", "Target Man"],
};

const ATTR_PROFILES: Record<
  string,
  {
    pace: [number, number];
    shooting: [number, number];
    passing: [number, number];
    dribbling: [number, number];
    defending: [number, number];
    physical: [number, number];
  }
> = {
  GK: {
    pace: [35, 60],
    shooting: [25, 45],
    passing: [45, 70],
    dribbling: [35, 60],
    defending: [45, 70],
    physical: [45, 70],
  },
  RB: {
    pace: [60, 86],
    shooting: [35, 60],
    passing: [45, 70],
    dribbling: [55, 80],
    defending: [50, 78],
    physical: [55, 80],
  },
  CB: {
    pace: [40, 74],
    shooting: [25, 50],
    passing: [45, 70],
    dribbling: [35, 60],
    defending: [60, 85],
    physical: [60, 85],
  },
  LB: {
    pace: [60, 86],
    shooting: [35, 60],
    passing: [45, 70],
    dribbling: [55, 80],
    defending: [50, 78],
    physical: [55, 80],
  },
  CDM: {
    pace: [45, 74],
    shooting: [35, 60],
    passing: [55, 80],
    dribbling: [45, 78],
    defending: [55, 82],
    physical: [60, 84],
  },
  CM: {
    pace: [45, 78],
    shooting: [40, 70],
    passing: [60, 86],
    dribbling: [55, 84],
    defending: [45, 72],
    physical: [55, 78],
  },
  CAM: {
    pace: [50, 82],
    shooting: [55, 84],
    passing: [65, 88],
    dribbling: [60, 86],
    defending: [35, 60],
    physical: [50, 74],
  },
  RW: {
    pace: [70, 90],
    shooting: [45, 75],
    passing: [45, 72],
    dribbling: [65, 88],
    defending: [30, 54],
    physical: [50, 74],
  },
  LW: {
    pace: [70, 90],
    shooting: [45, 75],
    passing: [45, 72],
    dribbling: [65, 88],
    defending: [30, 54],
    physical: [50, 74],
  },
  ST: {
    pace: [55, 84],
    shooting: [60, 88],
    passing: [40, 68],
    dribbling: [55, 82],
    defending: [25, 48],
    physical: [60, 84],
  },
};

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1000)}K`;
  return `€${Math.round(n)}`;
}

function rollingAverage(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function academyPotentialSeedBonus(club: GameState["currentClub"]): number {
  return Math.max(0, (club.reputation - 45) / 120 + (club.academy?.rating ?? 50) / 220);
}

function generateYouthPlayer(
  seed: string,
  club: GameState["currentClub"],
  currentDate: string,
): Player {
  const pos = seededPick(seed, POSITIONS, 1);
  const profile = ATTR_PROFILES[pos];
  if (!profile) throw new Error(`No attribute profile found for ${pos}`);
  const age = seededRandInt(seed, 15, 18, 2);
  const academyBoost = Math.round((club.academy?.rating ?? 50) / 22);
  const youthRecruitment = club.scouting.regionsCovered.length >= 3 ? 3 : 0;
  const leagueRating = getLeagueStrengthRating(club.leagueId);
  const leagueEnvironment = getLeagueDevelopmentEnvironment(club.leagueId);
  const environmentBonus = Math.round((leagueRating - 60) / 12);
  const base = Math.round(20 + age * 2 + academyBoost + youthRecruitment + environmentBonus);

  const attrs = {
    pace: clampPercent(
      seededRandInt(seed, profile.pace[0], profile.pace[1], 3) + Math.round(academyBoost / 7),
    ),
    shooting: clampPercent(
      seededRandInt(seed, profile.shooting[0], profile.shooting[1], 4) +
        Math.round(academyBoost / 10),
    ),
    passing: clampPercent(
      seededRandInt(seed, profile.passing[0], profile.passing[1], 5) +
        Math.round(academyBoost / 12),
    ),
    dribbling: clampPercent(
      seededRandInt(seed, profile.dribbling[0], profile.dribbling[1], 6) +
        Math.round(academyBoost / 12),
    ),
    defending: clampPercent(
      seededRandInt(seed, profile.defending[0], profile.defending[1], 7) +
        Math.round(academyBoost / 10),
    ),
    physical: clampPercent(
      seededRandInt(seed, profile.physical[0], profile.physical[1], 8) +
        Math.round(academyBoost / 12),
    ),
  };

  const overall = clampPercent(
    (attrs.pace +
      attrs.shooting +
      attrs.passing +
      attrs.dribbling +
      attrs.defending +
        attrs.physical) /
        6 +
        base / 10 +
        (leagueEnvironment - 1) * 8,
  );
  const eliteRoll = seededUnit(`${seed}:elite`);
  const potentialRange: [number, number] =
    eliteRoll > 0.95 ? [overall + 12, overall + 18] : [overall + 6, overall + 12];
  const potential = clampValue(
    seededRandInt(seed, potentialRange[0], potentialRange[1], 9),
    overall,
    92,
  );

  const professionalism = clampPercent(
    seededRandInt(seed, 55, 92, 10) + Math.round(club.reputation / 40),
  );
  const marketValue = clampValue(
    Math.round((overall - 35) ** 2.05 * 65 + age * 3_200 + professionalism * 250),
    8_000,
    1_200_000,
  );
  const contractYears = 1;
  const weeklySalary = Math.round((marketValue * 0.0023) / 10) * 10;
  const first = seededPick(seed, FIRST_NAMES, 11);
  const last = seededPick(seed, LAST_NAMES, 12);
  const id = buildYouthPlayerId(seed, last, age);

  return {
    id,
    name: `${first} ${last}`,
    shortName: last,
    number: 0,
    pos,
    role: seededPick(seed, ROLE_BY_POS[pos] ?? ["Development Player"], 13),
    nationality: "ENG",
    age,
    overall,
    potential,
    fitness: seededRandInt(seed, 78, 95, 14),
    morale: clampPercent(60 + Math.round((club.reputation - 50) / 3)),
    form: seededRandInt(seed, 48, 70, 15),
    formTrend: "flat" as const,
    attrs,
    professionalism,
    personality: seededPick(seed, PERSONALITIES, 16),
    value: formatMoney(marketValue),
    salary: `€${weeklySalary.toLocaleString("en-US")}`,
    contractUntil: `Jun ${Number(club.facilities?.training ?? 50) > 60 ? 2028 : 2027}`,
    contractYears,
    trainingFocus: "Development",
    trainingProgress: seededRandInt(seed, 0, 20, 17),
    status: "available" as const,
    starter: false,
    consistency: clampPercent(professionalism * 0.55 + overall * 0.35),
    injuryProneness: clampPercent(100 - age * 2.5 - professionalism * 0.18, 5, 90),
    fatigue: clampPercent(100 - seededRandInt(seed, 84, 96, 18)),
    injury: null,
    marketValue,
    development: {
      trainingEfficiency: clampPercent(64 + professionalism * 0.18),
      growthRate: clampPercent(Math.max(0, potential - overall) * 8),
    },
    playingTime: { appearancesThisSeason: 0, startsThisSeason: 0, minutesThisSeason: 0 },
    relationships: [],
    tacticalFamiliarity: {
      [club.formation]: clampPercent(45 + seededRandInt(seed, 0, 20, 19)),
    },
    reputation: clampPercent(26 + Math.round(club.reputation / 5)),
    lastMatchRating: 5,
    matchRatingHistory: [],
    clubId: club.id,
    dateOfBirth: generateDOBFromAge(age, currentDate), // PHASE AAA-REPAIR-4: Add DOB for youth
  };
}

function isSeasonStart(date: string) {
  return date.endsWith("-08-01") || date.endsWith("-01-01");
}

function buildProspectCount(club: GameState["currentClub"], date: string) {
  const academyRating = club.academy?.rating ?? 50;
  const youthMultiplier = getFacilityEffectMultiplier(club, "youth");
  const seed = seededUnit(`${club.id}:${date}:prospects`);
  const base = academyRating / 35 + youthMultiplier * 0.25 + club.reputation / 120;
  const count = Math.min(2, Math.max(0, Math.round(base + (seed > 0.7 ? 0.9 : 0) - 0.4)));
  return count;
}

export function promoteProspectToSenior(
  state: GameState,
  club: GameState["currentClub"],
  prospectId: string,
): GameState {
  const prospect = state.players[prospectId];
  if (!prospect || prospect.status === "retired") return state;

  const updatedProspect: Player = {
    ...prospect,
    status: "available",
    starter: false,
    contractYears: Math.max(1, prospect.contractYears ?? 1),
    contractUntil: `Jun ${Number(String(state.time.season).split("/")[0]) + 1}`,
    clubId: club.id,
  };

  // CRITICAL FIX: Remove prospect from any OTHER club before adding to this club
  const nextClubs = { ...state.clubs };
  for (const [otherId, otherClub] of Object.entries(nextClubs)) {
    if (otherId !== club.id && otherClub.playerIds?.includes(prospectId)) {
      nextClubs[otherId] = {
        ...otherClub,
        playerIds: otherClub.playerIds.filter((id) => id !== prospectId),
      };
    }
  }

  const updatedClub = {
    ...club,
    playerIds: [...new Set([...club.playerIds.filter((id) => id !== prospectId), prospectId])],
    academy: {
      ...club.academy,
      prospectIds: club.academy?.prospectIds.filter((id) => id !== prospectId) ?? [],
    },
  };
  nextClubs[club.id] = updatedClub;

  return {
    ...state,
    players: { ...state.players, [prospectId]: updatedProspect },
    clubs: nextClubs,
    currentClub: state.currentClub.id === club.id ? updatedClub : state.currentClub,
  };
}

export function runSeasonalYouthGeneration(state: GameState): GameState {
  const today = state.time.date;
  if (!isSeasonStart(today)) return state;

  const events = [...(state.events ?? [])];
  const playerUpdates: Record<string, Player> = {};
  const clubUpdates: Record<string, GameState["currentClub"]> = {};
  let updatedCurrentClub = state.currentClub;

  // PERFORMANCE FIX: Batch all club/player updates instead of spreading on every club
  // Before: O(n²) - spread entire state for each of 1,737 clubs
  // After: O(n) - collect updates, spread once at end
  for (const club of Object.values(state.clubs)) {
    const clubSeed = `${club.id}:${today}`;
    const academyRating = club.academy?.rating ?? 50;
    const facilityMultiplier = getFacilityEffectMultiplier(club, "youth");
    const academyFocus = club.identity?.academyFocus ?? 50;
    const regionBonus = club.scouting.regionsCovered.includes("Western Europe") ? 1.05 : 1;
    const chance = Math.min(
      0.9,
      0.08 +
        academyRating / 1000 +
        academyFocus / 1000 +
        facilityMultiplier * 0.05 +
        regionBonus * 0.01,
    );
    if (seededUnit(`${clubSeed}:generate`) >= chance) continue;

    const generatedCount = buildProspectCount(club, today);
    if (generatedCount <= 0) continue;

    const nextProspects = [...(club.academy?.prospectIds ?? [])];
    const generatedPlayerIds: string[] = [];
    for (let i = 0; i < generatedCount; i += 1) {
      const generated = generateYouthPlayer(`${clubSeed}:${i}`, club, today);
      playerUpdates[generated.id] = generated;
      nextProspects.push(generated.id);
      generatedPlayerIds.push(generated.id);

      // Emit explicit YOUTH_GENERATED event with authoritative proof
      events.push({
        id: `event-youth-${events.length + 1}`,
        date: today,
        type: "YOUTH_GENERATED",
        description: `${club.name} generated prospect ${generated.name}`,
        meta: {
          playerId: generated.id,
          clubId: club.id,
          age: generated.age,
          potential: generated.potential,
        },
      } as any);
    }

    const updatedAcademy = {
      ...club.academy,
      prospectIds: nextProspects,
      rating: Math.min(
        100,
        Math.round(academyRating + generatedCount * 2 + facilityMultiplier * 1.5),
      ),
    };
    const updatedClub = { ...club, academy: updatedAcademy };
    clubUpdates[club.id] = updatedClub;
    if (state.currentClub.id === club.id) updatedCurrentClub = updatedClub;

    // Also keep summary milestone for UI/history
    events.push({
      id: `event-academy-${events.length + 1}`,
      date: today,
      type: "milestone" as const,
      description: `${club.name} produced ${generatedCount} new academy prospect${generatedCount > 1 ? "s" : ""}.`,
    });
  }

  // Apply all updates in a single operation
  const next = {
    ...state,
    players: { ...state.players, ...playerUpdates },
    clubs: { ...state.clubs, ...clubUpdates },
    currentClub: updatedCurrentClub,
    events,
  };
  return next;
}

export {};
