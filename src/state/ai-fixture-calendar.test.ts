import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { resolveTodaysAiFixtures } from "./ai-fixture-calendar";
import type { GameState } from "./types";

function fixtureState(): GameState {
  const state = buildInitialState();
  const nonManagerClubs = Object.values(state.clubs).filter(
    (club) => club.id !== state.currentClub.id,
  );
  const home = nonManagerClubs[0]!;
  const away = nonManagerClubs[1]!;
  const today = state.time.date;
  return {
    ...state,
    fixtures: [
      {
        id: "ai-today",
        competitionId: "test-league",
        season: String(state.time.season),
        homeClubId: home.id,
        awayClubId: away.id,
        calendarDate: today,
        date: "Today",
        matchday: 1,
        venue: "H",
        status: "scheduled",
        result: null,
      },
      {
        id: "manager-today",
        competitionId: "test-league",
        season: String(state.time.season),
        homeClubId: state.currentClub.id,
        awayClubId: away.id,
        calendarDate: today,
        date: "Today",
        matchday: 1,
        venue: "H",
        status: "scheduled",
        result: null,
      },
      {
        id: "future-ai",
        competitionId: "test-league",
        season: String(state.time.season),
        homeClubId: home.id,
        awayClubId: away.id,
        calendarDate: "2099-01-01",
        date: "Future",
        matchday: 2,
        venue: "H",
        status: "scheduled",
        result: null,
      },
    ],
    matches: [],
  };
}

describe("daily AI fixture calendar integration", () => {
  it("resolves today's AI fixture but leaves the manager fixture and future fixture scheduled", () => {
    const state = fixtureState();
    const next = resolveTodaysAiFixtures(state);
    expect(next.fixtures.find((fixture) => fixture.id === "ai-today")?.status).toBe("played");
    expect(next.fixtures.find((fixture) => fixture.id === "manager-today")?.status).toBe(
      "scheduled",
    );
    expect(next.fixtures.find((fixture) => fixture.id === "future-ai")?.status).toBe("scheduled");
    expect(next.matches.some((match) => match.fixtureId === "ai-today")).toBe(true);
  });

  it("is exactly once for results and events", () => {
    const first = resolveTodaysAiFixtures(fixtureState());
    const second = resolveTodaysAiFixtures(first);
    expect(second.matches.filter((match) => match.fixtureId === "ai-today")).toHaveLength(1);
    expect(second.events.filter((event) => event.meta?.["fixtureId"] === "ai-today")).toHaveLength(
      1,
    );
  });

  it("leaves completed and previous-season fixtures unchanged", () => {
    const state = fixtureState();
    const completed = {
      ...state.fixtures[0]!,
      status: "played" as const,
      scoreHome: 3,
      scoreAway: 2,
    };
    const previous = { ...state.fixtures[2]!, season: "1999/00", calendarDate: state.time.date };
    const next = resolveTodaysAiFixtures({ ...state, fixtures: [completed, previous] });
    expect(next.fixtures).toEqual([completed, previous]);
  });

  it("produces deterministic results for the same fixture state", () => {
    const first = resolveTodaysAiFixtures(fixtureState());
    const second = resolveTodaysAiFixtures(fixtureState());
    const firstResult = first.matches.find((match) => match.fixtureId === "ai-today");
    const secondResult = second.matches.find((match) => match.fixtureId === "ai-today");
    expect(secondResult?.scoreHome).toBe(firstResult?.scoreHome);
    expect(secondResult?.scoreAway).toBe(firstResult?.scoreAway);
  });
});
