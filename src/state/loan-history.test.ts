import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { recordPlayerLoan } from "./player-development";

describe("loan history persistence", () => {
  it("does not duplicate an identical loan record", () => {
    const state = buildInitialState("loan-idempotency");
    const playerId = state.currentClub.playerIds[0]!;
    const first = recordPlayerLoan(state, playerId, "westport-united", "2026-08-01", "2027-06-30");
    const second = recordPlayerLoan(first, playerId, "westport-united", "2026-08-01", "2027-06-30");

    expect(second.players[playerId]?.loanHistory).toEqual(first.players[playerId]?.loanHistory);
    expect(second.players[playerId]?.loanHistory).toHaveLength(1);
  });
});
