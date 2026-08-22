import { describe, expect, it } from "vitest";
import { buildInitialState } from "@/state/seed";
import { computeLeagueTable } from "@/state/standings";
import type { Fixture, GameState } from "@/state/types";
import {
  applyAiFixtureResults,
  applyAiFixtureResultsBatched,
  type AiFixtureResult,
} from "./ai-fixture-sim";

describe("same-day AI fixture player batching", () => {
  function fixtureState() {
    const state = buildInitialState("batch-equivalence");
    const fixtures = state.fixtures.filter((fixture) => fixture.status === "scheduled");
    const first = fixtures[0];
    const second = fixtures.find(
      (fixture) =>
        fixture.homeClubId !== first?.homeClubId &&
        fixture.homeClubId !== first?.awayClubId &&
        fixture.awayClubId !== first?.homeClubId &&
        fixture.awayClubId !== first?.awayClubId,
    );
    if (!first || !second) throw new Error("Expected independent fixtures");
    return { state, first, second };
  }

  function result(fixture: { id: string; homeClubId: string; awayClubId: string }, home: number, away: number): AiFixtureResult {
    return {
      fixtureId: fixture.id,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      homeStrength: 60,
      awayStrength: 60,
      outcome: home > away ? "H" : home < away ? "A" : "D",
      scoreHome: home,
      scoreAway: away,
      seed: 100 + home + away,
    };
  }

  function resultFor(fixture: Fixture, scoreHome: number, scoreAway: number, seed: number): AiFixtureResult {
    return {
      fixtureId: fixture.id,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      homeStrength: 60,
      awayStrength: 60,
      outcome: scoreHome > scoreAway ? "H" : scoreHome < scoreAway ? "A" : "D",
      scoreHome,
      scoreAway,
      seed,
    };
  }

  function contractState(): { state: GameState; fixtures: Fixture[]; leagueId: string } {
    const initial = buildInitialState("batch-contract");
    const managedClubId = initial.currentClub.id;
    const leagueId = initial.clubs[managedClubId]!.leagueId;
    const competitionId = initial.leagues[leagueId]?.competitionId;
    const leagueFixtures = initial.fixtures.filter(
      (fixture) =>
        fixture.status === "scheduled" &&
        fixture.competitionId === competitionId,
    );
    const fixtures = leagueFixtures.filter(
      (fixture) => fixture.homeClubId === managedClubId || fixture.awayClubId === managedClubId,
    );
    if (fixtures.length < 2) throw new Error("Expected two scheduled managed-club fixtures");

    const selectedFixtures = fixtures.slice(0, 2);
    const selectedClubIds = new Set(
      selectedFixtures.flatMap((fixture) => [fixture.homeClubId, fixture.awayClubId]),
    );
    const clubs = Object.fromEntries(
      [...selectedClubIds].map((clubId) => {
        const club = initial.clubs[clubId]!;
        return [clubId, { ...club, playerIds: [...club.playerIds] }];
      }),
    );
    const players = Object.fromEntries(
      [...selectedClubIds].flatMap((clubId) =>
        clubs[clubId]!.playerIds
          .map((playerId) => [playerId, initial.players[playerId]] as const)
          .filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => Boolean(entry[1])),
      ),
    );
    const state: GameState = {
      ...initial,
      clubs,
      players,
      currentClub: clubs[managedClubId]!,
      manager: { ...initial.manager, clubId: managedClubId },
      leagues: { [leagueId]: initial.leagues[leagueId]! },
      competitions: initial.competitions.filter((competition) => competition.id === competitionId),
      fixtures: selectedFixtures,
      matches: [],
      events: [],
      news: [],
    };
    return { state, fixtures: selectedFixtures, leagueId };
  }

  it.each([[3, 1], [1, 1], [0, 2]])("matches sequential state for %i-%i", (home, away) => {
    const { state, first, second } = fixtureState();
    const results = [result(first, home, away), result(second, away, home)];
    const sequential = applyAiFixtureResults(state, results, state.time.date);
    const batched = applyAiFixtureResultsBatched(state, results, state.time.date);
    expect(batched).toEqual(sequential);
    expect(state.players).not.toBe(batched.players);
  });

  it("returns the original state for zero results", () => {
    const { state } = fixtureState();
    expect(applyAiFixtureResultsBatched(state, [], state.time.date)).toBe(state);
  });

  it("returns the original state when no result is applicable", () => {
    const { state, first } = fixtureState();
    const invalid = result(first, 2, 0);
    invalid.fixtureId = "fixture-does-not-exist";
    expect(applyAiFixtureResultsBatched(state, [invalid], state.time.date)).toBe(state);
  });

  it("falls back to sequential behavior when a player overlap is detected", () => {
    const { state, first } = fixtureState();
    const results = [result(first, 2, 0), result(first, 1, 1)];
    const sequential = applyAiFixtureResults(state, results, state.time.date);
    const batched = applyAiFixtureResultsBatched(state, results, state.time.date);
    expect(batched).toEqual(sequential);
  });

  it("defines the full future batch equivalence contract", () => {
    const { state, fixtures, leagueId } = contractState();
    const [first, second] = fixtures;
    if (!first || !second) throw new Error("Expected two fixtures");

    const invalidResult = resultFor(
      {
        ...first,
        id: "fixture-does-not-exist",
      },
      9,
      0,
      999,
    );
    const results = [
      resultFor(first, 4, 0, 101),
      resultFor(second, 1, 1, 102),
      resultFor(first, 4, 0, 101),
      invalidResult,
    ];
    const pendingState: GameState = {
      ...state,
      pendingManagerFixtureId: first.id,
    };

    const beforeTable = computeLeagueTable(pendingState, leagueId);
    const sequential = applyAiFixtureResults(pendingState, results, pendingState.time.date);
    const batched = applyAiFixtureResultsBatched(pendingState, results, pendingState.time.date);
    const affectedFixtureIds = new Set([first.id, second.id]);
    const affectedClubIds = new Set([
      first.homeClubId,
      first.awayClubId,
      second.homeClubId,
      second.awayClubId,
    ]);
    const affectedPlayerIds = new Set(
      [...affectedClubIds].flatMap((clubId) => pendingState.clubs[clubId]?.playerIds ?? []),
    );

    expect(
      [...affectedFixtureIds].map((fixtureId) =>
        batched.fixtures.find((fixture) => fixture.id === fixtureId),
      ),
    ).toEqual(
      [...affectedFixtureIds].map((fixtureId) =>
        sequential.fixtures.find((fixture) => fixture.id === fixtureId),
      ),
    );
    expect(batched.matches).toEqual(sequential.matches);
    expect(batched.events).toEqual(sequential.events);
    expect(batched.news).toEqual(sequential.news);
    expect(batched.manager).toEqual(sequential.manager);
    expect(batched.fans).toEqual(sequential.fans);
    for (const playerId of affectedPlayerIds) {
      expect(batched.players[playerId]).toEqual(sequential.players[playerId]);
    }
    for (const clubId of affectedClubIds) {
      expect(batched.clubs[clubId]).toEqual(sequential.clubs[clubId]);
    }
    expect(batched.fixtures.filter((fixture) => fixture.status === "played")).toHaveLength(
      pendingState.fixtures.filter((fixture) => fixture.status === "played").length + 2,
    );
    expect(batched.matches.filter((match) => match.fixtureId === first.id)).toHaveLength(1);
    expect(batched.events.filter((event) => event.meta?.fixtureId === first.id)).toHaveLength(1);
    expect(batched.events.filter((event) => event.type === "MATCH_PLAYED")).toHaveLength(2);
    expect(batched.news.some((item) => item.tag === "match")).toBe(true);
    expect(
      (batched.clubs[first.homeClubId]?.aiMemory?.items.length ?? 0) -
        (pendingState.clubs[first.homeClubId]?.aiMemory?.items.length ?? 0),
    ).toBeGreaterThan(0);
    expect(batched.pendingManagerFixtureId).toBeUndefined();

    const afterTable = computeLeagueTable(batched, leagueId);
    expect(afterTable).not.toEqual(beforeTable);
    expect(afterTable.find((row) => row.clubId === first.homeClubId)?.played).toBeGreaterThan(
      beforeTable.find((row) => row.clubId === first.homeClubId)?.played ?? 0,
    );

    const secondSequential = applyAiFixtureResults(pendingState, results, pendingState.time.date);
    const secondBatched = applyAiFixtureResultsBatched(pendingState, results, pendingState.time.date);
    expect(secondSequential.matches).toEqual(sequential.matches);
    expect(secondSequential.events).toEqual(sequential.events);
    expect(secondBatched.matches).toEqual(batched.matches);
    expect(secondBatched.events).toEqual(batched.events);
    expect(batched.matches.map((match) => match.id)).toEqual(sequential.matches.map((match) => match.id));
    expect(batched.events.map((event) => event.id)).toEqual(sequential.events.map((event) => event.id));
    expect(batched.news.map((item) => item.id)).toEqual(sequential.news.map((item) => item.id));
    expect(
      Object.values(batched.players).filter((player, index) => player !== Object.values(pendingState.players)[index]),
    ).not.toHaveLength(0);
  });
});
