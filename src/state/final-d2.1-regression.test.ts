import { describe, expect, it } from "vitest";
import { addDaysISO, advanceGameDays } from "./calendar";
import { buildInitialState } from "./seed";
import { runAiActions } from "./ai-actions";
import { planAiWorldWork, runAiWorldScheduler } from "./ai-world-scheduler";
import type { Fixture, GameState } from "./types";
import { simulateMatch } from "../lib/match-engine";
import { buildSimTeamInput } from "../lib/ai-match-adapter";
import "./store";

interface PerformanceMetrics {
  label: string;
  elapsedMs: number;
  clubsEvaluated: number;
  expensiveAiEvaluations: number;
  fixturesProcessed: number;
  actionsExecuted: number;
}

function quietState(seed: string): GameState {
  const state = buildInitialState(seed);
  return {
    ...state,
    fixtures: state.fixtures.map((fixture) => ({ ...fixture, status: "played" as const })),
    meta: {
      ...(state.meta ?? {}),
      aiScheduler: { lastPeriodicReviewDate: state.time.date },
    },
  };
}

function aiFixture(state: GameState, id: string, date: string): Fixture {
  const aiClubs = Object.values(state.clubs).filter(
    (club) => club.aiManager && club.id !== state.currentClub.id,
  );
  const home = aiClubs[0]!;
  const away = aiClubs[1]!;
  return {
    id,
    competitionId: Object.values(state.leagues)[0]!.competitionId,
    season: String(state.time.season),
    homeClubId: home.id,
    awayClubId: away.id,
    calendarDate: date,
    date: "Regression fixture",
    matchday: 1,
    venue: "H",
    status: "scheduled",
    result: null,
  };
}

function measureAdvanceDay(state: GameState, label: string): PerformanceMetrics {
  const plan = planAiWorldWork(state);
  const beforeMatches = state.matches.length;
  const beforeEvents = (state.events ?? []).length;
  const beforeTransfers = state.transfers.length;
  const beforeNegotiations = (state.negotiations ?? []).length;
  const beforeTraining = (state.training ?? []).length;
  const start = performance.now();
  const next = advanceGameDays(state, 1);
  const elapsedMs = performance.now() - start;

  return {
    label,
    elapsedMs,
    clubsEvaluated: plan.items.length,
    expensiveAiEvaluations: plan.items.length,
    fixturesProcessed: next.matches.length - beforeMatches,
    actionsExecuted:
      Math.max(0, next.events.length - beforeEvents) +
      Math.max(0, next.transfers.length - beforeTransfers) +
      Math.max(0, (next.negotiations ?? []).length - beforeNegotiations) +
      Math.max(0, (next.training ?? []).length - beforeTraining),
  };
}

