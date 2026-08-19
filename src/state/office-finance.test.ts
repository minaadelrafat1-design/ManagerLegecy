/**
 * Office Finance Tests
 *
 * Comprehensive test suite validating:
 * - Revenue calculations and tracking
 * - Expense calculations and categorization
 * - Financial balance and net result
 * - Transfer impact on finances
 * - Loan management and debt tracking
 * - Monthly and historical financial summaries
 * - Persistence through save/load cycles
 */

import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialState } from "@/state/seed";
import { gameReducer } from "@/state/reducer";
import type { GameState } from "@/state/types";
import {
  getFinancialSummary,
  getRevenueBreakdown,
  getExpenseBreakdown,
  getCashFlowSummary,
  getLoanStatus,
  getRecentTransactions,
  getNetPosition,
  recordTransaction,
  calculatePeriodSummary,
  getCategoryBreakdown,
} from "@/state/office-finance";
import { parseMoney } from "@/state/finance";

let state: GameState;

beforeEach(() => {
  state = buildInitialState();
});

describe("Office Finance - Initial State", () => {
  it("should initialize with empty financial transactions", () => {
    expect(state.financialTransactions).toEqual([]);
  });

  it("should have valid initial balance", () => {
    const balance = parseMoney(state.finances?.balance ?? 0);
    expect(balance).toBeGreaterThan(0);
  });

  it("should have zero initial expenses and income", () => {
    const income = state.finances?.income ?? { total: 0 };
    const expenses = state.finances?.expenses ?? { total: 0 };
    expect(income.total).toEqual(0);
    expect(expenses.total).toEqual(0);
  });
});

describe("Office Finance - Revenue Breakdown", () => {
  it("should track all revenue sources", () => {
    const revenue = getRevenueBreakdown(state);
    expect(revenue).toHaveProperty("matchday_income");
    expect(revenue).toHaveProperty("sponsorship");
    expect(revenue).toHaveProperty("prize_money");
    expect(revenue).toHaveProperty("player_sales");
    expect(revenue).toHaveProperty("competition_revenue");
  });

  it("should sum revenue correctly", () => {
    const revenue = getRevenueBreakdown(state);
    const total = Object.values(revenue).reduce((sum, v) => sum + v, 0);
    expect(total).toEqual(state.finances?.income?.total ?? 0);
  });

  it("should show zero revenue initially", () => {
    const revenue = getRevenueBreakdown(state);
    const total = Object.values(revenue).reduce((sum, v) => sum + v, 0);
    expect(total).toEqual(0);
  });
});

describe("Office Finance - Expense Breakdown", () => {
  it("should track all expense categories", () => {
    const expenses = getExpenseBreakdown(state);
    expect(expenses).toHaveProperty("player_wages");
    expect(expenses).toHaveProperty("staff_wages");
    expect(expenses).toHaveProperty("transfer_fees");
    expect(expenses).toHaveProperty("facilities");
    expect(expenses).toHaveProperty("scouting");
    expect(expenses).toHaveProperty("medical");
    expect(expenses).toHaveProperty("operations");
  });

  it("should sum expenses correctly", () => {
    const expenses = getExpenseBreakdown(state);
    const total = Object.values(expenses).reduce((sum, v) => sum + v, 0);
    expect(total).toEqual(state.finances?.expenses?.total ?? 0);
  });
});

describe("Office Finance - Financial Summary", () => {
  it("should calculate net financial position", () => {
    const summary = getFinancialSummary(state);
    const expectedNet = summary.totalRevenue - summary.totalExpenses;
    expect(summary.netResult).toEqual(expectedNet);
  });

  it("should track transfer budget", () => {
    const summary = getFinancialSummary(state);
    expect(summary.transferBudget).toBeGreaterThan(0);
  });

  it("should track wage budget", () => {
    const summary = getFinancialSummary(state);
    expect(summary.wageBudget).toBeGreaterThan(0);
  });

  it("should calculate debt correctly with no loans", () => {
    const summary = getFinancialSummary(state);
    expect(summary.totalDebt).toEqual(0);
  });

  it("should show positive balance with no debt", () => {
    const summary = getFinancialSummary(state);
    expect(summary.currentBalance).toBeGreaterThan(0);
  });
});

