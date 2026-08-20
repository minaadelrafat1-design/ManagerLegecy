/* =============================================================================
 * GameState — initial seed
 * =============================================================================
 * Builds the ONE starting GameState from the data that already existed
 * before this phase: `data/squad.ts` (the managed roster) and
 * `data/opponent.ts` (the next opponent's lightweight sim roster), plus the
 * mock constants that were previously scattered across route files
 * (league table on the dashboard, fixture list, transfer targets, board
 * objectives, news feed). Centralising them here is what makes them part of
 * the authoritative state instead of copies embedded in each screen.
 *
 * Neither `data/squad.ts` nor `data/opponent.ts` is modified — they remain
 * the seed/reference data; this module is the only place that turns them
 * into a `GameState`.
 * ---------------------------------------------------------------------------*/

import { players as seedPlayers, FORMATION } from "@/data/squad";
import type { Player as BasePlayer } from "@/data/squad";
import { opponentXI, opponentBench, OPPONENT_FORMATION } from "@/data/opponent";
import { daysBetweenISO, addDaysISO, getDayOfWeekLabel, generateDOBFromAge } from "./calendar";
import { generateAIManager } from "./ai-manager";
import { ensureAiLedgerFromClub } from "./club-finance";
import { initializeAllEnhancedRevenueSystems } from "./enhanced-revenue";
import type {
  GameState,
  Club,
  Contract,
  Fixture,
  FixtureResult,
  GameCalendarState,
  League,
  Player,
  TacticsSettings,
} from "./types";
import { buildInitialTrainingPresets, getAllDrills } from "./training-presets";
import { createTrainingGroundDefaults } from "./training-ground";
import generateSampleWorld from "./worldgen";

// generate the world config once at module load so top-level population
// code can reference it without depending on buildInitialState order.
const GLOBAL_SAMPLE_WORLD = generateSampleWorld({ numCountries: 16 });

export const HOME_CLUB_ID = "northfield-united";
const AWAY_CLUB_ID = "westport-united";
const LEAGUE_ID = "national-league";
const LEAGUE_COMPETITION_ID = "national-league";
const CUP_COMPETITION_ID = "national-cup";
export const MATCHDAY = 14;
export const SEASON = "2026/27";
/** Canonical season anchor used by the live demo and all fresh career boots.
 * Keep the same value everywhere so save/reload transitions do not jump between
 * a start-of-season date and a mid-season date. */
export const SEASON_START_DATE = "2026-08-01";
/** A few days before the calculated matchday-14 fixture, so the seeded clock
 * and the seeded fixture list agree on what's next. */
export const CURRENT_DATE = "2026-11-11";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// ---- players ------------------------------------------------------------------
// Turns each hand-authored `data/squad.ts` record into the richer `Player`
// shape Phase A3 adds, deterministically from fields that already exist —
// no RNG, so this stays hydration-safe and reproducible. `data/squad.ts`
// itself is untouched.

/** "€41.0M" / "€520K" -> 41_000_000 / 520_000. Falls back to 0 for a value
 * that doesn't parse rather than throwing — a display string should never
 * crash the state layer. */
