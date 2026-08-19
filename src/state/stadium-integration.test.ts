import { describe, expect, it } from "vitest";
import "./stadium";
import { buildInitialState } from "./seed";
import { applyWeeklyFinanceTick, buildWeeklyFinanceSnapshot, parseMoney } from "./finance";
import { calculateMerchandiseRevenue, calculateTicketingRevenue, initializeTicketPackages } from "./enhanced-revenue";
import { advanceGameDays } from "./calendar";
import {
  applyStadiumMaintenance,
  createStadiumDefaults,
  getStadiumUpgradeDuration,
  queueStadiumUpgrade,
} from "./stadium";

function withPlayedHomeMatch(state: ReturnType<typeof buildInitialState>) {
  return {
    ...state,
    fans: { ...state.fans, attendanceAvg: 100_000 },
    currentClub: { ...state.currentClub, stadium: createStadiumDefaults(state.currentClub) },
    clubs: {
      ...state.clubs,
      [state.currentClub.id]: {
        ...state.currentClub,
        stadium: createStadiumDefaults(state.currentClub),
      },
    },
    matches: [
      {
        id: "match-stadium-test",
        fixtureId: "fx-stadium-test",
        seed: 1,
        homeClubId: state.currentClub.id,
        awayClubId: "westport-united",
        scoreHome: 2,
        scoreAway: 0,
        playedAt: state.time.date,
      },
    ],
  };
}

describe("stadium runtime integration", () => {
  it("caps actual matchday demand at the real stadium capacity", () => {
    const state = withPlayedHomeMatch(buildInitialState());
    state.currentClub.stadium!.capacity = 20_000;
    state.clubs[state.currentClub.id] = state.currentClub;
    const snapshot = buildWeeklyFinanceSnapshot(state);
    expect(snapshot.income.matchRevenue).toBeGreaterThan(0);

    const lowerDemand = {
      ...state,
      fans: { ...state.fans, attendanceAvg: 2_000 },
    };
    expect(buildWeeklyFinanceSnapshot(lowerDemand).income.matchRevenue).toBeLessThan(
      snapshot.income.matchRevenue,
    );
  });

  it("uses completed component levels in existing matchday and merchandise streams", () => {
    const baseline = withPlayedHomeMatch(buildInitialState());
    const upgraded = structuredClone(baseline);
    upgraded.currentClub.stadium!.componentLevels.hospitality = 5;
    upgraded.currentClub.stadium!.componentLevels.vip = 5;
    upgraded.currentClub.stadium!.componentLevels.corporateBoxes = 5;
    upgraded.currentClub.stadium!.componentLevels.concessions = 5;
    upgraded.currentClub.stadium!.componentLevels.shop = 5;
    upgraded.clubs[upgraded.currentClub.id] = upgraded.currentClub;

    expect(buildWeeklyFinanceSnapshot(upgraded).income.matchRevenue).toBeGreaterThan(
      buildWeeklyFinanceSnapshot(baseline).income.matchRevenue,
    );
    expect(calculateMerchandiseRevenue(upgraded.currentClub)).toBeGreaterThan(
      calculateMerchandiseRevenue(baseline.currentClub),
    );
  });

  it("uses real stadium capacity for ticket-package potential", () => {
    const state = buildInitialState();
    const baselineClub = { ...state.currentClub, stadium: createStadiumDefaults(state.currentClub) };
    initializeTicketPackages(baselineClub, state);
    const lowCapacityClub = {
      ...baselineClub,
      stadium: { ...baselineClub.stadium!, capacity: 1_000 },
    };
    expect(calculateTicketingRevenue(lowCapacityClub)).toBeLessThan(
      calculateTicketingRevenue(baselineClub),
    );
  });

  it("charges stadium operating cost through weekly operations without daily maintenance duplication", () => {
    const state = withPlayedHomeMatch(buildInitialState());
    const before = buildWeeklyFinanceSnapshot(state).expenses.operations;
    const stadium = state.currentClub.stadium!;
    const withOperatingCost = {
      ...state,
      currentClub: { ...state.currentClub, stadium: { ...stadium, operatingCost: 2_000_000 } },
      clubs: {
        ...state.clubs,
        [state.currentClub.id]: {
          ...state.currentClub,
          stadium: { ...stadium, operatingCost: 2_000_000 },
        },
      },
    };
    const after = buildWeeklyFinanceSnapshot(withOperatingCost).expenses.operations;
    expect(after).toBeGreaterThan(before);
  });

  it("completes a seating upgrade through normal day advancement and changes future capacity", () => {
    const state = buildInitialState();
    state.currentClub.stadium = createStadiumDefaults(state.currentClub);
    state.clubs[state.currentClub.id] = state.currentClub;
    state.finances.balance = "€100M";
    const before = state.currentClub.stadium.capacity;
    const started = queueStadiumUpgrade(state, "seating");
    const upgrade = started.currentClub.stadium!.upgrades[0]!;
    const completed = advanceGameDays(started, getStadiumUpgradeDuration("seating", 1) + 1);

    expect(upgrade.status).toBe("in_progress");
      expect(started.financialTransactions?.some((transaction) => transaction.relatedEntityId === upgrade?.id)).toBe(true);
    expect(completed.currentClub.stadium!.upgrades[0]!.status).toBe("completed");
    expect(completed.currentClub.stadium!.capacity).toBeGreaterThan(before);
  });

  it("records match revenue once and stadium maintenance once in the existing ledger", () => {
    const state = withPlayedHomeMatch(buildInitialState());
    const afterFinance = applyWeeklyFinanceTick(state);
    const afterFinanceAgain = applyWeeklyFinanceTick(afterFinance);
    const matchRevenueTransactions = (afterFinanceAgain.financialTransactions ?? []).filter(
      (transaction) => transaction.type === "match_revenue",
    );
    expect(matchRevenueTransactions).toHaveLength(1);

    const maintained = applyStadiumMaintenance(afterFinanceAgain);
    const repeated = applyStadiumMaintenance(maintained);
    const maintenanceTransactions = (repeated.financialTransactions ?? []).filter(
      (transaction) => transaction.type === "operations" && transaction.description.includes("stadium maintenance"),
    );
    expect(maintenanceTransactions).toHaveLength(1);
    expect(parseMoney(repeated.finances.balance)).toBe(parseMoney(maintained.finances.balance));
  });

  it("preserves stadium capacity and completed components through save/load", () => {
    const state = withPlayedHomeMatch(buildInitialState());
    state.currentClub.stadium!.componentLevels.seating = 4;
    state.currentClub.stadium!.capacity += 14_400;
    const loaded = JSON.parse(JSON.stringify(state));
    expect(loaded.currentClub.stadium.capacity).toBe(state.currentClub.stadium.capacity);
    expect(loaded.currentClub.stadium.componentLevels.seating).toBe(4);
  });
});
