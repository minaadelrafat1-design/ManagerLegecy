import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  collectCanonicalSimulationReport,
  type SimulationReport,
} from "./canonical-simulation-audit";

const requestedYears = process.argv[2]
  ?.split(",")
  .map((value) => Number.parseInt(value, 10))
  .filter((value): value is 1 | 5 | 10 | 30 => [1, 5, 10, 30].includes(value as 1 | 5 | 10 | 30));
const requestedSeeds = process.argv[3]?.split(",").filter(Boolean);
const mode: "full" | "quick" = process.argv.includes("--quick") ? "quick" : "full";
const repeatDeterminism = !process.argv.includes("--no-repeat");
const representative = !process.argv.includes("--full-world");
const YEARS = (requestedYears?.length ? requestedYears : [1, 5, 10, 30]) as Array<1 | 5 | 10 | 30>;
const SEEDS = (requestedSeeds?.length ? requestedSeeds : ["0", "1"]) as string[];

if (mode === "quick") {
  console.error(
    "CANONICAL TRUTH GATE FAILED: --quick intentionally skips match execution and cannot prove football occurred.",
  );
  process.exit(1);
}

interface LongTermCase {
  years: number;
  seed: string;
  elapsedMs: number;
  report: SimulationReport;
  checks: string[];
}

function runCase(years: number, seed: string): LongTermCase {
  const start = performance.now();
  const report = collectCanonicalSimulationReport(years, seed, mode, representative);
  const elapsedMs = performance.now() - start;
  const checks: string[] = [];

  if (report.seasonsCompleted !== years) checks.push("season-count");
  if (report.daysAdvanced <= 0) checks.push("days-advanced");
  if (report.fixturesScheduled <= 0) checks.push("fixtures-generated");
  if (report.matchesPlayed <= 0) checks.push("matches-completed");
  if (report.goals < 0) checks.push("negative-goals");
  for (const season of report.perSeason) {
    if (season.daysAdvanced <= 0) checks.push(`season-${season.seasonIndex}-days-advanced`);
    if (season.fixturesGenerated <= 0) checks.push(`season-${season.seasonIndex}-fixtures-generated`);
    if (season.matchesCompleted <= 0) checks.push(`season-${season.seasonIndex}-matches-completed`);
  }
  if (report.playerPopulation <= 0) checks.push("population");
  if (report.activePlayers + report.retiredPlayers !== report.playerPopulation)
    checks.push("player-status-counts");
  if (!Number.isFinite(report.averagePlayerAge)) checks.push("average-age");
  if (!Number.isFinite(report.averageOverall)) checks.push("average-overall");
  if (!Number.isFinite(report.averagePotential)) checks.push("average-potential");
  if (!Number.isFinite(report.averageClubBalance)) checks.push("average-finances");
  if (!Number.isFinite(report.leagueStrength)) checks.push("league-strength");

  return { years, seed, elapsedMs, report, checks };
}