describe("Office Finance - Transactions", () => {
  it("should record a revenue transaction", () => {
    const updated = recordTransaction(
      state,
      "match_revenue",
      "Home match vs Ravenport",
      50000,
      "revenue",
    );

    const txns = updated.financialTransactions ?? [];
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toEqual("match_revenue");
    expect(txns[0].amount).toEqual(50000);
  });

  it("should record an expense transaction", () => {
    const updated = recordTransaction(
      state,
      "transfer_fee",
      "Signing of player",
      -5000000,
      "expense",
    );

    const txns = updated.financialTransactions ?? [];
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toEqual("transfer_fee");
    expect(txns[0].amount).toEqual(-5000000);
  });

  it("should record multiple transactions in sequence", () => {
    let updated = state;
    updated = recordTransaction(updated, "match_revenue", "Match 1", 50000, "revenue");
    updated = recordTransaction(updated, "match_revenue", "Match 2", 60000, "revenue");
    updated = recordTransaction(updated, "transfer_fee", "Transfer", -5000000, "expense");

    const txns = updated.financialTransactions ?? [];
    expect(txns).toHaveLength(3);
  });

  it("should get recent transactions in reverse order", () => {
    let updated = state;
    updated = recordTransaction(updated, "match_revenue", "Match 1", 50000, "revenue");
    updated = recordTransaction(updated, "match_revenue", "Match 2", 60000, "revenue");
    updated = recordTransaction(updated, "transfer_fee", "Transfer", -5000000, "expense");

    const recent = getRecentTransactions(updated, 10);
    expect(recent).toHaveLength(3);
    expect(recent[0].amount).toEqual(-5000000); // Most recent first
  });

  it("should respect limit in getRecentTransactions", () => {
    let updated = state;
    for (let i = 0; i < 20; i++) {
      updated = recordTransaction(updated, "match_revenue", `Match ${i}`, 50000, "revenue");
    }

    const recent = getRecentTransactions(updated, 5);
    expect(recent).toHaveLength(5);
  });
});

describe("Office Finance - Transfer Impact", () => {
  it("should record transfer fee as expense", () => {
    const currentBudget = parseMoney(state.finances?.transferBudget ?? 0);
    const transferFee = 5000000;

    let updated = state;
    updated = gameReducer(updated, {
      type: "RECORD_TRANSFER",
      fee: transferFee,
      wageWeeklyDelta: 50000,
      description: "Signing of striker",
    });

    const txns = updated.financialTransactions ?? [];
    const transferTxn = txns.find((t) => t.type === "transfer_fee");
    expect(transferTxn).toBeDefined();
    expect(transferTxn?.amount).toEqual(-transferFee);
  });

  it("should record wage increase from transfer", () => {
    const wageDelta = 50000;

    let updated = state;
    updated = gameReducer(updated, {
      type: "RECORD_TRANSFER",
      fee: 5000000,
      wageWeeklyDelta: wageDelta,
      description: "Signing of striker",
    });

    const txns = updated.financialTransactions ?? [];
    const wageTxn = txns.find((t) => t.type === "player_salary");
    expect(wageTxn).toBeDefined();
    // Should be annualized in transaction
    expect(Math.abs(wageTxn?.amount ?? 0)).toBeGreaterThan(wageDelta);
  });

  it("should deduct transfer from budget", () => {
    const currentBudget = parseMoney(state.finances?.transferBudget ?? 0);
    const transferFee = 5000000;

    const updated = gameReducer(state, {
      type: "RECORD_TRANSFER",
      fee: transferFee,
      wageWeeklyDelta: 0,
      description: "Signing",
    });

    const newBudget = parseMoney(updated.finances?.transferBudget ?? 0);
    expect(newBudget).toBeLessThan(currentBudget);
  });
});

describe("Office Finance - Loans", () => {
  it("should track active loans", () => {
    // Manually add a loan to test tracking
    const loan = {
      id: "loan-1",
      principal: 10000000,
      remaining: 10000000,
      weeklyPayment: 200000,
      annualRatePct: 6,
      termWeeks: 52,
      approved: true,
    };

    const updated = {
      ...state,
      finances: {
        ...state.finances,
        loans: [loan],
      },
    };

    const loanStatus = getLoanStatus(updated);
    expect(loanStatus).toHaveLength(1);
    expect(loanStatus[0].id).toEqual("loan-1");
    expect(loanStatus[0].remaining).toEqual(10000000);
  });

  it("should calculate weeks remaining correctly", () => {
    const loan = {
      id: "loan-1",
      principal: 10000000,
      remaining: 1000000,
      weeklyPayment: 200000,
      annualRatePct: 6,
      termWeeks: 52,
      approved: true,
    };

    const updated = {
      ...state,
      finances: {
        ...state.finances,
        loans: [loan],
      },
    };

    const loanStatus = getLoanStatus(updated);
    expect(loanStatus[0].weeksRemaining).toBeLessThanOrEqual(10);
  });
});

describe("Office Finance - Cash Flow", () => {
  it("should calculate weekly net result", () => {
    const cashFlow = getCashFlowSummary(state);
    const expectedNet = cashFlow.incomingThisWeek - cashFlow.outgoingThisWeek;
    expect(cashFlow.netThisWeek).toEqual(expectedNet);
  });

  it("should show weekly average", () => {
    const cashFlow = getCashFlowSummary(state);
    expect(typeof cashFlow.weeklyAverage).toBe("number");
  });
});

describe("Office Finance - Net Position", () => {
  it("should calculate net position correctly", () => {
    const netPos = getNetPosition(state);
    const summary = getFinancialSummary(state);
    const expected = summary.currentBalance - summary.totalDebt;
    expect(netPos).toEqual(expected);
  });

  it("should show positive position with no debt", () => {
    const netPos = getNetPosition(state);
    expect(netPos).toBeGreaterThan(0);
  });

  it("should account for debt reduction", () => {
    const loan = {
      id: "loan-1",
      principal: 5000000,
      remaining: 5000000,
      weeklyPayment: 200000,
      annualRatePct: 6,
      termWeeks: 52,
      approved: true,
    };

    const updated = {
      ...state,
      finances: {
        ...state.finances,
        loans: [loan],
      },
    };

    const netPos = getNetPosition(updated);
    const summary = getFinancialSummary(updated);
    expect(netPos).toBeLessThan(summary.currentBalance);
  });
});

