/** Optional mapping that defines higher/lower leagues for promotion.
 * Format: { lowerLeagueId: higherLeagueId } meaning winner(s) of lower move to higher.
 * This file provides a default empty mapping; projects can override by
 * setting `state.meta.leagueHierarchy` at runtime to customize tiers. */

export const DEFAULT_LEAGUE_HIERARCHY: Record<string, string> = {
  championship: "premier-league",
  "league-one": "championship",
  "league-two": "league-one",
  "national-league": "league-two",
};

export {};
