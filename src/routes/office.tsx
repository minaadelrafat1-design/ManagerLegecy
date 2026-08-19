/**
 * Office - Manager's Financial Overview
 *
 * Complete financial dashboard showing revenue, expenses, balance, and
 * historical trends. All numbers originate from actual game economy.
 */

import { useGameState } from "@/state/store";
import { Link } from "@tanstack/react-router";
import {
  getFinancialSummary,
  getRevenueBreakdown,
  getExpenseBreakdown,
  getCashFlowSummary,
  getLoanStatus,
  getRecentTransactions,
  getMonthlyFinancials,
  getFormattedFinancialOverview,
  getNetPosition,
} from "@/state/office-finance";
import {
  getEnhancedRevenueBreakdown,
  calculateAllEnhancedRevenuePerWeek,
} from "@/state/enhanced-revenue";
import { formatMoney, parseMoney } from "@/state/finance";
import {
  Colors,
  Spacing,
  Borders,
  Transitions,
  Typography,
  Shadows,
} from "@/components/design-system";
import { useState } from "react";
import { TMod } from "@/components/ui-modern";

type TabId =
  | "summary"
  | "revenue"
  | "expenses"
  | "history"
  | "loans"
  | "merchandise"
  | "broadcasting"
  | "partnerships"
  | "youth";

