import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import {
  acceptTransferSession,
  addNegotiationEntry,
  closeNegotiation,
} from "./negotiation-sessions";
import type { EventLogEntry, GameState, NegotiationSession } from "./types";

function compactState(seed: string): {
  state: GameState;
  playerId: string;
  sellerId: string;
  buyerId: string;
  competingBuyerId: string;
  winnerId: string;
  competingId: string;
  rejectedId: string;
} {
  const initial = buildInitialState(seed);
  const buyerId = initial.currentClub.id;
  const seller = Object.values(initial.clubs).find(
    (club) => club.id !== buyerId && club.playerIds.length > 0,
  );
  const competingBuyer = Object.values(initial.clubs).find(
    (club) => club.id !== buyerId && club.id !== seller?.id,
  );
  if (!seller || !competingBuyer) throw new Error("Expected compact transfer clubs");

  const playerId = seller.playerIds[0];
  if (!playerId) throw new Error("Expected seller player");

  const selectedClubIds = [seller.id, buyerId, competingBuyer.id];
  const clubs = Object.fromEntries(
    selectedClubIds.map((clubId) => {
      const club = initial.clubs[clubId]!;
      return [clubId, { ...club, playerIds: [...club.playerIds] }];
    }),
  );
  const players = Object.fromEntries(
    selectedClubIds.flatMap((clubId) =>
      clubs[clubId]!.playerIds
        .map((id) => [id, initial.players[id]] as const)
        .filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => Boolean(entry[1])),
    ),
  );
  const contracts = (initial.contracts ?? []).filter((contract) => Boolean(players[contract.playerId]));
  const seedEvent: EventLogEntry = {
    id: "event-seed",
    date: initial.time.date,
    type: "milestone",
    description: "Contract test seed event",
    meta: { source: "negotiation-transition-contract" },
  };
  const winnerId = "neg-winner";
  const competingId = "neg-competing";
  const rejectedId = "neg-rejected";
  const offer = {
    fee: 500_000,
    salaryWeekly: 10_000_000,
    years: 3,
    installments: 1,
    signingBonus: 0,
  };
  const session = (id: string, sessionBuyerId: string): NegotiationSession => ({
    id,
    playerId,
    buyerClubId: sessionBuyerId,
    sellerClubId: seller.id,
    status: "open",
    stage: "player",
    type: "transfer",
    entries: [
      {
        id: `${id}-e1`,
        fromClubId: sessionBuyerId,
        offer,
        message: "Initial deterministic offer",
        date: initial.time.date,
      },
    ],
  });
  const state: GameState = {
    ...initial,
    clubs,
    players,
    currentClub: clubs[buyerId]!,
    manager: { ...initial.manager, clubId: buyerId },
    leagues: { [seller.leagueId]: initial.leagues[seller.leagueId]! },
    competitions: initial.competitions.filter(
      (competition) => competition.id === initial.leagues[seller.leagueId]?.competitionId,
    ),
    fixtures: [],
    matches: [],
    contracts,
    finances: {
      ...initial.finances,
      transferBudget: "€20,000,000",
      balance: "€20,000,000",
    },
    board: { ...(initial.board ?? {}), confidence: 90 },
    transfers: [
      {
        id: "listing-contract-player",
        playerId,
        sellerClubId: seller.id,
        loan: false,
        releaseClause: null,
        name: players[playerId]!.name,
        position: players[playerId]!.pos,
        rating: players[playerId]!.overall,
        nationality: players[playerId]!.nationality,
        age: players[playerId]!.age,
        value: players[playerId]!.value,
        status: "new",
      },
    ],
    events: [seedEvent],
    news: [],
    negotiations: [session(winnerId, buyerId), session(competingId, competingBuyer.id), session(rejectedId, competingBuyer.id)],
    meta: {
      ...(initial.meta ?? {}),
      aiLedgers: { ...(initial.meta?.aiLedgers ?? {}) },
    },
    time: {
      ...initial.time,
      date: "2027-01-10",
      season: "2026/27",
    },
  };
  return { state, playerId, sellerId: seller.id, buyerId, competingBuyerId: competingBuyer.id, winnerId, competingId, rejectedId };
}

function runSequentialOracle(seed: string): { initial: GameState; final: GameState; ids: ReturnType<typeof compactState> } {
  const ids = compactState(seed);
  const initial = ids.state;
  let state = initial;

  state = addNegotiationEntry(
    state,
    ids.winnerId,
    ids.sellerId,
    { fee: 500_000, salaryWeekly: 10_000_000, years: 3, installments: 1, signingBonus: 0 },
    "Seller countered with final terms.",
  );
  state = closeNegotiation(state, ids.rejectedId, "rejected", "Seller rejected this offer.");
  state = closeNegotiation(state, ids.competingId, "withdrawn", "Competing session closed after winner selection.");
  state = acceptTransferSession(state, ids.winnerId);

  return { initial, final: state, ids };
}

