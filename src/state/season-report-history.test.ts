import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { buildEndOfSeasonReport, finalizeSeasonIfNeeded } from "./season";

describe("historical season report snapshots", () => {
  function completedState() {
    const state = buildInitialState();
    const season = String(state.time.season);
    const playerId = state.currentClub.playerIds[0]!;
    return {
      ...state,
      time: {
        ...state.time,
        date: "2027-05-31",
      },
      fixtures: state.fixtures.map((fixture) =>
        fixture.season === season ? { ...fixture, status: "played" as const, scoreHome: 2, scoreAway: 0 } : fixture,
      ),
      players: {
        ...state.players,
        [playerId]: {
          ...state.players[playerId],
          seasonGoals: 12,
          seasonAssists: 5,
          playingTime: { appearancesThisSeason: 20, startsThisSeason: 18, minutesThisSeason: 1600 },
        },
      },
      events: [
        ...state.events,
        {
          id: "transfer-season-1",
          date: "2026-09-01",
          type: "TRANSFER_COMPLETED" as const,
          description: "Arrival",
          meta: { fromClubId: "other", toClubId: state.currentClub.id, playerId, fee: 2_000_000 },
        },
        {
          id: "transfer-old",
          date: "2025-09-01",
          type: "TRANSFER_COMPLETED" as const,
          description: "Old arrival",
          meta: { fromClubId: "other", toClubId: state.currentClub.id, playerId, fee: 9_000_000 },
        },
      ],
      financialTransactions: [
        {
          id: "season-match",
          date: "2026-10-01",
          type: "match_revenue" as const,
          description: "Matchday",
          amount: 100_000,
          category: "revenue" as const,
        },
        {
          id: "season-transfer",
          date: "2026-09-01",
          type: "transfer_fee" as const,
          description: "Arrival fee",
          amount: -2_000_000,
          category: "expense" as const,
        },
        {
          id: "old-transfer",
          date: "2025-09-01",
          type: "transfer_fee" as const,
          description: "Old fee",
          amount: -9_000_000,
          category: "expense" as const,
        },
      ],
    };
  }

  it("uses season-scoped awards, transfers, and finances", () => {
    const state = completedState();
    const report = buildEndOfSeasonReport(state)!;
    expect(report.squad.topScorer?.goals).toBe(12);
    expect(report.squad.topAssists?.assists).toBe(5);
    expect(report.transfers.arrivals).toBe(1);
    expect(report.transfers.spending).toBe(2_000_000);
    expect(report.finances.matchdayIncome).toBe(100_000);
    expect(report.finances.transferSpending).toBe(2_000_000);
    expect(report.finances.revenue).toBe(100_000);
  });

  it("retains old report values after later state changes and season finalization", () => {
    const initial = completedState();
    const first = finalizeSeasonIfNeeded(initial);
    const snapshot = first.seasonReport!;
    const playerId = first.currentClub.playerIds[0]!;
    const later = {
      ...first,
      players: { ...first.players, [playerId]: { ...first.players[playerId], seasonGoals: 40 } },
      financialTransactions: [
        ...(first.financialTransactions ?? []),
        {
          id: "future-income",
          date: "2027-09-01",
          type: "match_revenue" as const,
          description: "Future match",
          amount: 999_999,
          category: "revenue" as const,
        },
      ],
    };

    expect(later.seasonReport).toEqual(snapshot);
    expect(later.seasonReports).toContainEqual(snapshot);
    expect(later.seasonReport?.squad.topScorer?.goals).toBe(12);
    const reloaded = JSON.parse(JSON.stringify(later));
    expect(reloaded.seasonReports).toContainEqual(snapshot);
    expect(reloaded.seasonReport).toEqual(snapshot);
  });
});
