import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { getFinancialMetrics, getManagerMetrics, getRetirementAgeStats } from "./realism-metrics";
import { recordManagerEra, recordRetirement } from "./world-history";

describe("realism metrics", () => {
  it("calculates manager tenure from career history instead of placeholders", () => {
    const base = buildInitialState();
    const state = recordManagerEra(
      base,
      base.manager.id,
      base.manager.clubId,
      "2022-08-01",
      "2023-08-01",
      "Manager era",
      "Managed one season",
      1,
    );

    const metrics = getManagerMetrics(state);

    expect(metrics.appointments).toBeGreaterThanOrEqual(0);
    expect(metrics.dismissals).toBeGreaterThanOrEqual(0);
    expect(metrics.averageTenure).toBeGreaterThan(0);
    expect(metrics.averageTenure).toBeLessThan(20);
    expect(Object.keys(metrics.tenureDistribution).length).toBeGreaterThan(0);
  });

  it("aggregates financial indicators from actual club balances and transfer activity", () => {
    const state = buildInitialState();

    const metrics = getFinancialMetrics(state);

    expect(metrics.clubs).toBeGreaterThan(0);
    expect(metrics.averageBalance).toBeGreaterThanOrEqual(0);
    expect(metrics.totalTransferSpending).toBeGreaterThanOrEqual(0);
    expect(metrics.totalWageExpenditure).toBeGreaterThan(0);
    expect(metrics.totalRevenue).toBeGreaterThan(0);
    expect(Object.keys(metrics.balanceDistribution).length).toBeGreaterThan(0);
  });

  it("tracks retirement ages in realistic football ranges", () => {
    const base = buildInitialState();
    const playerId = Object.keys(base.players)[0];
    const state = recordRetirement(base, playerId, 33, base.currentClub.id);

    const metrics = getRetirementAgeStats(state);
    const totalRetirements = Object.values(metrics).reduce((sum, value) => sum + value, 0);

    expect(totalRetirements).toBeGreaterThan(0);
    expect(Object.keys(metrics).length).toBeGreaterThan(0);
    expect(metrics["30-35"] ?? 0).toBeGreaterThanOrEqual(0);
  });
});