function parseMoney(display: string): number {
  const match = /([\d.]+)\s*([MK])?/i.exec(display.replace(/[^0-9.MKmk]/g, ""));
  if (!match?.[1]) return 0;
  const n = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

function derivePlayerState(p: BasePlayer, formation: string): Player {
  const ageFactor = clamp(100 - Math.abs(p.age - 24) * 3); // peaks mid-20s
  return {
    ...p,
    consistency: clamp(p.professionalism * 0.6 + p.overall * 0.4),
    injuryProneness: clamp(100 - ageFactor * 0.5 - p.professionalism * 0.3, 5, 95),
    fatigue: clamp(100 - p.fitness, 0, 100),
    injury:
      p.status === "injured"
        ? { type: "Muscle strain", severity: "moderate", returnDate: null }
        : null,
    marketValue: parseMoney(p.value),
    development: {
      trainingEfficiency: clamp(ageFactor * 0.7 + p.professionalism * 0.3),
      growthRate: clamp((p.potential - p.overall) * 8),
    },
    playingTime: p.starter
      ? {
          appearancesThisSeason: MATCHDAY - 1,
          startsThisSeason: MATCHDAY - 1,
          minutesThisSeason: (MATCHDAY - 1) * 90,
        }
      : {
          appearancesThisSeason: Math.max(0, MATCHDAY - 8),
          startsThisSeason: 0,
          minutesThisSeason: Math.max(0, MATCHDAY - 8) * 22,
        },
    relationships: [],
    tacticalFamiliarity: { [formation]: p.starter ? 78 : 55 },
    reputation: 50,
    lastMatchRating: 5.0,
    matchRatingHistory: [],
    dateOfBirth: generateDOBFromAge(p.age, CURRENT_DATE),
  };
}

// ---- clubs ------------------------------------------------------------------

const RIVAL_CLUB_NAMES: Record<string, string> = {
  "ashcombe-city": "Ashcombe City",
  ravenport: "Ravenport",
  "harlow-rovers": "Harlow Rovers",
  kingsmere: "Kingsmere",
  "riverside-fc": "Riverside FC",
  "coastal-town": "Coastal Town",
  "oldbridge-athletic": "Oldbridge Athletic",
};

function hashSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deriveContextualClubIdentity(leagueId: string, clubId: string) {
  const world = GLOBAL_SAMPLE_WORLD;
  const division = world.countries
    .flatMap((country) => country.divisions)
    .find((item) => item.id === leagueId);
  const country = division ? world.countries.find((item) => item.id === division.countryId) : null;
  const seed = hashSeed(`${clubId}:${leagueId}`);

  const archetypeRoll = seed % 4;
  const archetype =
    archetypeRoll === 0
      ? "youth"
      : archetypeRoll === 1
        ? "ambitious"
        : archetypeRoll === 2
          ? "traditional"
          : "balanced";
  const countryBoost =
    country?.identity?.financialPower === "Elite"
      ? 10
      : country?.identity?.financialPower === "Strong"
        ? 6
        : 0;
  const divisionBoost =
    division?.identity?.competitiveLevel === "Highest"
      ? 9
      : division?.identity?.competitiveLevel === "Very high"
        ? 6
        : division?.identity?.competitiveLevel === "High"
          ? 4
          : 0;
  const academyFocus = Math.max(
    20,
    Math.min(
      90,
      38 +
        (seed % 35) +
        countryBoost +
        (country?.identity?.youthProduction === "Strong" ? 8 : 0) +
        (division?.identity?.developmentPath.includes("talent") ? 10 : 0),
    ),
  );
  const boardPatience = Math.max(
    18,
    Math.min(
      86,
      42 +
        (seed % 28) +
        (country?.identity?.culture?.includes("ambitious") ? 6 : 0) +
        (division ? 4 : 0),
    ),
  );
  const transferBudgetFactor = Number(
    (0.65 + ((seed % 100) / 100) * 0.9 + countryBoost / 120).toFixed(2),
  );
  const preferExperienced = Math.max(
    8,
    Math.min(
      82,
      28 +
        (seed % 46) +
        (archetype === "traditional" ? 18 : 0) +
        (country?.identity?.financialPower === "Elite" ? 8 : 0),
    ),
  );
  const expectations =
    archetype === "ambitious" || countryBoost > 0 ? "high" : seed % 3 === 0 ? "low" : "normal";

  return {
    archetype,
    academyFocus: Math.round(academyFocus),
    boardPatience: Math.round(boardPatience),
    transferBudgetFactor: Number(transferBudgetFactor.toFixed(2)),
    expectations,
    preferExperienced: Math.round(preferExperienced),
  } as const;
}

function makeMinimalClub(id: string, name: string, leagueId: string): Club {
  const facilities = { training: 50, medical: 50, youth: 50, stadium: 50 };
  const reputation = 50;
  const formation = "4-4-2";
  const contextualIdentity = deriveContextualClubIdentity(leagueId, id);
  return {
    id,
    name,
    shortName: name,
    abbr: name.slice(0, 3).toUpperCase(),
    ground: `${name} Ground`,
    primaryColor: "#7C8798",
    secondaryColor: "#3C4553",
    textColor: "#101A28",
    formation,
    leagueId,
    reputation,
    facilities,
    facilityLevels: { training: 3, youth: 2, medical: 2, scouting: 2 },
    academy: { rating: 50, prospectIds: [] },
    medical: { rating: 50, playersInTreatment: 0 },
    scouting: { rating: 50, regionsCovered: [] },
    playerIds: [],
    // Phase D1: this club isn't the player's, so it gets an AI manager —
    // see `state/ai-manager.ts`.
    aiManager: generateAIManager({ id, name, formation, reputation, facilities }),
    identity: contextualIdentity,
  };
}

/** Generate AI players for a club deterministically.
 * Creates a full squad (23-25 players) with realistic variations by position,
 * age, and rating adjusted for club tier. Uses seeded RNG for reproducibility.
 */
function generateClubSquad(
  clubId: string,
  clubName: string,
  leagueId: string,
  existingPlayers: Record<string, Player>,
): Player[] {
  const rng = createSeedRng(hashSeed(`${clubId}:squad`));
  const players: Player[] = [];

  // Positions with typical squad distribution
  const positions = [
    "GK",
    "GK", // 2 goalkeepers
    "CB",
    "CB",
    "CB",
    "CB", // 4 center backs
    "RB",
    "LB",
    "RB",
    "LB", // 4 fullbacks
    "CDM",
    "CDM",
    "CM",
    "CM",
    "CM",
    "CM", // 6 midfielders
    "CAM",
    "CAM", // 2 attacking mids
    "ST",
    "ST",
    "LW",
    "RW",
    "LW",
    "RW", // 6 forwards/wingers
  ];

  // Club division tier affects player ratings
  const divisionTierBoost = leagueId.includes("Premier")
    ? 12
    : leagueId.includes("Championship")
      ? 8
      : leagueId.includes("League One")
        ? 4
        : leagueId.includes("League Two")
          ? 0
          : leagueId === LEAGUE_ID
            ? 6 // national league
            : 2;

  const nationalities = [
    "ENG",
    "WAL",
    "SCO",
    "IRL",
    "FRA",
    "GER",
    "ITA",
    "ESP",
    "NED",
    "POR",
    "SWE",
    "NOR",
    "DEN",
    "BEL",
    "SRB",
    "CRO",
    "POL",
    "AUS",
    "BRA",
    "ARG",
  ];

  const firstNames = [
    "Liam",
    "Noah",
    "Oliver",
    "Elijah",
    "James",
    "Benjamin",
    "Lucas",
    "Henry",
    "Alexander",
    "Mason",
    "Michael",
    "Ethan",
    "Daniel",
    "Jacob",
    "Logan",
    "Jackson",
    "Sebastian",
    "Aiden",
    "Matthew",
    "Samuel",
  ];

  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
  ];

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i] ?? "CM";
    const firstName = firstNames[Math.floor(rng() * firstNames.length)] ?? "Player";
    const lastName = lastNames[Math.floor(rng() * lastNames.length)] ?? "Generic";
    const name = `${firstName} ${lastName}`;
    const nationality = nationalities[Math.floor(rng() * nationalities.length)] ?? "ENG";

    // Age distribution:
    // - Starters (i < squad role) have higher base ages and can reach retirement threshold
    // - Bench/reserves (i >= squad role) are younger
    // GK: starter 34-36, backup 25-28
    // CB: starter1 32-35, starter2 30-33, reserves 24-27
    // RB/LB: starter 30-33, backup 24-27
    // CDM/CM: starter 30-33, backup 24-27
    // CAM/LW/RW: starter 27-30, backup 22-25
    // ST: starter 32-35, backup 24-27

    let baseAge = 25;
    const maxVariance = 6; // ±3 years

    if (pos === "GK") {
      if (i === 0)
        baseAge = 35; // Lead GK near retirement threshold
      else baseAge = 25;
    } else if (pos === "CB") {
      if (i === 0) baseAge = 33;
      else if (i === 1) baseAge = 31;
      else baseAge = 24;
    } else if (pos === "RB" || pos === "LB") {
      if (i === 0) baseAge = 31;
      else baseAge = 24;
    } else if (pos === "CDM" || pos === "CM") {
      if (i === 0) baseAge = 31;
      else baseAge = 24;
    } else if (pos === "CAM" || pos === "LW" || pos === "RW") {
      if (i === 0) baseAge = 28;
      else baseAge = 22;
    } else if (pos === "ST") {
      if (i === 0) baseAge = 33;
      else baseAge = 24;
    }

    const ageVariance = Math.floor((rng() - 0.5) * maxVariance * 2);
    const age = Math.max(18, Math.min(39, baseAge + ageVariance));

    // Rating: base around 65-72, varies by club tier and position importance
    const positionBase = pos === "GK" ? 67 : pos === "ST" ? 68 : 66;
    const rating = Math.max(
      55,
      Math.min(82, positionBase + divisionTierBoost + Math.floor((rng() - 0.5) * 10)),
    );
    const potential = Math.min(
      99,
      rating + Math.floor((rng() - 0.5) * 8) + (age < 25 ? 8 : age > 32 ? -10 : 0),
    );

    const player: Player = {
      id: `${clubId}-player-${i + 1}`,
      name,
      shortName: lastName,
      number: i + 1,
      pos: pos as any,
      role: pos,
      nationality,
      age,
      overall: rating,
      potential,
      fitness: Math.max(50, Math.min(100, 75 + Math.floor((rng() - 0.5) * 20))),
      morale: Math.max(40, Math.min(100, 70 + Math.floor((rng() - 0.5) * 15))),
      form: Math.max(40, Math.min(100, 68 + Math.floor((rng() - 0.5) * 15))),
      formTrend: ["up", "flat", "down"][Math.floor(rng() * 3)] as any,
      attrs: {
        pace: Math.max(30, Math.min(99, rating + Math.floor((rng() - 0.5) * 15))),
        shooting: Math.max(30, Math.min(99, rating + Math.floor((rng() - 0.5) * 15))),
        passing: Math.max(30, Math.min(99, rating + Math.floor((rng() - 0.5) * 15))),
        dribbling: Math.max(30, Math.min(99, rating + Math.floor((rng() - 0.5) * 15))),
        defending: Math.max(30, Math.min(99, rating + Math.floor((rng() - 0.5) * 15))),
        physical: Math.max(30, Math.min(99, rating + Math.floor((rng() - 0.5) * 15))),
      },
      professionalism: Math.max(40, Math.min(100, 60 + Math.floor((rng() - 0.5) * 20))),
      personality: ["Determined", "Calm", "Focused", "Creative", "Quick", "Steady"][
        Math.floor(rng() * 6)
      ] as any,
      value: `€${Math.max(0.5, (rating / 80) * 12).toFixed(1)}M`,
      salary: `€${Math.max(5, (rating / 80) * 40).toFixed(0)}k`,
      contractUntil: `Jun ${2027 + Math.floor(rng() * 3)}`,
      contractYears: Math.floor(rng() * 3) + 1,
      trainingFocus: ["Finishing", "Passing", "Dribbling", "Defending", "Composure", "Pressing"][
        Math.floor(rng() * 6)
      ] as any,
      trainingProgress: Math.floor(rng() * 50) + 25,
      starter: i < 11, // First 11 are starters
      clubId,
      consistency: Math.max(40, Math.min(100, 60 + Math.floor((rng() - 0.5) * 20))),
      injuryProneness: Math.max(5, Math.min(95, 30 + Math.floor((rng() - 0.5) * 30))),
      fatigue: Math.floor(rng() * 40) + 20,
      injury: null,
      marketValue: Math.round((rating / 80) * 12_000_000),
      development: {
        trainingEfficiency: Math.max(40, Math.min(100, 65 + Math.floor((rng() - 0.5) * 20))),
        growthRate: Math.max(0, Math.min(99, Math.max(0, potential - rating) * 8)),
      },
      playingTime:
        i < 11
          ? {
              appearancesThisSeason: Math.floor(rng() * 5) + 8,
              startsThisSeason: Math.floor(rng() * 5) + 8,
              minutesThisSeason: Math.floor(rng() * 300) + 600,
            }
          : {
              appearancesThisSeason: Math.floor(rng() * 5) + 2,
              startsThisSeason: 0,
              minutesThisSeason: Math.floor(rng() * 150) + 100,
            },
      relationships: [],
      tacticalFamiliarity: {
        "4-4-2": 60 + Math.floor(rng() * 20),
        "4-3-3": 50 + Math.floor(rng() * 20),
      },
      reputation: Math.max(30, Math.min(80, 50 + Math.floor((rng() - 0.5) * 20))),
      lastMatchRating: 5.0 + rng() * 2.5,
      matchRatingHistory: [],
      dateOfBirth: generateDOBFromAge(age, CURRENT_DATE),
    };

    players.push(player);
  }

  return players;
}

