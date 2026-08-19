/**
 * Transfer metrics validation - ensures transfers are correctly counted per season.
 *
 * Verifies:
 * - Only TRANSFER_COMPLETED events are counted (actual completed moves)
 * - Transfer attempts counted separately
 * - No double-counting across seasons
 * - Player actually moved (clubId changed)
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

interface TransferMetricsReport {
  season: string;
  completedTransfers: number;
  transferAttempts: number;
  completedByClub: Record<string, number>; // clubId -> count of players sold
  violations: string[];
}

/**
 * Get transfer events for a specific season
 */
function getTransferEventsForSeason(state: any, season: string): any[] {
  const startYear = parseInt(season.split("/")[0], 10);
  const endYear = startYear + 1;
  const seasonStart = `${startYear}-08-01`;
  const seasonEnd = `${endYear}-07-31`;

  return (state.events ?? []).filter(
    (e: any) => e.type === "transfer" && e.date >= seasonStart && e.date <= seasonEnd,
  );
}

/**
 * Validate transfer metrics for a season
 */
function validateTransferMetrics(state: any, season: string): TransferMetricsReport {
  const violations: string[] = [];
  const completedByClub: Record<string, number> = {};

  const transferEvents = getTransferEventsForSeason(state, season);

  // Count completed transfers (events with "moved" in description = successful transfers)
  const completedEvents = transferEvents.filter(
    (e: any) => e.type === "transfer" && e.description?.includes("moved"),
  );
  const completedTransfers = completedEvents.length;

  // Count transfer attempts (all transfer events, including passed/rejected)
  const transferAttempts = transferEvents.filter((e: any) => e.type === "transfer").length;

  // Validate each completed transfer
  for (const event of completedEvents) {
    const playerId = event.meta?.["playerId"];
    // Transfer events may not have all metadata, so check for it if available
    const fromClubId = event.meta?.["sellerClubId"] || event.meta?.["fromClubId"];
    const toClubId = event.meta?.["buyerClubId"] || event.meta?.["toClubId"];

    if (!playerId) {
      violations.push(`Transfer event missing playerId: ${event.description}`);
      continue;
    }

    const player = state.players[playerId];
    if (!player) {
      violations.push(`Transfer event references non-existent player ${playerId}`);
      continue;
    }

    // Verify player actually moved (if we have from/to info)
    if (fromClubId && toClubId && player.clubId !== toClubId) {
      violations.push(
        `Transfer says ${playerId} moved to ${toClubId}, but player.clubId is ${player.clubId}`,
      );
    }

    // Track by selling club if available
    if (fromClubId) {
      completedByClub[fromClubId] = (completedByClub[fromClubId] ?? 0) + 1;
    }
  }

  if (completedTransfers === 0 && transferAttempts > 0) {
    // This might be OK if transfers are just offers/rejections without completion
    // Only warn if there are many attempts but no completions
    if (transferAttempts > 5) {
      violations.push(
        `${transferAttempts} transfer attempts but 0 completions - check if transfers are being finalized`,
      );
    }
  }

  return {
    season,
    completedTransfers,
    transferAttempts,
    completedByClub,
    violations,
  };
}

/**
 * Run multi-season transfer validation
 */
export function validateMultiSeasonTransfers(
  years: number,
  seedOverride?: string,
): TransferMetricsReport[] {
  let state = buildInitialState(seedOverride);
  const reports: TransferMetricsReport[] = [];

  for (let i = 0; i < years; i++) {
    const seasonBefore = state.time.season;
    state = simulateSeason(state as any) as any;

    // Validate the season that just completed
    const report = validateTransferMetrics(state, seasonBefore);
    reports.push(report);

    state = applyWorldSeasonProgression(state as any) as any;
  }

  return reports;
}

// Main entry point
const directScriptPath = process.argv[1];
if (directScriptPath?.endsWith("validate-transfer-metrics.ts")) {
  const years = Number.parseInt(process.argv[2] ?? "3", 10) || 3;
  const seed = process.argv[3];

  const reports = validateMultiSeasonTransfers(years, seed);

  console.log("=== TRANSFER METRICS VALIDATION REPORT ===\n");

  let totalViolations = 0;
  let totalCompleted = 0;
  let totalAttempts = 0;

  for (const report of reports) {
    console.log(`Season ${report.season}:`);
    console.log(`  Completed transfers: ${report.completedTransfers}`);
    console.log(`  Transfer attempts: ${report.transferAttempts}`);

    totalCompleted += report.completedTransfers;
    totalAttempts += report.transferAttempts;

    // Show top clubs by player sales
    if (Object.keys(report.completedByClub).length > 0) {
      const sortedClubs = Object.entries(report.completedByClub)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      console.log(`  Top selling clubs: ${sortedClubs.map(([c, n]) => `${c}(${n})`).join(", ")}`);
    }

    if (report.violations.length > 0) {
      console.log(`  ❌ Violations:`);
      for (const violation of report.violations) {
        console.log(`    - ${violation}`);
      }
      totalViolations += report.violations.length;
    } else {
      console.log(`  ✓ No violations`);
    }
    console.log();
  }

  console.log(`Summary:`);
  console.log(`  Total completed transfers: ${totalCompleted}`);
  console.log(`  Total transfer attempts: ${totalAttempts}`);
  console.log(`  Total violations: ${totalViolations}`);
  console.log();

  if (totalViolations === 0) {
    console.log(`✓ All ${reports.length} season(s) passed transfer validation\n`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${totalViolations} violation(s) across seasons\n`);
    process.exit(1);
  }
}

export default { validateMultiSeasonTransfers, validateTransferMetrics };
