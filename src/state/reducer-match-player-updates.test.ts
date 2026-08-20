import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { calculateMatchPlayerUpdates, gameReducer } from "./reducer";

function matchFixtureState() {
  const state = buildInitialState("match-player-updates");
  const fixture = state.fixtures.find((item) => item.status === "scheduled");
  if (!fixture) throw new Error("Expected a scheduled fixture");
  return { state, fixture };
}

describe("pure match player update calculation", () => {
  it.each([
    [3, 1],
    [1, 1],
    [0, 2],
  ])("matches reducer player results for %i-%i", (scoreHome, scoreAway) => {
    const { state, fixture } = matchFixtureState();
    const playerRatings = Object.fromEntries(
      [...(state.clubs[fixture.homeClubId]?.playerIds ?? []), ...(state.clubs[fixture.awayClubId]?.playerIds ?? [])].map(
        (playerId, index) => [playerId, 4.5 + (index % 5)],
      ),
    );
    const updates = calculateMatchPlayerUpdates(
      state,
      state.clubs[fixture.homeClubId]?.playerIds ?? [],
      state.clubs[fixture.awayClubId]?.playerIds ?? [],
      scoreHome,
      scoreAway,
      playerRatings,
    );
    const next = gameReducer(state, {
      type: "RECORD_MATCH_RESULT",
      fixtureId: fixture.id,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      scoreHome,
      scoreAway,
      seed: 123,
      playedAt: fixture.calendarDate,
      playerRatings,
    });

    for (const [playerId, player] of updates) {
      expect(next.players[playerId]).toEqual(player);
    }
    expect(next.players).not.toBe(state.players);
  });

  it("does not mutate the input player dictionary and ignores missing IDs", () => {
    const { state, fixture } = matchFixtureState();
    const before = JSON.stringify(state.players);
    const updates = calculateMatchPlayerUpdates(
      state,
      [...(state.clubs[fixture.homeClubId]?.playerIds ?? []), "missing-player"],
      ["missing-away-player"],
      2,
      0,
    );
    expect(updates.size).toBeGreaterThan(0);
    expect(state.players).toEqual(JSON.parse(before));
  });
});