const academyProspectIds = seedPlayers
  .filter((p) => p.age <= 23)
  .sort((a, b) => b.potential - b.overall - (a.potential - a.overall))
  .map((p) => p.id);

const injuredCount = seedPlayers.filter((p) => p.status === "injured").length;

const homeClub: Club = {
  id: HOME_CLUB_ID,
  name: "Northfield United",
  shortName: "Northfield",
  abbr: "NFU",
  ground: "Northfield Park",
  primaryColor: "#19C37D",
  secondaryColor: "#0E7A4E",
  textColor: "#04140C",
  formation: FORMATION,
  leagueId: LEAGUE_ID,
  reputation: 64,
  facilities: { training: 72, medical: 68, youth: 61, stadium: 75 },
  facilityLevels: { training: 4, youth: 3, medical: 3, scouting: 3 },
  trainingGround: createTrainingGroundDefaults(),
  academy: { rating: 58, prospectIds: academyProspectIds },
  medical: { rating: 68, playersInTreatment: injuredCount },
  scouting: { rating: 63, regionsCovered: ["Domestic", "Western Europe", "South America"] },
  playerIds: seedPlayers.map((p) => p.id),
  identity: {
    archetype: "youth",
    academyFocus: 75,
    boardPatience: 70,
    transferBudgetFactor: 0.75,
    expectations: "normal",
    preferExperienced: 20,
  },
};

const awayClubFacilities = { training: 55, medical: 55, youth: 48, stadium: 60 };
const awayClubReputation = 55;

const westportAiPlayer: Player = {
  id: "ai-westport-1",
  name: "Jasper Connolly",
  shortName: "Connolly",
  number: 19,
  pos: "CM",
  role: "Central Midfielder",
  nationality: "ENG",
  age: 26,
  overall: 75,
  potential: 81,
  fitness: 77,
  morale: 72,
  form: 73,
  formTrend: "up",
  attrs: { pace: 68, shooting: 58, passing: 78, dribbling: 69, defending: 71, physical: 74 },
  professionalism: 72,
  personality: "Driven",
  value: "€7.0M",
  salary: "€24,000",
  contractUntil: "Jun 2028",
  contractYears: 1,
  trainingFocus: "Passing",
  trainingProgress: 41,
  starter: true,
  clubId: AWAY_CLUB_ID,
  consistency: 74,
  injuryProneness: 31,
  fatigue: 31,
  injury: null,
  marketValue: 7_000_000,
  development: { trainingEfficiency: 73, growthRate: 64 },
  playingTime: { appearancesThisSeason: 8, startsThisSeason: 7, minutesThisSeason: 600 },
  relationships: [],
  tacticalFamiliarity: { "4-3-3": 67 },
  reputation: 51,
  lastMatchRating: 6.9,
  matchRatingHistory: [6.7, 6.9, 7.0, 6.8],
};

const awayClub: Club = {
  id: AWAY_CLUB_ID,
  name: "Westport United",
  shortName: "Westport",
  abbr: "WPU",
  ground: "Westport United Ground",
  primaryColor: "#E8EDF5",
  secondaryColor: "#9AA7B8",
  textColor: "#101A28",
  formation: OPPONENT_FORMATION,
  leagueId: LEAGUE_ID,
  reputation: awayClubReputation,
  facilities: awayClubFacilities,
  facilityLevels: { training: 2, youth: 2, medical: 2, scouting: 2 },
  academy: { rating: 48, prospectIds: [] },
  medical: { rating: 55, playersInTreatment: 0 },
  scouting: { rating: 50, regionsCovered: ["Domestic"] },
  playerIds: [westportAiPlayer.id],
  simRoster: { xi: opponentXI, bench: opponentBench },
  // Phase D1: Westport is a rival club, not the player's — it gets an AI
  // manager too. Northfield (the player's club) deliberately does not.
  aiManager: generateAIManager({
    id: AWAY_CLUB_ID,
    name: "Westport United",
    formation: OPPONENT_FORMATION,
    reputation: awayClubReputation,
    facilities: awayClubFacilities,
  }),
  identity: {
    archetype: "traditional",
    academyFocus: 40,
    boardPatience: 30,
    transferBudgetFactor: 0.9,
    expectations: "high",
    preferExperienced: 70,
  },
};

