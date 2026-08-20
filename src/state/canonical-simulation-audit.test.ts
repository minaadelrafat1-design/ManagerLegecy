import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import {
  collectAuthoritativeSeasonMetrics,
  type AuthoritativeSeasonMetrics,
} from "../../scripts/canonical-simulation-audit";
import type { EventLogEntry, GameState, MatchRecord } from "./types";

function buildMetricStates() {
  const before = buildInitialState("metrics-test");
  const fixture = before.fixtures[0]!;
  const match: MatchRecord = {
    id: "match-season-1",
    fixtureId: fixture.id,
    seed: 1,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    scoreHome: 2,
    scoreAway: 1,
    playedAt: "2027-01-10",
  };
  const events: EventLogEntry[] = [
    {
      id: "match-event",
      date: "2027-01-10",
      type: "MATCH_PLAYED",
      description: "opaque",
      meta: { fixtureId: fixture.id, homeClubId: fixture.homeClubId, awayClubId: fixture.awayClubId, scoreHome: 2, scoreAway: 1 },
    },
    { id: "attempt", date: "2026-09-01", type: "transfer", description: "opaque", meta: { action: "negotiation_start", type: "transfer" } },
    { id: "complete", date: "2026-09-02", type: "TRANSFER_COMPLETED", description: "opaque", meta: { playerId: "p1", fromClubId: "a", toClubId: "b" } },
    { id: "promotion", date: "2027-07-01", type: "PROMOTION", description: "opaque", meta: { clubId: "a", fromDivision: "a", toDivision: "b" } },
    { id: "relegation", date: "2027-07-01", type: "RELEGATION", description: "opaque", meta: { clubId: "b", fromDivision: "b", toDivision: "a" } },
    { id: "retirement", date: "2027-06-01", type: "PLAYER_RETIRED", description: "opaque", meta: { playerId: "p2", retired: true } },
    { id: "youth", date: "2026-09-01", type: "YOUTH_GENERATED", description: "opaque", meta: { playerId: "y1", age: 16 } },
    { id: "manager", date: "2027-07-01", type: "manager", description: "opaque", meta: { clubId: "a", action: "appointed" } },
  ];
  const after: GameState = { ...before, fixtures: [], matches: [match], events: [...before.events, ...events] };
  return { before, after };
}

function sum<T extends keyof AuthoritativeSeasonMetrics>(key: T, values: AuthoritativeSeasonMetrics[]) {
  return values.reduce((total, value) => total + value[key], 0);
}

describe("authoritative canonical historical metrics", () => {
  it("uses structured results and survives fixture pruning", () => {
    const { before, after } = buildMetricStates();
    const metrics = collectAuthoritativeSeasonMetrics(before, after, "2026/27");
    expect(metrics.fixturesGenerated).toBeGreaterThan(0);
    expect(metrics.fixturesPlayed).toBe(1);
    expect(metrics.matchesCompleted).toBe(1);
    expect(metrics.goals).toBe(3);
    expect(metrics.transferAttempts).toBe(1);
    expect(metrics.completedTransfers).toBe(1);
    expect(metrics.promotions).toBe(1);
    expect(metrics.relegations).toBe(1);
    expect(metrics.retirements).toBe(1);
    expect(metrics.youthGenerated).toBe(1);
    expect(metrics.managerChanges).toBe(1);
  });

  it("does not parse descriptions or mutate either state", () => {
    const { before, after } = buildMetricStates();
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    collectAuthoritativeSeasonMetrics(before, after, "2026/27");
    expect(JSON.stringify(before)).toBe(beforeJson);
    expect(JSON.stringify(after)).toBe(afterJson);
  });

  it("is repeatable and keeps season totals additive", () => {
    const { before, after } = buildMetricStates();
    const season1 = collectAuthoritativeSeasonMetrics(before, after, "2026/27");
    const season1Repeat = collectAuthoritativeSeasonMetrics(before, after, "2026/27");
    const season2 = { ...season1, goals: 1, matchesCompleted: 1 };
    expect(season1Repeat).toEqual(season1);
    expect(sum("goals", [season1, season2])).toBe(4);
    expect(sum("matchesCompleted", [season1, season2])).toBe(2);
  });
});