function main() {
  const cases: LongTermCase[] = [];
  const outputName = `final-d2.1-regression-${YEARS.join("-")}-seed-${SEEDS.join("-")}.json`;
  const writeCheckpoint = (deterministic: boolean | null = null) => {
    mkdirSync("outputs", { recursive: true });
    writeFileSync(
      `outputs/${outputName}`,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mode,
          years: [...YEARS],
          seeds: [...SEEDS],
          complete: cases.length === YEARS.length * SEEDS.length,
          deterministic,
          cases,
        },
        null,
        2,
      ),
    );
  };
  for (const years of YEARS) {
    for (const seed of SEEDS) {
      const result = runCase(years, seed);
      cases.push(result);
      writeCheckpoint();
      console.log(
        `${years} seasons seed ${seed}: ${result.elapsedMs.toFixed(1)}ms | ` +
          `fixtures=${result.report.fixturesScheduled} matches=${result.report.matchesPlayed} ` +
          `goals=${result.report.goals} transferAttempts=${result.report.transferAttempts} ` +
          `transfers=${result.report.completedTransfers} ` +
          `promotions=${result.report.promotions} relegations=${result.report.relegations} ` +
          `retirements=${result.report.retirements} youth=${result.report.youthGenerated} ` +
          `managers=${result.report.managerChanges} players=${result.report.playerPopulation} ` +
          `aiMemory=${result.report.aiMemoryItems} invariants=${result.report.invariantViolations}`,
      );
    }
  }

  const reproducibilitySeed = SEEDS[0] ?? "0";
  const reproducibilityCase = cases.find(
    (entry) => entry.years === (YEARS[0] ?? 1) && entry.seed === reproducibilitySeed,
  );
  const oneYearRepeat = repeatDeterminism ? runCase(YEARS[0] ?? 1, reproducibilitySeed) : undefined;
  const deterministic =
    oneYearRepeat === undefined
      ? null
      : reproducibilityCase !== undefined &&
        JSON.stringify(reproducibilityCase.report) === JSON.stringify(oneYearRepeat.report);
  const comparisonYears = YEARS[0] ?? 1;
  const firstSeedCase = cases.find(
    (entry) => entry.years === comparisonYears && entry.seed === (SEEDS[0] ?? "0"),
  );
  const secondSeedCase = cases.find(
    (entry) => entry.years === comparisonYears && entry.seed === SEEDS[1],
  );
  const differentSeedDiverges =
    firstSeedCase !== undefined &&
    secondSeedCase !== undefined &&
    JSON.stringify({
      transfers: firstSeedCase.report.completedTransfers,
      youth: firstSeedCase.report.youthGenerated,
      managers: firstSeedCase.report.managerChanges,
      population: firstSeedCase.report.playerPopulation,
      averageOverall: firstSeedCase.report.averageOverall,
      averagePotential: firstSeedCase.report.averagePotential,
      invariantBreakdown: firstSeedCase.report.invariantBreakdown,
    }) !==
      JSON.stringify({
        transfers: secondSeedCase.report.completedTransfers,
        youth: secondSeedCase.report.youthGenerated,
        managers: secondSeedCase.report.managerChanges,
        population: secondSeedCase.report.playerPopulation,
        averageOverall: secondSeedCase.report.averageOverall,
        averagePotential: secondSeedCase.report.averagePotential,
        invariantBreakdown: secondSeedCase.report.invariantBreakdown,
      });

  const malformedCases = cases.filter((entry) => entry.checks.length > 0);
  const output = {
    generatedAt: new Date().toISOString(),
    mode,
    representative,
    years: [...YEARS],
    seeds: [...SEEDS],
    deterministic,
    differentSeedDiverges,
    repeatElapsedMs: oneYearRepeat?.elapsedMs ?? null,
    cases,
  };

  mkdirSync("outputs", { recursive: true });
  writeFileSync(`outputs/${outputName}`, JSON.stringify(output, null, 2));

  console.log(
    `Same-seed reproducibility: ${deterministic === null ? "NOT RUN" : deterministic ? "PASS" : "FAIL"}`,
  );
  console.log(
    `Different-seed divergence: ${differentSeedDiverges === null ? "NOT RUN" : differentSeedDiverges ? "PASS" : "FAIL"}`,
  );
  console.log(`Malformed cases: ${malformedCases.length}`);
  console.log(`Report: outputs/${outputName}`);
  console.log(`World scope: ${representative ? "representative" : "full"}`);
  if (representative) {
    const auditYears = YEARS[0] ?? 1;
    console.log(
      `Representative density: ${auditYears >= 30 ? 2 : auditYears >= 10 ? 4 : 8} clubs per league`,
    );
  }
  console.log(
    "Invariant counts are reported per run; non-zero counts require review and are not hidden.",
  );

  if (deterministic === false || differentSeedDiverges === false || malformedCases.length > 0) {
    process.exitCode = 1;
  }
}

main();