export function Office() {
  const { state } = useGameState();
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  const summary = getFinancialSummary(state);
  const revenue = getRevenueBreakdown(state);
  const expenses = getExpenseBreakdown(state);
  const cashFlow = getCashFlowSummary(state);
  const loans = getLoanStatus(state);
  const recentTxns = getRecentTransactions(state, 15);
  const monthly = getMonthlyFinancials(state);
  const netPosition = getNetPosition(state);

  const healthStatus =
    summary.currentBalance > summary.totalDebt * 2
      ? "healthy"
      : summary.currentBalance > 0
        ? "caution"
        : "critical";

  const healthColor =
    healthStatus === "healthy"
      ? TMod.accentCyan
      : healthStatus === "caution"
        ? TMod.accentGold
        : TMod.accentRed;

  return (
    <div
      style={{
        background: TMod.bgPrimary,
        minHeight: "100vh",
        padding: Spacing.lg,
        fontFamily: Typography.family.body,
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: Spacing.sm,
            marginBottom: Spacing.md,
          }}
        >
          <Link
            to="/training"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: Spacing.sm,
              padding: `${Spacing.sm} ${Spacing.md}`,
              borderRadius: Borders.radius.md,
              border: `1px solid ${Colors.border.default}`,
              background: Colors.bg.elevation1,
              color: Colors.text.primary,
              textDecoration: "none",
              fontSize: Typography.small,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            🎯 Training Ground
          </Link>
          <Link
            to="/stadium"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: Spacing.sm,
              padding: `${Spacing.sm} ${Spacing.md}`,
              borderRadius: Borders.radius.md,
              border: `1px solid ${Colors.border.default}`,
              background: Colors.bg.elevation1,
              color: Colors.text.primary,
              textDecoration: "none",
              fontSize: Typography.small,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            🏟 Stadium & Facilities
          </Link>
        </div>

        {/* Header */}
        <div
          style={{
            marginBottom: Spacing.xl,
          }}
        >
          <h1
            style={{
              fontSize: Typography.scale.xl.size,
              color: TMod.textPrimary,
              margin: 0,
              marginBottom: Spacing.sm,
            }}
          >
            📊 Office
          </h1>
          <p
            style={{
              color: TMod.textSecondary,
              fontSize: Typography.body,
              margin: 0,
            }}
          >
            Financial oversight and detailed club economy analysis
          </p>
        </div>

        {/* Key Metrics Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: Spacing.md,
            marginBottom: Spacing.xl,
          }}
        >
          {/* Current Balance */}
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderMid}`,
              borderRadius: Borders.radius.md,
              padding: Spacing.md,
              boxShadow: Shadows.md,
            }}
          >
            <div
              style={{
                fontSize: Typography.small,
                color: TMod.textSecondary,
                marginBottom: Spacing.xs,
              }}
            >
              Current Balance
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: healthColor,
              }}
            >
              {formatMoney(summary.currentBalance)}
            </div>
            <div
              style={{
                fontSize: Typography.small,
                color: TMod.textSecondary,
                marginTop: Spacing.xs,
              }}
            >
              Health: {healthStatus.toUpperCase()}
            </div>
          </div>

          {/* Net Position */}
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderMid}`,
              borderRadius: Borders.radius.md,
              padding: Spacing.md,
              boxShadow: Shadows.md,
            }}
          >
            <div
              style={{
                fontSize: Typography.small,
                color: TMod.textSecondary,
                marginBottom: Spacing.xs,
              }}
            >
              Net Position
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: netPosition >= 0 ? TMod.accentCyan : TMod.accentRed,
              }}
            >
              {formatMoney(netPosition)}
            </div>
            <div
              style={{
                fontSize: Typography.small,
                color: TMod.textSecondary,
                marginTop: Spacing.xs,
              }}
            >
              Balance - Debt
            </div>
          </div>

          {/* Weekly Net */}
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderMid}`,
              borderRadius: Borders.radius.md,
              padding: Spacing.md,
              boxShadow: Shadows.md,
            }}
          >
            <div
              style={{
                fontSize: Typography.small,
                color: TMod.textSecondary,
                marginBottom: Spacing.xs,
              }}
            >
              Weekly Net Result
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color:
                  cashFlow.netThisWeek >= 0
                    ? TMod.accentCyan
                    : cashFlow.netThisWeek > -500000
                      ? TMod.accentGold
                      : TMod.accentRed,
              }}
            >
              {formatMoney(cashFlow.netThisWeek)}
            </div>
            <div
              style={{
                fontSize: Typography.small,
                color: TMod.textSecondary,
                marginTop: Spacing.xs,
              }}
            >
              Avg: {formatMoney(cashFlow.weeklyAverage)}
            </div>
          </div>

          {/* Transfer Budget */}
          <div
            style={{
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderMid}`,
              borderRadius: Borders.radius.md,
              padding: Spacing.md,
              boxShadow: Shadows.md,
            }}
          >
            <div
              style={{
                fontSize: Typography.small,
                color: Colors.textSecondary,
                marginBottom: Spacing.xs,
              }}
            >
              Transfer Budget
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#45B7D1",
              }}
            >
              {formatMoney(summary.transferBudget)}
            </div>
            <div
              style={{
                fontSize: Typography.small,
                color: Colors.textSecondary,
                marginTop: Spacing.xs,
              }}
            >
              Available for signings
            </div>
          </div>

          {/* Wage Budget */}
          <div
            style={{
              background: Colors.cardBackground,
              border: `1px solid ${Borders.color}`,
              borderRadius: Borders.radius.md,
              padding: Spacing.md,
              boxShadow: Shadows.md,
            }}
          >
            <div
              style={{
                fontSize: Typography.small,
                color: Colors.textSecondary,
                marginBottom: Spacing.xs,
              }}
            >
              Wage Budget
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#96CEB4",
              }}
            >
              {formatMoney(summary.wageBudget * 52)}
            </div>
            <div
              style={{
                fontSize: Typography.small,
                color: Colors.textSecondary,
                marginTop: Spacing.xs,
              }}
            >
              Annual salary cap
            </div>
          </div>

          {/* Total Debt */}
          <div
            style={{
              background: Colors.cardBackground,
              border: `1px solid ${Borders.color}`,
              borderRadius: Borders.radius.md,
              padding: Spacing.md,
              boxShadow: Shadows.md,
            }}
          >
            <div
              style={{
                fontSize: Typography.small,
                color: Colors.textSecondary,
                marginBottom: Spacing.xs,
              }}
            >
              Total Debt
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: summary.totalDebt > 0 ? "#FF6B6B" : "#4ECDC4",
              }}
            >
              {formatMoney(summary.totalDebt)}
            </div>
            <div
              style={{
                fontSize: Typography.small,
                color: Colors.textSecondary,
                marginTop: Spacing.xs,
              }}
            >
              {loans.length} active loan{loans.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: Spacing.xs,
            marginBottom: Spacing.lg,
            borderBottom: `1px solid ${Borders.color}`,
            overflowX: "auto",
            paddingBottom: Spacing.xs,
          }}
        >
          {(
            [
              "summary",
              "revenue",
              "expenses",
              "history",
              "loans",
              "merchandise",
              "broadcasting",
              "partnerships",
              "youth",
            ] as TabId[]
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: `${Spacing.sm} ${Spacing.md}`,
                background: activeTab === tab ? Colors.accent : "transparent",
                color: activeTab === tab ? Colors.background : Colors.text.primary,
                border: "none",
                borderRadius: `${Borders.radius.md} ${Borders.radius.md} 0 0`,
                cursor: "pointer",
                fontSize: Typography.body,
                fontWeight: activeTab === tab ? "bold" : "normal",
                transition: Transitions.base,
                whiteSpace: "nowrap",
              }}
            >
              {tab === "summary" && "Summary"}
              {tab === "revenue" && "Revenue"}
              {tab === "expenses" && "Expenses"}
              {tab === "history" && "History"}
              {tab === "loans" && "Loans"}
              {tab === "merchandise" && "🛍️ Merch"}
              {tab === "broadcasting" && "📺 Broadcasting"}
              {tab === "partnerships" && "🤝 Partnerships"}
              {tab === "youth" && "👶 Youth & Loans"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div
          style={{
            background: Colors.cardBackground,
            border: `1px solid ${Borders.color}`,
            borderRadius: Borders.radius.md,
            padding: Spacing.lg,
            boxShadow: Shadows.md,
          }}
        >
          {activeTab === "summary" && <SummaryTab revenue={revenue} expenses={expenses} />}
          {activeTab === "revenue" && <RevenueTab revenue={revenue} />}
          {activeTab === "expenses" && <ExpensesTab expenses={expenses} />}
          {activeTab === "history" && <HistoryTab recentTxns={recentTxns} monthly={monthly} />}
          {activeTab === "loans" && <LoansTab loans={loans} />}
          {activeTab === "merchandise" && <MerchandiseTab />}
          {activeTab === "broadcasting" && <BroadcastingTab />}
          {activeTab === "partnerships" && <PartnershipsTab />}
          {activeTab === "youth" && <YouthAndLoansTab />}
        </div>
      </div>
    </div>
  );
}

