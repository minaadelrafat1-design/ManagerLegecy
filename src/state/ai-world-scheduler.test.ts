import { describe, expect, it } from "vitest";
import { addDaysISO } from "./calendar";
import { buildInitialState } from "./seed";
import { planAiWorldWork, runAiWorldScheduler } from "./ai-world-scheduler";

function quietState() {
  const state = buildInitialState();
  return {
    ...state,
    fixtures: state.fixtures.map((fixture) => ({ ...fixture, status: "played" as const })),
    meta: {
      ...(state.meta ?? {}),
      aiScheduler: { lastPeriodicReviewDate: state.time.date },
    },
  };
}

describe("AI world scheduler", () => {
  it("does not schedule expensive AI work on a normal quiet day", () => {
    const state = quietState();
    expect(planAiWorldWork(state).items).toHaveLength(0);
  });

  it("schedules clubs with an upcoming fixture", () => {
    const state = quietState();
    const aiClub = Object.values(state.clubs).find((club) => club.aiManager)!;
    const opponent = Object.values(state.clubs).find((club) => club.id !== aiClub.id)!;
    const next = {
      ...state,
      fixtures: [
        {
          id: "scheduler-fixture",
          competitionId: "test",
          season: String(state.time.season),
          homeClubId: aiClub.id,
          awayClubId: opponent.id,
          calendarDate: addDaysISO(state.time.date, 2),
          date: "Test fixture",
          matchday: 1,
          venue: "H" as const,
          status: "scheduled" as const,
          result: null,
        },
      ],
    };
    const plan = planAiWorldWork(next);
    expect(
      plan.items.some(
        (item) => item.clubId === aiClub.id && item.reasons.includes("upcoming-match"),
      ),
    ).toBe(true);
  });

  it("uses deterministic periodic batches for the same state and date", () => {
    const state = quietState();
    const first = planAiWorldWork(state);
    const second = planAiWorldWork({ ...state, clubs: { ...state.clubs } });
    expect(second).toEqual(first);
    expect(first.items.length).toBeLessThanOrEqual(4);
  });

  it("schedules event-triggered work without growing scheduler metadata", () => {
    const state = quietState();
    const aiClub = Object.values(state.clubs).find(
      (club) => club.aiManager && club.playerIds.length > 0,
    )!;
    const injuredPlayerId = aiClub.playerIds[0]!;
    const next = {
      ...state,
      events: [
        {
          id: "scheduler-injury",
          date: state.time.date,
          type: "injury" as const,
          description: "Important player injury",
          meta: { playerId: injuredPlayerId },
        },
      ],
    };
    const plan = planAiWorldWork(next);
    expect(plan.items).toEqual([{ clubId: aiClub.id, reasons: ["injury-crisis"], priority: 20 }]);
    const quiet = runAiWorldScheduler(state);
    const again = runAiWorldScheduler(quiet);
    expect(again.meta?.["aiScheduler"]).toEqual(quiet.meta?.["aiScheduler"]);
  });

  it("targets manager replacement work to the appointed club", () => {
    const state = quietState();
    const aiClub = Object.values(state.clubs).find((club) => club.aiManager)!;
    const plan = planAiWorldWork({
      ...state,
      events: [
        {
          id: "manager-change",
          date: state.time.date,
          type: "manager",
          description: "Appointed",
          meta: { action: "appointed", clubId: aiClub.id },
        },
      ],
    });
    expect(plan.items).toEqual([{ clubId: aiClub.id, reasons: ["manager-change"], priority: 20 }]);
  });

  it("schedules bounded transfer-window work", () => {
    const state = quietState();
    const transferWindowState = { ...state, time: { ...state.time, date: "2027-01-10" } };
    const plan = planAiWorldWork(transferWindowState);
    expect(plan.items.some((item) => item.reasons.includes("transfer-window"))).toBe(true);
    expect(plan.items.length).toBeLessThanOrEqual(4);
  });

  it("does not process the same scheduler day twice", () => {
    const state = quietState();
    const first = runAiWorldScheduler(state);
    const second = runAiWorldScheduler(first);
    expect(second.meta?.["aiScheduler"]?.["lastRunDate"]).toBeUndefined();
    expect(second.meta?.["aiScheduler"]?.["lastPlanDate"]).toBe(state.time.date);
  });
});
