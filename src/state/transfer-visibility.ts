import type { GameState, EventLogEntry, NegotiationSession } from "./types";

export function filterVisibleNegotiations(
  state: GameState,
  managerClubId: string,
): NegotiationSession[] {
  const managerClub = state.clubs[managerClubId];
  const managerLeagueId = managerClub?.leagueId;

  return (state.negotiations ?? []).filter((session) => {
    const clubIds = [session.buyerClubId, session.sellerClubId].filter(Boolean) as string[];
    if (clubIds.length === 0) return false;

    return clubIds.some((clubId) => {
      if (clubId === managerClubId) return true;
      const club = state.clubs[clubId];
      return Boolean(club && club.leagueId === managerLeagueId);
    });
  });
}

export function filterVisibleTransferEvents(
  state: GameState,
  managerClubId: string,
  shortlistPlayerIds: string[] = [],
): EventLogEntry[] {
  const shortlist = new Set(shortlistPlayerIds);
  const managerClub = state.clubs[managerClubId];
  const managerLeagueId = managerClub?.leagueId;

  return (state.events ?? []).filter((event) => {
    if (
      event.type !== "transfer" &&
      event.type !== "TRANSFER_COMPLETED" &&
      event.type !== "TRANSFER_ACCEPTED"
    ) {
      return false;
    }

    const meta = event.meta ?? {};
    const playerId = meta["playerId"] as string | undefined;
    const fromClubId = meta["fromClubId"] as string | undefined;
    const toClubId = meta["toClubId"] as string | undefined;

    if (playerId && shortlist.has(playerId)) {
      return true;
    }

    const clubIds = [fromClubId, toClubId].filter(Boolean) as string[];

    if (clubIds.length === 0) {
      return false;
    }

    return clubIds.some((clubId) => {
      const club = state.clubs[clubId];
      if (!club) return false;
      return club.leagueId === managerLeagueId || club.id === managerClubId;
    });
  });
}
