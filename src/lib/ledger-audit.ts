/**
 * Ledger Integrity Audit
 *
 * Validates that AI club ledgers accurately reflect actual wage commitments
 * and budget allocations. Detects mismatches early before they compound.
 */

import type { GameState } from "../state/types";

export interface LedgerAuditIssue {
  clubId: string;
  clubName: string;
  issueType: "wage-mismatch" | "balance-mismatch" | "budget-overcommit";
  severity: "warning" | "critical";
  actual: number;
  ledgered: number;
  variance: number;
  variancePercent: number;
  message: string;
}

export interface LedgerAuditReport {
  timestamp: string;
  auditDate: string;
  totalClubs: number;
  clubsAudited: number;
  issuesFound: number;
  issues: LedgerAuditIssue[];
  summary: string;
}

/**
 * Sum actual player wage commitments for a club from the player roster.
 * Returns weekly wage total.
 */
function sumPlayerWagesForClub(state: GameState, clubId: string): number {
  const club = state.clubs[clubId];
  if (!club) return 0;

  return club.playerIds.reduce((total: number, playerId: string) => {
    const player = state.players[playerId];
    if (!player || player.status === "retired") return total;
    const salary = (player as any).salary ?? "€0";
    return total + Number(String(salary).replace(/[^\d.-]/g, "")) || 0;
  }, 0);
}

/**
 * Audit all AI club ledgers against actual roster commitments.
 * Returns detailed report of any mismatches found.
 */
export function auditTransferLedgers(state: GameState): LedgerAuditReport {
  const issues: LedgerAuditIssue[] = [];
  const ledgers = state.meta?.aiLedgers ?? {};
  const clubs = Object.values(state.clubs);

  for (const club of clubs) {
    if (!club) continue;
    // Skip if no ledger (managed club may not have one)
    if (!ledgers[club.id]) continue;

    const ledger = ledgers[club.id];
    if (!ledger) continue;

    const actualWages = sumPlayerWagesForClub(state, club.id);
    const ledgeredWages = ledger.currentWageCommitment ?? 0;

    // Check wage mismatch (allow 10% variance for rounding/timing)
    const wageVariance = ledgeredWages - actualWages;
    const wageVariancePercent = actualWages > 0 ? (Math.abs(wageVariance) / actualWages) * 100 : 0;

    if (wageVariancePercent > 10) {
      const severity = wageVariancePercent > 25 ? "critical" : "warning";
      issues.push({
        clubId: club.id,
        clubName: club.name,
        issueType: "wage-mismatch",
        severity,
        actual: actualWages,
        ledgered: ledgeredWages,
        variance: wageVariance,
        variancePercent: wageVariancePercent,
        message: `Ledger reports €${ledgeredWages.toFixed(0)}/week wages but roster only commits €${actualWages.toFixed(0)}/week (${wageVariancePercent.toFixed(1)}% variance)`,
      });
    }

    // Transfer budget is a planning ceiling derived from projected revenue,
    // not a literal cash balance. We only flag an issue when the planned spend
    // is materially above both the club's liquid balance and its near-term
    // wage security buffer.
    const wageBudgetWeekly = ledger.wageBudgetWeekly ?? 0;
    const balance = ledger.balance ?? 0;
    const liquidityBuffer = Math.max(0, balance - wageBudgetWeekly * 8);
    const transferBudget = ledger.transferBudget ?? 0;
    const cannotAffordCashSpend = balance < 0 && transferBudget > 0;
    const unrealisticBudget =
      transferBudget > balance + Math.max(2_500_000, wageBudgetWeekly * 12) && liquidityBuffer <= 0;

    if (cannotAffordCashSpend || unrealisticBudget) {
      issues.push({
        clubId: club.id,
        clubName: club.name,
        issueType: "budget-overcommit",
        severity: "warning",
        actual: Math.max(0, liquidityBuffer),
        ledgered: transferBudget,
        variance: transferBudget - Math.max(0, liquidityBuffer),
        variancePercent:
          ((transferBudget - Math.max(0, liquidityBuffer)) /
            Math.max(1, Math.max(0, liquidityBuffer))) *
          100,
        message: `Transfer budget €${transferBudget.toFixed(0)} exceeds the club's liquid planning buffer (€${Math.max(0, liquidityBuffer).toFixed(0)})`,
      });
    }
  }

  const report: LedgerAuditReport = {
    timestamp: new Date().toISOString(),
    auditDate: state.time.date,
    totalClubs: clubs.length,
    clubsAudited: Object.keys(ledgers).length,
    issuesFound: issues.length,
    issues,
    summary:
      issues.length === 0
        ? `✅ All ${Object.keys(ledgers).length} ledgers match actual commitments`
        : `⚠️  Found ${issues.length} ledger mismatches (${issues.filter((i) => i.severity === "critical").length} critical)`,
  };

  return report;
}

/**
 * Get a club's ledger health status (for UI/monitoring).
 */
export function getLedgerHealthStatus(
  state: GameState,
  clubId: string,
): {
  status: "healthy" | "caution" | "critical";
  wagesCovered: number;
  balanceBuffer: number;
  budgetUtilization: number;
  message: string;
} {
  const ledger = state.meta?.aiLedgers?.[clubId];
  const club = state.clubs[clubId];

  if (!ledger || !club) {
    return {
      status: "healthy",
      wagesCovered: 100,
      balanceBuffer: 0,
      budgetUtilization: 0,
      message: "No ledger data",
    };
  }

  const actualWages = club.playerIds.reduce((total: number, pid: string) => {
    const p = state.players[pid];
    if (!p || p.status === "retired") return total;
    const salary = (p as any).salary ?? "€0";
    return total + (Number(String(salary).replace(/[^\d.-]/g, "")) || 0);
  }, 0);

  const currentWageCommitment = ledger.currentWageCommitment ?? 0;
  const wagesCovered = actualWages > 0 ? (currentWageCommitment / actualWages) * 100 : 100;
  const balance = ledger.balance ?? 0;
  const wageBudgetWeekly = ledger.wageBudgetWeekly ?? 0;
  const balanceBuffer = Math.max(0, balance - currentWageCommitment * 4);
  const transferBudget = ledger.transferBudget ?? 0;
  const budgetUtilization =
    transferBudget > 0 ? ((transferBudget - balanceBuffer) / transferBudget) * 100 : 0;

  let status: "healthy" | "caution" | "critical" = "healthy";
  if (wagesCovered < 85 || balanceBuffer < 0) status = "critical";
  else if (wagesCovered < 95 || budgetUtilization > 80) status = "caution";

  return {
    status,
    wagesCovered: Math.round(wagesCovered),
    balanceBuffer,
    budgetUtilization: Math.round(budgetUtilization),
    message:
      status === "critical"
        ? "⚠️ CRITICAL: Ledger misaligned or balance depleted"
        : status === "caution"
          ? "⚠️ CAUTION: Ledger approaching limits"
          : "✅ Ledger healthy",
  };
}

export {};
