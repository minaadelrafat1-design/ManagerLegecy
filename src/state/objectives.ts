import type { GameState } from "./types";

function makeId(prefix: string, n: number) {
  return `${prefix}-${n}`;
}

/** Generate or refresh board objectives based on real club state.
 * Called weekly to ensure objectives reflect season progress and finances.
 */
export function generateBoardObjectives(state: GameState): GameState {
  const clubId = state.manager?.clubId ?? state.currentClub?.id;
  if (!clubId) return state;

  const club = state.clubs[clubId];
  if (!club) return state;

  const expectations: GameState["board"]["expectations"] = [];

  // League objective: derive based on club tier/reputation
  const maxClubs = 20;
  const targetTier =
    club.reputation >= 70 ? "top" : club.reputation >= 50 ? "mid" : "avoid_relegation";
  const leagueObj = {
    id: makeId("obj-league", state.time.day || 0),
    kind: "league_position",
    description:
      targetTier === "top"
        ? "Finish in top positions"
        : targetTier === "mid"
          ? "Secure mid-table"
          : "Avoid relegation",
    progress: 0,
    target:
      targetTier === "top"
        ? Math.max(1, Math.floor(maxClubs * 0.2))
        : targetTier === "mid"
          ? Math.max(1, Math.floor(maxClubs * 0.5))
          : maxClubs,
  } as any;
  expectations.push(leagueObj);

  // Financial objective: keep positive balance or reduce losses
  const balance = parseInt(String(state.finances?.balance ?? 0)) || 0;
  expectations.push({
    id: makeId("obj-finance", state.time.day || 1),
    kind: "finance",
    description: "Maintain stable finances",
    progress: 0,
    target: Math.max(0, balance),
  } as any);

  // Youth development: promote at least one academy prospect per season for clubs with academy
  if (club.academy?.rating && club.academy.rating > 40) {
    expectations.push({
      id: makeId("obj-youth", state.time.day || 2),
      kind: "youth_promotion",
      description: "Promote youth prospects",
      progress: 0,
      target: 1,
    } as any);
  }

  // Facility improvement objective if facilities low
  if ((club.facilities?.stadium ?? 0) < 40) {
    expectations.push({
      id: makeId("obj-facility", state.time.day || 3),
      kind: "facility_upgrade",
      description: "Plan facility upgrades",
      progress: 0,
      target: 1,
    } as any);
  }

  return { ...state, board: { ...(state.board ?? {}), expectations } } as GameState;
}

export {};
