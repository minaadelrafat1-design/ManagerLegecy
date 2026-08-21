import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { createTransactionDraft } from "./transaction-local";

describe("transaction-local state writes", () => {
  it("preserves exact serialized state across multi-write transfer and event updates", () => {
    const base = buildInitialState();
    const seller = Object.values(base.clubs).find((club) => (club.playerIds?.length ?? 0) > 0)!;
    const buyer = Object.values(base.clubs).find((club) => club.id !== seller.id)!;
    const player = base.players[seller.playerIds[0]]!;

    const direct = {
      ...base,
      players: {
        ...base.players,
        [player.id]: { ...player, clubId: buyer.id },
      },
      clubs: {
        ...base.clubs,
        [seller.id]: {
          ...seller,
          playerIds: seller.playerIds.filter((id) => id !== player.id),
        },
        [buyer.id]: {
          ...buyer,
          playerIds: [...new Set([...buyer.playerIds, player.id])],
        },
      },
      events: [
        ...base.events,
        {
          id: `event-transfer-${base.events.length + 1}`,
          date: base.time.date,
          type: "TRANSFER_COMPLETED",
          description: `${seller.name} -> ${buyer.name}: ${player.name}`,
          meta: {
            playerId: player.id,
            fromClubId: seller.id,
            toClubId: buyer.id,
          },
        },
      ],
    };

    const draft = createTransactionDraft(base);
    draft.setPlayer(player.id, { ...player, clubId: buyer.id });
    draft.setClub(seller.id, {
      ...seller,
      playerIds: seller.playerIds.filter((id) => id !== player.id),
    });
    draft.setClub(buyer.id, {
      ...buyer,
      playerIds: [...new Set([...buyer.playerIds, player.id])],
    });
    draft.pushEvent({
      id: `event-transfer-${base.events.length + 1}`,
      date: base.time.date,
      type: "TRANSFER_COMPLETED",
      description: `${seller.name} -> ${buyer.name}: ${player.name}`,
      meta: {
        playerId: player.id,
        fromClubId: seller.id,
        toClubId: buyer.id,
      },
    });

    const next = draft.commit();
    expect(JSON.stringify(next)).toBe(JSON.stringify(direct));
    expect(next.players[player.id]?.clubId).toBe(buyer.id);
    expect(next.clubs[seller.id]?.playerIds).not.toContain(player.id);
    expect(next.clubs[buyer.id]?.playerIds).toContain(player.id);
  });
});
