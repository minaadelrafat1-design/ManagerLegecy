import { describe, expect, it } from "vitest";
import { buildInitialState } from "../src/state/seed";
import {
  collectAuthoritativeSeasonMetrics,
  type AuthoritativeSeasonMetrics,
} from "./canonical-simulation-audit";
import type { EventLogEntry, GameState, MatchRecord } from "../src/state/types";

function seasonStatePair() {
  const before = buildInitialState("metrics-test");
  const fixture = before.fixtures[0]!;
  const season1Match: MatchRecord = {
    id: "match-season-1",
    fixtureId: fixture.id,
    seed: 1,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    scoreHome: 2,
    scoreAway: 1,
    playedAt: "2027-01-10",
  };
  const season1Events: EventLogEntry[] = [
    {
      id: "event-match-season-1",
      date: "2027-01-10",
      type: "MATCH_PLAYED",
      description: "opaque",
      meta: {
        fixtureId: fixture.id,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        scoreHome: 2,
        scoreAway: 1,
      },
    },
    {
      id: "event-attempt-season-1",
      date: "2026-09-01",
      type: "transfer",
      description: "opaque",
      meta: { action: "negotiation_start", type: "transfer", sessionId: "s1" },
    },
    {
      id: "event-complete-season-1",
      date: "2026-09-02",
      type: "TRANSFER_COMPLETED",
      description: "opaque",
      meta: { playerId: "p1", fromClubId: "a", toClubId: "b" },
    },
    {
      id: "event-promotion-season-1",
      date: "2027-07-01",
      type: "PROMOTION",
      description: "opaque",
      meta: { clubId: "club-a", fromDivision: "a", toDivision: "b" },
    },
    {
      id: "event-relegation-season-1",
      date: "2027-07-01",
      type: "RELEGATION",
      description: "opaque",
      meta: { clubId: "club-b", fromDivision: "b", toDivision: "a" },
    },
    {
      id: "event-retirement-season-1",
      date: "2027-06-01",
      type: "PLAYER_RETIRED",
      description: "opaque",
      meta: { playerId: "p2", retired: true },
    },
    {
      id: "event-youth-season-1",
      date: "2026-09-01",
      type: "YOUTH_GENERATED",
      description: "opaque",
      meta: { playerId: "y1", age: 16 },
    },
    {
      id: "event-manager-season-1",
      date: "2027-07-01",
      type: "manager",
      description: "opaque",
      meta: { clubId: "club-a", action: "appointed" },
    },
  ];
  const afterSeason1: GameState = {
    ...before,
    fixtures: [],
    matches: [season1Match],
    events: [...before.events, ...season1Events],
  };
  return { before, afterSeason1, season1Match, season1Events };
}

function addSeason2(before: GameState): GameState {
  const priorMatch = before.matches[0]!;
  const fixture = {
    id: "f-season-2",
    competitionId: "competition-season-2",
    season: "2027/28",
    homeClubId: priorMatch.homeClubId,
    awayClubId: priorMatch.awayClubId,
    calendarDate: "2028-01-10",
    date: "2028-01-10",
    matchday: 1,
    venue: "H" as const,
    status: "scheduled" as const,
    result: null,
  };
  const match: MatchRecord = {
    id: "match-season-2",
    fixtureId: fixture.id,
    seed: 2,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    scoreHome: 1,
    scoreAway: 0,
    playedAt: "2028-01-10",
  };
  const event: EventLogEntry = {
    id: "event-match-season-2",
    date: "2028-01-10",
    type: "MATCH_PLAYED",
    description: "opaque",
    meta: {
      fixtureId: fixture.id,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      scoreHome: 1,
      scoreAway: 0,
    },
  };
  return {
    ...before,
    fixtures: [],
    matches: [...before.matches, match],
    events: [...before.events, event],
  };
}

function sumMetric<T extends keyof AuthoritativeSeasonMetrics>(
  metric: T,
  values: AuthoritativeSeasonMetrics[],
) {
  return values.reduce((sum, value) => sum + value[metric], 0);
}

describe("canonical authoritative historical metrics", () => {
  it("records generated fixtures, played fixtures, matches, and goals from results", () => {
    const { before, afterSeason1 } = seasonStatePair();
    const metrics = collectAuthoritativeSeasonMetrics(before, afterSeason1, "2026/27");
    expect(metrics.fixturesGenerated).toBeGreaterThan(0);
    expect(metrics.fixturesPlayed).toBe(1);
    expect(metrics.matchesCompleted).toBe(1);
    expect(metrics.goals).toBe(3);
  });

  it("keeps transfer attempts separate from completed transfers", () => {
    const { before, afterSeason1 } = seasonStatePair();
    const metrics = collectAuthoritativeSeasonMetrics(before, afterSeason1, "2026/27");
    expect(metrics.transferAttempts).toBe(1);
    expect(metrics.completedTransfers).toBe(1);
  });

  it("counts competition and lifecycle outcomes only from structured events", () => {
    const { before, afterSeason1 } = seasonStatePair();
    const metrics = collectAuthoritativeSeasonMetrics(before, afterSeason1, "2026/27");
    expect(metrics.promotions).toBe(1);
    expect(metrics.relegations).toBe(1);
    expect(metrics.retirements).toBe(1);
    expect(metrics.youthGenerated).toBe(1);
    expect(metrics.managerChanges).toBe(1);
  });

  it("remains correct after the season fixture is pruned", () => {
    const { before, afterSeason1 } = seasonStatePair();
    expect(afterSeason1.fixtures).toHaveLength(0);
    expect(collectAuthoritativeSeasonMetrics(before, afterSeason1, "2026/27").goals).toBe(3);
  });

  it("does not mutate gameplay state", () => {
    const { before, afterSeason1 } = seasonStatePair();
    const beforeSnapshot = JSON.stringify(before);
    const afterSnapshot = JSON.stringify(afterSeason1);
    collectAuthoritativeSeasonMetrics(before, afterSeason1, "2026/27");
    expect(JSON.stringify(before)).toBe(beforeSnapshot);
    expect(JSON.stringify(afterSeason1)).toBe(afterSnapshot);
  });

  it("is repeatable and preserves season 1 after season 2 executes", () => {
    const { before, afterSeason1 } = seasonStatePair();
    const season1 = collectAuthoritativeSeasonMetrics(before, afterSeason1, "2026/27");
    const repeatedSeason1 = collectAuthoritativeSeasonMetrics(before, afterSeason1, "2026/27");
    const afterSeason2 = addSeason2(afterSeason1);
    const season2 = collectAuthoritativeSeasonMetrics(afterSeason1, afterSeason2, "2027/28");

    expect(repeatedSeason1).toEqual(season1);
    expect(season1.goals).toBe(3);
    expect(season2.goals).toBe(1);
    expect(sumMetric("goals", [season1, season2])).toBe(4);
    expect(sumMetric("matchesCompleted", [season1, season2])).toBe(2);
  });
});