const clubs: Record<string, Club> = { [homeClub.id]: homeClub, [awayClub.id]: awayClub };
// Augment clubs with generated clubs for each division in the sample world
(() => {
  // Number of countries to populate with actual clubs (all 16 for realistic ecosystem)
  const POPULATE_COUNTRIES = 16;
  const world = GLOBAL_SAMPLE_WORLD;
  const countriesToPopulate = (world.countries ?? []).slice(0, POPULATE_COUNTRIES);
  for (const country of countriesToPopulate) {
    for (const div of country.divisions ?? []) {
      // skip divisions already populated by the bespoke seed
      if (Object.values(clubs).some((c) => c.leagueId === div.id)) continue;
      // Realistic team counts: 20 in Premier, 22 in lower divisions
      const count = div.level === 1 ? 20 : 22;
      for (let i = 1; i <= count; i++) {
        const id = `${div.id}-club-${i}`;
        const name = `${div.name} Club ${i}`;
        clubs[id] = makeMinimalClub(id, name, div.id);
      }
    }
  }
})();
for (const [id, name] of Object.entries(RIVAL_CLUB_NAMES)) {
  // give a few rivals distinctive archetypes
  const c = makeMinimalClub(id, name, LEAGUE_ID);
  if (id === "ashcombe-city")
    c.identity = {
      archetype: "ambitious",
      academyFocus: 45,
      boardPatience: 20,
      transferBudgetFactor: 1.5,
      expectations: "high",
      preferExperienced: 10,
    };
  if (id === "ravenport")
    c.identity = {
      archetype: "youth",
      academyFocus: 80,
      boardPatience: 60,
      transferBudgetFactor: 0.6,
      expectations: "normal",
      preferExperienced: 15,
    };
  if (id === "harlow-rovers")
    c.identity = {
      archetype: "traditional",
      academyFocus: 35,
      boardPatience: 40,
      transferBudgetFactor: 0.9,
      expectations: "high",
      preferExperienced: 75,
    };
  clubs[id] = c;
}

const players: GameState["players"] = Object.fromEntries(
  seedPlayers.map((p): [string, Player] => [
    p.id,
    { ...derivePlayerState(p, FORMATION), clubId: HOME_CLUB_ID },
  ]),
);

const aiClubRoster: Record<string, Player[]> = {
  ravenport: [
    {
      id: "ai-ravenport-1",
      name: "Nolan Price",
      shortName: "Price",
      number: 9,
      pos: "ST",
      role: "Striker",
      nationality: "WAL",
      age: 24,
      overall: 74,
      potential: 81,
      fitness: 78,
      morale: 70,
      form: 72,
      formTrend: "up",
      attrs: { pace: 76, shooting: 75, passing: 58, dribbling: 70, defending: 32, physical: 71 },
      professionalism: 70,
      personality: "Determined",
      value: "€6.2M",
      salary: "€19,000",
      contractUntil: "Jun 2028",
      contractYears: 1,
      trainingFocus: "Finishing",
      trainingProgress: 38,
      starter: true,
      clubId: "ravenport",
      consistency: 71,
      injuryProneness: 31,
      fatigue: 30,
      injury: null,
      marketValue: 6_200_000,
      development: { trainingEfficiency: 70, growthRate: 63 },
      playingTime: { appearancesThisSeason: 6, startsThisSeason: 6, minutesThisSeason: 540 },
      relationships: [],
      tacticalFamiliarity: { "4-3-3": 64 },
      reputation: 48,
      lastMatchRating: 6.7,
      matchRatingHistory: [6.4, 6.9, 6.7, 6.8],
    },
  ],
  "harlow-rovers": [
    {
      id: "ai-harlow-1",
      name: "Mateo Iversen",
      shortName: "Iversen",
      number: 10,
      pos: "CAM",
      role: "Attacking Midfielder",
      nationality: "NOR",
      age: 26,
      overall: 75,
      potential: 79,
      fitness: 75,
      morale: 71,
      form: 71,
      formTrend: "flat",
      attrs: { pace: 72, shooting: 73, passing: 78, dribbling: 74, defending: 42, physical: 65 },
      professionalism: 72,
      personality: "Creative",
      value: "€7.1M",
      salary: "€22,000",
      contractUntil: "Jun 2029",
      contractYears: 2,
      trainingFocus: "Composure",
      trainingProgress: 36,
      starter: true,
      clubId: "harlow-rovers",
      consistency: 72,
      injuryProneness: 33,
      fatigue: 29,
      injury: null,
      marketValue: 7_100_000,
      development: { trainingEfficiency: 72, growthRate: 61 },
      playingTime: { appearancesThisSeason: 7, startsThisSeason: 6, minutesThisSeason: 570 },
      relationships: [],
      tacticalFamiliarity: { "4-3-3": 67 },
      reputation: 50,
      lastMatchRating: 6.8,
      matchRatingHistory: [6.6, 6.8, 7.0, 6.7],
    },
  ],
  kingsmere: [
    {
      id: "ai-kingsmere-1",
      name: "Alec Hume",
      shortName: "Hume",
      number: 14,
      pos: "CB",
      role: "Central Defender",
      nationality: "SCO",
      age: 27,
      overall: 73,
      potential: 77,
      fitness: 74,
      morale: 69,
      form: 68,
      formTrend: "flat",
      attrs: { pace: 68, shooting: 36, passing: 62, dribbling: 53, defending: 80, physical: 79 },
      professionalism: 70,
      personality: "Calm",
      value: "€5.8M",
      salary: "€18,000",
      contractUntil: "Jun 2027",
      contractYears: 1,
      trainingFocus: "Defending",
      trainingProgress: 35,
      starter: true,
      clubId: "kingsmere",
      consistency: 69,
      injuryProneness: 28,
      fatigue: 32,
      injury: null,
      marketValue: 5_800_000,
      development: { trainingEfficiency: 69, growthRate: 58 },
      playingTime: { appearancesThisSeason: 5, startsThisSeason: 5, minutesThisSeason: 450 },
      relationships: [],
      tacticalFamiliarity: { "4-3-3": 62 },
      reputation: 46,
      lastMatchRating: 6.3,
      matchRatingHistory: [6.2, 6.1, 6.4, 6.5],
    },
  ],
  "riverside-fc": [
    {
      id: "ai-riverside-1",
      name: "Luca Sato",
      shortName: "Sato",
      number: 11,
      pos: "LW",
      role: "Winger",
      nationality: "JPN",
      age: 22,
      overall: 74,
      potential: 84,
      fitness: 80,
      morale: 73,
      form: 74,
      formTrend: "up",
      attrs: { pace: 82, shooting: 69, passing: 72, dribbling: 78, defending: 39, physical: 62 },
      professionalism: 73,
      personality: "Quick",
      value: "€6.5M",
      salary: "€20,000",
      contractUntil: "Jun 2029",
      contractYears: 2,
      trainingFocus: "Dribbling",
      trainingProgress: 37,
      starter: true,
      clubId: "riverside-fc",
      consistency: 73,
      injuryProneness: 30,
      fatigue: 27,
      injury: null,
      marketValue: 6_500_000,
      development: { trainingEfficiency: 74, growthRate: 68 },
      playingTime: { appearancesThisSeason: 7, startsThisSeason: 5, minutesThisSeason: 520 },
      relationships: [],
      tacticalFamiliarity: { "4-3-3": 65 },
      reputation: 49,
      lastMatchRating: 6.9,
      matchRatingHistory: [6.8, 6.9, 7.1, 6.8],
    },
  ],
  "coastal-town": [
    {
      id: "ai-coastal-1",
      name: "Ruben Hale",
      shortName: "Hale",
      number: 6,
      pos: "CDM",
      role: "Defensive Midfielder",
      nationality: "ENG",
      age: 28,
      overall: 72,
      potential: 75,
      fitness: 72,
      morale: 69,
      form: 66,
      formTrend: "flat",
      attrs: { pace: 60, shooting: 52, passing: 70, dribbling: 62, defending: 79, physical: 79 },
      professionalism: 69,
      personality: "Steady",
      value: "€5.6M",
      salary: "€17,000",
      contractUntil: "Jun 2027",
      contractYears: 1,
      trainingFocus: "Pressing",
      trainingProgress: 34,
      starter: true,
      clubId: "coastal-town",
      consistency: 68,
      injuryProneness: 27,
      fatigue: 35,
      injury: null,
      marketValue: 5_600_000,
      development: { trainingEfficiency: 68, growthRate: 56 },
      playingTime: { appearancesThisSeason: 5, startsThisSeason: 5, minutesThisSeason: 420 },
      relationships: [],
      tacticalFamiliarity: { "4-3-3": 60 },
      reputation: 45,
      lastMatchRating: 6.2,
      matchRatingHistory: [6.0, 6.3, 6.2, 6.4],
    },
  ],
  "oldbridge-athletic": [
    {
      id: "ai-oldbridge-1",
      name: "Kian Fletcher",
      shortName: "Fletcher",
      number: 8,
      pos: "CM",
      role: "Central Midfielder",
      nationality: "ENG",
      age: 24,
      overall: 73,
      potential: 78,
      fitness: 77,
      morale: 70,
      form: 69,
      formTrend: "flat",
      attrs: { pace: 68, shooting: 61, passing: 74, dribbling: 66, defending: 68, physical: 72 },
      professionalism: 70,
      personality: "Focused",
      value: "€6.0M",
      salary: "€19,000",
      contractUntil: "Jun 2028",
      contractYears: 1,
      trainingFocus: "Passing",
      trainingProgress: 35,
      starter: true,
      clubId: "oldbridge-athletic",
      consistency: 70,
      injuryProneness: 29,
      fatigue: 31,
      injury: null,
      marketValue: 6_000_000,
      development: { trainingEfficiency: 70, growthRate: 60 },
      playingTime: { appearancesThisSeason: 6, startsThisSeason: 5, minutesThisSeason: 480 },
      relationships: [],
      tacticalFamiliarity: { "4-3-3": 63 },
      reputation: 47,
      lastMatchRating: 6.6,
      matchRatingHistory: [6.4, 6.7, 6.5, 6.6],
    },
  ],
};

