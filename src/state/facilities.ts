import type { Club, GameState } from "./types";
import { parseMoney, formatMoney } from "./finance";

export type FacilityKey = "training" | "youth" | "medical" | "scouting";

export interface FacilityDefinition {
  key: FacilityKey;
  label: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  baseRating: number;
  ratingGrowth: number;
}

export const FACILITY_DEFINITIONS: Record<FacilityKey, FacilityDefinition> = {
  training: {
    key: "training",
    label: "Training facility",
    description: "Improves development and training quality.",
    maxLevel: 5,
    baseCost: 2_500_000,
    costGrowth: 1.45,
    baseRating: 50,
    ratingGrowth: 6,
  },
  youth: {
    key: "youth",
    label: "Youth academy",
    description: "Produces more promising academy prospects.",
    maxLevel: 5,
    baseCost: 2_000_000,
    costGrowth: 1.35,
    baseRating: 50,
    ratingGrowth: 5,
  },
  medical: {
    key: "medical",
    label: "Medical facility",
    description: "Speeds recovery and softens injury impact.",
    maxLevel: 5,
    baseCost: 1_800_000,
    costGrowth: 1.4,
    baseRating: 50,
    ratingGrowth: 5,
  },
  scouting: {
    key: "scouting",
    label: "Scouting network",
    description: "Improves player information and recruitment intelligence.",
    maxLevel: 5,
    baseCost: 1_600_000,
    costGrowth: 1.38,
    baseRating: 50,
    ratingGrowth: 4,
  },
};

export function getFacilityLevel(club: Club | undefined, key: FacilityKey): number {
  if (!club) return 1;
  const explicit = club.facilityLevels?.[key];
  if (typeof explicit === "number") return Math.max(1, Math.min(5, explicit));
  const value = club.facilities?.[key as keyof typeof club.facilities];
  if (typeof value !== "number") return 1;
  const baseLevel = Math.min(5, Math.max(1, Math.round(value / 20)));
  return baseLevel;
}

export function getFacilityRating(club: Club | undefined, key: FacilityKey): number {
  const level = getFacilityLevel(club, key);
  const definition = FACILITY_DEFINITIONS[key];
  return Math.max(0, Math.min(100, definition.baseRating + (level - 1) * definition.ratingGrowth));
}

export function getFacilityUpgradeCost(level: number): number {
  const definition = FACILITY_DEFINITIONS.training;
  return Math.round(definition.baseCost * Math.pow(definition.costGrowth, Math.max(0, level - 1)));
}

export function getFacilityUpgradeCostForKey(key: FacilityKey, level: number): number {
  const definition = FACILITY_DEFINITIONS[key];
  return Math.round(definition.baseCost * Math.pow(definition.costGrowth, Math.max(0, level - 1)));
}

export function getFacilityEffectMultiplier(club: Club | undefined, key: FacilityKey): number {
  const level = getFacilityLevel(club, key);
  const base = key === "training" ? 1.05 : key === "youth" ? 1.04 : key === "medical" ? 1.03 : 1.02;
  return base + (level - 1) * 0.03;
}

export function upgradeFacility(state: GameState, facility: FacilityKey): GameState {
  const club = state.currentClub;
  if (!club) return state;
  const currentLevel = getFacilityLevel(club, facility);
  if (currentLevel >= FACILITY_DEFINITIONS[facility].maxLevel) return state;
  const cost = getFacilityUpgradeCostForKey(facility, currentLevel);
  const balance = parseMoney(state.finances?.balance);
  if (balance < cost) return state;

  const nextLevel = Math.min(FACILITY_DEFINITIONS[facility].maxLevel, currentLevel + 1);
  const fallbackLevels: Club["facilityLevels"] = { training: 1, youth: 1, medical: 1, scouting: 1 };
  const nextFacilityLevels = {
    ...fallbackLevels,
    ...(club.facilityLevels ?? {}),
    [facility]: nextLevel,
  };
  const nextRating = getFacilityRating({ ...club, facilityLevels: nextFacilityLevels }, facility);
  const updatedFacilities = {
    ...club.facilities,
    [facility]: nextRating,
    ...(facility === "youth" ? { youth: nextRating } : {}),
    ...(facility === "training" ? { training: nextRating } : {}),
    ...(facility === "medical" ? { medical: nextRating } : {}),
  };
  const updatedClub = {
    ...club,
    facilities: updatedFacilities,
    facilityLevels: nextFacilityLevels,
    ...(facility === "youth"
      ? { academy: { ...club.academy, rating: Math.min(100, club.academy.rating + 4) } }
      : {}),
  };
  const updatedCurrentClub = state.currentClub.id === club.id ? updatedClub : state.currentClub;
  const updatedClubs = { ...state.clubs, [club.id]: updatedClub };

  const nextBalance = balance - cost;
  return {
    ...state,
    clubs: updatedClubs,
    currentClub: updatedCurrentClub,
    finances: {
      ...state.finances,
      balance: formatMoney(nextBalance),
      expenses: {
        playerSalaries: state.finances?.expenses?.playerSalaries ?? 0,
        staff: state.finances?.expenses?.staff ?? 0,
        transfers: state.finances?.expenses?.transfers ?? 0,
        facilities: (state.finances?.expenses?.facilities ?? 0) + cost,
        scouting: state.finances?.expenses?.scouting ?? 0,
        medical: state.finances?.expenses?.medical ?? 0,
        operations: state.finances?.expenses?.operations ?? 0,
        total: (state.finances?.expenses?.total ?? 0) + cost,
      },
    },
    events: [
      ...(state.events ?? []),
      {
        id: `event-facility-${(state.events?.length ?? 0) + 1}`,
        date: state.time.date,
        type: "milestone" as const,
        description: `${FACILITY_DEFINITIONS[facility].label} upgraded to level ${currentLevel + 1} for ${formatMoney(cost)}.`,
      },
    ],
  };
}
