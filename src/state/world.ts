import type { GameState, WorldConfig } from "./types";

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  countries: [
    {
      id: "england",
      name: "England",
      identity: {
        footballStyle: "Direct, high-intensity, relentless pressing",
        financialPower: "Elite",
        youthProduction: "Strong",
        reputation: "World-class",
        culture: "Competitive, ambitious and media-driven",
      },
      divisions: [
        {
          id: "premier-league",
          name: "Premier League",
          countryId: "england",
          level: 1,
          identity: {
            prestige: "Elite",
            developmentPath: "Top-flight talent pipeline",
            competitiveLevel: "Highest",
          },
          qualificationSlots: 4,
          relegationTo: "championship",
          relegationSpots: 3,
        },
        {
          id: "championship",
          name: "Championship",
          countryId: "england",
          level: 2,
          identity: {
            prestige: "High",
            developmentPath: "Promotion pressure",
            competitiveLevel: "Very high",
          },
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
          identity: {
            prestige: "Medium",
            developmentPath: "Step-up pathway",
            competitiveLevel: "High",
          },
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
          identity: {
            prestige: "Lower",
            developmentPath: "Professional development",
            competitiveLevel: "Moderate",
          },
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
          identity: {
            prestige: "Regional",
            developmentPath: "Entry to professional ranks",
            competitiveLevel: "Rising",
          },
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
        { type: "leaguePosition", sourceCompetitionId: "premier-league", positions: [1, 2, 3, 4] },
      ],
      format: {
        groupStage: {
          numGroups: 2,
          teamsPerGroup: 2,
          homeAndAway: true,
          advancePerGroup: 2, // PHASE AAA-REPAIR-3: Changed to 2 per group (4 total advance)
        },
        knockoutStage: {
          rounds: [
            { id: "semi-final", name: "Semi-final", teams: 4, twoLegged: true }, // PHASE AAA-REPAIR-3: Changed from 2 to 4 teams
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
      qualificationSlots: 2, // PHASE AAA-REPAIR-3: Changed from 3 to 2
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
          numGroups: 2, // PHASE AAA-REPAIR-3: Changed from 3 to 2 groups (2 teams total)
          teamsPerGroup: 1,
          homeAndAway: true,
          advancePerGroup: 1, // 2 groups × 1 advance = 2 teams
        },
        knockoutStage: {
          rounds: [
            { id: "final", name: "Final", teams: 2, twoLegged: false }, // PHASE AAA-REPAIR-3: Removed semifinal, go straight to final
          ],
          extraTime: true,
          penalties: true,
        },
      },
    },
  ],
};

export function ensureWorldMeta(state: GameState): GameState {
  const next = { ...state } as GameState;
  const hierarchy = (next.meta?.leagueHierarchy as Record<string, string> | undefined) ?? {
    championship: "premier-league",
    "league-one": "championship",
    "league-two": "league-one",
    "national-league": "league-two",
  };

  const worldConfig = next.meta?.worldConfig ?? DEFAULT_WORLD_CONFIG;
  return {
    ...next,
    meta: {
      ...next.meta,
      leagueHierarchy: hierarchy,
      worldConfig,
      worldYear: next.meta?.worldYear ?? 2026,
    },
  };
}

export function applyWorldSeasonProgression(state: GameState): GameState {
  const world = ensureWorldMeta(state);
  const currentSeasonLabel =
    world.time?.season ??
    `${world.meta?.worldYear ?? 2026}/${String((world.meta?.worldYear ?? 2026) + 1).slice(-2)}`;
  const [startYearRaw = String(world.meta?.worldYear ?? 2026)] =
    String(currentSeasonLabel).split("/");
  const startYear = Number.parseInt(startYearRaw, 10) || (world.meta?.worldYear ?? 2026);
  const nextYear = startYear + 1;
  const nextSeasonLabel = `${nextYear}/${String(nextYear + 1).slice(-2)}`;
  const nextSeasonStartDate = `${nextYear}-08-01`;

  const events = [...(world.events ?? [])];
  events.push({
    id: `world-progress-${events.length + 1}`,
    date: nextSeasonStartDate,
    type: "milestone",
    description: `World season cycle advances to ${nextSeasonLabel}. European qualification windows refresh for the countries in the configured pyramid.`,
    meta: { type: "world_progression", worldYear: nextYear },
  });

  return {
    ...world,
    events,
    time: {
      ...world.time,
      season: nextSeasonLabel,
      date: nextSeasonStartDate,
      seasonStartDate: nextSeasonStartDate,
      day: 1,
      week: 1,
    },
    meta: {
      ...world.meta,
      worldYear: nextYear,
    },
  };
}

/**
 * CRITICAL: Updates world season metadata WITHOUT changing the calendar date.
 * This preserves chronological continuity while advancing the season label.
 *
 * Use this in ADVANCE_DAY flow to prevent date jumps.
 * Only changes:
 * - season label (2026/27 → 2027/28)
 * - world year
 * - seasonStartDate (for fixture day-of-season calculation)
 *
 * DOES NOT change:
 * - date (calendar continues normally)
 * - day/week (preserved from current clock)
 */
export function applyWorldSeasonProgressionWithoutDateChange(state: GameState): GameState {
  const world = ensureWorldMeta(state);
  const currentSeasonLabel =
    world.time?.season ??
    `${world.meta?.worldYear ?? 2026}/${String((world.meta?.worldYear ?? 2026) + 1).slice(-2)}`;
  const [startYearRaw = String(world.meta?.worldYear ?? 2026)] =
    String(currentSeasonLabel).split("/");
  const startYear = Number.parseInt(startYearRaw, 10) || (world.meta?.worldYear ?? 2026);
  const nextYear = startYear + 1;
  const nextSeasonLabel = `${nextYear}/${String(nextYear + 1).slice(-2)}`;
  const nextSeasonStartDate = `${nextYear}-08-01`;

  const events = [...(world.events ?? [])];
  events.push({
    id: `world-progress-${events.length + 1}`,
    date: world.time.date,
    type: "milestone",
    description: `World season cycle advances to ${nextSeasonLabel}. European qualification windows refresh for the countries in the configured pyramid.`,
    meta: { type: "world_progression", worldYear: nextYear },
  });

  return {
    ...world,
    events,
    time: {
      ...world.time,
      season: nextSeasonLabel,
      seasonStartDate: nextSeasonStartDate,
      // CRITICAL: DO NOT change date/day/week - preserve calendar continuity
    },
    meta: {
      ...world.meta,
      worldYear: nextYear,
    },
  };
}
