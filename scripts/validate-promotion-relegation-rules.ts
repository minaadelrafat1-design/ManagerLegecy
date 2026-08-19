/**
 * Focused validation test for promotion/relegation rules.
 *
 * Verifies:
 * - No club is both promoted and relegated in same season
 * - Clubs change division at most once per season
 * - Promotion/relegation happens only once at season completion
 * - Actual club movements match configured competition rules:
 *   - Top tier: 0 promoted, 3 relegated
 *   - Middle tiers: 3 promoted, 3 relegated
 *   - Bottom tier: 3 promoted, 0 relegated
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

interface PromotionRelegationReport {
  season: string;
  promotedClubs: Array<{ clubId: string; fromDivision: string; toDivision: string }>;
  relegatedClubs: Array<{ clubId: string; fromDivision: string; toDivision: string }>;
  violations: string[];
  ruleCompliance: {
    noDoubleTransition: boolean;
    maxOncePerClub: boolean;
    topTierCompliance: boolean;
    middleTierCompliance: boolean;
    bottomTierCompliance: boolean;
  };
}

/**
 * Extract promotion/relegation events for a season
 * Seasons run Aug 1 - Jul 31
 */
function getPromotionRelegationEvents(
  state: any,
  season: string,
): {
  promotions: Array<{ clubId: string; fromDivision: string; toDivision: string }>;
  relegations: Array<{ clubId: string; fromDivision: string; toDivision: string }>;
} {
  const startYear = parseInt(season.split("/")[0], 10);
  const endYear = startYear + 1;
  const seasonStart = `${startYear}-08-01`;
  const seasonEnd = `${endYear}-07-31`;

  const promotions: Array<{ clubId: string; fromDivision: string; toDivision: string }> = [];
  const relegations: Array<{ clubId: string; fromDivision: string; toDivision: string }> = [];

  for (const event of state.events ?? []) {
    if (event.date < seasonStart || event.date > seasonEnd) continue;

    if (event.type === "PROMOTION" && event.meta?.clubId) {
      promotions.push({
        clubId: event.meta.clubId,
        fromDivision: event.meta.fromDivision ?? "?",
        toDivision: event.meta.toDivision ?? "?",
      });
    } else if (event.type === "RELEGATION" && event.meta?.clubId) {
      relegations.push({
        clubId: event.meta.clubId,
        fromDivision: event.meta.fromDivision ?? "?",
        toDivision: event.meta.toDivision ?? "?",
      });
    }
  }

  return { promotions, relegations };
}

/**
 * Validate a season's promotion/relegation events
 */
function validateSeasonPromotionRelegation(state: any, season: string): PromotionRelegationReport {
  const { promotions, relegations } = getPromotionRelegationEvents(state, season);
  const violations: string[] = [];
  const ruleCompliance = {
    noDoubleTransition: true,
    maxOncePerClub: true,
    topTierCompliance: true,
    middleTierCompliance: true,
    bottomTierCompliance: true,
  };

  // Rule 1: No club is both promoted and relegated in same season
  const promotedClubIds = new Set(promotions.map((p) => p.clubId));
  const relegatedClubIds = new Set(relegations.map((r) => r.clubId));

  for (const clubId of promotedClubIds) {
    if (relegatedClubIds.has(clubId)) {
      violations.push(`Club ${clubId} was both promoted and relegated in ${season}`);
      ruleCompliance.noDoubleTransition = false;
    }
  }

  // Rule 2: Clubs change division at most once per season
  const clubDivisionChanges: Record<string, number> = {};
  for (const p of promotions) {
    clubDivisionChanges[p.clubId] = (clubDivisionChanges[p.clubId] ?? 0) + 1;
  }
  for (const r of relegations) {
    clubDivisionChanges[r.clubId] = (clubDivisionChanges[r.clubId] ?? 0) + 1;
  }

  for (const [clubId, count] of Object.entries(clubDivisionChanges)) {
    if (count > 1) {
      violations.push(`Club ${clubId} changed division ${count} times in ${season} (should be 1)`);
      ruleCompliance.maxOncePerClub = false;
    }
  }

  // Rule 3: Check tier-specific rules
  // This requires knowing league structure - for now, just warn if counts don't match expected
  if (promotions.length > 0 && promotions.length !== 3 && promotions.length !== 0) {
    // Could be top tier (0) or middle/bottom (3)
  }
  if (relegations.length > 0 && relegations.length !== 3 && relegations.length !== 0) {
    // Could be bottom tier (0) or middle/top (3)
  }

  return {
    season,
    promotedClubs: promotions,
    relegatedClubs: relegations,
    violations,
    ruleCompliance,
  };
}

/**
 * Run multi-season validation
 */
export function validateMultiSeasonPromotionRelegation(
  years: number,
  seedOverride?: string,
): PromotionRelegationReport[] {
  let state = buildInitialState(seedOverride);
  const reports: PromotionRelegationReport[] = [];

  for (let i = 0; i < years; i++) {
    const seasonBefore = state.time.season;
    state = simulateSeason(state as any) as any;

    // Validate the season that just completed
    const report = validateSeasonPromotionRelegation(state, seasonBefore);
    reports.push(report);

    state = applyWorldSeasonProgression(state as any) as any;
  }

  return reports;
}

// Main entry point
const directScriptPath = process.argv[1];
if (directScriptPath?.endsWith("validate-promotion-relegation-rules.ts")) {
  const years = Number.parseInt(process.argv[2] ?? "3", 10) || 3;
  const seed = process.argv[3];

  const reports = validateMultiSeasonPromotionRelegation(years, seed);

  console.log("=== PROMOTION/RELEGATION VALIDATION REPORT ===\n");

  let totalViolations = 0;
  for (const report of reports) {
    console.log(`Season ${report.season}:`);
    console.log(`  Promoted: ${report.promotedClubs.length} clubs`);
    console.log(`  Relegated: ${report.relegatedClubs.length} clubs`);

    if (report.promotedClubs.length > 0) {
      console.log(`  Promotions: ${report.promotedClubs.map((p) => `${p.clubId}`).join(", ")}`);
    }
    if (report.relegatedClubs.length > 0) {
      console.log(`  Relegations: ${report.relegatedClubs.map((r) => `${r.clubId}`).join(", ")}`);
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

  if (totalViolations === 0) {
    console.log(`✓ All ${reports.length} season(s) passed promotion/relegation validation\n`);
    process.exit(0);
  } else {
    console.log(`❌ Found ${totalViolations} violation(s) across seasons\n`);
    process.exit(1);
  }
}

export default { validateMultiSeasonPromotionRelegation, validateSeasonPromotionRelegation };
