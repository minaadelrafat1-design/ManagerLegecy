import { describe, it, expect } from "vitest";
import type { GameState } from "./types";
import { filterVisibleTransferEvents } from "./transfer-visibility";

describe("Transfer visibility filtering", () => {
  it("only shows transfer activity for the manager league or shortlist players", () => {
    const state = {
      currentClub: { id: "club-1", leagueId: "league-1" },
      clubs: {
        "club-1": { id: "club-1", leagueId: "league-1", name: "Home" },
        "club-2": { id: "club-2", leagueId: "league-1", name: "Rivals" },
        "club-3": { id: "club-3", leagueId: "league-2", name: "Other League" },
      },
      events: [
        {
          id: "e1",
          date: "2026-01-01",
          type: "TRANSFER_COMPLETED",
          description: "Home signed a player",
          meta: { playerId: "p1", fromClubId: "club-3", toClubId: "club-1" },
        },
        {
          id: "e2",
          date: "2026-01-02",
          type: "TRANSFER_COMPLETED",
          description: "Other league transfer",
          meta: { playerId: "p2", fromClubId: "club-3", toClubId: "club-4" },
        },
        {
          id: "e3",
          date: "2026-01-03",
          type: "TRANSFER_COMPLETED",
          description: "Shortlist player moved",
          meta: { playerId: "p3", fromClubId: "club-5", toClubId: "club-6" },
        },
      ],
    } as unknown as GameState;

    const visible = filterVisibleTransferEvents(state, "club-1", ["p3"]);
    expect(visible.map((e) => e.id)).toEqual(["e1", "e3"]);
  });
});
