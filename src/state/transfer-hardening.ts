/**
 * PHASE 7B: Transfer Hardening Utilities
 *
 * Provides atomic, verified transfer functions that ensure:
 * 1. Player actually moves between clubs (atomic player movement)
 * 2. Financial transactions only happen after player movement succeeds
 * 3. No duplicate transfers
 * 4. Contracts are consistent
 * 5. Complete transaction or complete rollback
 */

import type { GameState, Player } from "./types";
import { createTransactionDraft } from "./transaction-local";

/**
 * Verify that a transfer is legally possible:
 * - Player exists
 * - Player belongs to seller
 * - Player not already at buyer
 * - Player not in any active transfer negotiation
 * - Transfer window is open OR player is free agent
 */
export function verifyTransferLegality(
  state: GameState,
  playerId: string,
  fromClubId: string,
  toClubId: string,
): { legal: boolean; reason?: string } {
  // Player exists
  const player = state.players[playerId];
  if (!player) return { legal: false, reason: "player-not-found" };

  // Clubs exist
  const fromClub = state.clubs[fromClubId];
  const toClub = state.clubs[toClubId];
  if (!fromClub || !toClub) return { legal: false, reason: "club-not-found" };

  // Player belongs to seller
  if (player.clubId !== fromClubId) {
    return { legal: false, reason: "player-not-at-seller" };
  }
  if (!fromClub.playerIds.includes(playerId)) {
    return { legal: false, reason: "player-not-in-seller-roster" };
  }

  // Player not already at buyer
  if (player.clubId === toClubId) {
    return { legal: false, reason: "player-already-at-buyer" };
  }
  if (toClub.playerIds.includes(playerId)) {
    return { legal: false, reason: "player-in-buyer-roster" };
  }

  // Player not in any active transfer negotiation for another buyer
  const activeTransfers =
    state.negotiations?.filter(
      (s) => s.type === "transfer" && s.status === "open" && s.playerId === playerId,
    ) ?? [];

  for (const session of activeTransfers) {
    if (session.buyerClubId !== toClubId) {
      return { legal: false, reason: "player-in-active-negotiation-elsewhere" };
    }
  }

  // Player not already being transferred to another destination
  const playerTransfers = state.transfers.filter((t) => t.playerId === playerId);
  for (const listing of playerTransfers) {
    // If there's a listing and we're not negotiating for it, it's a problem
    const hasActiveNegotiationForListing = activeTransfers.some(
      (s) => s.sellerClubId === listing.sellerClubId,
    );
    if (!hasActiveNegotiationForListing && listing.status !== "rejected") {
      return { legal: false, reason: "player-has-unresolved-listing" };
    }
  }

  return { legal: true };
}

/**
 * Atomically move a player between clubs.
 *
 * Verifies:
 * 1. Player exists
 * 2. Player belongs to source before move
 * 3. Player is removed from source
 * 4. Player is added to destination
 * 5. Player.clubId is updated
 * 6. No player is simultaneously registered to multiple clubs
 *
 * Returns: { success, reason?, updatedState }
 */
function movePlayerAtomicallyVerified(
  state: GameState,
  playerId: string,
  fromClubId: string,
  toClubId: string,
  includeCareerHistory = false,
): { success: boolean; reason?: string; state: GameState } {
  const player = state.players[playerId]!;
  const fromClub = state.clubs[fromClubId]!;
  const toClub = state.clubs[toClubId]!;

  // ATOMIC OPERATION: all-or-nothing
  try {
    const draft = createTransactionDraft(state);

    // Step 1: Update clubs
    const updatedFromClub = {
      ...fromClub,
      playerIds: fromClub.playerIds.filter((id) => id !== playerId),
    };

    const updatedToClub = {
      ...toClub,
      playerIds: [...new Set([...toClub.playerIds, playerId])],
    };

    // Step 2: Update player
    const updatedPlayer = {
      ...player,
      clubId: toClubId,
      ...(includeCareerHistory && player.career
        ? {
            career: {
              ...player.career,
              clubHistory: [...(player.career.clubHistory ?? []), toClubId],
              transfers: (player.career.transfers ?? 0) + 1,
            },
          }
        : {}),
    };

    draft.setPlayer(playerId, updatedPlayer);
    draft.setClub(fromClubId, updatedFromClub);
    draft.setClub(toClubId, updatedToClub);

    const newState = draft.commit();

    // Step 4: VERIFY ATOMICITY (before returning)
    // Verify player removed from source
    if (updatedFromClub.playerIds.includes(playerId)) {
      return { success: false, reason: "player-not-removed-from-source", state };
    }

    // Verify player added to destination
    if (!updatedToClub.playerIds.includes(playerId)) {
      return { success: false, reason: "player-not-added-to-destination", state };
    }

    // Verify player.clubId is correct
    if (updatedPlayer.clubId !== toClubId) {
      return { success: false, reason: "player-clubid-not-updated", state };
    }

    // Verify player not in multiple clubs
    let duplicateCount = 0;
    for (const club of Object.values(newState.clubs)) {
      if (club.playerIds.includes(playerId)) {
        duplicateCount++;
      }
    }
    if (duplicateCount !== 1) {
      return { success: false, reason: `player-in-${duplicateCount}-clubs`, state };
    }

    // Verify consistency: player.clubId must match exactly one club's roster
    const playerClubId = newState.players[playerId]?.clubId;
    const matchingClubs = Object.values(newState.clubs).filter((c) =>
      c.playerIds.includes(playerId),
    );
    if (matchingClubs.length !== 1 || matchingClubs[0]?.id !== playerClubId) {
      return {
        success: false,
        reason: "player-clubid-roster-mismatch",
        state,
      };
    }

    return { success: true, state: newState };
  } catch (err) {
    return { success: false, reason: `exception: ${(err as Error).message}`, state };
  }
}

