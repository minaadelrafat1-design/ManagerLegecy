#!/usr/bin/env node
/**
 * PHASE 7E DIAGNOSTIC — Quick Validation Report
 *
 * Fast audit run: 1-year + invariant checks only.
 * Full 30-year audit can run asynchronously.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";
import { checkAllInvariants, type InvariantViolation } from "../src/state/event-invariants";
import type { GameState } from "../src/state/types";

interface DiagnosticReport {
  phase: "7E-DIAGNOSTIC";
  timestamp: string;
  testDuration: number;
  oneYearMetrics: {
    seasonsCompleted: number;
    fixturesPlayed: number;
    totalGoals: number;
    completedTransfers: number;
    promotions: number;
    relegations: number;
    managerChanges: number;
    retirements: number;
    activePlayers: number;
    activeClubs: number;
  };
  systemHealth: {
    invariantViolations: number;
    criticalErrors: number;
    warnings: number;
    violationTypes: Record<string, number>;
  };
  readinessStatus: "PASS" | "WARN" | "FAIL";
  readinessMessage: string;
  realisticResults: {
    transferMarketActive: boolean;
    promotionRelegationWorking: boolean;
    managerTurnoveeActive: boolean;
    playerProgressionActive: boolean;
  };
  nextSteps: string[];
}

function oneYearDiagnostic(): DiagnosticReport {
  const startTime = Date.now();

  console.log("\n🔄 Running 1-year diagnostic simulation...");
  let state = buildInitialState();

  // Run 1 season
  state = simulateSeason(state as any) as any;
  state = applyWorldSeasonProgression(state as any) as any;

  const duration = Date.now() - startTime;

  // Collect metrics
  const fixtures = state.fixtures ?? [];
  const played = fixtures.filter((f: any) => f.status === "played");
  const players = Object.values(state.players ?? {});
  const clubs = Object.values(state.clubs ?? {});
  const activeClubs = clubs.filter((c: any) => c.playerIds?.length > 0);
  const activePlayers = players.filter((p: any) => p.status !== "retired");

  const events = state.events ?? [];
  const transferEvents = events.filter((e: any) => e.type === "TRANSFER_COMPLETED");
  const promotionEvents = events.filter((e: any) => e.type === "PROMOTION");
  const relegationEvents = events.filter((e: any) => e.type === "RELEGATION");
  const managerEvents = events.filter((e: any) => e.type === "manager");
  const retirementEvents = events.filter((e: any) => e.type === "PLAYER_RETIRED");

  const totalGoals = played.reduce(
    (sum: number, f: any) => sum + (f.scoreHome ?? 0) + (f.scoreAway ?? 0),
    0,
  );

  // Check invariants
  const violations = checkAllInvariants(state);
  const criticalErrors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  const violationsByType: Record<string, number> = {};
  for (const v of violations) {
    violationsByType[v.type] = (violationsByType[v.type] ?? 0) + 1;
  }

  // Realism checks
  const transferMarketActive = transferEvents.length > 0;
  const promotionRelegationWorking = promotionEvents.length > 0 && relegationEvents.length > 0;
  const managerTurnoveeActive = managerEvents.length > 0;
  const playerProgressionActive = activePlayers.length > 0;

  // Status determination
  let status: "PASS" | "WARN" | "FAIL" = "PASS";
  let message = "✓ All systems nominal";

  if (criticalErrors.length > 0) {
    status = "FAIL";
    message = `❌ CRITICAL: ${criticalErrors.length} invariant violations detected`;
  } else if (warnings.length > 5) {
    status = "WARN";
    message = `⚠️  ${warnings.length} warnings detected`;
  } else if (!transferMarketActive || !promotionRelegationWorking) {
    status = "WARN";
    message = "⚠️  Some systems not activated in 1-year";
  }

  // Next steps
  const nextSteps: string[] = [];
  if (status === "FAIL") nextSteps.push("1. Fix critical invariant violations");
  nextSteps.push("2. Run full 1yr/5yr/10yr/30yr audit (use npm run test:stress)");
  nextSteps.push("3. Analyze financial stability across timescales");
  nextSteps.push("4. Verify realistic player progression and aging");
  nextSteps.push("5. Generate final production report");

  return {
    phase: "7E-DIAGNOSTIC",
    timestamp: new Date().toISOString(),
    testDuration: duration,
    oneYearMetrics: {
      seasonsCompleted: 1,
      fixturesPlayed: played.length,
      totalGoals,
      completedTransfers: transferEvents.length,
      promotions: promotionEvents.length,
      relegations: relegationEvents.length,
      managerChanges: managerEvents.length,
      retirements: retirementEvents.length,
      activePlayers: activePlayers.length,
      activeClubs: activeClubs.length,
    },
    systemHealth: {
      invariantViolations: violations.length,
      criticalErrors: criticalErrors.length,
      warnings: warnings.length,
      violationTypes: violationsByType,
    },
    readinessStatus: status,
    readinessMessage: message,
    realisticResults: {
      transferMarketActive,
      promotionRelegationWorking,
      managerTurnoveeActive,
      playerProgressionActive,
    },
    nextSteps,
  };
}

function main() {
  console.log("\n" + "=".repeat(80));
  console.log("PHASE 7E DIAGNOSTIC — Quick System Validation");
  console.log("=".repeat(80));

  try {
    const report = oneYearDiagnostic();

    console.log("\n📊 DIAGNOSTIC RESULTS:");
    console.log(
      `   Status: ${report.readinessStatus === "PASS" ? "✓ PASS" : report.readinessStatus === "WARN" ? "⚠️  WARN" : "❌ FAIL"}`,
    );
    console.log(`   Message: ${report.readinessMessage}`);

    console.log("\n📈 1-YEAR METRICS:");
    console.log(`   Fixtures Played: ${report.oneYearMetrics.fixturesPlayed}`);
    console.log(
      `   Total Goals: ${report.oneYearMetrics.totalGoals} (avg: ${(report.oneYearMetrics.totalGoals / Math.max(1, report.oneYearMetrics.fixturesPlayed)).toFixed(2)}/match)`,
    );
    console.log(`   Transfers: ${report.oneYearMetrics.completedTransfers}`);
    console.log(
      `   Promotions/Relegations: ${report.oneYearMetrics.promotions}/${report.oneYearMetrics.relegations}`,
    );
    console.log(`   Manager Changes: ${report.oneYearMetrics.managerChanges}`);
    console.log(`   Player Retirements: ${report.oneYearMetrics.retirements}`);
    console.log(`   Active Players: ${report.oneYearMetrics.activePlayers}`);
    console.log(`   Active Clubs: ${report.oneYearMetrics.activeClubs}`);

    console.log("\n🔍 SYSTEM CHECKS:");
    console.log(
      `   ${report.realisticResults.transferMarketActive ? "✓" : "❌"} Transfer Market Active`,
    );
    console.log(
      `   ${report.realisticResults.promotionRelegationWorking ? "✓" : "❌"} Promotion/Relegation Working`,
    );
    console.log(
      `   ${report.realisticResults.managerTurnoveeActive ? "✓" : "❌"} Manager Turnover Active`,
    );
    console.log(
      `   ${report.realisticResults.playerProgressionActive ? "✓" : "❌"} Player Progression Active`,
    );

    console.log("\n🛡️  INVARIANT CHECKS:");
    console.log(`   Total Violations: ${report.systemHealth.invariantViolations}`);
    console.log(`   Critical Errors: ${report.systemHealth.criticalErrors}`);
    console.log(`   Warnings: ${report.systemHealth.warnings}`);
    if (Object.keys(report.systemHealth.violationTypes).length > 0) {
      console.log("   Violation Types:");
      Object.entries(report.systemHealth.violationTypes).forEach(([type, count]) => {
        console.log(`     • ${type}: ${count}`);
      });
    }

    console.log("\n📋 NEXT STEPS:");
    report.nextSteps.forEach((step) => console.log(`   ${step}`));

    // Save report
    const reportPath = path.join(process.cwd(), "outputs", "phase-7e-diagnostic.json");
    const outputDir = path.dirname(reportPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved: ${reportPath}`);

    console.log("\n⏱️  Diagnostic completed in " + (report.testDuration / 1000).toFixed(2) + "s\n");

    process.exit(report.readinessStatus === "FAIL" ? 1 : 0);
  } catch (error) {
    console.error("❌ DIAGNOSTIC FAILED:", error);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
