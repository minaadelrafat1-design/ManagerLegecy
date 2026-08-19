import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { calculateOfferValue } from "./negotiation";
import {
  acceptTransferSession,
  startTransferNegotiation,
  submitTransferOffer,
} from "./negotiation-sessions";
import type { GameState } from "./types";
import { gameReducer } from "./reducer";

function getTestClubs(state: GameState) {
  const seller = Object.values(state.clubs).find((club) => club.playerIds.length > 0)!;
  const buyer = Object.values(state.clubs).find((club) => club.id !== seller.id)!;
  return { seller, buyer, player: state.players[seller.playerIds[0]!]! };
}

describe("staged transfer negotiation", () => {
  it("keeps contracted players in place until club and player terms are accepted", () => {
    let state = buildInitialState();
    const { seller, buyer, player } = getTestClubs(state);
    const offer = {
      fee: Math.max(player.marketValue * 2, 10_000_000),
      installments: 2,
      sellOnPercent: 15,
      sellOnClause: true,
      salaryWeekly: 100_000,
      years: 3,
    };

    state = startTransferNegotiation(state, buyer.id, player.id, offer);
    expect(state.negotiations).toHaveLength(1);
    expect(state.negotiations![0]!.stage).toBe("club");
    expect(state.players[player.id]!.clubId).toBe(seller.id);

    state = acceptTransferSession(state, state.negotiations![0]!.id);
    const playerStage = state.negotiations!.find((session) => session.stage === "player")!;
    expect(playerStage).toBeDefined();
    expect(state.players[player.id]!.clubId).toBe(seller.id);

    state = acceptTransferSession(state, playerStage.id);
    expect(state.players[player.id]!.clubId).toBe(buyer.id);
    expect(state.clubs[seller.id]!.playerIds).not.toContain(player.id);
    expect(state.clubs[buyer.id]!.playerIds).toContain(player.id);
  });

  it("skips club talks for a free agent and completes only after player terms", () => {
    let state = buildInitialState();
    const buyer = state.currentClub;
    const source = Object.values(state.clubs).find((club) => club.id !== buyer.id && club.playerIds.length > 0)!;
    const player = state.players[source.playerIds[0]!]!;
    state = {
      ...state,
      players: { ...state.players, [player.id]: { ...player, clubId: undefined } },
      clubs: { ...state.clubs, [source.id]: { ...source, playerIds: source.playerIds.filter((id) => id !== player.id) } },
    };

    state = startTransferNegotiation(state, buyer.id, player.id, {
      fee: 0,
      salaryWeekly: 100_000,
      years: 3,
    });
    expect(state.negotiations![0]!.stage).toBe("player");
    state = acceptTransferSession(state, state.negotiations![0]!.id);
    expect(state.players[player.id]!.clubId).toBe(buyer.id);
  });

  it("prevents duplicate active approaches and values structured terms deterministically", () => {
    const state = buildInitialState();
    const { buyer, player } = getTestClubs(state);
    const offer = {
      fee: 1_000_000,
      upfrontPayment: 500_000,
      futurePayment: 500_000,
      addOns: 2_000_000,
      appearanceBonuses: 1_000_000,
      playerPlusCash: 250_000,
      sellOnPercent: 20,
    };
    const first = startTransferNegotiation(state, buyer.id, player.id, offer);
    const second = startTransferNegotiation(first, buyer.id, player.id, offer);
    expect(second.negotiations).toHaveLength(1);
    expect(calculateOfferValue(offer)).toBe(2_662_500);
    expect(JSON.parse(JSON.stringify(second)).negotiations).toEqual(second.negotiations);
  });

  it("routes a submitted offer through the AI response instead of fabricating a chat reply", () => {
    let state = buildInitialState();
    const { seller, buyer, player } = getTestClubs(state);
    state = startTransferNegotiation(state, buyer.id, player.id, { fee: 1, salaryWeekly: 100_000, years: 3 });
    const sessionId = state.negotiations![0]!.id;
    state = submitTransferOffer(state, sessionId, { fee: player.marketValue, salaryWeekly: 100_000, years: 3 });
    const session = state.negotiations!.find((item) => item.id === sessionId)!;
    const playerStage = state.negotiations!.find((item) => item.playerId === player.id && item.stage === "player");
    expect(session.status).toBe("accepted");
    expect(playerStage?.entries.some((entry) => entry.message.includes("Club terms agreed"))).toBe(true);
    expect(state.players[player.id]!.clubId).toBe(seller.id);
  });

  it("persists shortlist add, remove, and clear actions", () => {
    const state = buildInitialState();
    const player = Object.values(state.players)[0]!;
    const added = gameReducer(state, { type: "ADD_TO_SHORTLIST", playerId: player.id });
    expect(added.shortlistPlayerIds).toContain(player.id);
    const removed = gameReducer(added, { type: "REMOVE_FROM_SHORTLIST", playerId: player.id });
    expect(removed.shortlistPlayerIds).not.toContain(player.id);
    const restored = gameReducer(removed, { type: "ADD_TO_SHORTLIST", playerId: player.id });
    expect(gameReducer(restored, { type: "CLEAR_SHORTLIST" }).shortlistPlayerIds).toEqual([]);
  });

  it("returns an AI response when the manager approaches a contracted player", () => {
    const state = buildInitialState();
    const { buyer, player } = getTestClubs(state);
    const next = gameReducer(state, {
      type: "CREATE_NEGOTIATION",
      buyerClubId: buyer.id,
      sellerClubId: player.clubId!,
      playerId: player.id,
      offer: { fee: 1, salaryWeekly: 100_000, years: 3 },
      negotiationType: "transfer",
    });
    const session = next.negotiations?.find((item) => item.playerId === player.id && item.buyerClubId === buyer.id);
    expect(session?.entries.length).toBeGreaterThan(1);
  });
});