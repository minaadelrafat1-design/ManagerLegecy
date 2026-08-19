import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const { ensureWorldMeta, applyWorldSeasonProgression, DEFAULT_WORLD_CONFIG } =
  await import("../src/state/world.ts");

const state = ensureWorldMeta(buildInitialState());

assert(state.meta?.worldConfig, "world config missing");
assert(
  Array.isArray(state.meta.worldConfig.countries) && state.meta.worldConfig.countries.length > 0,
  "countries not configured",
);
assert(
  Array.isArray(state.meta.worldConfig.competitions) &&
    state.meta.worldConfig.competitions.length > 0,
  "competitions not configured",
);
assert(
  state.meta.worldConfig.countries.some(
    (country) => country.identity?.footballStyle && country.identity?.financialPower,
  ),
  "country identity metadata missing",
);
assert(
  state.meta.worldConfig.countries.some((country) =>
    country.divisions.some(
      (division) => division.identity?.prestige && division.identity?.developmentPath,
    ),
  ),
  "division identity metadata missing",
);
const clubs = state.clubs;
assert(
  Object.values(clubs).some(
    (club) => club.identity?.archetype && club.identity?.academyFocus !== undefined,
  ),
  "club identity not generated",
);
assert(
  new Set(Object.values(clubs).map((club) => club.identity?.archetype ?? "balanced")).size > 1,
  "club identities are not differentiated across clubs",
);
assert(Object.keys(state.meta.leagueHierarchy || {}).length > 0, "league hierarchy missing");

const advanced = applyWorldSeasonProgression(state);
assert(advanced.events.length >= state.events.length, "world progression did not produce events");
assert(advanced.meta?.worldYear >= (state.meta?.worldYear ?? 0), "world year did not advance");
assert(
  advanced.meta?.worldConfig?.countries[0]?.id === DEFAULT_WORLD_CONFIG.countries[0].id,
  "default config not preserved",
);

console.log("PASS — world config and progression");
process.exit(0);
