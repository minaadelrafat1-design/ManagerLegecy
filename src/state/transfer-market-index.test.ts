import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { buildTransferMarketIndex, determineSquadNeedForClub, identifyTransferTargets } from "./ai-decisions";

describe("transfer market index", () => {
  it("groups valid listings by position and keeps deterministic ordering", () => {
    const base = buildInitialState();
    const clubId = Object.keys(base.clubs)[0]!;

    const listings = [
      {
        id: "listing-2",
        playerId: "p-2",
        sellerClubId: "club-b",
        name: "Alpha Striker",
        position: "ST",
        rating: 79,
        nationality: "FR",
        age: 24,
        value: "€18M",
        status: "new",
      },
      {
        id: "listing-1",
        playerId: "p-1",
        sellerClubId: "club-a",
        name: "Beta Striker",
        position: "ST",
        rating: 77,
        nationality: "BR",
        age: 26,
        value: "€16M",
        status: "new",
      },
      {
        id: "listing-3",
        playerId: "p-3",
        sellerClubId: "club-c",
        name: "Gamma Midfielder",
        position: "CM",
        rating: 74,
        nationality: "DE",
        age: 29,
        value: "€12M",
        status: "new",
      },
    ] as any;

    const state = {
      ...base,
      transfers: listings,
      clubs: {
        ...base.clubs,
        [clubId]: {
          ...base.clubs[clubId],
          aiManager: {
            ...base.clubs[clubId].aiManager,
            transferPriorities: ["value-for-money", "youth-potential"],
          },
        },
      },
    };

    const index = buildTransferMarketIndex(state);

    expect(index.byPosition.get("ST")?.map((listing) => listing.id)).toEqual(["listing-2", "listing-1"]);
    expect(index.listingById.get("listing-1")?.id).toBe("listing-1");

    const need = determineSquadNeedForClub(state, clubId);
    const targets = identifyTransferTargets(state, clubId, 3, need, index);
    const sortedByScore = [...targets].sort(
      (a, b) => b.score - a.score || a.listingId.localeCompare(b.listingId),
    );

    expect(targets.length).toBeLessThanOrEqual(3);
    expect(targets.map((target) => target.listingId)).toEqual(
      sortedByScore.map((target) => target.listingId),
    );
  });
});
