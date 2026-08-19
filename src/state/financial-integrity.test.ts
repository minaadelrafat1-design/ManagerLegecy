import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { runAiActions } from "./ai-actions";
import { auditTransferLedgers } from "../lib/ledger-audit";
import { computeClubFinancials } from "./club-finance";

describe("financial integrity", () => {
  it("keeps AI ledger wage commitments aligned with the actual roster", () => {
    const state = buildInitialState();
    const clubId = Object.values(state.clubs).find(
      (club) => club.aiManager && club.id !== state.currentClub.id,
    )?.id;

    expect(clubId).toBeTruthy();
    if (!clubId) return;

    const after = runAiActions(state);
    const report = auditTransferLedgers(after);
    const club = after.clubs[clubId];
    const actualWeeklyWages = club.playerIds.reduce((sum, playerId) => {
      const player = after.players[playerId];
      if (!player || player.status === "retired") return sum;
      const salary = Number(String(player.salary ?? "€0").replace(/[^\d.-]/g, "")) || 0;
      return sum + salary;
    }, 0);
    const ledger = after.meta?.aiLedgers?.[clubId];

    expect(report.issues).toEqual([]);
    expect(ledger?.currentWageCommitment ?? 0).toBeCloseTo(actualWeeklyWages, 0);
    expect(computeClubFinancials(after, clubId).wageCommitmentsWeekly ?? 0).toBeCloseTo(
      actualWeeklyWages,
      0,
    );
  });
});
