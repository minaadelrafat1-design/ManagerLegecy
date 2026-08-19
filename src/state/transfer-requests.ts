import { registerDailyHook } from "./calendar";
import { listPlayerForTransfer } from "./ai-transfers";
import type { GameState } from "./types";
import { seededUnit } from "./utils";

/**
 * Monitor player morale and contract status to generate transfer requests.
 * - Very low morale (< 30) can trigger transfer requests
 * - Unsatisfied/unfulfilled contracts can trigger requests
 * - Players unhappy with playing time also request transfers
 * Uses deterministic seeding to avoid random spikes.
 */
function generateTransferRequests(state: GameState): GameState {
  let next = state;
  const today = state.time.date;

  // OPTIMIZATION: Only check manager's club players to avoid iterating all players in the game
  const managedClubId = state.currentClub.id;
  const managedClub = state.clubs[managedClubId];
  const playerIds = managedClub?.playerIds ?? [];

  for (const playerId of playerIds) {
    const player = next.players[playerId];
    if (!player || !player.clubId) continue;

    // Skip if player is already listed for transfer
    const alreadyListed = (next.transfers ?? []).find((t) => t.playerId === playerId);
    if (alreadyListed) continue;

    const morale = player.morale ?? 50;
    const contractYears = player.contractYears ?? 2;
    const personality = player.personality ?? "Professional";

    // Personality affects unhappiness tolerance
    const moralThreshold = ["Temperamental", "Volatile", "Unsettled"].includes(personality)
      ? 35
      : 25;

    // Chance to request transfer based on morale, contract, and personality
    let transferChance = 0;

    if (morale < moralThreshold) {
      // Very unhappy - likely to request transfer
      transferChance = 0.08 + ((moralThreshold - morale) / 100) * 0.12; // up to 20% per day
    }

    if (contractYears === 0) {
      // Contract expiring soon = higher chance to leave (handled elsewhere but bump here)
      transferChance = Math.max(transferChance, 0.02);
    }

    if (transferChance > 0) {
      const seed = `${today}|transfer-request|${playerId}`;
      const roll = seededUnit(seed);

      if (roll < transferChance) {
        // Player requests transfer
        const club = next.clubs[player.clubId];
        if (club) {
          // List player for transfer with meta indicating it's a request not a club decision
          next = listPlayerForTransfer(next, playerId, player.clubId, {
            status: "new",
            releaseClause: null,
          });

          // Create a news item about the request
          const nid = `news-transfer-request-${(next.news?.length ?? 0) + 1}`;
          next = {
            ...next,
            news: [
              ...(next.news ?? []),
              {
                id: nid,
                tag: "transfer",
                time: today,
                text: `${player.name} requests transfer from ${club.name}`,
              },
            ],
          };

          // Add event for manager to see
          const eid = `event-transfer-request-${(next.events?.length ?? 0) + 1}`;
          next = {
            ...next,
            events: [
              ...(next.events ?? []),
              {
                id: eid,
                date: today,
                type: "transfer",
                description: `${player.name} has requested transfer (morale: ${morale})`,
                meta: {
                  action: "transfer_request",
                  playerId,
                  clubId: player.clubId,
                  reason: morale < moralThreshold ? "low-morale" : "contract-expiring",
                },
              },
            ],
          };
        }
      }
    }
  }

  return next;
}

registerDailyHook("events", (state: GameState) => {
  // OPTIMIZATION: Only process transfer requests every 3 days
  // Reduces overhead since player morale changes aren't instant
  const dayOfCycle = state.time.day % 3;
  if (dayOfCycle !== 0) return state;

  return generateTransferRequests(state);
});

export {};
