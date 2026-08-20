import { performance } from "node:perf_hooks";
import { collectCanonicalSimulationReport } from "./canonical-simulation-audit";

type CanonicalReport = ReturnType<typeof collectCanonicalSimulationReport>;

function projection(report: CanonicalReport) {
  return {
    mode: report.mode,
    worldScope: report.worldScope,
    years: report.years,
    daysAdvanced: report.daysAdvanced,
    seasonsCompleted: report.seasonsCompleted,
    fixturesScheduled: report.fixturesScheduled,
    matchesPlayed: report.matchesPlayed,
    goals: report.goals,
    transferAttempts: report.transferAttempts,
    completedTransfers: report.completedTransfers,
    promotions: report.promotions,
    relegations: report.relegations,
    retirements: report.retirements,
    youthGenerated: report.youthGenerated,
    managerChanges: report.managerChanges,
    invariantViolations: report.invariantViolations,
    invariantBreakdown: report.invariantBreakdown,
    perSeason: report.perSeason,
  };
}

function firstDifference(left: unknown, right: unknown, path = "root"): string | null {
  if (Object.is(left, right)) return null;
  if (typeof left !== typeof right || left === null || right === null) {
    return `${path}: ${JSON.stringify(left)} !== ${JSON.stringify(right)}`;
  }
  if (typeof left !== "object" || typeof right !== "object") {
    return `${path}: ${JSON.stringify(left)} !== ${JSON.stringify(right)}`;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort();
  for (const key of keys) {
    const difference = firstDifference(leftRecord[key], rightRecord[key], `${path}.${key}`);
    if (difference) return difference;
  }
  return `${path}: values differ`;
}

function stateMetrics(report: CanonicalReport) {
  const lastSeason = report.perSeason[report.perSeason.length - 1];
  return {
    seasons: report.seasonsCompleted,
    days: report.daysAdvanced,
    fixtures: report.fixturesScheduled,
    matches: report.matchesPlayed,
    goals: report.goals,
    transferAttempts: report.transferAttempts,
    transfers: report.completedTransfers,
    promotions: report.promotions,
    relegations: report.relegations,
    retirements: report.retirements,
    youth: report.youthGenerated,
    managers: report.managerChanges,
    invariants: report.invariantViolations,
    lastSeason: lastSeason?.seasonLabel ?? null,
  };
}

function run(label: "A" | "B") {
  const start = performance.now();
  console.log(`[RUN ${label}] START`);
  const report = collectCanonicalSimulationReport(5, "step-2c2-five-season", "full", true);
  const elapsedMs = performance.now() - start;
  console.log(`[RUN ${label}] END ${elapsedMs.toFixed(2)}ms`);
  console.log(JSON.stringify({ run: label, elapsedMs, metrics: stateMetrics(report) }));
  return { report, elapsedMs };
}

const runA = run("A");
const runB = run("B");
const projectionA = projection(runA.report);
const projectionB = projection(runB.report);
const equal = JSON.stringify(projectionA) === JSON.stringify(projectionB);
const difference = equal ? null : firstDifference(projectionA, projectionB);
const totalMs = runA.elapsedMs + runB.elapsedMs;

console.log(JSON.stringify({
  comparison: equal ? "PASS" : "FAIL",
  firstDifference: difference,
  runADurationMs: runA.elapsedMs,
  runBDurationMs: runB.elapsedMs,
  totalDurationMs: totalMs,
  metrics: stateMetrics(runA.report),
}, null, 2));

if (!equal) process.exitCode = 1;
