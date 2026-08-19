/**
 * Office Finance Module
 *
 * Comprehensive financial overview system for the manager's office.
 * Tracks all revenue, expenses, and financial events for historical analysis.
 * All values originate from existing game economy systems.
 */

import type { GameState, FinancialTransaction, FinancialTransactionType } from "./types";
import { formatMoney, parseMoney } from "./finance";
import { deterministicId } from "./utils";

export interface FinancialSummary {
  currentBalance: number;
  totalRevenue: number;
  totalExpenses: number;
  netResult: number;
  transferBudget: number;
  wageBudget: number;
  totalDebt: number;
}

export interface FinancialPeriod {
  startDate: string;
  endDate: string;
  revenue: number;
  expenses: number;
  netResult: number;
}

export interface CategoryBreakdown {
  category: "revenue" | "expense" | "debt";
  byType: Record<FinancialTransactionType, number>;
}

/**
 * Generate unique transaction ID
 */
export function generateTransactionId(state: GameState, type: FinancialTransactionType): string {
  return deterministicId(
    "txn",
    `${state.gameSeed ?? "0"}:${state.time.date}:${type}`,
    state.financialTransactions?.length ?? 0,
  );
}

/**
 * Record a financial transaction in the ledger
 */
export function recordTransaction(
  state: GameState,
  type: FinancialTransactionType,
  description: string,
  amount: number,
  category: "revenue" | "expense" | "debt",
  relatedEntityId?: string,
): GameState {
  const transaction: FinancialTransaction = {
    id: generateTransactionId(state, type),
    date: state.time.date,
    type,
    description,
    amount,
    category,
    ...(relatedEntityId && { relatedEntityId }),
  };

  return {
    ...state,
    financialTransactions: [...(state.financialTransactions ?? []), transaction],
  };
}

/**
 * Get current financial summary for office display
 */
export function getFinancialSummary(state: GameState): FinancialSummary {
  const balance = parseMoney(state.finances?.balance ?? 0);
  const income = state.finances?.income ?? {
    matchRevenue: 0,
    sponsorship: 0,
    prizeMoney: 0,
    playerSales: 0,
    competitionRevenue: 0,
    total: 0,
  };
  const expenses = state.finances?.expenses ?? {
    playerSalaries: 0,
    staff: 0,
    transfers: 0,
    facilities: 0,
    scouting: 0,
    medical: 0,
    operations: 0,
    total: 0,
  };
  const transferBudget = parseMoney(state.finances?.transferBudget ?? 0);
  const wageBudget = parseMoney(state.finances?.wageBudget ?? 0);
  const loans = state.finances?.loans ?? [];
  const totalDebt = loans.reduce((sum, loan) => sum + Math.max(0, loan.remaining), 0);

  return {
    currentBalance: balance,
    totalRevenue: income.total,
    totalExpenses: expenses.total,
    netResult: income.total - expenses.total,
    transferBudget,
    wageBudget,
    totalDebt,
  };
}

/**
 * Get revenue breakdown from current snapshot
 */
export function getRevenueBreakdown(state: GameState): Record<string, number> {
  const income = state.finances?.income ?? {
    matchRevenue: 0,
    sponsorship: 0,
    prizeMoney: 0,
    playerSales: 0,
    competitionRevenue: 0,
    total: 0,
  };

  return {
    matchday_income: income.matchRevenue,
    sponsorship: income.sponsorship,
    prize_money: income.prizeMoney,
    player_sales: income.playerSales,
    competition_revenue: income.competitionRevenue,
  };
}

/**
 * Get expense breakdown from current snapshot
 */
export function getExpenseBreakdown(state: GameState): Record<string, number> {
  const expenses = state.finances?.expenses ?? {
    playerSalaries: 0,
    staff: 0,
    transfers: 0,
    facilities: 0,
    scouting: 0,
    medical: 0,
    operations: 0,
    total: 0,
  };

  return {
    player_wages: expenses.playerSalaries,
    staff_wages: expenses.staff,
    transfer_fees: expenses.transfers,
    facilities: expenses.facilities,
    scouting: expenses.scouting,
    medical: expenses.medical,
    operations: expenses.operations,
  };
}