describe("Prompt 6 final D2.1 regression suite", () => {
  it("verifies an observable AI action before and after state", () => {
    const state = buildInitialState("prompt6-ai-action");
    const club = Object.values(state.clubs).find(
      (candidate) => candidate.aiManager && candidate.id !== state.currentClub.id,
    )!;
    const beforeMemory = club.aiMemory?.items?.length ?? 0;
    const beforeLedger = state.meta?.aiLedgers?.[club.id];

    const next = runAiActions(state, new Set([club.id]));
    const afterClub = next.clubs[club.id]!;
    const afterMemory = afterClub.aiMemory?.items?.length ?? 0;
    const afterLedger = next.meta?.aiLedgers?.[club.id];

    expect(afterMemory).toBeGreaterThan(beforeMemory);
    expect(afterLedger).toBeDefined();
    expect(
      beforeLedger === undefined ||
        afterLedger!.transferBudget !== beforeLedger.transferBudget ||
        afterLedger!.wageBudgetWeekly !== beforeLedger.wageBudgetWeekly ||
        afterLedger!.balance !== beforeLedger.balance,
    ).toBe(true);
    expect(afterClub.aiMemory?.items?.every((item) => item.summary.length > 0)).toBe(true);
  });

  it("runs the canonical end-to-end day pipeline through fixture, consequence, scheduler, action, event, and memory", () => {
    const initial = buildInitialState("prompt6-e2e");
    const fixtureDate = addDaysISO(initial.time.date, 1);
    const fixture = aiFixture(initial, "prompt6-e2e-fixture", fixtureDate);
    const targetClubId = fixture.homeClubId;
    const targetBeforeMemory = initial.clubs[targetClubId]?.aiMemory?.items?.length ?? 0;
    const state: GameState = {
      ...initial,
      fixtures: [...initial.fixtures, fixture],
      matches: [],
    };

    const next = advanceGameDays(state, 1);
    const resolvedFixture = next.fixtures.find((candidate) => candidate.id === fixture.id)!;
    const result = next.matches.find((match) => match.fixtureId === fixture.id);
    const resultEvent = next.events.find((event) => event.meta?.["fixtureId"] === fixture.id);
    const schedulerMeta = next.meta?.aiScheduler as { lastProcessedClubIds?: string[] } | undefined;
    const targetAfterMemory = next.clubs[targetClubId]?.aiMemory?.items?.length ?? 0;

    expect(resolvedFixture.status).toBe("played");
    expect(result).toBeDefined();
    expect(resultEvent).toBeDefined();
    expect(schedulerMeta?.lastProcessedClubIds).toContain(targetClubId);
    expect(targetAfterMemory).toBeGreaterThan(targetBeforeMemory);
    expect(next.events.length).toBeGreaterThan(state.events.length);
    expect(next.matches.length).toBeGreaterThan(state.matches.length);
  });

  it("collects observable performance metrics for normal, heavy, transfer-window, and season-transition days", () => {
    const normal = measureAdvanceDay(quietState("prompt6-normal"), "normal-day");

    const heavyBase = quietState("prompt6-heavy");
    const heavyFixtures = Array.from({ length: 8 }, (_, index) =>
      aiFixture(heavyBase, `prompt6-heavy-${index}`, addDaysISO(heavyBase.time.date, 1)),
    );
    const heavy = measureAdvanceDay(
      { ...heavyBase, fixtures: [...heavyBase.fixtures, ...heavyFixtures] },
      "heavy-matchday",
    );

    const transferWindowState = {
      ...quietState("prompt6-window"),
      time: { ...quietState("prompt6-window").time, date: "2027-01-10" },
    };
    const transferWindow = measureAdvanceDay(transferWindowState, "transfer-window-day");

    const seasonTransition = measureAdvanceDay(
      {
        ...quietState("prompt6-transition"),
        time: { ...quietState("prompt6-transition").time, date: "2027-07-31" },
      },
      "season-transition",
    );

    const metrics = [normal, heavy, transferWindow, seasonTransition];
    for (const metric of metrics) {
      expect(Number.isFinite(metric.elapsedMs)).toBe(true);
      expect(metric.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(metric.clubsEvaluated).toBeGreaterThanOrEqual(0);
      expect(metric.expensiveAiEvaluations).toBe(metric.clubsEvaluated);
      expect(metric.fixturesProcessed).toBeGreaterThanOrEqual(0);
      expect(metric.actionsExecuted).toBeGreaterThanOrEqual(0);
    }
    expect(heavy.fixturesProcessed).toBeGreaterThan(normal.fixturesProcessed);
    expect(metrics.map((metric) => metric.label)).toEqual([
      "normal-day",
      "heavy-matchday",
      "transfer-window-day",
      "season-transition",
    ]);
  }, 180_000);

  it("keeps scheduler work cadence-limited and metadata bounded at representative scale", () => {
    let state = quietState("prompt6-scale");
    const firstPlan = planAiWorldWork({
      ...state,
      meta: { ...(state.meta ?? {}), aiScheduler: {} },
    });
    expect(firstPlan.items.length).toBeLessThanOrEqual(4);

    const firstRun = runAiWorldScheduler({
      ...state,
      meta: { ...(state.meta ?? {}), aiScheduler: {} },
    });
    expect(firstRun.meta?.aiScheduler?.lastProcessedClubIds?.length ?? 0).toBeLessThanOrEqual(4);

    for (let day = 0; day < 30; day++) {
      state = advanceGameDays(state, 1);
    }

    const schedulerState = state.meta?.aiScheduler;
    expect(Object.keys(schedulerState ?? {}).length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(schedulerState ?? {}).length).toBeLessThan(1_000);
    expect(schedulerState?.lastProcessedClubIds?.length ?? 0).toBeLessThanOrEqual(4);
  });

  it("keeps match simulation deterministic and uses the same observable score for repeated inputs", () => {
    const state = buildInitialState("prompt6-match");
    const clubs = Object.values(state.clubs).filter((club) => club.id !== state.currentClub.id);
    const first = simulateMatch(
      buildSimTeamInput("home", clubs[0]!, state.players, false),
      buildSimTeamInput("away", clubs[1]!, state.players, false),
      6016,
    );
    const second = simulateMatch(
      buildSimTeamInput("home", clubs[0]!, state.players, false),
      buildSimTeamInput("away", clubs[1]!, state.players, false),
      6016,
    );

    expect(second.finalScore).toEqual(first.finalScore);
    expect(first.events.length).toBeGreaterThan(0);
    expect(first.snapshots.length).toBeGreaterThan(1);
  });
});