function contractSnapshot(state: GameState): string {
  return JSON.stringify({
    negotiations: state.negotiations,
    events: state.events,
    players: state.players,
    clubs: state.clubs,
    contracts: state.contracts,
    finances: state.finances,
    transfers: state.transfers,
    meta: state.meta,
    news: state.news,
    manager: state.manager,
    currentClub: state.currentClub,
  });
}

describe("negotiation transition batch contract", () => {
  it("captures a deterministic sequential oracle for a future private draft", () => {
    const first = runSequentialOracle("negotiation-contract-seed");
    const second = runSequentialOracle("negotiation-contract-seed");
    const { final, initial, ids } = first;

    expect(contractSnapshot(final)).toBe(contractSnapshot(second.final));
    expect(final.negotiations.map((session) => session.id)).toEqual([
      ids.winnerId,
      ids.competingId,
      ids.rejectedId,
    ]);
    expect(final.negotiations.find((session) => session.id === ids.winnerId)?.status).toBe("accepted");
    expect(final.negotiations.find((session) => session.id === ids.competingId)?.status).toBe("withdrawn");
    expect(final.negotiations.find((session) => session.id === ids.rejectedId)?.status).toBe("rejected");
    expect(final.negotiations.find((session) => session.id === ids.winnerId)?.entries.map((entry) => entry.id)).toEqual([
      `${ids.winnerId}-e1`,
      `${ids.winnerId}-e2`,
    ]);

    expect(final.events.map((event) => event.id)).toEqual([
      "event-seed",
      "event-neg-2",
      "event-neg-3",
      "event-neg-4",
      "event-transfer-5",
      "event-neg-6",
    ]);
    expect(final.events.map((event) => event.meta?.["action"])).toEqual([
      undefined,
      "negotiation_update",
      "negotiation_close",
      "negotiation_close",
      "transfer_completed",
      "transfer_accepted",
    ]);
    expect(final.events[1]?.meta?.["sessionId"]).toBe(ids.winnerId);
    expect(final.events[2]?.meta?.["sessionId"]).toBe(ids.rejectedId);
    expect(final.events[3]?.meta?.["sessionId"]).toBe(ids.competingId);
    expect(final.events[4]?.meta?.["playerId"]).toBe(ids.playerId);

    expect(final.players[ids.playerId]?.clubId).toBe(ids.buyerId);
    expect(final.clubs[ids.sellerId]?.playerIds).not.toContain(ids.playerId);
    expect(final.clubs[ids.buyerId]?.playerIds).toContain(ids.playerId);

    const playerContract = final.contracts.find((contract) => contract.playerId === ids.playerId);
    expect(playerContract === undefined || playerContract.clubId === ids.buyerId).toBe(true);

    expect(final.finances).not.toEqual(initial.finances);
    expect(final.finances).toBeDefined();
    expect(final.transfers).toEqual(initial.transfers);
    expect(final.meta).toBeDefined();
    expect(Object.keys(final.meta?.aiLedgers ?? {})).toContain("westport-united");
    expect(final.news).toEqual(initial.news);
    expect(final.manager).toEqual(initial.manager);
    expect(final.currentClub).toEqual(initial.currentClub);
  });

  it("requires repeated future transitions to observe the prior private result", () => {
    const { final, ids } = runSequentialOracle("negotiation-repeat-seed");
    const repeatedClose = closeNegotiation(final, ids.competingId, "withdrawn", "Repeated close.");
    const repeatedAccept = acceptTransferSession(repeatedClose, ids.winnerId);
    const missing = addNegotiationEntry(
      repeatedAccept,
      "missing-session",
      ids.sellerId,
      { fee: 1, salaryWeekly: 1, years: 1 },
      "Should be ignored.",
    );

    expect(contractSnapshot(repeatedClose)).toBe(contractSnapshot(final));
    expect(repeatedAccept).toStrictEqual(final);
    expect(missing).toStrictEqual(final);
  });

  it("documents the competing-session closure seam without exporting the private helper", () => {
    const { final, ids } = runSequentialOracle("negotiation-competing-seed");
    const competingSessions = final.negotiations.filter(
      (session) => session.playerId === ids.playerId && session.id !== ids.winnerId,
    );

    expect(competingSessions.map((session) => session.status)).toEqual(["withdrawn", "rejected"]);
    expect(competingSessions.map((session) => session.id)).toEqual([ids.competingId, ids.rejectedId]);
  });
});
