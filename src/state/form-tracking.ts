import type { GameState, MatchRecord } from "./types";

/**
 * PERF: Process today's match results in batch instead of looping through all matches.
 * Only called for the ONE match that just finished on the current date.
 * Returns map of playerId -> formDelta to apply in batch.
 */
export function computeTodayMatchFormDeltas(
  state: GameState,
  todayMatches: MatchRecord[],
): Map<string, number> {
  const deltas = new Map<string, number>();
  const today = state.time.date;

  for (const match of todayMatches) {
    if (!match.playedAt || match.playedAt !== today) continue;

    const homeWin = match.scoreHome > match.scoreAway;
    const awayWin = match.scoreAway > match.scoreHome;
    const draw = match.scoreHome === match.scoreAway;

    const homeResultFactor = homeWin ? 1.0 : draw ? 0.5 : -0.3;
    const awayResultFactor = awayWin ? 1.0 : draw ? 0.5 : -0.3;

    const homeFormDelta = Math.round(homeResultFactor * 12);
    const awayFormDelta = Math.round(awayResultFactor * 12);

    // Batch update deltas
    if (match.homeClubId) {
      const homeClub = state.clubs[match.homeClubId];
      if (homeClub) {
        for (const pid of homeClub.playerIds) {
          deltas.set(pid, (deltas.get(pid) ?? 0) + homeFormDelta);
        }
      }
    }
    if (match.awayClubId) {
      const awayClub = state.clubs[match.awayClubId];
      if (awayClub) {
        for (const pid of awayClub.playerIds) {
          deltas.set(pid, (deltas.get(pid) ?? 0) + awayFormDelta);
        }
      }
    }
  }

  return deltas;
}

/**
 * PERF: Apply batched form updates once instead of spreads per player.
 * Called after computing all deltas for the day.
 */
export function applyFormDeltas(state: GameState, deltas: Map<string, number>): GameState {
  if (deltas.size === 0) return state;

  const updatedPlayers = { ...state.players };
  for (const [playerId, delta] of deltas) {
    const player = state.players[playerId];
    if (!player) continue;
    const newForm = Math.max(30, Math.min(100, (player.form ?? 50) + delta));
    updatedPlayers[playerId] = { ...player, form: newForm };
  }

  return { ...state, players: updatedPlayers };
}

/**
 * PERF: Decay form for inactive players only on matchdays.
 * Scans only the last 3 recent matches per club instead of all 7 days of history.
 * Skip decay entirely if club had a match today (just updated form above).
 */
export function decayInactivePlayerForm(state: GameState, hadMatchToday: boolean): GameState {
  if (hadMatchToday) return state;

  const managedClubId = state.currentClub?.id ?? state.manager?.clubId;
  if (!managedClubId) return state;

  const club = state.clubs[managedClubId];
  const playerIds = club?.playerIds ?? [];
  if (playerIds.length === 0) return state;

  const recentMatches = (state.matches ?? [])
    .slice(-10) // PERF: Only check last 10 matches, not all history
    .filter((m) => m.playedAt); // Only matches with dates

  const playedClubs = new Set<string>();
  for (const match of recentMatches) {
    playedClubs.add(match.homeClubId);
    playedClubs.add(match.awayClubId);
  }

  // Only decay if no recent match
  if (playedClubs.has(managedClubId)) return state;

  const updatedPlayers = { ...state.players };
  for (const playerId of playerIds) {
    const player = state.players[playerId];
    if (!player || player.injury) continue;

    const decay = Math.round((50 - (player.form ?? 50)) * 0.01);
    const newForm = Math.max(30, Math.min(100, (player.form ?? 50) + decay));
    updatedPlayers[playerId] = { ...player, form: newForm };
  }

  return { ...state, players: updatedPlayers };
}