players[westportAiPlayer.id] = westportAiPlayer;
for (const [clubId, members] of Object.entries(aiClubRoster)) {
  const club = clubs[clubId];
  if (!club) continue;
  const playerIds = members.map((member) => member.id);
  club.playerIds = [...new Set([...club.playerIds, ...playerIds])];
  for (const player of members) {
    players[player.id] = player;
  }
}

// Populate remaining clubs with AI-generated squads (Approach 1: init-time population)
for (const club of Object.values(clubs)) {
  // Skip clubs that already have players (home, away, manual rosters)
  if (club.playerIds.length > 0) continue;

  // Generate full squad for this club
  const generatedSquad = generateClubSquad(club.id, club.name, club.leagueId, players);

  // Add players to global players registry
  for (const player of generatedSquad) {
    players[player.id] = player;
  }

  // Link club to its players
  club.playerIds = generatedSquad.map((p) => p.id);
}

// ---- contracts (lifecycle status derived from each player's current terms) ----

const contracts: Contract[] = seedPlayers.map((p) => ({
  playerId: p.id,
  clubId: HOME_CLUB_ID,
  status: p.contractYears <= 0 ? "expiring" : "active",
}));

// ---- league (Phase B2: no stored `table` — see `./standings.ts`) --------------

const league: League = {
  id: LEAGUE_ID,
  name: "National League",
  competitionId: LEAGUE_COMPETITION_ID,
  season: SEASON,
  matchday: MATCHDAY,
};

// ---- fixtures (Phase B2) -------------------------------------------------------
// Two sources, merged below:
//  1. `MANAGED_CLUB_FIXTURES` — the manager's own last three results plus the
//     upcoming Westport match, hand-authored (as before) so the specific
//     opponents/scores/dates stay narratively meaningful. `fx-14` in
//     particular is load-bearing: `routes/match.tsx` writes its simulation
//     result back with a hardcoded `fixtureId: "fx-14"`, so this id, its
//     matchup (home club vs `AWAY_CLUB_ID`) and its unplayed status must not
//     change here.
//  2. `generateRoundRobinFixtures()` — a full triple round-robin among every
//     club in the nine-team demo league. Each club therefore plays the other
//     eight clubs three times: 24 league matches per club. Deterministic
//     (seeded RNG, no `Math.random`) so the seed is reproducible and
//     hydration-safe, same rule as `derivePlayerState` above.
// Nothing here computes points/goal difference/position — that's entirely
// `computeStandings`'s job, driven by these fixtures.

const LEAGUE_CLUB_IDS: string[] = [HOME_CLUB_ID, AWAY_CLUB_ID, ...Object.keys(RIVAL_CLUB_NAMES)];