/**
 * Filter transactions by period (date range)
 */
export function getTransactionsByPeriod(
  state: GameState,
  startDate: string,
  endDate: string,
): FinancialTransaction[] {
  return (state.financialTransactions ?? []).filter((txn) => {
    return txn.date >= startDate && txn.date <= endDate;
  });
}

/**
 * Calculate financial period summary
 */
export function calculatePeriodSummary(
  state: GameState,
  startDate: string,
  endDate: string,
): FinancialPeriod {
  const transactions = getTransactionsByPeriod(state, startDate, endDate);

  const revenue = transactions
    .filter((txn) => txn.category === "revenue")
    .reduce((sum, txn) => sum + txn.amount, 0);

  const expenses = Math.abs(
    transactions
      .filter((txn) => txn.category === "expense")
      .reduce((sum, txn) => sum + txn.amount, 0),
  );

  return {
    startDate,
    endDate,
    revenue,
    expenses,
    netResult: revenue - expenses,
  };
}

/**
 * Get recent transactions (limit to N most recent)
 */
export function getRecentTransactions(
  state: GameState,
  limit: number = 20,
): FinancialTransaction[] {
  const transactions = state.financialTransactions ?? [];
  return transactions.slice(-limit).reverse();
}

/**
 * Get category breakdown of all transactions
 */
export function getCategoryBreakdown(state: GameState): CategoryBreakdown[] {
  const transactions = state.financialTransactions ?? [];

  // Initialize all transaction types
  const types: FinancialTransactionType[] = [
    "match_revenue",
    "sponsorship",
    "prize_money",
    "competition_revenue",
    "player_salary",
    "staff_wages",
    "transfer_fee",
    "transfer_sell",
    "facilities",
    "scouting",
    "medical",
    "operations",
    "loan_payment",
    "loan_interest",
    "loan_received",
  ];

  const createEmptyBreakdown = () => {
    return Object.fromEntries(types.map((type) => [type, 0])) as Record<
      FinancialTransactionType,
      number
    >;
  };

  const breakdown: Record<
    "revenue" | "expense" | "debt",
    Record<FinancialTransactionType, number>
  > = {
    revenue: createEmptyBreakdown(),
    expense: createEmptyBreakdown(),
    debt: createEmptyBreakdown(),
  };

  // Aggregate transactions
  for (const txn of transactions) {
    breakdown[txn.category][txn.type] = (breakdown[txn.category][txn.type] ?? 0) + txn.amount;
  }

  return Object.entries(breakdown).map(([category, byType]) => ({
    category: category as "revenue" | "expense" | "debt",
    byType: byType as Record<FinancialTransactionType, number>,
  }));
}

/**
 * Get weekly spending trend (last N weeks)
 */
export function getWeeklySpendingTrend(state: GameState, weeks: number = 10): FinancialPeriod[] {
  const transactions = state.financialTransactions ?? [];
  if (transactions.length === 0) return [];

  // Group transactions by week (assuming date is YYYY-MM-DD format)
  const weekGroups: Record<string, FinancialTransaction[]> = {};

  for (const txn of transactions) {
    const date = new Date(txn.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split("T")[0] ?? txn.date;

    if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
    weekGroups[weekKey]?.push(txn);
  }

  // Calculate summaries for each week
  const weeks_ = Object.entries(weekGroups)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-weeks)
    .map(([weekStart, txns]) => {
      const revenue = txns
        .filter((t) => t.category === "revenue")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = Math.abs(
        txns.filter((t) => t.category === "expense").reduce((sum, t) => sum + t.amount, 0),
      );

      // Calculate week end date
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const endDateStr =
        end.toISOString().split("T")[0] ?? start.toISOString().split("T")[0] ?? weekStart;

      return {
        startDate: weekStart,
        endDate: endDateStr,
        revenue,
        expenses,
        netResult: revenue - expenses,
      };
    });

  return weeks_;
}

/**
 * Get monthly financial summary (assuming 4 weeks per month)
 */