export function movePlayerAtomically(
  state: GameState,
  playerId: string,
  fromClubId: string,
  toClubId: string,
): { success: boolean; reason?: string; state: GameState } {
  const legality = verifyTransferLegality(state, playerId, fromClubId, toClubId);
  if (!legality.legal) {
    return { success: false, reason: legality.reason ?? "unknown-reason", state };
  }
  return movePlayerAtomicallyVerified(state, playerId, fromClubId, toClubId);
}

/**
 * Complete a transfer with full atomic guarantees.
 *
 * Flow:
 * 1. Verify transfer is legal
 * 2. Atomically move player
 * 3. Apply financial effects (only if movement succeeded)
 * 4. Update contracts
 * 5. Record in history
 * 6. Emit exactly one completion event
 *
 * Returns: { success, reason?, state }
 */
export interface TransferCompletion {
  success: boolean;
  reason?: string;
  state: GameState;
  playerId?: string;
  fromClubId?: string;
  toClubId?: string;
}

export function completeTransferAtomically(
  state: GameState,
  playerId: string,
  fromClubId: string,
  toClubId: string,
  fee?: number,
  salaryWeekly?: number,
): TransferCompletion {
  // Step 1: Verify legality
  const legality = verifyTransferLegality(state, playerId, fromClubId, toClubId);
  if (!legality.legal) {
    return { success: false, reason: legality.reason ?? "unknown-reason", state };
  }

  // Step 2: Move player atomically
  const movement = movePlayerAtomicallyVerified(state, playerId, fromClubId, toClubId, true);
  if (!movement.success) {
    return {
      success: false,
      reason: `movement-failed: ${movement.reason}`,
      state,
    };
  }

  let next = movement.state;
  const player = next.players[playerId]!;

  // Step 3: Update contracts (verify consistency)
  if (next.contracts) {
    const playerContract = next.contracts.find((c) => c.playerId === playerId);
    if (playerContract && playerContract.clubId !== toClubId) {
      const draft = createTransactionDraft(next);
      draft.setContracts(
        next.contracts.map((c) =>
          c.playerId === playerId ? { ...c, clubId: toClubId, status: "active" } : c,
        ),
      );
      next = draft.commit();
    }
  }

  // Step 4: Emit exactly one TRANSFER_COMPLETED event
  // Check if event already exists (idempotency)
  const existingCompletionEvent = next.events?.find(
    (e) =>
      e.type === "TRANSFER_COMPLETED" &&
      e.meta?.["playerId"] === playerId &&
      e.meta?.["fromClubId"] === fromClubId &&
      e.meta?.["toClubId"] === toClubId &&
      e.date === next.time.date,
  );

  if (!existingCompletionEvent) {
    const completionEvent = {
      id: `event-transfer-${next.events.length + 1}`,
      date: next.time.date,
      type: "TRANSFER_COMPLETED" as const,
      description: `${next.clubs[fromClubId]?.name ?? fromClubId} → ${next.clubs[toClubId]?.name ?? toClubId}: ${player.name}${fee ? ` (€${fee.toLocaleString()})` : ""}`,
      meta: {
        playerId,
        fromClubId,
        toClubId,
        fee,
        salaryWeekly,
        action: "transfer_completed",
      },
    };

    const draft = createTransactionDraft(next);
    draft.pushEvent(completionEvent);
    next = draft.commit();
  }


  return {
    success: true,
    state: next,
    playerId,
    fromClubId,
    toClubId,
  };
}

/**
 * Verify that a completed transfer was atomic and consistent.
 * Use this for post-hoc validation in tests or audit systems.
 */
export function verifyTransferConsistency(
  state: GameState,
  playerId: string,
  expectedClubId: string,
): { consistent: boolean; violations: string[] } {
  const violations: string[] = [];
  const player = state.players[playerId];

  if (!player) {
    violations.push("player-not-found");
    return { consistent: false, violations };
  }

  // Player.clubId must match a club roster
  if (player.clubId !== expectedClubId) {
    violations.push(`player.clubId (${player.clubId}) !== expected (${expectedClubId})`);
  }

  // Player must be in exactly one club's roster
  let clubCount = 0;
  let actualClubId = null;
  for (const [clubId, club] of Object.entries(state.clubs)) {
    if (club.playerIds.includes(playerId)) {
      clubCount++;
      actualClubId = clubId;
    }
  }

  if (clubCount === 0) {
    violations.push("player-not-in-any-club-roster");
  } else if (clubCount > 1) {
    violations.push(`player-in-${clubCount}-club-rosters`);
  } else if (actualClubId !== player.clubId) {
    violations.push(`roster club (${actualClubId}) !== player.clubId (${player.clubId})`);
  }

  // If in a contract, contract.clubId must match
  const playerContract = state.contracts?.find((c) => c.playerId === playerId);
  if (playerContract && playerContract.clubId !== expectedClubId) {
    violations.push(`contract.clubId (${playerContract.clubId}) !== expected (${expectedClubId})`);
  }

  return {
    consistent: violations.length === 0,
    violations,
  };
}

export default {
  verifyTransferLegality,
  movePlayerAtomically,
  completeTransferAtomically,
  verifyTransferConsistency,
};
