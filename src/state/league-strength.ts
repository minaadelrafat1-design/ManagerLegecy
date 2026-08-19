import type { GameState } from "./types";

export type LeagueStrengthTier = 1 | 2 | 3 | 4;

export interface LeagueStrengthDefinition {
  key: string;
  label: string;
  tier: LeagueStrengthTier;
  /** 0-100 strength of the country's top division. */
  topDivisionRating: number;
  /** 0-100 attractiveness signal used by existing transfer negotiations. */
  transferAttractiveness: number;
  /** Small environmental effect on generated players and development. */
  developmentEnvironment: number;
}

/**
 * One data source for the global football hierarchy. The generated world keeps
 * its existing country/club ids; `strengthKey` metadata maps them to this
 * table without renaming or replacing any club identity.
 */
export const LEAGUE_STRENGTH_DEFINITIONS: readonly LeagueStrengthDefinition[] = [
  { key: "england", label: "England", tier: 1, topDivisionRating: 100, transferAttractiveness: 100, developmentEnvironment: 1.05 },
  { key: "spain", label: "Spain", tier: 1, topDivisionRating: 97, transferAttractiveness: 96, developmentEnvironment: 1.04 },
  { key: "italy", label: "Italy", tier: 1, topDivisionRating: 94, transferAttractiveness: 93, developmentEnvironment: 1.03 },
  { key: "germany", label: "Germany", tier: 1, topDivisionRating: 92, transferAttractiveness: 91, developmentEnvironment: 1.03 },
  { key: "france", label: "France", tier: 1, topDivisionRating: 89, transferAttractiveness: 88, developmentEnvironment: 1.02 },
  { key: "portugal", label: "Portugal", tier: 2, topDivisionRating: 84, transferAttractiveness: 82, developmentEnvironment: 1.01 },
  { key: "turkey", label: "Turkey", tier: 2, topDivisionRating: 81, transferAttractiveness: 79, developmentEnvironment: 1.0 },
  { key: "netherlands", label: "Netherlands", tier: 2, topDivisionRating: 80, transferAttractiveness: 80, developmentEnvironment: 1.01 },
  { key: "belgium", label: "Belgium", tier: 2, topDivisionRating: 77, transferAttractiveness: 75, developmentEnvironment: 1.0 },
  { key: "established-europe", label: "Established European League", tier: 3, topDivisionRating: 70, transferAttractiveness: 68, developmentEnvironment: 0.98 },
  { key: "developing-europe", label: "Developing European League", tier: 4, topDivisionRating: 60, transferAttractiveness: 56, developmentEnvironment: 0.95 },
];

export const GLOBAL_COUNTRY_STRENGTH_KEYS: readonly string[] = [
  "england",
  "spain",
  "italy",
  "germany",
  "france",
  "portugal",
  "turkey",
  "netherlands",
  "belgium",
  "established-europe",
  "established-europe",
  "established-europe",
  "developing-europe",
  "developing-europe",
  "developing-europe",
  "developing-europe",
];

const DIVISION_MULTIPLIERS: Record<number, number> = {
  1: 1,
  2: 0.88,
  3: 0.76,
  4: 0.65,
  5: 0.55,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function definitionForKey(key: string): LeagueStrengthDefinition {
  return (
    LEAGUE_STRENGTH_DEFINITIONS.find((definition) => definition.key === key) ??
    LEAGUE_STRENGTH_DEFINITIONS.find((definition) => definition.key === "developing-europe")!
  );
}

function fallbackKeyForLeagueId(leagueId: string): string {
  if (leagueId === "national-league") return "england";
  if (leagueId.startsWith("england-")) return "england";
  if (leagueId.startsWith("rivendell-")) return "spain";
  if (leagueId.startsWith("norland-")) return "italy";
  const match = /^country-(\d+)-/.exec(leagueId);
  const index = match ? Number(match[1]) - 1 : -1;
  return GLOBAL_COUNTRY_STRENGTH_KEYS[index] ?? "developing-europe";
}

export function getLeagueStrengthDefinition(
  state: Pick<GameState, "meta"> | undefined,
  leagueId: string,
): LeagueStrengthDefinition {
  const division = state?.meta?.worldConfig?.countries
    ?.flatMap((country) => country.divisions)
    .find((item) => item.id === leagueId);
  const country = division
    ? state?.meta?.worldConfig?.countries?.find((item) => item.id === division.countryId)
    : undefined;
  const key = country?.strengthKey ?? fallbackKeyForLeagueId(leagueId);
  return definitionForKey(key);
}

export function getLeagueStrengthRating(
  leagueId: string,
  state?: Pick<GameState, "meta">,
): number {
  const definition = getLeagueStrengthDefinition(state, leagueId);
  const divisionLevel = state?.meta?.worldConfig?.countries
    ?.flatMap((country) => country.divisions)
    .find((item) => item.id === leagueId)?.level;
  const multiplier = DIVISION_MULTIPLIERS[divisionLevel ?? (leagueId === "national-league" ? 5 : 1)] ?? 0.55;
  return clamp(definition.topDivisionRating * multiplier);
}

export function getLeagueTransferAttractiveness(
  leagueId: string,
  state?: Pick<GameState, "meta">,
): number {
  const definition = getLeagueStrengthDefinition(state, leagueId);
  const divisionLevel = state?.meta?.worldConfig?.countries
    ?.flatMap((country) => country.divisions)
    .find((item) => item.id === leagueId)?.level;
  const multiplier = DIVISION_MULTIPLIERS[divisionLevel ?? (leagueId === "national-league" ? 5 : 1)] ?? 0.55;
  return clamp(definition.transferAttractiveness * multiplier);
}

export function getLeagueDevelopmentEnvironment(
  leagueId: string,
  state?: Pick<GameState, "meta">,
): number {
  const definition = getLeagueStrengthDefinition(state, leagueId);
  const rating = getLeagueStrengthRating(leagueId, state);
  return Math.max(0.9, Math.min(1.08, definition.developmentEnvironment + (rating - 60) / 1000));
}