/** Helper to calculate calendar date for a fixture based on matchday */
function calculateFixtureDate(matchday: number): string {
  const preseasonDays = 14; // Two weeks before first match
  const calendarDate = addDaysISO(SEASON_START_DATE, preseasonDays + (matchday - 1) * 7);
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

const MANAGED_CLUB_FIXTURES: Fixture[] = [
  {
    id: "fx-11",
    competitionId: LEAGUE_COMPETITION_ID,
    season: SEASON,
    homeClubId: HOME_CLUB_ID,
    awayClubId: "riverside-fc",
    calendarDate: calculateFixtureDate(11),
    date: formatDisplayDate(calculateFixtureDate(11)),
    matchday: 11,
    venue: "H",
    status: "played",
    result: "W",
    scoreHome: 2,
    scoreAway: 1,
  },
  {
    id: "fx-12",
    competitionId: LEAGUE_COMPETITION_ID,
    season: SEASON,
    homeClubId: "coastal-town",
    awayClubId: HOME_CLUB_ID,
    calendarDate: calculateFixtureDate(12),
    date: formatDisplayDate(calculateFixtureDate(12)),
    matchday: 12,
    venue: "A",
    status: "played",
    result: "D",
    scoreHome: 1,
    scoreAway: 1,
  },
  {
    id: "fx-13",
    competitionId: LEAGUE_COMPETITION_ID,
    season: SEASON,
    homeClubId: HOME_CLUB_ID,
    awayClubId: "oldbridge-athletic",
    calendarDate: calculateFixtureDate(13),
    date: formatDisplayDate(calculateFixtureDate(13)),
    matchday: 13,
    venue: "H",
    status: "played",
    result: "L",
    scoreHome: 0,
    scoreAway: 2,
  },
  {
    id: "fx-14",
    competitionId: LEAGUE_COMPETITION_ID,
    season: SEASON,
    homeClubId: HOME_CLUB_ID,
    awayClubId: AWAY_CLUB_ID,
    calendarDate: calculateFixtureDate(14),
    date: formatDisplayDate(calculateFixtureDate(14)),
    matchday: 14,
    venue: "H",
    status: "scheduled",
    result: null,
  },
];

/** Small, fast, seedable PRNG (mulberry32) — same algorithm as
 * `lib/match-engine.ts`'s `createRng`, duplicated locally rather than
 * imported so this module (state/rules) doesn't reach into the simulation
 * layer just for a number generator. Deterministic per seed. */
function createSeedRng(seed: number) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

const BYE = "__bye__";

/** Standard "circle method" round-robin scheduler: fixes the first club in
 * place and rotates the rest, producing `n-1` rounds (`n` = club count,
 * padded with one `BYE` slot for an odd club count) in which every club
 * meets every other club exactly once. Home/away is assigned afterward so
 * odd-sized leagues receive an exact home/away split over one cycle. */
function roundRobinRounds(clubIds: string[]): Array<Array<[string, string]>> {
  const slots = clubIds.length % 2 === 0 ? [...clubIds] : [...clubIds, BYE];
  const n = slots.length;
  let arr = [...slots];
  const pairings: Array<Array<[string, string]>> = [];

  for (let round = 0; round < n - 1; round++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b && a !== BYE && b !== BYE) {
        pairs.push([a, b]);
      }
    }
    pairings.push(pairs);
    // Rotate everyone except the fixed slot 0: last element moves to slot 1.
    const first = arr[0];
    const last = arr[n - 1];
    if (first !== undefined && last !== undefined) {
      arr = [first, last, ...arr.slice(1, n - 1)];
    }
  }

  const targetHomeMatches = Math.floor((clubIds.length - 1) / 2);
  const homeCounts = new Map(clubIds.map((clubId) => [clubId, 0]));
  const oriented: Array<Array<[string, string]>> = [];

  function orientRound(roundIndex: number): boolean {
    if (roundIndex === pairings.length) {
      return clubIds.every((clubId) => {
        const home = homeCounts.get(clubId) ?? 0;
        const away = clubIds.length - 1 - home;
        return Math.abs(home - away) <= 1;
      });
    }

    const round = pairings[roundIndex] ?? [];
    const choices: Array<[string, string]> = [];

    function orientPair(pairIndex: number): boolean {
      if (pairIndex === round.length) {
        oriented.push(choices.slice());
        if (orientRound(roundIndex + 1)) return true;
        oriented.pop();
        return false;
      }

      const [first, second] = round[pairIndex] ?? [];
      if (!first || !second) return orientPair(pairIndex + 1);

      for (const [home, away] of [
        [first, second],
        [second, first],
      ] as Array<[string, string]>) {
        const nextHomeCount = (homeCounts.get(home) ?? 0) + 1;
        if (nextHomeCount > targetHomeMatches + 1) continue;
        homeCounts.set(home, nextHomeCount);
        choices.push([home, away]);
        if (orientPair(pairIndex + 1)) return true;
        choices.pop();
        homeCounts.set(home, nextHomeCount - 1);
      }
      return false;
    }

    return orientPair(0);
  }

  if (orientRound(0)) return oriented;
  return pairings;
}

/** Deterministic triple round-robin among the whole demo league. The four
 * hand-authored manager fixtures replace one generated meeting each, so their
 * stable ids, scores, and dates remain load-bearing without creating duplicate
 * fixtures or changing the 24-match-per-club contract. Matchdays 11-14 are
 * reserved for those hand-authored fixtures. */
function generateRoundRobinFixtures(): Fixture[] {
  const rng = createSeedRng(0x5eed_0001);
  const rounds = roundRobinRounds(LEAGUE_CLUB_IDS);
  const generated: Fixture[] = [];
  const managedPairKeys = new Set(
    MANAGED_CLUB_FIXTURES.map((fixture) =>
      [fixture.homeClubId, fixture.awayClubId].sort().join("|"),
    ),
  );
  const replacedManagedPairs = new Set<string>();

  for (let cycle = 0; cycle < 3; cycle += 1) {
    rounds.forEach((pairs, roundIndex) => {
      const rawMatchday = cycle * rounds.length + roundIndex + 1;
      // Keep the authored matchdays 11-14 free of generated fixtures so the
      // manager cannot be scheduled for two matches on one calendar date.
      const matchday = rawMatchday >= 11 ? rawMatchday + 4 : rawMatchday;
      const calendarDate = calculateFixtureDate(matchday);
      const displayDate = formatDisplayDate(calendarDate);
      pairs.forEach(([homeClubId, awayClubId], pairIndex) => {
        const pairKey = [homeClubId, awayClubId].sort().join("|");
        if (managedPairKeys.has(pairKey) && !replacedManagedPairs.has(pairKey)) {
          replacedManagedPairs.add(pairKey);
          return;
        }

        // Home sides score a little more often than away sides, on average —
        // enough to keep the generated table from looking perfectly uniform,
        // without any single result being lopsided.
        const scoreHome = randInt(rng, 0, 3);
        const scoreAway = randInt(rng, 0, 3);
        const involvesManagedClub = homeClubId === HOME_CLUB_ID || awayClubId === HOME_CLUB_ID;
        const isPlayed = calendarDate <= CURRENT_DATE;
        generated.push({
          id: `fx-md${matchday}-${pairIndex + 1}`,
          competitionId: LEAGUE_COMPETITION_ID,
          season: SEASON,
          homeClubId,
          awayClubId,
          calendarDate,
          date: displayDate,
          matchday,
          // Only meaningful for the managed club's own fixtures (see the
          // `Fixture.venue` doc comment); "H" is an unused placeholder for a
          // match neither side of which is the managed club.
          venue: awayClubId === HOME_CLUB_ID ? "A" : "H",
          status: isPlayed ? "played" : "scheduled",
          result:
            isPlayed && involvesManagedClub
              ? resultForManagedClub(homeClubId, awayClubId, scoreHome, scoreAway)
              : null,
          ...(isPlayed ? { scoreHome, scoreAway } : {}),
        });
      });
    });
  }

  return generated;
}

/** `Fixture.result` is defined from the managed club's perspective (see
 * its doc comment) — mirrors `resultFor` in `./reducer.ts`, kept as a
 * separate small copy here rather than imported so the seed module stays
 * decoupled from the reducer. */
function resultForManagedClub(
  homeClubId: string,
  awayClubId: string,
  scoreHome: number,
  scoreAway: number,
): FixtureResult {
  const managedIsHome = homeClubId === HOME_CLUB_ID;
  const scoreFor = managedIsHome ? scoreHome : scoreAway;
  const scoreAgainst = managedIsHome ? scoreAway : scoreHome;
  if (scoreFor > scoreAgainst) return "W";
  if (scoreFor < scoreAgainst) return "L";
  return "D";
}

const fixtures: Fixture[] = [...generateRoundRobinFixtures(), ...MANAGED_CLUB_FIXTURES];

// ---- game calendar ------------------------------------------------------------

const initialDaysSinceStart = daysBetweenISO(SEASON_START_DATE, CURRENT_DATE); // 0-based

const initialTime: GameCalendarState = {
  date: CURRENT_DATE,
  season: SEASON,
  day: initialDaysSinceStart + 1,
  week: Math.floor(initialDaysSinceStart / 7) + 1,
  seasonStartDate: SEASON_START_DATE,
};

