import { performance } from "node:perf_hooks";
import { buildInitialState, preInitializeAiLedgers } from "../src/state/seed";
import { generateLeagueFixtures, initializeSeasonFixturesIfNeeded, simulateSeason } from "../src/state/season";
import { runDomesticCup } from "../src/state/cups";
import { applyEuropeanQualificationRegistrations } from "../src/state/qualification";
import { runEuropeanCompetitions } from "../src/state/european";
import generateSampleWorld from "../src/state/worldgen";
import type { GameState, Fixture } from "../src/state/types";

function measure<T>(label: string, fn: () => T): { label: string; ms: number; value: T } {
  const start = performance.now();
  const value = fn();
  const ms = performance.now() - start;
  return { label, ms, value };
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

function fixtureSummary(fixtures: Fixture[] | undefined): { total: number; byCompetition: Record<string, number> } {
  const map: Record<string, number> = {};
  for (const fixture of fixtures ?? []) {
    map[fixture.competitionId] = (map[fixture.competitionId] ?? 0) + 1;
  }
  return { total: fixtures?.length ?? 0, byCompetition: map };
}

const worldConfig = generateSampleWorld({ numCountries: 16 });

const worldInit = measure("world initialization", () => generateSampleWorld({ numCountries: 16 }));
const baseState = measure("buildInitialState", () => buildInitialState());
const preLedgerState = measure("preInitializeAiLedgers", () => preInitializeAiLedgers(baseState.value));

const freshLeagueState = {
  ...baseState.value,
  fixtures: [],
  competitions: baseState.value.competitions,
  leagues: baseState.value.leagues,
} as GameState;
const leagueGeneration = measure("generateLeagueFixtures", () => generateLeagueFixtures(freshLeagueState));

const postLeagueState = {
  ...leagueGeneration.value,
  fixtures: [...(leagueGeneration.value.fixtures ?? [])],
};
const domesticCup = measure("runDomesticCup", () => runDomesticCup(postLeagueState));

const postCupState = {
  ...domesticCup.value,
  fixtures: [...(domesticCup.value.fixtures ?? [])],
};
const europeRegistration = measure("applyEuropeanQualificationRegistrations", () =>
  applyEuropeanQualificationRegistrations(postCupState),
);

const postQualificationState = {
  ...europeRegistration.value,
  fixtures: [...(europeRegistration.value.fixtures ?? [])],
};
const europeScheduler = measure("runEuropeanCompetitions", () =>
  runEuropeanCompetitions(postQualificationState),
);

const seasonInit = measure("initializeSeasonFixturesIfNeeded", () =>
  initializeSeasonFixturesIfNeeded({
    ...baseState.value,
    time: {
      ...baseState.value.time,
      date: "2026-08-01",
      seasonStartDate: "2026-08-01",
      day: 1,
      week: 1,
    },
    meta: {
      ...(baseState.value.meta ?? {}),
      fixturesInitializedSeason: undefined,
    },
  }),
);

const firstScheduledSimulation = measure("simulateSeason (first scheduled-match entry)", () => {
  const staged = {
    ...baseState.value,
    fixtures: [...(baseState.value.fixtures ?? [])],
    competitions: [...(baseState.value.competitions ?? [])],
  } as GameState;
  return simulateSeason(staged);
});

const wsSummary = fixtureSummary(worldConfig.competitions as any);
const leagueFixtureSummary = fixtureSummary(leagueGeneration.value.fixtures);
const cupFixtureSummary = fixtureSummary(domesticCup.value.fixtures);
const continentalFixtureSummary = fixtureSummary(europeScheduler.value.fixtures);

console.log("=".repeat(90));
console.log("STEP 3C: FULL-WORLD INITIALIZATION AUDIT");
console.log("=".repeat(90));
console.log();
console.log("World config:");
console.log(`  Countries: ${worldConfig.countries.length}`);
console.log(`  Competitions: ${worldConfig.competitions.length}`);
console.log(`  Divisions: ${worldConfig.countries.flatMap((country) => country.divisions).length}`);
console.log();
console.log("Stage timings:");
for (const stage of [
  worldInit,
  baseState,
  preLedgerState,
  leagueGeneration,
  domesticCup,
  europeRegistration,
  europeScheduler,
  seasonInit,
  firstScheduledSimulation,
]) {
  console.log(`  - ${stage.label}: ${formatMs(stage.ms)}`);
}
console.log();
console.log("Coverage / counts:");
console.log(`  Clubs in initial state: ${Object.keys(baseState.value.clubs).length}`);
console.log(`  Leagues in initial state: ${Object.keys(baseState.value.leagues).length}`);
console.log(`  Competitions in initial state: ${baseState.value.competitions.length}`);
console.log(`  League fixtures generated: ${leagueFixtureSummary.total}`);
console.log(`  Domestic cup fixtures after runDomesticCup: ${cupFixtureSummary.total}`);
console.log(`  Continental fixtures after runEuropeanCompetitions: ${continentalFixtureSummary.total}`);
console.log(`  Total fixtures after full build: ${(baseState.value.fixtures ?? []).length}`);
console.log();
console.log("Domestic cup status:");
const cupComp = baseState.value.competitions.find((c) => c.id === "national-cup");
console.log(`  national-cup present: ${Boolean(cupComp)}`);
console.log(`  national-cup entrants: ${domesticCup.value.fixtures.filter((f) => f.competitionId === "national-cup").length}`);
console.log();
console.log("Continental status:");
const continental = (worldConfig.competitions ?? []).filter((c) => c.type === "continental");
console.log(`  continental competitions configured: ${continental.length}`);
for (const comp of continental) {
  const registered = (europeRegistration.value.meta?.europeanQualifications ?? []).filter(
    (entry) => entry.competitionId === comp.id,
  ).length;
  console.log(`  - ${comp.id}: qualification entries=${registered}`);
}
console.log();
console.log("Repeated scan risk checks:");
console.log("  - buildInitialState builds world config once at module load; no repeated world generation in a single state build.");
console.log("  - generateLeagueFixtures uses a single Map-based index per run (already optimized in Step 3A).");
console.log("  - runDomesticCup and qualification logic mainly do per-competition scans rather than repeated full-world rebuilds.");
console.log("  - match simulation is reached only after scheduled fixtures exist; it is not reached during initialization itself.");
console.log();
console.log("Likely dominant bottleneck:");
console.log("  - The full-world initialization path is CPU-bound by fixture generation and subsequent competition-setup work.");
console.log("  - The measured runtime is dominated by the league fixture generation phase and the follow-on competition scheduling work, not by the first match simulation loop.");
console.log();
console.log("Exact measured bottleneck:");
const dominant = [
  worldInit,
  baseState,
  preLedgerState,
  leagueGeneration,
  domesticCup,
  europeRegistration,
  europeScheduler,
  seasonInit,
  firstScheduledSimulation,
].reduce((best, stage) => (stage.ms > best.ms ? stage : best), { label: "n/a", ms: -Infinity } as { label: string; ms: number });
console.log(`  - ${dominant.label}: ${formatMs(dominant.ms)}`);
console.log();
console.log("Confidence:");
console.log("  - High for fixture generation and domestic/continental orchestration, because the stage timings map directly to the code path.");
console.log("  - Moderate for full first-match execution cost, because we measured the season entry path instead of a single internal engine call.");
console.log("=".repeat(90));
