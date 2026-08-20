import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { gameReducer } from "./reducer";

 describe("transfer finance ledger", () => {
  it("keeps enhanced-revenue initialization deterministic across repeated builds", () => {
    const first = buildInitialState("finance-seed-repeat");
    const second = buildInitialState("finance-seed-repeat");

    expect(second.financialTransactions).toEqual(first.financialTransactions);
    expect(second.currentClub.merchandise).toEqual(first.currentClub.merchandise);
    expect(second.currentClub.ticketPackages).toEqual(first.currentClub.ticketPackages);
    expect(second.currentClub.youthProspects).toEqual(first.currentClub.youthProspects);
  });

  it("records transfer fee and annualized wages", () => {
    const state = buildInitialState("transfer-finance-ledger");
    const next = gameReducer(state, {
      type: "RECORD_TRANSFER",
      fee: 5_000_000,
      wageWeeklyDelta: 50_000,
      description: "Signing of striker",
    });

    const transactions = next.financialTransactions ?? [];
    expect(transactions.some((transaction) => transaction.type === "transfer_fee" && transaction.amount === -5_000_000)).toBe(true);
    expect(transactions.some((transaction) => transaction.type === "player_salary" && transaction.amount === -2_600_000)).toBe(true);
  });
});
