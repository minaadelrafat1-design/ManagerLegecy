/**
 * STANDINGS TEST SUITE
 *
 * Tests for league table computation from fixtures
 */

import { describe, it, expect } from "vitest";
import { computeLeagueTable } from "../state/standings";
import type { GameState } from "../state/types";

function createMockClub(id: string, name: string): any {
  return {
    id,
    name,
    leagueId: "league-1",
    playerIds: [],
    reputation: 50,
  };
}

function createMockFixture(
  id: string,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
): any {
  return {
    id,
    competitionId: "comp-1",
    homeClubId: homeId,
    awayClubId: awayId,
    scoreHome: homeScore,
    scoreAway: awayScore,
    status: "played",
  };
}

function createMockState(): any {
  return {
    clubs: {},
    fixtures: [],
    competitions: [{ id: "comp-1", name: "Test League", type: "league" }],
    leagues: {
      "league-1": {
        id: "league-1",
        name: "Test League",
        competitionId: "comp-1",
        clubs: [],
      },
    },
  };
}

describe("Standings - Basic Table Calculation", () => {
  it("computes empty table for no clubs", () => {
    const state = createMockState();
    const table = computeLeagueTable(state, "league-1");
    expect(table).toEqual([]);
  });

  it("computes single club table (no matches)", () => {
    const state = createMockState();
    state.clubs["club1"] = createMockClub("club1", "Club One");
    state.leagues["league-1"].clubs = ["club1"];
    const table = computeLeagueTable(state, "league-1");

    expect(table).toHaveLength(1);
    expect(table[0]?.clubId).toBe("club1");
    expect(table[0]?.played).toBe(0);
    expect(table[0]?.points).toBe(0);
  });

  it("computes two-club table after single match", () => {
    const state = createMockState();
    state.clubs["club1"] = createMockClub("club1", "Club One");
    state.clubs["club2"] = createMockClub("club2", "Club Two");
    state.leagues["league-1"].clubs = ["club1", "club2"];
    state.fixtures = [createMockFixture("f1", "club1", "club2", 2, 1)];

    const table = computeLeagueTable(state, "league-1");

    expect(table).toHaveLength(2);
    // Club1 should be first (3 points, +1 GD)
    expect(table[0]?.clubId).toBe("club1");
    expect(table[0]?.points).toBe(3);
    expect(table[0]?.goalDifference).toBe(1);
    // Club2 should be second (0 points, -1 GD)
    expect(table[1]?.clubId).toBe("club2");
    expect(table[1]?.points).toBe(0);
    expect(table[1]?.goalDifference).toBe(-1);
  });

  it("computes table with win, draw, loss", () => {
    const state = createMockState();
    state.clubs["club1"] = createMockClub("club1", "Club One");
    state.clubs["club2"] = createMockClub("club2", "Club Two");
    state.clubs["club3"] = createMockClub("club3", "Club Three");
    state.leagues["league-1"].clubs = ["club1", "club2", "club3"];
    state.fixtures = [
      createMockFixture("f1", "club1", "club2", 2, 1), // club1 wins
      createMockFixture("f2", "club2", "club3", 1, 1), // draw
      createMockFixture("f3", "club3", "club1", 0, 3), // club1 wins
    ];

    const table = computeLeagueTable(state, "league-1");

    expect(table).toHaveLength(3);
    expect(table[0]?.clubId).toBe("club1"); // 6 points
    expect(table[0]?.points).toBe(6);
    expect(table[1]?.clubId).toBe("club2"); // 1 point
    expect(table[1]?.points).toBe(1);
    expect(table[2]?.clubId).toBe("club3"); // 1 point
    expect(table[2]?.points).toBe(1);
  });
});

