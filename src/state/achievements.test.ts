import { describe, expect, it } from "vitest";
import { getConfirmedTrophyAchievements } from "./achievements";
import { buildInitialState } from "./seed";
import { gameReducer } from "./reducer";

describe("confirmed trophy achievements", () => {
  it("detects the user's club winning the completed league", () => {
    const state = buildInitialState();
    const league = state.leagues[state.currentClub.leagueId]!;
    const completed = {
      ...state,
      fixtures: state.fixtures.map((fixture) =>
        fixture.competitionId === league.competitionId
          ? {
              ...fixture,
              status: "played" as const,
              scoreHome: fixture.homeClubId === state.currentClub.id ? 4 : 0,
              scoreAway: fixture.awayClubId === state.currentClub.id ? 4 : 0,
            }
          : fixture,
      ),
    };

    const trophies = getConfirmedTrophyAchievements(completed);
    expect(trophies.some((trophy) => trophy.competitionId === league.competitionId)).toBe(true);
    expect(trophies.find((trophy) => trophy.competitionId === league.competitionId)?.achievement).toBe(
      "Champions",
    );
  });

  it("detects a confirmed cup winner and does not infer a trophy otherwise", () => {
    const state = buildInitialState();
    const cup = state.competitions.find((competition) => competition.type === "cup");
    expect(cup).toBeDefined();

    const winner = {
      ...state,
      competitions: state.competitions.map((competition) =>
        competition.id === cup?.id ? { ...competition, status: "won" as const } : competition,
      ),
    };
    expect(getConfirmedTrophyAchievements(winner).some((trophy) => trophy.competitionId === cup?.id)).toBe(
      true,
    );
    expect(getConfirmedTrophyAchievements(state)).toEqual([]);
  });

  it("keeps multiple confirmed trophies separate", () => {
    const state = buildInitialState();
    const cup = state.competitions.find((competition) => competition.type === "cup");
    const events = [
      {
        id: "winner-cup",
        date: state.time.date,
        type: "COMPETITION_WINNER" as const,
        description: "Cup winner",
        meta: { competitionId: cup?.id, winnerId: state.currentClub.id, competitionName: "National Cup" },
      },
      {
        id: "winner-europe",
        date: state.time.date,
        type: "EUROPEAN_WINNER" as const,
        description: "European winner",
        meta: { competitionId: "continental-test", winnerId: state.currentClub.id, competitionName: "Continental Cup" },
      },
    ];

    const trophies = getConfirmedTrophyAchievements({ ...state, events });
    expect(trophies.map((trophy) => trophy.id)).toEqual([
      "trophy:" + cup?.id + ":2026/27",
      "trophy:continental-test:2026/27",
    ]);
  });

  it("persists the seen flag so a reload cannot show the same trophy again", () => {
    const state = buildInitialState();
    const cup = state.competitions.find((competition) => competition.type === "cup")!;
    const winner = {
      ...state,
      competitions: state.competitions.map((competition) =>
        competition.id === cup.id ? { ...competition, status: "won" as const } : competition,
      ),
    };
    const trophy = getConfirmedTrophyAchievements(winner)[0]!;
    const saved = gameReducer(winner, { type: "MARK_ACHIEVEMENT_SEEN", achievementId: trophy.id });
    const reloaded = { ...saved };

    expect(reloaded.seenAchievementIds).toContain(trophy.id);
    expect(getConfirmedTrophyAchievements(reloaded)).toContainEqual(trophy);
    expect(reloaded.seenAchievementIds).toContain(trophy.id);
  });
});