export function buildInitialState(seedOverride?: string): GameState {
  const SAMPLE_WORLD = GLOBAL_SAMPLE_WORLD;

  const gameState: GameState = {
    manager: {
      id: "manager-1",
      name: "Danny Voss",
      nationality: "ENG",
      reputation: 62,
      clubId: HOME_CLUB_ID,
      trophies: 0,
      experience: 4,
      tactics: 68,
      training: 64,
      motivation: 71,
      scouting: 58,
      negotiation: 60,
      manManagement: 66,
      playerDevelopment: 62,
      credit: 70,
      philosophy: "Possession-based, high press, develop from within",
      boardConfidence: 68,
      fanConfidence: 74,
      squadConfidence: 71,
      contract: { clubId: HOME_CLUB_ID, salary: "€38,000 / wk", until: "Jun 2028" },
    },
    time: initialTime,
    currentClub: homeClub,
    clubs,
    players,
    staff: [
      {
        id: "staff-asst",
        name: "Rhys Callahan",
        role: "Assistant Manager",
        nationality: "IRL",
        rating: 74,
        clubId: HOME_CLUB_ID,
      },
      {
        id: "staff-physio",
        name: "Marta Novaković",
        role: "Head Physio",
        nationality: "CRO",
        rating: 81,
        clubId: HOME_CLUB_ID,
      },
      {
        id: "staff-scout",
        name: "Owen Baptiste",
        role: "Chief Scout",
        nationality: "ENG",
        rating: 69,
        clubId: HOME_CLUB_ID,
      },
    ],
    // Build leagues/competitions/clubs from the generated sample world so
    // multi-country flows work without hard-coded country logic.
    leagues: (() => {
      const map: Record<string, League> = { [league.id]: league };
      const world = SAMPLE_WORLD;
      for (const country of world.countries ?? []) {
        for (const div of country.divisions ?? []) {
          if (!map[div.id]) {
            map[div.id] = {
              id: div.id,
              name: div.name,
              competitionId: div.id,
              season: SEASON,
              matchday: MATCHDAY,
            } as League;
          }
        }
      }
      return map;
    })(),
    competitions: (() => {
      const comps = [] as any[];
      for (const c of SAMPLE_WORLD.competitions ?? []) {
        comps.push({ ...c, stage: "Matchday 1", status: "active" });
      }
      // Ensure legacy local competitions still present
      if (!comps.find((x) => x.id === LEAGUE_COMPETITION_ID)) {
        comps.push({
          id: LEAGUE_COMPETITION_ID,
          name: "National League",
          stage: "Matchday 14",
          status: "active",
        });
      }
      if (!comps.find((x) => x.id === CUP_COMPETITION_ID)) {
        comps.push({
          id: CUP_COMPETITION_ID,
          name: "National Cup",
          stage: "Round of 16",
          status: "active",
        });
      }
      return comps;
    })(),
    fixtures,
    matches: [],
    transfers: [
      // Goalkeepers
      {
        id: "target-gk-01",
        name: "Viktor Orsic",
        position: "GK",
        rating: 82,
        nationality: "HRV",
        age: 28,
        value: "€18.5M",
        status: "new",
      },
      {
        id: "target-gk-02",
        name: "Gabriel Slonina",
        position: "GK",
        rating: 76,
        nationality: "USA",
        age: 21,
        value: "€12.0M",
        status: "new",
      },
      {
        id: "target-gk-03",
        name: "Ivo Grbic",
        position: "GK",
        rating: 80,
        nationality: "MNE",
        age: 24,
        value: "€15.5M",
        status: "new",
      },
      // Defenders - Center Backs
      {
        id: "target-cb-01",
        name: "Luka Gojsalvic",
        position: "CB",
        rating: 81,
        nationality: "HRV",
        age: 27,
        value: "€22.0M",
        status: "new",
      },
      {
        id: "target-cb-02",
        name: "Juan David Ramirez",
        position: "CB",
        rating: 78,
        nationality: "COL",
        age: 26,
        value: "€16.5M",
        status: "new",
      },
      {
        id: "target-cb-03",
        name: "Abdul Mumin",
        position: "CB",
        rating: 77,
        nationality: "GHA",
        age: 25,
        value: "€14.0M",
        status: "new",
      },
      {
        id: "target-cb-04",
        name: "Amos Pieper",
        position: "CB",
        rating: 75,
        nationality: "DEU",
        age: 23,
        value: "€11.5M",
        status: "new",
      },
      // Defenders - Full Backs
      {
        id: "target-lb-01",
        name: "Javi Galan",
        position: "LB",
        rating: 80,
        nationality: "ESP",
        age: 28,
        value: "€19.5M",
        status: "new",
      },
      {
        id: "target-rb-01",
        name: "Sergey Salyukov",
        position: "RB",
        rating: 76,
        nationality: "RUS",
        age: 24,
        value: "€13.0M",
        status: "new",
      },
      {
        id: "target-lb-02",
        name: "Theo Hernández",
        position: "LB",
        rating: 84,
        nationality: "FRA",
        age: 27,
        value: "€32.0M",
        status: "interested",
      },
      {
        id: "target-rb-02",
        name: "Tariq Lamptey",
        position: "RB",
        rating: 77,
        nationality: "GHA",
        age: 23,
        value: "€15.5M",
        status: "new",
      },
      // Midfielders - Central
      {
        id: "target-cm-01",
        name: "Miloš Petrović",
        position: "CM",
        rating: 79,
        nationality: "SRB",
        age: 26,
        value: "€14.0M",
        status: "new",
      },
      {
        id: "target-cm-02",
        name: "Konrad Laimer",
        position: "CM",
        rating: 81,
        nationality: "AUT",
        age: 26,
        value: "€25.0M",
        status: "new",
      },
      {
        id: "target-cm-03",
        name: "Madi Noujain",
        position: "CM",
        rating: 74,
        nationality: "CMR",
        age: 24,
        value: "€10.5M",
        status: "new",
      },
      {
        id: "target-cm-04",
        name: "Moussa Dembélé",
        position: "CM",
        rating: 76,
        nationality: "BEL",
        age: 29,
        value: "€12.0M",
        status: "new",
      },
      {
        id: "target-cm-05",
        name: "Mehmet Akturkoglu",
        position: "CM",
        rating: 78,
        nationality: "TUR",
        age: 25,
        value: "€17.5M",
        status: "new",
      },
      // Midfielders - Attacking
      {
        id: "target-am-01",
        name: "Ferdi Kadioglu",
        position: "AM",
        rating: 79,
        nationality: "TUR",
        age: 24,
        value: "€18.0M",
        status: "new",
      },
      {
        id: "target-am-02",
        name: "Isco",
        position: "AM",
        rating: 77,
        nationality: "ESP",
        age: 31,
        value: "€6.5M",
        status: "new",
      },
      {
        id: "target-am-03",
        name: "Joe Willock",
        position: "AM",
        rating: 75,
        nationality: "ENG",
        age: 24,
        value: "€14.0M",
        status: "new",
      },
      // Wingers
      {
        id: "target-lw-01",
        name: "Henrik Dahl",
        position: "LW",
        rating: 74,
        nationality: "SWE",
        age: 22,
        value: "€9.5M",
        status: "new",
      },
      {
        id: "target-rw-01",
        name: "Ansu Fati",
        position: "RW",
        rating: 83,
        nationality: "ESP",
        age: 21,
        value: "€28.5M",
        status: "interested",
      },
      {
        id: "target-lw-02",
        name: "David Neres",
        position: "LW",
        rating: 80,
        nationality: "BRA",
        age: 26,
        value: "€21.0M",
        status: "new",
      },
      {
        id: "target-rw-02",
        name: "Serge Gnabry",
        position: "RW",
        rating: 81,
        nationality: "DEU",
        age: 28,
        value: "€24.0M",
        status: "bid",
      },
      {
        id: "target-lw-03",
        name: "Callum Hudson-Odoi",
        position: "LW",
        rating: 76,
        nationality: "ENG",
        age: 23,
        value: "€13.5M",
        status: "new",
      },
      {
        id: "target-rw-03",
        name: "Luis Enrique",
        position: "RW",
        rating: 72,
        nationality: "ARG",
        age: 20,
        value: "€5.5M",
        status: "new",
      },
      // Strikers
      {
        id: "target-st-01",
        name: "Goncalo Ramos",
        position: "ST",
        rating: 82,
        nationality: "POR",
        age: 21,
        value: "€26.5M",
        status: "new",
      },
      {
        id: "target-st-02",
        name: "Dominic Solanke",
        position: "ST",
        rating: 79,
        nationality: "ENG",
        age: 26,
        value: "€19.0M",
        status: "new",
      },
      {
        id: "target-st-03",
        name: "Alexander Sørloth",
        position: "ST",
        rating: 80,
        nationality: "NOR",
        age: 25,
        value: "€20.5M",
        status: "new",
      },
      {
        id: "target-st-04",
        name: "Santiago Giménez",
        position: "ST",
        rating: 81,
        nationality: "MEX",
        age: 23,
        value: "€24.0M",
        status: "new",
      },
      {
        id: "target-st-05",
        name: "Matej Oravec",
        position: "ST",
        rating: 71,
        nationality: "SVK",
        age: 22,
        value: "€4.5M",
        status: "new",
      },
      {
        id: "target-st-06",
        name: "Sébastien Haller",
        position: "ST",
        rating: 78,
        nationality: "CIV",
        age: 30,
        value: "€8.0M",
        status: "new",
      },
      // Budget defenders & squad depth players
      {
        id: "target-cb-05",
        name: "Ismail Jakobs",
        position: "CB",
        rating: 72,
        nationality: "DEU",
        age: 23,
        value: "€6.5M",
        status: "new",
      },
      {
        id: "target-rb-03",
        name: "Vitor Campanharo",
        position: "RB",
        rating: 70,
        nationality: "BRA",
        age: 24,
        value: "€5.0M",
        status: "new",
      },
      {
        id: "target-cm-06",
        name: "Oussama Tannane",
        position: "CM",
        rating: 73,
        nationality: "MAR",
        age: 28,
        value: "€7.5M",
        status: "new",
      },
      {
        id: "target-cm-07",
        name: "Rúben Neves",
        position: "CM",
        rating: 82,
        nationality: "POR",
        age: 27,
        value: "€28.5M",
        status: "interested",
      },
    ],
    contracts,
    training: [
      {
        id: "plan-balanced",
        name: "Balanced",
        focus: "Balanced",
        intensity: "medium",
        assignedPlayerIds: seedPlayers.map((p) => p.id),
      },
      {
        id: "plan-attacking",
        name: "Attacking",
        focus: "Attacking",
        intensity: "high",
        assignedPlayerIds: seedPlayers.map((p) => p.id),
      },
      {
        id: "plan-defensive",
        name: "Defensive",
        focus: "Defensive",
        intensity: "medium",
        assignedPlayerIds: seedPlayers.map((p) => p.id),
      },
      {
        id: "plan-fitness",
        name: "Fitness",
        focus: "Conditioning",
        intensity: "high",
        assignedPlayerIds: seedPlayers.map((p) => p.id),
      },
    ],
    selectedTrainingPlanId: "plan-balanced",
    trainPresets: buildInitialTrainingPresets(),
    trainDrills: getAllDrills(),
    finances: {
      transferBudget: "€24.5M",
      wageBudget: "€480,000 / wk",
      squadValue: "€312M",
      balance: "€61.2M",
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
    financialTransactions: [],
    scoutingNetwork: {
      scouts: [],
      assignments: [],
    },
    board: {
      confidence: 68,
      expectations: [
        { title: "Top-four finish", progress: 72, note: "3rd · on track" },
        { title: "Reach cup quarter-final", progress: 50, note: "Round of 16 next" },
        { title: "Develop two academy players", progress: 40, note: "Mensah, Haugen" },
      ],
      reputation: 64,
    },
    fans: { approval: 74, attendanceAvg: 38400 },
    events: [],
    news: [
      {
        id: "news-1",
        tag: "PRESS",
        time: "2h",
        text: "Board praises unbeaten home run ahead of Ravenport clash.",
      },
      {
        id: "news-2",
        tag: "SCOUT",
        time: "6h",
        text: "Report filed on a 19-year-old left winger in the Eredivisie.",
      },
      {
        id: "news-3",
        tag: "MEDICAL",
        time: "1d",
        text: "Halvorsen managed in training — fitness monitored daily.",
      },
    ],
    inbox: [],
    inboxSettings: {
      archiveOldAfterDays: 30,
      dedupeWindowDays: 1,
    },
    calendar: [
      {
        id: "cal-1",
        date: "Sat 6 Dec",
        type: "match",
        description: "Westport United (H) — National League, Matchday 14",
      },
    ],
    careerHistory: [
      {
        id: "career-1",
        season: "2026/27",
        clubId: HOME_CLUB_ID,
        summary: "Appointed manager of Northfield United.",
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
    meta: {
      worldYear: 2026,
      leagueHierarchy: {
        championship: "premier-league",
        "league-one": "championship",
        "league-two": "league-one",
        "national-league": "league-two",
      },
      worldConfig: SAMPLE_WORLD,
      europeanQualifications: [],
    },
    negotiations: [],
    gameSeed: seedOverride ?? "0",
  };

  const managedClub = {
    ...gameState.currentClub,
    playerIds: [...gameState.currentClub.playerIds],
    academy: {
      ...gameState.currentClub.academy,
      prospectIds: [...gameState.currentClub.academy.prospectIds],
    },
  };
  gameState.currentClub = managedClub;
  gameState.clubs = { ...gameState.clubs, [managedClub.id]: managedClub };

  // Initialize enhanced revenue systems for the current (player-managed) club
  initializeAllEnhancedRevenueSystems(gameState.currentClub, gameState);

  const worldSeed = seedOverride ?? "0";
  return {
    ...gameState,
    clubs: Object.fromEntries(
      Object.entries(gameState.clubs).map(([clubId, club]) => {
        if (!club.aiManager) return [clubId, club];
        const aiManager = generateAIManager(
          {
            id: club.id,
            name: club.name,
            formation: club.formation,
            reputation: club.reputation,
            facilities: club.facilities,
          },
          { worldSeed, generation: club.aiManager.generation ?? 1 },
        );
        return [clubId, { ...club, aiManager }];
      }),
    ),
  };
}

/** Pre-initialize AI ledgers for all AI-managed clubs at game start.
 * This ensures consistent financials and prevents on-demand initialization edge cases. */
export function preInitializeAiLedgers(initial: GameState): GameState {
  let state = initial;
  const aiClubs = Object.values(state.clubs).filter(
    (c) => c.aiManager && c.id !== initial.manager.clubId,
  );
  for (const club of aiClubs) {
    state = ensureAiLedgerFromClub(state, club.id);
  }
  return state;
}
