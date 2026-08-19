import { describe, expect, it } from "vitest";
import { buildInitialState } from "@/state/seed";
import {
  buildSimTeamInput,
  calculateAiSquadMorale,
  simulateAiFixtureViaEngine,
} from "./ai-match-adapter";
import { simulateMatch } from "./match-engine";

function makeFixtureState() {
  const state = buildInitialState();
  const clubs = Object.values(state.clubs).filter((club) => club.id !== state.currentClub.id);
  return {
    state,
    home: clubs[0]!,
    away: clubs[1]!,
  };
}

describe("AI match adapter authority and inputs", () => {
  it("uses the canonical engine score without post-engine calibration", () => {
    const { state, home, away } = makeFixtureState();
    const fixture = {
      id: "authority-fixture",
      competitionId: "test",
      season: String(state.time.season),
      homeClubId: home.id,
      awayClubId: away.id,
      calendarDate: state.time.date,
      date: "Today",
      matchday: 1,
      venue: "H" as const,
      status: "scheduled" as const,
      result: null,
    };
    const seed = 123456;
    const expected = simulateMatch(
      buildSimTeamInput("home", home, state.players, true, state),
      buildSimTeamInput("away", away, state.players, false, state),
      seed,
    ).finalScore;
    const actual = simulateAiFixtureViaEngine(fixture, state.clubs, state.players, seed, state);
    expect(actual.scoreHome).toBe(expected.home);
    expect(actual.scoreAway).toBe(expected.away);
    expect(actual.outcome).toBe(
      expected.home > expected.away ? "H" : expected.home < expected.away ? "A" : "D",
    );
  });

  it("calculates bounded deterministic morale from state", () => {
    const { state, home } = makeFixtureState();
    const first = calculateAiSquadMorale(home, state.players, state);
    const second = calculateAiSquadMorale(home, state.players, state);
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(20);
    expect(first).toBeLessThanOrEqual(85);
  });

  it("responds to meaningful morale changes without changing unchanged state", () => {
    const { state, home } = makeFixtureState();
    const baseline = calculateAiSquadMorale(home, state.players, state);
    const unchanged = calculateAiSquadMorale(home, state.players, state);
    const lowMoralePlayers = Object.fromEntries(
      Object.entries(state.players).map(([id, player]) =>
        home.playerIds.includes(id) ? [id, { ...player, morale: 20 }] : [id, player],
      ),
    );
    const changed = calculateAiSquadMorale(home, lowMoralePlayers, state);
    expect(unchanged).toBe(baseline);
    expect(changed).toBeLessThan(baseline);
  });

  it("is deterministic for identical seeds and permits underdogs to win", () => {
    const { state, home, away } = makeFixtureState();
    const fixture = {
      id: "deterministic-fixture",
      competitionId: "test",
      season: String(state.time.season),
      homeClubId: home.id,
      awayClubId: away.id,
      calendarDate: state.time.date,
      date: "Today",
      matchday: 1,
      venue: "H" as const,
      status: "scheduled" as const,
      result: null,
    };
    const results = Array.from({ length: 20 }, (_, index) =>
      simulateAiFixtureViaEngine(fixture, state.clubs, state.players, 1000 + index, state),
    );
    const repeat = simulateAiFixtureViaEngine(fixture, state.clubs, state.players, 1007, state);
    expect(results[7]).toEqual(repeat);
    expect(results.some((result) => result.outcome === "A")).toBe(true);
  });

  it("gives a stronger synthetic team a statistical advantage without forcing every result", () => {
    const state = buildInitialState();
    const facilities = state.currentClub.facilities;
    const strong = {
      ...state.currentClub,
      id: "strength-home",
      reputation: 90,
      facilities,
      playerIds: [],
      leagueId: state.currentClub.leagueId,
    };
    const weak = {
      ...state.currentClub,
      id: "strength-away",
      reputation: 25,
      playerIds: [],
      leagueId: state.currentClub.leagueId,
      facilities: { training: 25, medical: 25, youth: 25, stadium: 25 },
    };
    const fixture = {
      id: "strength-sample",
      competitionId: "test",
      season: String(state.time.season),
      homeClubId: strong.id,
      awayClubId: weak.id,
      calendarDate: state.time.date,
      date: "Today",
      matchday: 1,
      venue: "H" as const,
      status: "scheduled" as const,
      result: null,
    };
    const clubsById = { ...state.clubs, [strong.id]: strong, [weak.id]: weak };
    const results = Array.from({ length: 30 }, (_, index) =>
      simulateAiFixtureViaEngine(fixture, clubsById, state.players, 4000 + index, state),
    );
    const homeWins = results.filter((result) => result.outcome === "H").length;
    const awayWins = results.filter((result) => result.outcome === "A").length;
    expect(homeWins).toBeGreaterThan(awayWins);
  });
});
