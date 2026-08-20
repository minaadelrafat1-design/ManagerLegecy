import { describe, expect, it } from "vitest";
import { collectCanonicalSimulationReport } from "../../scripts/canonical-simulation-audit";
import { buildInitialState } from "./seed";
import { simulateAiFixtureViaEngine } from "../lib/ai-match-adapter";
import { performance } from "node:perf_hooks";

/**
 * Deterministic output contract: compare only authoritative simulation
 * results. Runtime, generatedAt, object identity, and other diagnostics are
 * intentionally excluded.
 */
function canonicalProjection(report: ReturnType<typeof collectCanonicalSimulationReport>) {
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

describe("deterministic simulation gate", () => {
  it("produces the same match result for identical inputs and seed", () => {
    const state = buildInitialState("match-determinism");
    const fixture = state.fixtures.find((candidate) => candidate.status === "scheduled")!;
    const first = simulateAiFixtureViaEngine(
      fixture,
      state.clubs,
      state.players,
      6016,
      state,
    );
    const second = simulateAiFixtureViaEngine(
      fixture,
      state.clubs,
      state.players,
      6016,
      state,
    );
    expect(second).toEqual(first);
  });

  it("produces identical authoritative metrics for the same one-season seed", () => {
    const first = collectCanonicalSimulationReport(1, "determinism-one", "full", true);
    const second = collectCanonicalSimulationReport(1, "determinism-one", "full", true);
    expect(canonicalProjection(second)).toEqual(canonicalProjection(first));
  }, 240_000);

  it("accepts different seeds when their canonical outputs differ", () => {
    const first = collectCanonicalSimulationReport(1, "determinism-seed-a", "full", true);
    const second = collectCanonicalSimulationReport(1, "determinism-seed-b", "full", true);
    expect(canonicalProjection(second)).not.toEqual(canonicalProjection(first));
  }, 240_000);
});

export function runOneSeasonDeterminismDiagnostic() {
  const diagnostics: Array<{
    run: "first" | "second";
    phase: string;
    elapsedMs: number;
    metrics?: Record<string, number>;
  }> = [];
  const run = (label: "first" | "second") => {
    const start = performance.now();
    const report = collectCanonicalSimulationReport(
      1,
      "determinism-diagnostic",
      "full",
      true,
      (diagnostic) => diagnostics.push({ run: label, ...diagnostic }),
    );
    diagnostics.push({
      run: label,
      phase: "canonical-report-complete",
      elapsedMs: performance.now() - start,
    });
    return report;
  };

  const first = run("first");
  const firstProjectionStart = performance.now();
  const firstProjection = canonicalProjection(first);
  diagnostics.push({
    run: "first",
    phase: "serialization-first",
    elapsedMs: performance.now() - firstProjectionStart,
    metrics: { bytes: JSON.stringify(firstProjection).length },
  });
  const second = run("second");
  const secondProjectionStart = performance.now();
  const secondProjection = canonicalProjection(second);
  diagnostics.push({
    run: "second",
    phase: "serialization-second",
    elapsedMs: performance.now() - secondProjectionStart,
    metrics: { bytes: JSON.stringify(secondProjection).length },
  });
  const comparisonStart = performance.now();
  const equal = JSON.stringify(secondProjection) === JSON.stringify(firstProjection);
  diagnostics.push({
    run: "second",
    phase: "comparison",
    elapsedMs: performance.now() - comparisonStart,
    metrics: { equal: equal ? 1 : 0 },
  });
  return { equal, diagnostics };
}
