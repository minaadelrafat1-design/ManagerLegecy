import { performance } from "node:perf_hooks";
import { collectCanonicalSimulationReport } from "./canonical-simulation-audit";

const diagnostics: Array<Record<string, unknown>> = [];

function run(label: "first" | "second") {
  const runStart = performance.now();
  console.log(`[${label}] START`);
  const report = collectCanonicalSimulationReport(1, "step-2c1-diagnostic", "full", true, (item) => {
    const record = { run: label, ...item };
    diagnostics.push(record);
    console.log(JSON.stringify(record));
  });
  const result = { run: label, phase: "canonical-report-complete", elapsedMs: performance.now() - runStart };
  diagnostics.push(result);
  console.log(JSON.stringify(result));
  console.log(JSON.stringify({ run: label, report: {
    seasonsCompleted: report.seasonsCompleted,
    daysAdvanced: report.daysAdvanced,
    fixturesGenerated: report.fixturesScheduled,
    matchesCompleted: report.matchesPlayed,
    goals: report.goals,
    invariants: report.invariantViolations,
  }}));
  return report;
}

const first = run("first");
const firstSerializationStart = performance.now();
const firstSerialized = JSON.stringify(first);
console.log(JSON.stringify({ run: "first", phase: "report-serialization", elapsedMs: performance.now() - firstSerializationStart, metrics: { bytes: firstSerialized.length } }));

const second = run("second");
const secondSerializationStart = performance.now();
const secondSerialized = JSON.stringify(second);
console.log(JSON.stringify({ run: "second", phase: "report-serialization", elapsedMs: performance.now() - secondSerializationStart, metrics: { bytes: secondSerialized.length } }));

const comparisonStart = performance.now();
const equal = firstSerialized === secondSerialized;
console.log(JSON.stringify({ phase: "comparison", elapsedMs: performance.now() - comparisonStart, equal }));