import { describe, expect, it } from "vitest";
import { gameReducer } from "./reducer";
import { buildInitialState } from "./seed";
import {
  checkAllInvariants,
  detectMatchEventWithoutResult,
  detectMatchRecordIntegrity,
} from "./event-invariants";
import type { EventLogEntry, Fixture, GameState, MatchRecord } from "./types";

function playedEvidence(state: GameState) {
  const fixture = state.fixtures.find((candidate) => candidate.status === "scheduled")!;
  const match: MatchRecord = {
    id: `match-${fixture.id}`,
    fixtureId: fixture.id,
    seed: 123,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    scoreHome: 2,
    scoreAway: 1,
    playedAt: fixture.calendarDate,
  };
  const event: EventLogEntry = {
    id: `event-${fixture.id}`,
    date: fixture.calendarDate,
    type: "MATCH_PLAYED",
    description: "Match completed",
    meta: {
      fixtureId: fixture.id,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      scoreHome: 2,
      scoreAway: 1,
    },
  };
  return { fixture, match, event };
}

describe("match evidence across fixture retention", () => {
  it("executes a match before pruning", () => {
    const state = buildInitialState();
    const fixture = state.fixtures.find((candidate) => candidate.status === "scheduled")!;
    const next = gameReducer(state, {
      type: "RECORD_MATCH_RESULT",
      fixtureId: fixture.id,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      scoreHome: 2,
      scoreAway: 1,
      seed: 123,
      playedAt: fixture.calendarDate,
    });

    expect(next.fixtures.find((candidate) => candidate.id === fixture.id)?.status).toBe("played");
    expect(next.matches.some((match) => match.fixtureId === fixture.id)).toBe(true);
  });

  it("retains the MatchRecord after execution", () => {
    const state = buildInitialState();
    const fixture = state.fixtures.find((candidate) => candidate.status === "scheduled")!;
    const next = gameReducer(state, {
      type: "RECORD_MATCH_RESULT",
      fixtureId: fixture.id,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      scoreHome: 2,
      scoreAway: 1,
      seed: 123,
      playedAt: fixture.calendarDate,
    });

    const match = next.matches.find((candidate) => candidate.fixtureId === fixture.id);
    expect(match?.scoreHome).toBe(2);
    expect(match?.scoreAway).toBe(1);
    expect(match?.playedAt).toBe(fixture.calendarDate);
  });

  it("accepts a legitimately pruned fixture when historical evidence remains", () => {
    const state = buildInitialState();
    const { fixture, match, event } = playedEvidence(state);
    const pruned: GameState = {
      ...state,
      fixtures: [],
      matches: [match],
      events: [...state.events, event],
    };

    expect(detectMatchEventWithoutResult(pruned)).toEqual([]);
    expect(detectMatchRecordIntegrity(pruned)).toEqual([]);
    expect(checkAllInvariants(pruned)).toEqual([]);
  });

  it("preserves historical match validity after pruning", () => {
    const state = buildInitialState();
    const { fixture, match, event } = playedEvidence(state);
    const historicalState: GameState = {
      ...state,
      fixtures: state.fixtures.filter((candidate) => candidate.id !== fixture.id),
      matches: [match],
      events: [...state.events, event],
    };

    const violations = checkAllInvariants(historicalState);
    expect(violations.some((violation) => violation.type === "MATCH_PLAYED_MISSING_FIXTURE")).toBe(
      false,
    );
  });

  it("still fails for corrupted historical MatchRecord evidence", () => {
    const state = buildInitialState();
    const { fixture, match, event } = playedEvidence(state);
    const corrupted: GameState = {
      ...state,
      fixtures: state.fixtures.filter((candidate) => candidate.id !== fixture.id),
      matches: [{ ...match, scoreHome: 9 }],
      events: [...state.events, event],
    };

    const violations = checkAllInvariants(corrupted);
    expect(
      violations.some((violation) => violation.type === "MATCH_RECORD_RESULT_MISMATCH"),
    ).toBe(true);
    expect(
      violations.some((violation) => violation.type === "MATCH_PLAYED_HISTORICAL_RESULT_MISMATCH"),
    ).toBe(true);
  });

  it("fails when a retained played fixture has no MatchRecord", () => {
    const state = buildInitialState();
    const { fixture, event } = playedEvidence(state);
    const retained: Fixture = { ...fixture, status: "played", scoreHome: 2, scoreAway: 1 };
    const corrupted: GameState = {
      ...state,
      fixtures: [retained],
      matches: [],
      events: [...state.events, event],
    };

    expect(
      detectMatchRecordIntegrity(corrupted).some(
        (violation) => violation.type === "PLAYED_FIXTURE_MISSING_MATCH_RECORD",
      ),
    ).toBe(true);
  });
});
