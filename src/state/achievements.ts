import { computeLeagueTable } from "./standings";
import type { GameState } from "./types";

export interface TrophyAchievement {
  id: string;
  competitionId: string;
  competitionName: string;
  achievement: "Champions" | "Cup Winners" | "Continental Champions";
  clubName: string;
  season: string;
}

function seasonForCompetition(state: GameState, competitionId: string): string {
  return (
    state.fixtures.find((fixture) => fixture.competitionId === competitionId)?.season ??
    String(state.time.season)
  );
}

export function getConfirmedTrophyAchievements(state: GameState): TrophyAchievement[] {
  const clubId = state.currentClub?.id;
  if (!clubId) return [];

  const achievements = new Map<string, TrophyAchievement>();
  const clubName = state.currentClub.name;

  for (const event of state.events ?? []) {
    if (event.type !== "COMPETITION_WINNER" && event.type !== "EUROPEAN_WINNER") continue;
    const winnerId = event.meta?.['winnerId'] ?? event.meta?.['winner'];
    if (winnerId !== clubId) continue;

    const competitionId = String(event.meta?.['competitionId'] ?? event.meta?.['competition'] ?? event.id);
    const competition = state.competitions.find((item) => item.id === competitionId);
    const competitionName = String(
      event.meta?.['competitionName'] ?? competition?.name ?? event.description,
    );
    const season = String(event.meta?.['season'] ?? seasonForCompetition(state, competitionId));
    const achievement = event.type === "EUROPEAN_WINNER" ? "Continental Champions" : "Cup Winners";
    const id = `trophy:${competitionId}:${season}`;
    achievements.set(id, {
      id,
      competitionId,
      competitionName,
      achievement,
      clubName,
      season,
    });
  }

  for (const competition of state.competitions ?? []) {
    if (competition.status !== "won" || (competition.type !== "cup" && competition.type !== "continental")) {
      continue;
    }
    const id = `trophy:${competition.id}:${seasonForCompetition(state, competition.id)}`;
    achievements.set(id, {
      id,
      competitionId: competition.id,
      competitionName: competition.name,
      achievement: competition.type === "continental" ? "Continental Champions" : "Cup Winners",
      clubName,
      season: seasonForCompetition(state, competition.id),
    });
  }

  for (const league of Object.values(state.leagues ?? {})) {
    if (league.id !== state.currentClub.leagueId) continue;
    const season = String(state.time.season);
    const fixtures = (state.fixtures ?? []).filter(
      (fixture) => fixture.competitionId === league.competitionId && fixture.season === season,
    );
    if (fixtures.length === 0 || fixtures.some((fixture) => fixture.status !== "played")) continue;
    const table = computeLeagueTable(state, league.id);
    if (table[0]?.clubId !== clubId) continue;

    const id = `trophy:${league.competitionId}:${season}`;
    achievements.set(id, {
      id,
      competitionId: league.competitionId,
      competitionName: league.name,
      achievement: "Champions",
      clubName,
      season,
    });
  }

  return [...achievements.values()];
}