export function getMonthlyFinancials(state: GameState): FinancialPeriod[] {
  const transactions = state.financialTransactions ?? [];
  if (transactions.length === 0) return [];

  // Group by month
  const monthGroups: Record<string, FinancialTransaction[]> = {};

  for (const txn of transactions) {
    const date = txn.date.substring(0, 7); // YYYY-MM
    if (!monthGroups[date]) monthGroups[date] = [];
    monthGroups[date].push(txn);
  }

  return Object.entries(monthGroups)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, txns]) => {
      const revenue = txns
        .filter((t) => t.category === "revenue")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = Math.abs(
        txns.filter((t) => t.category === "expense").reduce((sum, t) => sum + t.amount, 0),
      );

      return {
        startDate: `${month}-01`,
        endDate: month, // simplified
        revenue,
        expenses,
        netResult: revenue - expenses,
      };
    });
}

/**
 * Get all loans and their current status
 */
export function getLoanStatus(state: GameState) {
  const loans = state.finances?.loans ?? [];
  return loans.map((loan) => ({
    id: loan.id,
    originalPrincipal: loan.principal,
    remaining: loan.remaining,
    weeklyPayment: loan.weeklyPayment,
    annualRate: loan.annualRatePct,
    termWeeks: loan.termWeeks,
    startDate: loan.startedAt,
    approved: loan.approved,
    weeksRemaining: Math.ceil(loan.remaining / loan.weeklyPayment),
  }));
}

/**
 * Calculate cash flow summary: incoming vs outgoing
 */
export function getCashFlowSummary(state: GameState): {
  incomingThisWeek: number;
  outgoingThisWeek: number;
  netThisWeek: number;
  weeklyAverage: number;
} {
  const income = state.finances?.income ?? { total: 0 };
  const expenses = state.finances?.expenses ?? { total: 0 };

  const incomingThisWeek = income.total;
  const outgoingThisWeek = expenses.total;
  const netThisWeek = incomingThisWeek - outgoingThisWeek;

  // Calculate average over last 10 weeks
  const weekly = getWeeklySpendingTrend(state, 10);
  const weeklyAverage =
    weekly.length > 0 ? weekly.reduce((sum, w) => sum + w.netResult, 0) / weekly.length : 0;

  return {
    incomingThisWeek,
    outgoingThisWeek,
    netThisWeek,
    weeklyAverage,
  };
}

/**
 * Get formatted financial overview
 */
export function getFormattedFinancialOverview(state: GameState) {
  const summary = getFinancialSummary(state);
  const revenue = getRevenueBreakdown(state);
  const expenses = getExpenseBreakdown(state);
  const cashFlow = getCashFlowSummary(state);
  const loans = getLoanStatus(state);

  return {
    summary: {
      balance: formatMoney(summary.currentBalance),
      balanceRaw: summary.currentBalance,
      totalRevenue: formatMoney(summary.totalRevenue),
      totalExpenses: formatMoney(summary.totalExpenses),
      netResult: formatMoney(summary.netResult),
      netResultRaw: summary.netResult,
      transferBudget: formatMoney(summary.transferBudget),
      wageBudget: formatMoney(summary.wageBudget),
      totalDebt: formatMoney(summary.totalDebt),
      totalDebtRaw: summary.totalDebt,
    },
    revenue: Object.fromEntries(Object.entries(revenue).map(([k, v]) => [k, formatMoney(v)])),
    expenses: Object.fromEntries(Object.entries(expenses).map(([k, v]) => [k, formatMoney(v)])),
    cashFlow: {
      incomingThisWeek: formatMoney(cashFlow.incomingThisWeek),
      outgoingThisWeek: formatMoney(cashFlow.outgoingThisWeek),
      netThisWeek: formatMoney(cashFlow.netThisWeek),
      weeklyAverage: formatMoney(cashFlow.weeklyAverage),
    },
    loans,
  };
}

/**
 * Get transactions filtered by type
 */
export function getTransactionsByType(
  state: GameState,
  type: FinancialTransactionType,
): FinancialTransaction[] {
  return (state.financialTransactions ?? []).filter((txn) => txn.type === type);
}

/**
 * Get net financial position: balance - debt
 */
export function getNetPosition(state: GameState): number {
  const summary = getFinancialSummary(state);
  return summary.currentBalance - summary.totalDebt;
}