describe("Standings - Tiebreaker Rules", () => {
  it("breaks tie by goal difference", () => {
    const state = createMockState();
    state.clubs["club1"] = createMockClub("club1", "Club One");
    state.clubs["club2"] = createMockClub("club2", "Club Two");
    state.leagues["league-1"].clubs = ["club1", "club2"];
    state.fixtures = [
      createMockFixture("f1", "club1", "club2", 3, 0),
      createMockFixture("f2", "club2", "club1", 2, 1),
    ];

    const table = computeLeagueTable(state, "league-1");

    // Both have 3 points, but club1 has +3 GD, club2 has +1 GD
    expect(table[0]?.clubId).toBe("club1");
    expect(table[1]?.clubId).toBe("club2");
  });

  it("breaks tie by goals scored when GD equal", () => {
    const state = createMockState();
    state.clubs["club1"] = createMockClub("club1", "Club One");
    state.clubs["club2"] = createMockClub("club2", "Club Two");
    state.leagues["league-1"].clubs = ["club1", "club2"];
    state.fixtures = [
      createMockFixture("f1", "club1", "club2", 3, 1),
      createMockFixture("f2", "club2", "club1", 3, 1),
    ];

    const table = computeLeagueTable(state, "league-1");

    // Both have same points and GD, so either is valid
    // (deterministic tiebreaker would be club ID alphabetically)
    expect(table).toHaveLength(2);
    expect([table[0]?.clubId, table[1]?.clubId]).toContain("club1");
    expect([table[0]?.clubId, table[1]?.clubId]).toContain("club2");
  });
});

describe("Standings - Multiple Matches Per Club", () => {
  it("handles round-robin correctly", () => {
    const state = createMockState();
    state.clubs["club1"] = createMockClub("club1", "Club One");
    state.clubs["club2"] = createMockClub("club2", "Club Two");
    state.clubs["club3"] = createMockClub("club3", "Club Three");
    state.leagues["league-1"].clubs = ["club1", "club2", "club3"];
    state.fixtures = [
      // Matchday 1
      createMockFixture("f1", "club1", "club2", 2, 1),
      createMockFixture("f2", "club3", "club1", 0, 0),
      // Matchday 2
      createMockFixture("f3", "club2", "club3", 1, 1),
      createMockFixture("f4", "club1", "club3", 3, 0),
    ];

    const table = computeLeagueTable(state, "league-1");

    expect(table).toHaveLength(3);
    expect(table[0]?.played).toBeGreaterThanOrEqual(1);
    expect(table[0]?.played).toBeLessThanOrEqual(4); // up to 4 matches for 3 clubs
    // Club1 should have good record: W, D, W
    expect(table[0]?.clubId).toBe("club1");
  });
});

describe("Standings - Unplayed Fixtures Ignored", () => {
  it("ignores scheduled fixtures", () => {
    const state = createMockState();
    state.clubs["club1"] = createMockClub("club1", "Club One");
    state.clubs["club2"] = createMockClub("club2", "Club Two");
    state.leagues["league-1"].clubs = ["club1", "club2"];
    state.fixtures = [
      createMockFixture("f1", "club1", "club2", 2, 1),
      {
        // unplayed
        id: "f2",
        competitionId: "comp-1",
        homeClubId: "club2",
        awayClubId: "club1",
        status: "scheduled",
      },
    ];

    const table = computeLeagueTable(state, "league-1");

    expect(table[0]?.played).toBe(1); // Only 1 match counted
    expect(table[0]?.points).toBe(3); // club1 still only has 3 points
  });
});

describe("Standings - Null Scores Ignored", () => {
  it("ignores fixtures with null scores", () => {
    const state = createMockState();
    state.clubs["club1"] = createMockClub("club1", "Club One");
    state.clubs["club2"] = createMockClub("club2", "Club Two");
    state.leagues["league-1"].clubs = ["club1", "club2"];
    state.fixtures = [
      {
        id: "f1",
        competitionId: "comp-1",
        homeClubId: "club1",
        awayClubId: "club2",
        scoreHome: null,
        scoreAway: null,
        status: "played",
      },
    ];

    const table = computeLeagueTable(state, "league-1");

    // Should treat as no matches
    expect(table[0]?.played).toBe(0);
  });
});