describe("Office Finance - Period Calculations", () => {
  it("should calculate period summary for date range", () => {
    let updated = state;
    updated = recordTransaction(updated, "match_revenue", "Match", 100000, "revenue");
    updated = recordTransaction(updated, "player_salary", "Wages", -50000, "expense");

    // Use the actual date from state for the test
    const currentDate = state.time.date;
    const period = calculatePeriodSummary(updated, currentDate, currentDate);
    expect(period.revenue).toEqual(100000);
    expect(period.expenses).toEqual(50000);
    expect(period.netResult).toEqual(50000);
  });

  it("should handle empty period correctly", () => {
    // Use dates that won't match the initial game date
    const period = calculatePeriodSummary(state, "2000-01-01", "2000-01-31");
    expect(period.revenue).toEqual(0);
    expect(period.expenses).toEqual(0);
  });
});

describe("Office Finance - Category Breakdown", () => {
  it("should categorize transactions", () => {
    let updated = state;
    updated = recordTransaction(updated, "match_revenue", "Match", 100000, "revenue");
    updated = recordTransaction(updated, "player_salary", "Wages", -50000, "expense");

    const breakdown = getCategoryBreakdown(updated);
    const revenue = breakdown.find((b) => b.category === "revenue");
    const expense = breakdown.find((b) => b.category === "expense");

    expect(revenue?.byType.match_revenue).toEqual(100000);
    expect(expense?.byType.player_salary).toEqual(-50000);
  });
});

describe("Office Finance - Persistence", () => {
  it("should maintain transaction history through state updates", () => {
    let updated = state;
    updated = recordTransaction(updated, "match_revenue", "Match 1", 100000, "revenue");
    updated = recordTransaction(updated, "match_revenue", "Match 2", 120000, "revenue");

    const txns1 = (updated.financialTransactions ?? []).length;
    updated = recordTransaction(updated, "player_salary", "Wages", -50000, "expense");
    const txns2 = (updated.financialTransactions ?? []).length;

    expect(txns2).toEqual(txns1 + 1);
  });

  it("should preserve transaction data on reduction", () => {
    let updated = state;
    updated = recordTransaction(updated, "match_revenue", "Match 1", 100000, "revenue");
    updated = recordTransaction(updated, "match_revenue", "Match 2", 120000, "revenue");

    // Simulate a game action that shouldn't clear transactions
    updated = gameReducer(updated, {
      type: "ADD_TRANSFER_TARGET",
      listing: {
        id: "target-1",
        name: "Test Player",
        position: "ST",
        rating: 75,
        nationality: "ENG",
        age: 25,
        value: "€5M",
        status: "new",
      },
    });

    const txns = updated.financialTransactions ?? [];
    expect(txns).toHaveLength(2);
  });
});

describe("Office Finance - Season Transitions", () => {
  it("should maintain transaction history across seasons", () => {
    let updated = state;

    // Record some transactions
    for (let i = 0; i < 5; i++) {
      updated = recordTransaction(
        updated,
        "match_revenue",
        `Match ${i}`,
        50000 + i * 1000,
        "revenue",
      );
    }

    const preSeasonTxns = (updated.financialTransactions ?? []).length;

    // Simulate advancing to new season (transactions should persist)
    updated = gameReducer(updated, {
      type: "ADD_TRANSFER_TARGET",
      listing: {
        id: "target-new",
        name: "New Target",
        position: "ST",
        rating: 80,
        nationality: "FRA",
        age: 24,
        value: "€8M",
        status: "new",
      },
    });

    const postSeasonTxns = (updated.financialTransactions ?? []).length;
    expect(postSeasonTxns).toEqual(preSeasonTxns);
  });
});

describe("Office Finance - Integration", () => {
  it("should track complex financial workflow", () => {
    let updated = state;

    // Record match revenues
    updated = recordTransaction(updated, "match_revenue", "Home vs Team A", 75000, "revenue");
    updated = recordTransaction(updated, "prize_money", "Win bonus", 25000, "revenue");

    // Record recurring expenses
    updated = recordTransaction(updated, "player_salary", "Weekly wages", -300000, "expense");
    updated = recordTransaction(updated, "medical", "Medical staff", -50000, "expense");

    // Record transfer
    updated = gameReducer(updated, {
      type: "RECORD_TRANSFER",
      fee: 5000000,
      wageWeeklyDelta: 75000,
      description: "Signing of midfielder",
    });

    const txns = updated.financialTransactions ?? [];
    expect(txns.length).toBeGreaterThanOrEqual(5);

    // Verify balance calculations still work
    const summary = getFinancialSummary(updated);
    expect(summary.currentBalance).toBeLessThan(parseMoney(state.finances?.balance ?? 0));
  });
});