function SummaryTab({
  revenue,
  expenses,
}: {
  revenue: Record<string, number>;
  expenses: Record<string, number>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: Spacing.lg,
      }}
    >
      <div>
        <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>Revenue Sources</h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: Spacing.sm,
          }}
        >
          {Object.entries(revenue).map(([key, value]) => (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: Spacing.sm,
                background: Colors.background,
                borderRadius: Borders.radius.md,
                borderLeft: `3px solid #4ECDC4`,
              }}
            >
              <span style={{ color: Colors.text.primary }}>
                {key.replace(/_/g, " ").toUpperCase()}
              </span>
              <span
                style={{
                  color: "#4ECDC4",
                  fontWeight: "bold",
                }}
              >
                {formatMoney(value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>Expense Categories</h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: Spacing.sm,
          }}
        >
          {Object.entries(expenses).map(([key, value]) => (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: Spacing.sm,
                background: Colors.background,
                borderRadius: Borders.radius.md,
                borderLeft: `3px solid #FF6B6B`,
              }}
            >
              <span style={{ color: Colors.text.primary }}>
                {key.replace(/_/g, " ").toUpperCase()}
              </span>
              <span
                style={{
                  color: "#FF6B6B",
                  fontWeight: "bold",
                }}
              >
                {formatMoney(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevenueTab({ revenue }: { revenue: Record<string, number> }) {
  const total = Object.values(revenue).reduce((sum, v) => sum + v, 0);

  return (
    <div>
      <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>Revenue Breakdown</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: Spacing.md,
        }}
      >
        {Object.entries(revenue).map(([key, value]) => {
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
          return (
            <div
              key={key}
              style={{
                background: Colors.background,
                padding: Spacing.md,
                borderRadius: Borders.radius.md,
                border: `1px solid ${Borders.color}`,
              }}
            >
              <div
                style={{
                  fontSize: Typography.small,
                  color: Colors.textSecondary,
                  marginBottom: Spacing.xs,
                }}
              >
                {key.replace(/_/g, " ").toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#4ECDC4",
                  marginBottom: Spacing.xs,
                }}
              >
                {formatMoney(value)}
              </div>
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  background: Colors.background,
                  borderRadius: "2px",
                  overflow: "hidden",
                  marginBottom: Spacing.xs,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${percentage}%`,
                    background: "#4ECDC4",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: Typography.small,
                  color: Colors.textSecondary,
                }}
              >
                {percentage}% of total
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: Spacing.lg,
          padding: Spacing.md,
          background: Colors.background,
          borderRadius: Borders.radius.md,
          border: `2px solid #4ECDC4`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: Typography.body, color: Colors.text.primary }}>
            Total Weekly Revenue
          </span>
          <span
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#4ECDC4",
            }}
          >
            {formatMoney(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ExpensesTab({ expenses }: { expenses: Record<string, number> }) {
  const total = Object.values(expenses).reduce((sum, v) => sum + v, 0);

  return (
    <div>
      <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>Expense Breakdown</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: Spacing.md,
        }}
      >
        {Object.entries(expenses).map(([key, value]) => {
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
          return (
            <div
              key={key}
              style={{
                background: Colors.background,
                padding: Spacing.md,
                borderRadius: Borders.radius.md,
                border: `1px solid ${Borders.color}`,
              }}
            >
              <div
                style={{
                  fontSize: Typography.small,
                  color: Colors.textSecondary,
                  marginBottom: Spacing.xs,
                }}
              >
                {key.replace(/_/g, " ").toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#FF6B6B",
                  marginBottom: Spacing.xs,
                }}
              >
                {formatMoney(value)}
              </div>
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  background: Colors.background,
                  borderRadius: "2px",
                  overflow: "hidden",
                  marginBottom: Spacing.xs,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${percentage}%`,
                    background: "#FF6B6B",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: Typography.small,
                  color: Colors.textSecondary,
                }}
              >
                {percentage}% of total
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: Spacing.lg,
          padding: Spacing.md,
          background: Colors.background,
          borderRadius: Borders.radius.md,
          border: `2px solid #FF6B6B`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: Typography.body, color: Colors.text.primary }}>
            Total Weekly Expenses
          </span>
          <span
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#FF6B6B",
            }}
          >
            {formatMoney(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ recentTxns, monthly }: { recentTxns: any[]; monthly: any[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: Spacing.lg,
      }}
    >
      <div>
        <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>Recent Transactions</h3>
        <div
          style={{
            maxHeight: "400px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: Spacing.sm,
          }}
        >
          {recentTxns.length === 0 ? (
            <p
              style={{
                color: Colors.textSecondary,
              }}
            >
              No transactions recorded yet.
            </p>
          ) : (
            recentTxns.map((txn) => (
              <div
                key={txn.id}
                style={{
                  padding: Spacing.sm,
                  background: Colors.background,
                  borderRadius: Borders.radius.md,
                  borderLeft: `3px solid ${
                    txn.category === "revenue"
                      ? "#4ECDC4"
                      : txn.category === "expense"
                        ? "#FF6B6B"
                        : "#FFB800"
                  }`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: Spacing.xs,
                  }}
                >
                  <span
                    style={{
                      color: Colors.text.primary,
                      fontSize: Typography.small,
                      fontWeight: "bold",
                    }}
                  >
                    {txn.description}
                  </span>
                  <span
                    style={{
                      color:
                        txn.category === "revenue"
                          ? "#4ECDC4"
                          : txn.category === "expense"
                            ? "#FF6B6B"
                            : "#FFB800",
                      fontWeight: "bold",
                    }}
                  >
                    {txn.amount > 0 ? "+" : ""}
                    {formatMoney(txn.amount)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: Typography.small,
                    color: Colors.textSecondary,
                  }}
                >
                  {txn.date} • {txn.type.replace(/_/g, " ")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>Monthly Summary</h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: Spacing.sm,
          }}
        >
          {monthly.length === 0 ? (
            <p
              style={{
                color: Colors.textSecondary,
              }}
            >
              No monthly data available.
            </p>
          ) : (
            monthly.map((period, idx) => (
              <div
                key={idx}
                style={{
                  padding: Spacing.md,
                  background: Colors.background,
                  borderRadius: Borders.radius.md,
                  border: `1px solid ${Borders.color}`,
                }}
              >
                <div
                  style={{
                    marginBottom: Spacing.sm,
                    fontWeight: "bold",
                    color: Colors.text.primary,
                  }}
                >
                  {period.startDate}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: Spacing.xs,
                    fontSize: Typography.small,
                  }}
                >
                  <span style={{ color: Colors.textSecondary }}>Revenue:</span>
                  <span style={{ color: "#4ECDC4", fontWeight: "bold" }}>
                    +{formatMoney(period.revenue)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: Spacing.xs,
                    fontSize: Typography.small,
                  }}
                >
                  <span style={{ color: Colors.textSecondary }}>Expenses:</span>
                  <span style={{ color: "#FF6B6B", fontWeight: "bold" }}>
                    -{formatMoney(period.expenses)}
                  </span>
                </div>
                <div
                  style={{
                    borderTop: `1px solid ${Borders.color}`,
                    paddingTop: Spacing.xs,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: Typography.small,
                    fontWeight: "bold",
                  }}
                >
                  <span style={{ color: Colors.text.primary }}>Net:</span>
                  <span
                    style={{
                      color:
                        period.netResult >= 0
                          ? "#4ECDC4"
                          : period.netResult > -500000
                            ? "#FFB800"
                            : "#FF6B6B",
                    }}
                  >
                    {period.netResult > 0 ? "+" : ""}
                    {formatMoney(period.netResult)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LoansTab({ loans }: { loans: any[] }) {
  if (loans.length === 0) {
    return (
      <div>
        <p
          style={{
            color: Colors.textSecondary,
            fontSize: Typography.body,
          }}
        >
          ✓ No active loans. Club finances are debt-free.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>Active Loans</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: Spacing.md,
        }}
      >
        {loans.map((loan) => (
          <div
            key={loan.id}
            style={{
              padding: Spacing.md,
              background: Colors.background,
              border: `1px solid ${Borders.color}`,
              borderRadius: Borders.radius.md,
              borderLeft: `4px solid #FFB800`,
            }}
          >
            <div
              style={{
                marginBottom: Spacing.sm,
                fontWeight: "bold",
                color: Colors.text.primary,
                fontSize: Typography.body,
              }}
            >
              Loan #{loan.id.split("-")[1]}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: Spacing.sm,
                fontSize: Typography.small,
              }}
            >
              <div>
                <div style={{ color: Colors.textSecondary }}>Principal</div>
                <div style={{ color: "#FFB800", fontWeight: "bold" }}>
                  {formatMoney(loan.originalPrincipal)}
                </div>
              </div>

              <div>
                <div style={{ color: Colors.textSecondary }}>Remaining</div>
                <div style={{ color: "#FFB800", fontWeight: "bold" }}>
                  {formatMoney(loan.remaining)}
                </div>
              </div>

              <div>
                <div style={{ color: Colors.textSecondary }}>Weekly Payment</div>
                <div style={{ color: "#FFB800", fontWeight: "bold" }}>
                  {formatMoney(loan.weeklyPayment)}
                </div>
              </div>

              <div>
                <div style={{ color: Colors.textSecondary }}>Annual Rate</div>
                <div style={{ color: "#FFB800", fontWeight: "bold" }}>{loan.annualRate}%</div>
              </div>

              <div>
                <div style={{ color: Colors.textSecondary }}>Weeks Remaining</div>
                <div style={{ color: "#FFB800", fontWeight: "bold" }}>{loan.weeksRemaining}</div>
              </div>

              <div>
                <div style={{ color: Colors.textSecondary }}>Status</div>
                <div
                  style={{
                    fontWeight: "bold",
                    color: loan.approved ? "#4ECDC4" : "#FF6B6B",
                  }}
                >
                  {loan.approved ? "ACTIVE" : "PENDING"}
                </div>
              </div>
            </div>

            {loan.startDate && (
              <div
                style={{
                  marginTop: Spacing.sm,
                  fontSize: Typography.small,
                  color: Colors.textSecondary,
                  paddingTop: Spacing.sm,
                  borderTop: `1px solid ${Borders.color}`,
                }}
              >
                Started: {loan.startDate}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MerchandiseTab() {
  const { state } = useGameState();
  const club = state.currentClub;

  if (!club.merchandise) {
    return <p style={{ color: Colors.textSecondary }}>Merchandise system not yet initialized.</p>;
  }

  const totalMonthly = club.merchandise.channels
    .filter((c) => c.isActive)
    .reduce((sum, c) => sum + c.monthlyRevenue * c.profitMargin, 0);
  const reputationBoost = 1 + (club.reputation || 50) * 0.0015;
  const monthlyAfterBoost = totalMonthly * reputationBoost;
  const weeklyRevenue = Math.round(monthlyAfterBoost / 4.33);

  return (
    <div>
      <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>🛍️ Merchandise Sales</h3>
      <div
        style={{
          background: Colors.background,
          padding: Spacing.md,
          borderRadius: Borders.radius.md,
          marginBottom: Spacing.lg,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: Spacing.sm,
          }}
        >
          <div>
            <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
              Weekly Revenue
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4ECDC4" }}>
              {formatMoney(weeklyRevenue)}
            </div>
          </div>
          <div>
            <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
              Monthly Revenue
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4ECDC4" }}>
              {formatMoney(Math.round(monthlyAfterBoost))}
            </div>
          </div>
          <div>
            <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
              Active Channels
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#FFB800" }}>
              {club.merchandise.channels.filter((c) => c.isActive).length} of{" "}
              {club.merchandise.channels.length}
            </div>
          </div>
        </div>
      </div>

      <h4 style={{ color: Colors.text.primary }}>Sales Channels</h4>
      {club.merchandise.channels.map((channel) => (
        <div
          key={channel.id}
          style={{
            background: Colors.background,
            padding: Spacing.md,
            borderRadius: Borders.radius.md,
            marginBottom: Spacing.md,
            borderLeft: `3px solid ${channel.isActive ? "#4ECDC4" : "#666"}`,
            opacity: channel.isActive ? 1 : 0.6,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: Spacing.sm,
            }}
          >
            <div>
              <div style={{ color: Colors.text.primary, fontWeight: "bold" }}>{channel.name}</div>
              <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                {channel.type.toUpperCase()}
              </div>
            </div>
            <div
              style={{
                background: channel.isActive ? "#4ECDC4" : "#666",
                color: Colors.background,
                padding: `${Spacing.xs} ${Spacing.sm}`,
                borderRadius: Borders.radius.md,
                fontSize: Typography.small,
              }}
            >
              {channel.isActive ? "ACTIVE" : "INACTIVE"}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: Spacing.sm,
            }}
          >
            <div>
              <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                Monthly Revenue
              </div>
              <div style={{ color: "#4ECDC4", fontWeight: "bold" }}>
                {formatMoney(channel.monthlyRevenue)}
              </div>
            </div>
            <div>
              <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                Profit Margin
              </div>
              <div style={{ color: "#FFB800", fontWeight: "bold" }}>
                {Math.round(channel.profitMargin * 100)}%
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BroadcastingTab() {
  const { state } = useGameState();
  const club = state.currentClub;

  if (!club.broadcastingRights || club.broadcastingRights.length === 0) {
    return (
      <div>
        <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>📺 Broadcasting Rights</h3>
        <p style={{ color: Colors.textSecondary }}>
          No active broadcasting deals. Broadcasting deals are granted when you enter a competition.
        </p>
      </div>
    );
  }

  const totalWeekly = club.broadcastingRights.reduce(
    (sum, deal) =>
      sum + deal.domesticDealPerWeek + deal.internationalDealPerWeek + deal.streamingDealPerWeek,
    0,
  );

  return (
    <div>
      <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>📺 Broadcasting Rights</h3>
      <div
        style={{
          background: Colors.background,
          padding: Spacing.md,
          borderRadius: Borders.radius.md,
          marginBottom: Spacing.lg,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: Spacing.sm,
          }}
        >
          <div>
            <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
              Total Weekly
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4ECDC4" }}>
              {formatMoney(totalWeekly)}
            </div>
          </div>
          <div>
            <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
              Active Deals
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#FFB800" }}>
              {club.broadcastingRights.length}
            </div>
          </div>
        </div>
      </div>

      {club.broadcastingRights.map((deal) => (
        <div
          key={deal.competitionId}
          style={{
            background: Colors.background,
            padding: Spacing.md,
            borderRadius: Borders.radius.md,
            marginBottom: Spacing.md,
            borderLeft: "3px solid #4ECDC4",
          }}
        >
          <div style={{ color: Colors.text.primary, fontWeight: "bold", marginBottom: Spacing.sm }}>
            {deal.competitionId.toUpperCase()}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: Spacing.sm,
            }}
          >
            <div>
              <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                Domestic
              </div>
              <div style={{ color: "#4ECDC4", fontWeight: "bold" }}>
                {formatMoney(deal.domesticDealPerWeek)}/wk
              </div>
            </div>
            <div>
              <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                International
              </div>
              <div style={{ color: "#4ECDC4", fontWeight: "bold" }}>
                {formatMoney(deal.internationalDealPerWeek)}/wk
              </div>
            </div>
            <div>
              <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                Streaming
              </div>
              <div style={{ color: "#4ECDC4", fontWeight: "bold" }}>
                {formatMoney(deal.streamingDealPerWeek)}/wk
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PartnershipsTab() {
  const { state } = useGameState();
  const club = state.currentClub;
  const hasTrainingPartnerships = club.trainingPartnerships && club.trainingPartnerships.length > 0;
  const hasCommercialPartnerships =
    club.commercialPartnerships && club.commercialPartnerships.length > 0;
  const hasTicketing = club.ticketPackages && club.ticketPackages.length > 0;

  const trainingRevenue =
    club.trainingPartnerships?.reduce(
      (sum, p) => sum + (p.isActive ? p.monthlyFee / 4.33 : 0),
      0,
    ) || 0;

  const commercialRevenue =
    club.commercialPartnerships?.reduce(
      (sum, p) => sum + (p.status === "active" ? p.weeklyPayment : 0),
      0,
    ) || 0;

  const ticketingRevenue =
    club.ticketPackages?.reduce(
      (sum, pkg) => sum + (pkg.currentHolders * pkg.pricePerSeason) / 36,
      0,
    ) || 0;

  return (
    <div>
      <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>🤝 Partnerships & Ticketing</h3>

      {/* Revenue Summary */}
      <div
        style={{
          background: Colors.background,
          padding: Spacing.md,
          borderRadius: Borders.radius.md,
          marginBottom: Spacing.lg,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: Spacing.sm,
          }}
        >
          <div>
            <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
              Training Partnerships
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4ECDC4" }}>
              {formatMoney(Math.round(trainingRevenue))}/wk
            </div>
          </div>
          <div>
            <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
              Commercial Deals
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4ECDC4" }}>
              {formatMoney(Math.round(commercialRevenue))}/wk
            </div>
          </div>
          <div>
            <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
              Ticket Revenue
            </div>
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4ECDC4" }}>
              {formatMoney(Math.round(ticketingRevenue))}/wk
            </div>
          </div>
        </div>
      </div>

      {/* Training Partnerships */}
      {hasTrainingPartnerships && (
        <div style={{ marginBottom: Spacing.lg }}>
          <h4 style={{ color: Colors.text.primary }}>Training Partnerships</h4>
          {club.trainingPartnerships?.map((partnership) => (
            <div
              key={partnership.id}
              style={{
                background: Colors.background,
                padding: Spacing.md,
                borderRadius: Borders.radius.md,
                marginBottom: Spacing.md,
                borderLeft: `3px solid ${partnership.isActive ? "#4ECDC4" : "#666"}`,
              }}
            >
              <div
                style={{ color: Colors.text.primary, fontWeight: "bold", marginBottom: Spacing.xs }}
              >
                {partnership.partnerClubName}
              </div>
              <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                {partnership.details}
              </div>
              <div
                style={{
                  marginTop: Spacing.sm,
                  color: "#4ECDC4",
                  fontWeight: "bold",
                }}
              >
                {formatMoney(partnership.monthlyFee)}/month
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Commercial Partnerships */}
      {hasCommercialPartnerships && (
        <div style={{ marginBottom: Spacing.lg }}>
          <h4 style={{ color: Colors.text.primary }}>Commercial Partnerships</h4>
          {club.commercialPartnerships?.map((partnership) => (
            <div
              key={partnership.id}
              style={{
                background: Colors.background,
                padding: Spacing.md,
                borderRadius: Borders.radius.md,
                marginBottom: Spacing.md,
                borderLeft: `3px solid ${partnership.status === "active" ? "#FFB800" : "#666"}`,
              }}
            >
              <div
                style={{ color: Colors.text.primary, fontWeight: "bold", marginBottom: Spacing.xs }}
              >
                {partnership.partnerName} ({partnership.type.replace(/_/g, " ").toUpperCase()})
              </div>
              <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                {partnership.startYear}-{partnership.endYear}
              </div>
              <div style={{ marginTop: Spacing.sm }}>
                <div
                  style={{
                    color: "#FFB800",
                    fontWeight: "bold",
                  }}
                >
                  {formatMoney(partnership.annualValue)}/year
                </div>
                <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                  {formatMoney(partnership.weeklyPayment)}/week
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Packages */}
      {hasTicketing && (
        <div>
          <h4 style={{ color: Colors.text.primary }}>Ticket Packages</h4>
          {club.ticketPackages?.map((pkg) => (
            <div
              key={pkg.id}
              style={{
                background: Colors.background,
                padding: Spacing.md,
                borderRadius: Borders.radius.md,
                marginBottom: Spacing.md,
                borderLeft: "3px solid #4ECDC4",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: Spacing.sm,
                }}
              >
                <div>
                  <div style={{ color: Colors.text.primary, fontWeight: "bold" }}>{pkg.name}</div>
                  <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                    {pkg.seatsIncluded} seats • {pkg.currentHolders}/{pkg.maxAvailable}
                  </div>
                </div>
                <div style={{ color: "#4ECDC4", fontWeight: "bold" }}>
                  {formatMoney(pkg.pricePerSeason)}/season
                </div>
              </div>
              {pkg.perks.length > 0 && (
                <div style={{ fontSize: Typography.small, color: Colors.textSecondary }}>
                  Perks: {pkg.perks.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!hasTrainingPartnerships && !hasCommercialPartnerships && !hasTicketing && (
        <p style={{ color: Colors.textSecondary }}>
          No partnerships or ticket packages configured yet.
        </p>
      )}
    </div>
  );
}

function YouthAndLoansTab() {
  const { state } = useGameState();
  const club = state.currentClub;
  const hasYouth = club.youthProspects && club.youthProspects.length > 0;
  const hasLoans = club.loanOutPlayers && club.loanOutPlayers.length > 0;

  const loanRevenue =
    club.loanOutPlayers?.reduce(
      (sum, loan) => sum + (loan.status === "active" ? loan.weeklyFee : 0),
      0,
    ) || 0;

  return (
    <div>
      <h3 style={{ color: Colors.text.primary, marginTop: 0 }}>👶 Youth Academy & Loan Fees</h3>

      {/* Revenue Summary */}
      {hasLoans && (
        <div
          style={{
            background: Colors.background,
            padding: Spacing.md,
            borderRadius: Borders.radius.md,
            marginBottom: Spacing.lg,
          }}
        >
          <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
            Active Loan-Out Revenue
          </div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4ECDC4" }}>
            {formatMoney(Math.round(loanRevenue))}/week
          </div>
        </div>
      )}

      {/* Youth Prospects */}
      {hasYouth && (
        <div style={{ marginBottom: Spacing.lg }}>
          <h4 style={{ color: Colors.text.primary }}>🌟 Youth Prospects</h4>
          {club.youthProspects?.map((prospect) => (
            <div
              key={prospect.id}
              style={{
                background: Colors.background,
                padding: Spacing.md,
                borderRadius: Borders.radius.md,
                marginBottom: Spacing.md,
                borderLeft: `3px solid ${prospect.isSelling ? "#FF6B6B" : "#4ECDC4"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: Spacing.sm,
                }}
              >
                <div>
                  <div style={{ color: Colors.text.primary, fontWeight: "bold" }}>
                    {prospect.name}
                  </div>
                  <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                    Age: {prospect.age} • Potential: {Math.round(prospect.potential)}
                  </div>
                </div>
                <div style={{ color: "#FFB800", fontWeight: "bold" }}>
                  {formatMoney(prospect.marketValue)}
                </div>
              </div>
              {prospect.isSelling && (
                <div style={{ color: "#FF6B6B", fontSize: Typography.small }}>
                  Selling • Asking: {formatMoney(prospect.saleValue || 0)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loan-Out Players */}
      {hasLoans && (
        <div>
          <h4 style={{ color: Colors.text.primary }}>📤 Loaned-Out Players</h4>
          {club.loanOutPlayers?.map((loan) => (
            <div
              key={loan.id}
              style={{
                background: Colors.background,
                padding: Spacing.md,
                borderRadius: Borders.radius.md,
                marginBottom: Spacing.md,
                borderLeft: `3px solid ${loan.status === "active" ? "#4ECDC4" : "#666"}`,
                opacity: loan.status === "active" ? 1 : 0.6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: Spacing.sm,
                }}
              >
                <div>
                  <div style={{ color: Colors.text.primary, fontWeight: "bold" }}>
                    {loan.playerName}
                  </div>
                  <div style={{ color: Colors.textSecondary, fontSize: Typography.small }}>
                    Loaned to: {loan.loanToClubName}
                  </div>
                </div>
                <div
                  style={{
                    background: loan.status === "active" ? "#4ECDC4" : "#666",
                    color: Colors.background,
                    padding: `${Spacing.xs} ${Spacing.sm}`,
                    borderRadius: Borders.radius.md,
                    fontSize: Typography.small,
                  }}
                >
                  {loan.status.toUpperCase()}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: Spacing.sm,
                  fontSize: Typography.small,
                }}
              >
                <div>
                  <div style={{ color: Colors.textSecondary }}>Weekly Fee</div>
                  <div style={{ color: "#4ECDC4", fontWeight: "bold" }}>
                    {formatMoney(loan.weeklyFee)}
                  </div>
                </div>
                <div>
                  <div style={{ color: Colors.textSecondary }}>Until</div>
                  <div style={{ color: "#FFB800", fontWeight: "bold" }}>{loan.endsAt}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasYouth && !hasLoans && (
        <p style={{ color: Colors.textSecondary }}>
          No youth prospects or active loan-outs. Youth prospects are generated when the system is
          initialized.
        </p>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/office")({
  head: () => ({
    meta: [{ title: "Office | Manager Legacy" }],
  }),
  component: Office,
});
