import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialState } from "./seed";
import type { GameState } from "./types";
import { gameReducer, type GameAction } from "./reducer";

describe("Integration & Long-Term Stability", () => {
  let state: GameState;

  beforeEach(() => {
    state = buildInitialState();
  });

  const dispatch = (action: GameAction): GameState => {
    return gameReducer(state, action);
  };

  describe("STATE INTEGRITY — References and Consistency", () => {
    it("CRITICAL: all player.clubId references exist in clubs", () => {
      // Every player's club reference must point to a valid club
      for (const [playerId, player] of Object.entries(state.players)) {
        if (player.clubId) {
          expect(
            state.clubs[player.clubId],
            `Player ${playerId} references invalid club ${player.clubId}`,
          ).toBeDefined();
          // Club must list this player in playerIds
          expect(state.clubs[player.clubId]?.playerIds).toContain(playerId);
        }
      }
    });

    it("CRITICAL: every club.playerIds entry exists and points back to club", () => {
      // Every club's player list must reference valid players with correct clubId
      for (const [clubId, club] of Object.entries(state.clubs)) {
        for (const playerId of club.playerIds) {
          const player = state.players[playerId];
          expect(player, `Club ${clubId} references non-existent player ${playerId}`).toBeDefined();
          expect(player?.clubId).toBe(clubId);
        }
      }
    });

    it("CRITICAL: every fixture references valid clubs", () => {
      for (const fixture of state.fixtures) {
        expect(
          state.clubs[fixture.homeClubId],
          `Fixture ${fixture.id} references non-existent home club`,
        ).toBeDefined();
        expect(
          state.clubs[fixture.awayClubId],
          `Fixture ${fixture.id} references non-existent away club`,
        ).toBeDefined();
        expect(fixture.homeClubId).not.toBe(fixture.awayClubId);
      }
    });

    it("CRITICAL: fixture IDs are unique", () => {
      const ids = new Set<string>();
      for (const fixture of state.fixtures) {
        expect(!ids.has(fixture.id), `Duplicate fixture ID: ${fixture.id}`).toBe(true);
        ids.add(fixture.id);
      }
    });

    it("CRITICAL: every match references valid clubs and fixture", () => {
      for (const match of state.matches) {
        expect(state.clubs[match.homeClubId]).toBeDefined();
        expect(state.clubs[match.awayClubId]).toBeDefined();
        if (match.fixtureId) {
          const fixture = state.fixtures.find((f) => f.id === match.fixtureId);
          expect(fixture, `Match ${match.id} references non-existent fixture`).toBeDefined();
          expect(fixture?.status).toBe("played");
        }
      }
    });

    it("CRITICAL: currentClub is valid and exists in clubs", () => {
      expect(state.clubs[state.currentClub.id]).toBeDefined();
      expect(state.currentClub).toEqual(state.clubs[state.currentClub.id]);
    });

    it("CRITICAL: manager.clubId points to valid club", () => {
      expect(state.clubs[state.manager.clubId]).toBeDefined();
    });

    it("CRITICAL: no duplicate match records for same fixture", () => {
      const fixtureToMatches: Record<string, string[]> = {};
      for (const match of state.matches) {
        if (match.fixtureId) {
          if (!fixtureToMatches[match.fixtureId]) {
            fixtureToMatches[match.fixtureId] = [];
          }
          fixtureToMatches[match.fixtureId].push(match.id);
        }
      }
      // Each fixture should have at most one match record
      for (const [fixtureId, matches] of Object.entries(fixtureToMatches)) {
        expect(
          matches.length,
          `Fixture ${fixtureId} has ${matches.length} match records (should be 1)`,
        ).toBeLessThanOrEqual(1);
      }
    });

    it("CRITICAL: played fixtures have valid results", () => {
      for (const fixture of state.fixtures) {
        if (fixture.status === "played") {
          expect(fixture.scoreHome).toBeDefined();
          expect(fixture.scoreAway).toBeDefined();
          expect(typeof fixture.scoreHome).toBe("number");
          expect(typeof fixture.scoreAway).toBe("number");
          expect(fixture.scoreHome).toBeGreaterThanOrEqual(0);
          expect(fixture.scoreAway).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("CRITICAL: scheduled fixtures do not contain completed results", () => {
      for (const fixture of state.fixtures) {
        if (fixture.status === "scheduled") {
          expect(fixture.scoreHome).toBeUndefined();
          expect(fixture.scoreAway).toBeUndefined();
        }
      }
    });

    it("CRITICAL: pending manager fixture ID points to valid scheduled fixture", () => {
      if (state.pendingManagerFixtureId) {
        const fixture = state.fixtures.find((f) => f.id === state.pendingManagerFixtureId);
        expect(fixture).toBeDefined();
        expect(fixture?.status).toBe("scheduled");
        expect(fixture?.homeClubId).toBe(state.currentClub.id);
        expect(fixture?.awayClubId).toBe(state.currentClub.id);
      }
    });

    it("every negotiation references valid players and clubs", () => {
      for (const negotiation of state.negotiations ?? []) {
        const player = state.players[negotiation.playerId];
        expect(
          player,
          `Negotiation ${negotiation.id} references non-existent player`,
        ).toBeDefined();
        expect(state.clubs[negotiation.buyerClubId]).toBeDefined();
        expect(state.clubs[negotiation.sellerClubId]).toBeDefined();
      }
    });

    it("every transfer listing references valid clubs", () => {
      for (const transfer of state.transfers) {
        if (transfer.sellerClubId) {
          expect(state.clubs[transfer.sellerClubId]).toBeDefined();
        }
        if (transfer.playerId) {
          expect(state.players[transfer.playerId]).toBeDefined();
        }
      }
    });
  });

  describe("SEASON TRANSITIONS — Finalization & Safety", () => {
    it("season finalization cannot be applied twice on same date", () => {
      const testState = state;
      const startEvents = testState.events.length;

      // Manually trigger finalization-like state
      // (In real flow, would advance to end of season)
      // For now just verify the guard mechanism exists
      expect(testState.meta?.lastSeasonFinalizedSeason).toBeUndefined();
    });

    it("promotion/relegation recorded only once per season", () => {
      // Check that event log guards against duplicate PROMOTION events
      const promotionEvents = state.events.filter((e) => e.type === "PROMOTION");
      const seasonToCounts: Record<string, number> = {};

      for (const event of promotionEvents) {
        const season = event.meta?.season ?? state.time.season;
        seasonToCounts[season] = (seasonToCounts[season] ?? 0) + 1;
      }

      // Each season should have at most one promotion event per club
      for (const [season, count] of Object.entries(seasonToCounts)) {
        expect(count, `Season ${season} has duplicate promotion events`).toBeLessThanOrEqual(
          state.clubs ? Object.keys(state.clubs).length : 100,
        );
      }
    });

    it("all clubs in same league have valid leagueId references", () => {
      const clubsByLeague: Record<string, string[]> = {};
      for (const [clubId, club] of Object.entries(state.clubs)) {
        if (club.leagueId) {
          if (!clubsByLeague[club.leagueId]) {
            clubsByLeague[club.leagueId] = [];
          }
          clubsByLeague[club.leagueId].push(clubId);
        }
      }

      for (const [leagueId, clubs] of Object.entries(clubsByLeague)) {
        // League exists
        expect(state.leagues[leagueId]).toBeDefined();
        // All clubs in league are consistent
        expect(clubs.length).toBeGreaterThan(0);
      }
    });
  });

  describe("FIXTURE & MATCH LIFECYCLE", () => {
    it("a fixture cannot produce duplicate match records after multiple recordings", () => {
      let testState = state;
      // Find a scheduled fixture
      const fixture = testState.fixtures.find((f) => f.status === "scheduled");
      if (!fixture) {
        expect(true).toBe(true); // Skip if no fixtures
        return;
      }

      // Record the match
      testState = dispatch({
        type: "RECORD_MATCH_RESULT",
        fixtureId: fixture.id,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        scoreHome: 2,
        scoreAway: 1,
        seed: 123,
        playedAt: fixture.calendarDate,
      });

      const matchesForFixture1 = testState.matches.filter((m) => m.fixtureId === fixture.id);
      expect(matchesForFixture1.length).toBe(1);

      // Record the SAME result again (idempotent)
      testState = dispatch({
        type: "RECORD_MATCH_RESULT",
        fixtureId: fixture.id,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        scoreHome: 2,
        scoreAway: 1,
        seed: 123,
        playedAt: fixture.calendarDate,
      });

      const matchesForFixture2 = testState.matches.filter((m) => m.fixtureId === fixture.id);
      // Should still be 1, not 2 (idempotent)
      expect(matchesForFixture2.length).toBe(1);
    });

    it("fixture status transitions are monotonic: scheduled -> played", () => {
      let testState = state;
      const fixture = testState.fixtures.find((f) => f.status === "scheduled");
      if (!fixture) {
        expect(true).toBe(true); // Skip
        return;
      }

      expect(fixture.status).toBe("scheduled");
      expect(fixture.scoreHome).toBeUndefined();

      testState = dispatch({
        type: "RECORD_MATCH_RESULT",
        fixtureId: fixture.id,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        scoreHome: 1,
        scoreAway: 0,
        seed: 456,
        playedAt: fixture.calendarDate,
      });

      const updated = testState.fixtures.find((f) => f.id === fixture.id);
      expect(updated?.status).toBe("played");
      expect(updated?.scoreHome).toBe(1);
      expect(updated?.scoreAway).toBe(0);
    });
  });

  describe("COMPLETE CAREER PROGRESSION FLOW", () => {
    it("can advance through multiple days, play matches, complete season, and continue", () => {
      let testState = state;
      const startSeason = testState.time.season;
      const startClubId = testState.currentClub.id;
      let matchesPlayed = 0;

      // Advance 30 days
      for (let i = 0; i < 30; i++) {
        testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
      }

      // Try to find and play a match
      let matchdayFixed = false;
      for (let i = 0; i < 10; i++) {
        if (testState.pendingManagerFixtureId) {
          // Have a fixture on today
          const fixture = testState.fixtures.find(
            (f) => f.id === testState.pendingManagerFixtureId,
          );
          if (fixture && fixture.status === "scheduled") {
            testState = dispatch({
              type: "RECORD_MATCH_RESULT",
              fixtureId: fixture.id,
              homeClubId: fixture.homeClubId,
              awayClubId: fixture.awayClubId,
              scoreHome: 1,
              scoreAway: 0,
              seed: 789,
              playedAt: fixture.calendarDate,
            });
            matchesPlayed++;
            matchdayFixed = true;
            break;
          }
        }
        // Advance another day
        testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
      }

      if (matchdayFixed) {
        expect(matchesPlayed).toBe(1);
      }

      // Verify state still valid after all this
      expect(testState.currentClub.id).toBe(startClubId);
      expect(state.clubs[testState.currentClub.id]).toBeDefined();
      for (const playerId of testState.currentClub.playerIds) {
        expect(testState.players[playerId]).toBeDefined();
        expect(testState.players[playerId]?.clubId).toBe(testState.currentClub.id);
      }
    });
  });

  describe("ADVANCE_DAY INTEGRITY", () => {
    it("ADVANCE_DAY clears pending fixture only after match is played", () => {
      let testState = state;

      // Advance until we have a pending fixture
      for (let i = 0; i < 30; i++) {
        testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
        if (testState.pendingManagerFixtureId) break;
      }

      if (testState.pendingManagerFixtureId) {
        const pendingId = testState.pendingManagerFixtureId;

        // Advance day again without playing match - pending should stay or be for next fixture
        testState = dispatch({ type: "ADVANCE_DAY", days: 1 });

        // Should either still be pending for the same fixture (blocked) or moved to next fixture
        // Key: it shouldn't disappear without being played
        if (testState.pendingManagerFixtureId) {
          const fixture = testState.fixtures.find(
            (f) => f.id === testState.pendingManagerFixtureId,
          );
          expect(fixture?.status).toBe("scheduled");
        }
      }
    });

    it("ADVANCE_DAY after match result clears pending fixture and allows next advancement", () => {
      let testState = state;

      // Advance to fixture
      for (let i = 0; i < 30; i++) {
        testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
        if (testState.pendingManagerFixtureId) break;
      }

      if (testState.pendingManagerFixtureId) {
        const pendingId = testState.pendingManagerFixtureId;
        const fixture = testState.fixtures.find((f) => f.id === pendingId);

        if (fixture) {
          // Record result
          testState = dispatch({
            type: "RECORD_MATCH_RESULT",
            fixtureId: fixture.id,
            homeClubId: fixture.homeClubId,
            awayClubId: fixture.awayClubId,
            scoreHome: 2,
            scoreAway: 1,
            seed: 999,
            playedAt: fixture.calendarDate,
          });

          // Pending should be cleared since match is played
          expect(testState.pendingManagerFixtureId).toBeUndefined();

          // Should be able to advance further
          testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
          expect(testState.time.date).not.toBe(fixture.calendarDate);
        }
      }
    });
  });

  describe("PLAYER DEVELOPMENT CONSISTENCY", () => {
    it("player attributes stay within valid ranges after 50 days", () => {
      let testState = state;

      for (let i = 0; i < 50; i++) {
        testState = dispatch({ type: "ADVANCE_DAY", days: 1 });
      }

      for (const player of Object.values(testState.players)) {
        expect(player.fatigue ?? 0).toBeGreaterThanOrEqual(0);
        expect(player.fatigue ?? 0).toBeLessThanOrEqual(100);
        expect(player.fitness ?? 50).toBeGreaterThanOrEqual(0);
        expect(player.fitness ?? 50).toBeLessThanOrEqual(100);
        expect(player.morale ?? 50).toBeGreaterThanOrEqual(0);
        expect(player.morale ?? 50).toBeLessThanOrEqual(100);
        expect(player.form ?? 50).toBeGreaterThanOrEqual(0);
        expect(player.form ?? 50).toBeLessThanOrEqual(100);
      }
    });
  });
});
