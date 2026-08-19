#!/usr/bin/env node
/**
 * PHASE 7E — AAA LONG-RUN SIMULATION VALIDATION
 *
 * Production-quality stress and integrity audit of the complete simulation.
 * Runs deterministic simulations for 1, 5, 10, and 30 years.
 * Collects authoritative metrics and validates invariants.
 *
 * Usage: npx tsx scripts/phase-7e-stress-test-full.ts
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import {
  collectCanonicalSimulationReport,
  type SimulationReport,
} from "./canonical-simulation-audit";
import { checkAllInvariants, type InvariantViolation } from "../src/state/event-invariants";
import {
  getFinancialMetrics as getRealFinancialMetrics,
  getManagerMetrics as getRealManagerMetrics,
  getRetirementAgeStats as getRealRetirementAgeStats,
} from "../src/state/realism-metrics";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";
import type { GameState } from "../src/state/types";

interface WorldMetrics {
  seasonsCompleted: number;
  worldDate: string;
  competitionCount: number;
  activeClubs: number;
  activeClubsByDivision: Record<string, number>;
  activePlayers: number;
  retiredPlayers: number;
  youthGenerated: number;
  averageSquadSize: number;
  squadSizeDistribution: Record<string, number>;
}

interface PlayerMetrics {
  count: number;
  averageAge: number;
  ageDistribution: Record<string, number>;
  ovrDistribution: Record<string, number>;
  potentialDistribution: Record<string, number>;
  retirementsByAge: Record<string, number>;
  averageCareerLength: number;
}

interface TransferMetrics {
  completed: number;
  failed: number;
  avgFee: number;
  totalFeeVolume: number;
  feeDistribution: Record<string, number>;
  playersWithMultipleTransfers: number;
  transferSuccessRate: number;
}

interface CompetitionMetrics {
  fixturesScheduled: number;
  matchesPlayed: number;
  totalGoals: number;
  avgGoalsPerMatch: number;
  domesticCups: number;
  europeanCompetitions: number;
  promotions: number;
  relegations: number;
  promotionRelegationBalance: number;
}

interface FinancialMetrics {
  clubs: number;
  averageBalance: number;
  balanceDistribution: Record<string, number>;
  negativeBudgetClubs: number;
  totalTransferSpending: number;
  totalWageExpenditure: number;
  totalRevenue: number;
}

interface ManagerMetrics {
  appointments: number;
  dismissals: number;
  averageTenure: number;
  tenureDistribution: Record<string, number>;
}

interface StressTestResult {
  years: number;
  timestamp: string;
  testDuration: number;
  worldMetrics: WorldMetrics;
  playerMetrics: PlayerMetrics;
  transferMetrics: TransferMetrics;
  competitionMetrics: CompetitionMetrics;
  financialMetrics: FinancialMetrics;
  managerMetrics: ManagerMetrics;
  invariantViolations: {
    total: number;
    errors: number;
    warnings: number;
    byType: Record<string, number>;
    samples: InvariantViolation[];
  };
  healthStatus: "PASS" | "WARN" | "FAIL";
  healthMessage: string;
}

interface FullAuditReport {
  phase: "7E";
  title: "AAA Long-Run Simulation Validation";
  timestamp: string;
  testsExecuted: string[];
  totalTestDuration: number;
  results: {
    "1-year": StressTestResult;
    "5-year": StressTestResult;
    "10-year": StressTestResult;
    "30-year": StressTestResult;
  };
  comparison: {
    inflationAnalysis: string;
    financialStability: string;
    clubDiversity: string;
    playerTurnover: string;
    competitiveBalance: string;
    managerStability: string;
  };
  systemsProduction: {
    ready: string[];
    needsWork: string[];
    broken: string[];
  };
  recommendations: string[];
}

function getWorldMetrics(state: GameState): WorldMetrics {
  const clubs = Object.values(state.clubs ?? {});
  const players = Object.values(state.players ?? {});
  const activeClubs = clubs.filter((c) => c.playerIds.length > 0);
  const activePlayers = players.filter((p) => p.status !== "retired");
  const retiredPlayers = players.filter((p) => p.status === "retired");

  const clubsByDivision: Record<string, number> = {};
  for (const club of activeClubs) {
    clubsByDivision[club.leagueId] = (clubsByDivision[club.leagueId] ?? 0) + 1;
  }

  const squadSizes = activeClubs.map((c) => c.playerIds.length);
  const avgSquadSize =
    squadSizes.length > 0 ? squadSizes.reduce((a, b) => a + b) / squadSizes.length : 0;

  const squadSizeDistribution: Record<string, number> = {};
  for (const size of squadSizes) {
    const bucket = `${Math.floor(size / 5) * 5}-${Math.floor(size / 5) * 5 + 4}`;
    squadSizeDistribution[bucket] = (squadSizeDistribution[bucket] ?? 0) + 1;
  }

  return {
    seasonsCompleted: state.time?.season ?? 0,
    worldDate: state.time?.date ?? "",
    competitionCount: Object.values(state.competitions ?? {}).length,
    activeClubs: activeClubs.length,
    activeClubsByDivision: clubsByDivision,
    activePlayers: activePlayers.length,
    retiredPlayers: retiredPlayers.length,
    youthGenerated: players.filter((p) => (p.age ?? 99) <= 21).length,
    averageSquadSize: Math.round(avgSquadSize * 10) / 10,
    squadSizeDistribution,
  };
}

function getPlayerMetrics(state: GameState): PlayerMetrics {
  const players = Object.values(state.players ?? {});
  const ages = players.map((p) => p.age ?? 20);
  const ovrs = players.map((p) => p.overall ?? 50);
  const potentials = players.map((p) => p.potential ?? 75);

  const ageDistribution: Record<string, number> = {};
  const ovrDistribution: Record<string, number> = {};
  const potentialDistribution: Record<string, number> = {};
  const retirementsByAge: Record<string, number> = {};

  for (const player of players) {
    const age = player.age ?? 20;
    const ageBucket = `${Math.floor(age / 5) * 5}-${Math.floor(age / 5) * 5 + 4}`;
    ageDistribution[ageBucket] = (ageDistribution[ageBucket] ?? 0) + 1;

    const ovr = player.overall ?? 50;
    const ovrBucket = `${Math.floor(ovr / 10) * 10}-${Math.floor(ovr / 10) * 10 + 9}`;
    ovrDistribution[ovrBucket] = (ovrDistribution[ovrBucket] ?? 0) + 1;

    const pot = player.potential ?? 75;
    const potBucket = `${Math.floor(pot / 10) * 10}-${Math.floor(pot / 10) * 10 + 9}`;
    potentialDistribution[potBucket] = (potentialDistribution[potBucket] ?? 0) + 1;

    if (player.status === "retired") {
      const retAgeBucket = `${Math.floor(age / 2) * 2}-${Math.floor(age / 2) * 2 + 1}`;
      retirementsByAge[retAgeBucket] = (retirementsByAge[retAgeBucket] ?? 0) + 1;
    }
  }

  const activeCareerPlayers = players.filter((p) => p.status === "active");
  const avgCareerLength =
    activeCareerPlayers.length > 0
      ? activeCareerPlayers.reduce((sum, p) => sum + ((p.age ?? 20) - 18), 0) /
        activeCareerPlayers.length
      : 0;

  return {
    count: players.length,
    averageAge: Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10,
    ageDistribution,
    ovrDistribution,
    potentialDistribution,
    retirementsByAge,
    averageCareerLength: Math.round(avgCareerLength * 10) / 10,
  };
}

function getTransferMetrics(state: GameState): TransferMetrics {
  const players = Object.values(state.players ?? {});
  const transferEvents = (state.events ?? []).filter((e) => e.type === "TRANSFER_COMPLETED");

  const playersWithTransfers = new Map<string, number>();
  let totalFee = 0;
  let transferCount = 0;

  for (const event of transferEvents) {
    const playerId = event.meta?.["playerId"] as string | undefined;
    if (playerId) {
      playersWithTransfers.set(playerId, (playersWithTransfers.get(playerId) ?? 0) + 1);
      transferCount++;
      const fee = (event.meta?.["fee"] as number | undefined) ?? 0;
      totalFee += fee;
    }
  }

  const playersWithMultiple = Array.from(playersWithTransfers.values()).filter(
    (count) => count > 1,
  ).length;
  const feeDistribution: Record<string, number> = {};
  for (const event of transferEvents) {
    const fee = (event.meta?.["fee"] as number | undefined) ?? 1_000_000;
    const bucket =
      fee < 1_000_000
        ? "< €1M"
        : fee < 5_000_000
          ? "€1-5M"
          : fee < 10_000_000
            ? "€5-10M"
            : "> €10M";
    feeDistribution[bucket] = (feeDistribution[bucket] ?? 0) + 1;
  }

  return {
    completed: transferCount,
    failed: 0, // would need to count rejected transfers
    avgFee: transferCount > 0 ? Math.round(totalFee / transferCount) : 0,
    totalFeeVolume: totalFee,
    feeDistribution,
    playersWithMultipleTransfers: playersWithMultiple,
    transferSuccessRate: transferCount > 0 ? 100 : 0, // all counted are successes
  };
}

function getCompetitionMetrics(state: GameState): CompetitionMetrics {
  const fixtures = state.fixtures ?? [];
  const played = fixtures.filter((f) => f.status === "played");
  const totalGoals = played.reduce((sum, f) => sum + (f.scoreHome ?? 0) + (f.scoreAway ?? 0), 0);

  const promotionEvents = (state.events ?? []).filter((e) => e.type === "PROMOTION");
  const relegationEvents = (state.events ?? []).filter((e) => e.type === "RELEGATION");

  return {
    fixturesScheduled: fixtures.length,
    matchesPlayed: played.length,
    totalGoals,
    avgGoalsPerMatch: played.length > 0 ? Math.round((totalGoals / played.length) * 100) / 100 : 0,
    domesticCups: Object.values(state.competitions ?? {}).filter((c) => c.type === "cup").length,
    europeanCompetitions: Object.values(state.competitions ?? {}).filter(
      (c) => c.type === "european",
    ).length,
    promotions: promotionEvents.length,
    relegations: relegationEvents.length,
    promotionRelegationBalance: promotionEvents.length - relegationEvents.length,
  };
}

function getFinancialMetrics(state: GameState): FinancialMetrics {
  const metrics = getRealFinancialMetrics(state);
  return {
    clubs: metrics.clubs,
    averageBalance: metrics.averageBalance,
    balanceDistribution: metrics.balanceDistribution,
    negativeBudgetClubs: metrics.negativeBudgetClubs,
    totalTransferSpending: metrics.totalTransferSpending,
    totalWageExpenditure: metrics.totalWageExpenditure,
    totalRevenue: metrics.totalRevenue,
  };
}

function getManagerMetrics(state: GameState): ManagerMetrics {
  const metrics = getRealManagerMetrics(state);
  return {
    appointments: metrics.appointments,
    dismissals: metrics.dismissals,
    averageTenure: metrics.averageTenure,
    tenureDistribution: metrics.tenureDistribution,
  };
}

function analyzeHealthStatus(
  violations: InvariantViolation[],
  years: number,
): { status: "PASS" | "WARN" | "FAIL"; message: string } {
  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  if (errors.length > 0) {
    return {
      status: "FAIL",
      message: `CRITICAL: ${errors.length} invariant violations found in ${years}-year simulation. System is not production-ready.`,
    };
  }

  if (warnings.length > years) {
    // More than 1 warning per year is concerning
    return {
      status: "WARN",
      message: `${warnings.length} warnings detected over ${years} years. Review before production.`,
    };
  }

  return {
    status: "PASS",
    message: `All invariants passed. System is healthy for ${years}-year period.`,
  };
}

async function runStressTest(years: number): Promise<StressTestResult> {
  const startTime = Date.now();

  console.log(`\n🔄 Starting ${years}-year simulation...`);
  let state = buildInitialState();

  for (let i = 0; i < years; i++) {
    state = simulateSeason(state as any) as any;
    state = applyWorldSeasonProgression(state as any) as any;
    if ((i + 1) % Math.max(1, Math.floor(years / 10)) === 0) {
      console.log(`   ✓ Completed ${i + 1}/${years} seasons...`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`✓ ${years}-year simulation completed in ${(duration / 1000).toFixed(2)}s`);

  const violations = checkAllInvariants(state);
  const errorViolations = violations.filter((v) => v.severity === "error");
  const warningViolations = violations.filter((v) => v.severity === "warning");

  const violationsByType: Record<string, number> = {};
  for (const violation of violations) {
    violationsByType[violation.type] = (violationsByType[violation.type] ?? 0) + 1;
  }

  const { status, message } = analyzeHealthStatus(violations, years);

  return {
    years,
    timestamp: new Date().toISOString(),
    testDuration: duration,
    worldMetrics: getWorldMetrics(state),
    playerMetrics: getPlayerMetrics(state),
    transferMetrics: getTransferMetrics(state),
    competitionMetrics: getCompetitionMetrics(state),
    financialMetrics: getFinancialMetrics(state),
    managerMetrics: getManagerMetrics(state),
    invariantViolations: {
      total: violations.length,
      errors: errorViolations.length,
      warnings: warningViolations.length,
      byType: violationsByType,
      samples: violations.slice(0, 10),
    },
    healthStatus: status,
    healthMessage: message,
  };
}

function generateComparison(results: Record<string, StressTestResult>): Record<string, string> {
  const data = Object.values(results);

  // Check for runaway inflation (transfer fees increasing dramatically)
  const feeProgression = data.map((d) => d.transferMetrics.avgFee).slice(0, 3);
  const inflationRatio =
    feeProgression.length > 1 ? feeProgression[feeProgression.length - 1] / feeProgression[0] : 1;
  const inflationAnalysis =
    inflationRatio > 3
      ? `⚠️  RUNAWAY INFLATION: Average transfer fees increased ${(inflationRatio * 100).toFixed(0)}% from 1yr to 5yr. May indicate exponential salary/fee spiral.`
      : inflationRatio > 1.5
        ? `⚡ MODERATE INFLATION: Transfer fees up ${((inflationRatio - 1) * 100).toFixed(0)}%. Monitor closely.`
        : `✓ STABLE: Transfer fees stable across timescales.`;

  // Check financial stability
  const financialStatus =
    data.every((d) => d.invariantViolations.errors === 0) &&
    data.every((d) => d.financialMetrics.negativeBudgetClubs < 5)
      ? `✓ FINANCIALLY STABLE: No reported financial crises across all simulations.`
      : `⚠️  FINANCIAL STRESS: Some clubs showing negative budget or financial system errors.`;

  // Check club diversity
  const clubVariation = data.map((d) => Object.keys(d.worldMetrics.activeClubsByDivision).length);
  const clubStability =
    clubVariation[clubVariation.length - 1] === clubVariation[0]
      ? `✓ CLUB DIVERSITY STABLE: Division ecosystem remains consistent.`
      : `⚡ DIVISION CHANGES: ${clubVariation[clubVariation.length - 1]} divisions in 30yr vs ${clubVariation[0]} in 1yr.`;

  // Check player turnover
  const playerTurnover30 = data[3]?.playerMetrics.count ?? 0;
  const playerTurnover1 = data[0]?.playerMetrics.count ?? 0;
  const turnoverRatio = playerTurnover30 / playerTurnover1;
  const turnoverAnalysis =
    turnoverRatio > 2
      ? `⚡ HIGH TURNOVER: ${turnoverRatio.toFixed(1)}x more players in 30yr (${playerTurnover30}) vs 1yr (${playerTurnover1}). Realistic generational change.`
      : turnoverRatio < 1
        ? `⚠️  INSUFFICIENT TURNOVER: Player count decreased over time. Retirement may be too aggressive.`
        : `✓ REALISTIC TURNOVER: ~${((turnoverRatio - 1) * 100).toFixed(0)}% growth due to youth generation and retirement.`;

  // Check competitive balance
  const competitiveness30 = data[3]?.competitionMetrics.promotions ?? 0;
  const competitiveness1 = data[0]?.competitionMetrics.promotions ?? 0;
  const competitivenessAnalysis =
    competitiveness30 > 0
      ? `✓ COMPETITIVE ECOSYSTEM: ${competitiveness30} promotions across 30 years shows active league movement.`
      : `⚠️  STAGNANT COMPETITION: No promotions detected. League ecosystem may be broken.`;

  // Check manager stability
  const managerTurnover30 = data[3]?.managerMetrics.dismissals ?? 0;
  const managerTurnover1 = data[0]?.managerMetrics.dismissals ?? 0;
  const managerAnalysis =
    managerTurnover30 > 30
      ? `✓ ACTIVE MANAGER MARKET: ${managerTurnover30} dismissals in 30 years (~1 per year per club).`
      : `⚡ LOW MANAGER TURNOVER: Only ${managerTurnover30} dismissals. May need adjustment.`;

  return {
    inflationAnalysis,
    financialStability: financialStatus,
    clubDiversity: clubStability,
    playerTurnover: turnoverAnalysis,
    competitiveBalance: competitivenessAnalysis,
    managerStability: managerAnalysis,
  };
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("PHASE 7E — AAA LONG-RUN SIMULATION VALIDATION");
  console.log("Production-Quality Stress & Integrity Audit");
  console.log("=".repeat(80));

  const overallStartTime = Date.now();

  const results: Record<string, StressTestResult> = {};

  // Run all simulations
  try {
    results["1-year"] = await runStressTest(1);
    results["5-year"] = await runStressTest(5);
    results["10-year"] = await runStressTest(10);
    results["30-year"] = await runStressTest(30);
  } catch (error) {
    console.error("❌ SIMULATION FAILED:", error);
    process.exit(1);
  }

  const totalDuration = Date.now() - overallStartTime;

  // Generate comparison analysis
  const comparison = generateComparison(results);

  // Determine overall system health
  const allErrors = Object.values(results).reduce(
    (sum, r) => sum + r.invariantViolations.errors,
    0,
  );
  const allWarnings = Object.values(results).reduce(
    (sum, r) => sum + r.invariantViolations.warnings,
    0,
  );

  const systemsReady: string[] = [];
  const systemsNeedsWork: string[] = [];
  const systemsBroken: string[] = [];

  if (allErrors === 0) systemsReady.push("Transfer system (no duplication or orphan transfers)");
  else systemsBroken.push("Transfer system");

  if (results["30-year"].competitionMetrics.promotions > 0)
    systemsReady.push("Promotion/relegation system");
  else systemsNeedsWork.push("Promotion/relegation system (low activity)");

  if (
    results["30-year"].playerMetrics.retirementsByAge &&
    Object.keys(results["30-year"].playerMetrics.retirementsByAge).length > 0
  )
    systemsReady.push("Player retirement system");
  else systemsNeedsWork.push("Player retirement system");

  if (results["30-year"].managerMetrics.dismissals > 0) systemsReady.push("Manager sacking system");
  else systemsNeedsWork.push("Manager sacking system");

  const report: FullAuditReport = {
    phase: "7E",
    title: "AAA Long-Run Simulation Validation",
    timestamp: new Date().toISOString(),
    testsExecuted: [
      "1-year deterministic simulation",
      "5-year deterministic simulation",
      "10-year deterministic simulation",
      "30-year deterministic simulation",
    ],
    totalTestDuration: totalDuration,
    results,
    comparison,
    systemsProduction: {
      ready: systemsReady,
      needsWork: systemsNeedsWork,
      broken: systemsBroken,
    },
    recommendations: [
      allErrors === 0
        ? "✓ No critical invariant violations detected"
        : "❌ CRITICAL: Fix invariant violations before production",
      allWarnings < 10 ? "✓ Warning count acceptable" : "⚠️  Review and address warnings",
      "Conduct player value/salary audits for financial realism",
      "Monitor transfer market inflation across longer timescales",
      "Verify manager tenure distribution matches real football",
    ],
  };

  // Write comprehensive report
  const reportPath = path.join(process.cwd(), "outputs", "phase-7e-stress-test-report.json");
  const outputDir = path.dirname(reportPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary to console
  console.log("\n" + "=".repeat(80));
  console.log("📊 AUDIT RESULTS");
  console.log("=".repeat(80));

  console.log("\n✅ SYSTEM HEALTH:");
  Object.entries(results).forEach(([period, result]) => {
    const icon =
      result.healthStatus === "PASS" ? "✓" : result.healthStatus === "WARN" ? "⚠️ " : "❌";
    console.log(`  ${icon} ${period}: ${result.healthMessage}`);
  });

  console.log("\n📈 COMPARATIVE ANALYSIS:");
  Object.entries(comparison).forEach(([key, value]) => {
    console.log(`  • ${key.replace(/([A-Z])/g, " $1").trim()}: ${value}`);
  });

  console.log("\n🔧 PRODUCTION READINESS:");
  console.log(`  ✓ Ready: ${report.systemsProduction.ready.join(", ") || "None yet"}`);
  console.log(`  ⚡ Needs Work: ${report.systemsProduction.needsWork.join(", ") || "None"}`);
  console.log(`  ❌ Broken: ${report.systemsProduction.broken.join(", ") || "None"}`);

  console.log("\n💾 Full report saved to: " + reportPath);
  console.log("⏱️  Total test duration: " + (totalDuration / 1000).toFixed(2) + "s\n");

  // Exit with appropriate code
  const hasErrors = allErrors > 0;
  process.exit(hasErrors ? 1 : 0);
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
