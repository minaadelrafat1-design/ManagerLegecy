import type { WorldConfig } from "./types";
import { GLOBAL_COUNTRY_STRENGTH_KEYS } from "./league-strength";

export function generateSampleWorld(opts?: { numCountries?: number }): WorldConfig {
  const num = opts?.numCountries ?? 16;
  const countries = [] as any[];

  const seedNamed = [
    { id: "england", name: "England" },
    { id: "rivendell", name: "Rivendell" },
    { id: "norland", name: "Norland" },
  ];

  const countryProfiles = [
    {
      footballStyle: "Direct, high-intensity, relentless pressing",
      financialPower: "Elite",
      youthProduction: "Strong",
      reputation: "World-class",
      culture: "Competitive, ambitious and media-driven",
    },
    {
      footballStyle: "Technical, possession-led and patient",
      financialPower: "Strong",
      youthProduction: "Very good",
      reputation: "Established",
      culture: "Structured and methodical",
    },
    {
      footballStyle: "Balanced, athletic and transition-heavy",
      financialPower: "Moderate",
      youthProduction: "Promising",
      reputation: "Steady",
      culture: "Disciplined and route-driven",
    },
    {
      footballStyle: "Counter-attacking and compact defensively",
      financialPower: "Moderate",
      youthProduction: "Developing",
      reputation: "Rising",
      culture: "Pragmatic and resilient",
    },
  ];

  const divisionNames = [
    "Premier League",
    "Championship",
    "League One",
    "League Two",
    "National League",
  ];

  const divisionIdentities = [
    {
      prestige: "Elite",
      developmentPath: "Top-flight talent pipeline",
      competitiveLevel: "Highest",
    },
    { prestige: "High", developmentPath: "Promotion pressure", competitiveLevel: "Very high" },
    { prestige: "Medium", developmentPath: "Step-up pathway", competitiveLevel: "High" },
    {
      prestige: "Lower",
      developmentPath: "Professional development",
      competitiveLevel: "Moderate",
    },
    {
      prestige: "Regional",
      developmentPath: "Entry to professional ranks",
      competitiveLevel: "Rising",
    },
  ];

  for (let i = 0; i < num; i++) {
    const named = seedNamed[i];
    const id = named ? named.id : `country-${i + 1}`;
    const name = named ? named.name : `Country ${i + 1}`;
    const profile = countryProfiles[i % countryProfiles.length];
    const divisions = [] as any[];

    const divisionIds = [
      `${id}-premier`,
      `${id}-championship`,
      `${id}-league-one`,
      `${id}-league-two`,
      `${id}-national`,
    ];

    for (let level = 0; level < divisionIds.length; level += 1) {
      const divisionId = divisionIds[level];
      const currentName = divisionNames[level] ?? `Division ${level + 1}`;
      const isTop = level === 0;
      const isBottom = level === divisionIds.length - 1;
      const promotionTo = isTop ? null : divisionIds[level - 1];
      const relegationTo = isBottom ? null : divisionIds[level + 1];

      divisions.push({
        id: divisionId,
        name: `${name} ${currentName}`,
        countryId: id,
        level: level + 1,
        identity: divisionIdentities[level] ?? divisionIdentities[0],
        qualificationSlots: isTop ? 4 : undefined,
        promotionTo,
        promotionSpots: isTop ? undefined : 3,
        relegationTo,
        relegationSpots: isBottom ? undefined : 3,
      });
    }

    countries.push({
      id,
      name,
      strengthKey: GLOBAL_COUNTRY_STRENGTH_KEYS[i] ?? "developing-europe",
      identity: profile,
      divisions,
    });
  }

  const competitions = [] as any[];
  for (const c of countries) {
    for (const division of c.divisions) {
      competitions.push({
        id: division.id,
        name: division.name,
        type: "league",
        countryId: c.id,
        divisionIds: [division.id],
      });
    }
    competitions.push({ id: `${c.id}-cup`, name: `${c.name} Cup`, type: "cup", countryId: c.id });
  }

  competitions.push({
    id: "uefa-champions-league",
    name: "UEFA Champions League",
    type: "continental",
    qualificationSlots: 4,
    qualificationRules: [
      {
        type: "leaguePosition",
        sourceCompetitionId: countries[0].divisions[0].id,
        positions: [1, 2, 3, 4],
      },
    ],
    format: {
      groupStage: { numGroups: 2, teamsPerGroup: 2, homeAndAway: true, advancePerGroup: 2 },
      knockoutStage: {
        rounds: [
          { id: "semi", name: "Semi-final", teams: 4, twoLegged: true, isFinal: false },
          { id: "final", name: "Final", teams: 2, twoLegged: false, isFinal: true },
        ],
        extraTime: true,
        penalties: true,
      },
    },
  });

  competitions.push({
    id: "uefa-europa-league",
    name: "UEFA Europa League",
    type: "continental",
    qualificationSlots: 2,
    qualificationRules: [
      {
        type: "cupWinner",
        sourceCompetitionId: `${countries[0].id}-cup`,
        fallbackToCompetitionId: countries[0].divisions[0].id,
      },
      { type: "leaguePosition", sourceCompetitionId: countries[0].divisions[0].id, positions: [5] },
    ],
    format: {
      groupStage: { numGroups: 2, teamsPerGroup: 1, homeAndAway: true, advancePerGroup: 1 },
      knockoutStage: {
        rounds: [{ id: "final", name: "Final", teams: 2, twoLegged: false, isFinal: true }],
        extraTime: true,
        penalties: true,
      },
    },
  });

  return { countries, competitions } as WorldConfig;
}

export default generateSampleWorld;
