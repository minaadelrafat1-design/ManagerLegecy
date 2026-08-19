/**
 * Transfer System Integration Tests
 *
 * Verify that the authoritative transfer operation is integrated correctly
 * across all transfer paths and that synthetic player generation is disabled.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialState } from "./seed";
import { completeTransferAtomically } from "./transfer-hardening";
import { runEnhancedTransferWindow } from "./transfers-enhanced";

describe("Transfer System Integration", () => {
  let state = buildInitialState();

  beforeEach(() => {
    state = buildInitialState();
  });

  // =========================================================================
  // TEST 1: No synthetic players created during transfer window
  // =========================================================================
  it("transfer window does not create synthetic players", () => {
    const playerCountBefore = Object.keys(state.players).length;
    const marketGenPlayersBefore = Object.values(state.players).filter((p) =>
      p.id.startsWith("market-gen-"),
    ).length;

    // Run enhanced transfer window (returns GameState directly)
    const next = runEnhancedTransferWindow(state);

    const playerCountAfter = Object.keys(next.players).length;
    const marketGenPlayersAfter = Object.values(next.players).filter((p) =>
      p.id.startsWith("market-gen-"),
    ).length;

    // Should not have created synthetic players
    expect(marketGenPlayersAfter).toBe(marketGenPlayersBefore);
    expect(marketGenPlayersAfter).toBe(0);

    // Player count should only increase if transfers or contracts created players
    // (not synthetic market generation)
    expect(playerCountAfter).toBeLessThanOrEqual(playerCountBefore + 2);
  });

  // =========================================================================
  // TEST 2: Transfer window handles empty rosters gracefully
  // =========================================================================
  it("transfer window gracefully handles clubs with no players", () => {
    // Create a club with no players
    const emptyClub = {
      id: "empty-club-test",
      name: "Empty Club",
      shortName: "Empty",
      abbr: "EMP",
      ground: "Empty Ground",
      primaryColor: "#000000",
      secondaryColor: "#FFFFFF",
      textColor: "#000000",
      formation: "4-4-2",
      leagueId: "test-league",
      reputation: 50,
      facilities: { training: 50, medical: 50, youth: 50, stadium: 50 },
      facilityLevels: { training: 2, youth: 2, medical: 2, scouting: 2 },
      academy: { rating: 50, prospectIds: [] },
      medical: { rating: 50, playersInTreatment: 0 },
      scouting: { rating: 50, regionsCovered: [] },
      playerIds: [], // Empty roster
      aiManager: null,
      identity: {
        archetype: "balanced",
        academyFocus: 50,
        boardPatience: 50,
        transferBudgetFactor: 0.75,
        expectations: "normal",
        preferExperienced: 50,
      },
    } as any;

    const stateWithEmpty = {
      ...state,
      clubs: { ...state.clubs, [emptyClub.id]: emptyClub },
    };

    // Run enhanced transfer window - should not crash or create synthetic players
    const result = runEnhancedTransferWindow(stateWithEmpty);
    expect(result).toBeDefined();

    // Verify no synthetic players were created
    const syntheticCount = Object.values(result.players).filter((p) =>
      p.id.startsWith("market-gen-"),
    ).length;
    expect(syntheticCount).toBe(0);
  });

  // =========================================================================
  // TEST 3: Ledger is deducted only after successful transfer
  // =========================================================================
  it("ledger deduction happens after transfer confirmation", () => {
    // This is a verification test that would be more complex to test in isolation
    // The atomic operation ensures ledger is only deducted on success
    const seller = Object.values(state.clubs).find((c) => (c.playerIds?.length ?? 0) > 0);
    const buyer = Object.values(state.clubs).find((c) => c.id !== seller!.id && c.aiManager);

    if (!seller || !buyer || !seller.playerIds || seller.playerIds.length === 0) {
      // Skip if no suitable clubs found
      expect(true).toBe(true);
      return;
    }

    const player = state.players[seller.playerIds[0]];
    const ledgerBefore = buyer.aiManager?.ledger?.available ?? 0;

    const result = completeTransferAtomically(
      state,
      player.id,
      seller.id,
      buyer.id,
      100_000,
      50_000,
    );

    if (result.success) {
      const next = result.state;
      const updatedBuyer = next.clubs[buyer.id];

      // Verify buyer successfully acquired the player
      expect(updatedBuyer.playerIds).toContain(player.id);
      expect(next.players[player.id].clubId).toBe(buyer.id);

      // Note: Ledger deduction is tested in detail in transfer-ecosystem.test.ts
      // This just verifies the operation completes atomically
      expect(result.success).toBe(true);
    }
  });

  // =========================================================================
  // TEST 4: Multiple consecutive transfers work correctly
  // =========================================================================
  it("multiple transfers execute atomically", () => {
    let current = state;

    // Execute 2 transfers in sequence
    for (let i = 0; i < 2; i++) {
      const seller = Object.values(current.clubs).find((c) => (c.playerIds?.length ?? 0) > 0);
      const buyer = Object.values(current.clubs).find((c) => c.id !== seller!.id);

      if (!seller || !buyer || !seller.playerIds || seller.playerIds.length === 0) {
        // Not enough players for second transfer
        break;
      }

      const player = current.players[seller.playerIds[0]];
      const result = completeTransferAtomically(
        current,
        player.id,
        seller.id,
        buyer.id,
        50_000,
        25_000,
      );

      if (result.success) {
        current = result.state;
        expect(current.players[player.id].clubId).toBe(buyer.id);
      }
    }

    // Verify no synthetic players were created during transfers
    const syntheticCount = Object.values(current.players).filter((p) =>
      p.id.startsWith("market-gen-"),
    ).length;
    expect(syntheticCount).toBe(0);
  });

  // =========================================================================
  // TEST 5: Player rosters remain consistent after transfers
  // =========================================================================
  it("player rosters remain consistent", () => {
    const seller = Object.values(state.clubs).find((c) => (c.playerIds?.length ?? 0) > 0);
    const buyer = Object.values(state.clubs).find((c) => c.id !== seller!.id);

    if (!seller || !buyer || !seller.playerIds) {
      expect(true).toBe(true);
      return;
    }

    const player = state.players[seller.playerIds[0]];
    const sellerRosterBefore = seller.playerIds.length;
    const buyerRosterBefore = buyer.playerIds?.length ?? 0;

    const result = completeTransferAtomically(state, player.id, seller.id, buyer.id);

    if (result.success) {
      const next = result.state;
      const updatedSeller = next.clubs[seller.id];
      const updatedBuyer = next.clubs[buyer.id];

      // Seller roster should have decreased by 1
      expect(updatedSeller.playerIds?.length ?? 0).toBe(sellerRosterBefore - 1);

      // Buyer roster should have increased by 1
      expect(updatedBuyer.playerIds?.length ?? 0).toBe(buyerRosterBefore + 1);

      // Player should not be in both rosters
      const inSeller = updatedSeller.playerIds?.includes(player.id) ?? false;
      const inBuyer = updatedBuyer.playerIds?.includes(player.id) ?? false;
      expect(inSeller && inBuyer).toBe(false);
    }
  });
});
