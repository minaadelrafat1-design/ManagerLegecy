import type { GameState } from "./types";
import { seededUnit } from "./utils";
import { buildTransferOffer } from "./ai-transfers";
import {
  createNegotiationSession,
  addNegotiationEntry,
  acceptTransferSession,
} from "./negotiation-sessions";
import { evaluateOffer } from "./negotiation";

/** Enhanced transfer window: creates deterministic negotiation sessions
 * between AI clubs and resolves them using the existing negotiation
 * evaluation logic. Updates state with accepted transfers and events.
 */
export function runEnhancedTransferWindow(state: GameState): GameState {
  let next = { ...state } as GameState;
  const clubs = Object.values(next.clubs);
  if (clubs.length < 2) return state;

  const attempts = Math.max(1, Math.floor(clubs.length / 6));
  const events = [...(next.events ?? [])];

  for (let i = 0; i < attempts; i++) {
    const seller = clubs[Math.floor(seededUnit(`${state.time.date}:sell:${i}`) * clubs.length)];
    if (!seller) continue;
    const buyer = clubs[Math.floor(seededUnit(`${state.time.date}:buy:${i}`) * clubs.length)];
    if (!buyer || buyer.id === seller.id) continue;

    // Skip clubs with no players - don't create synthetic market players.
    // Player generation should happen in legitimate world-building, not transfer simulation.
    if ((seller.playerIds?.length ?? 0) === 0) {
      continue;
    }

    const playerId =
      seller.playerIds[
        Math.floor(seededUnit(`${state.time.date}:sellp:${i}`) * seller.playerIds.length)
      ];
    if (!playerId) continue;

    const player = next.players?.[playerId];
    if (!player) continue;

    const offer = buildTransferOffer(next, buyer, {
      id: `market-listing-${i}`,
      playerId,
      sellerClubId: seller.id,
      name: player.name,
      position: player.pos,
      rating: player.overall,
      nationality: player.nationality,
      age: player.age,
      value: player.value ?? "€0",
      status: "new",
    });

    // Multiple negotiation rounds (up to 3) to resolve transfers
    let sessionState = createNegotiationSession(
      next,
      buyer.id,
      seller.id,
      playerId,
      offer,
      "AI initial offer",
      "transfer",
    );
    let currentOffer = offer;
    let transferred = false;

    for (let round = 0; round < 3 && !transferred; round++) {
      const result = evaluateOffer(sessionState, buyer.id, seller.id, playerId, currentOffer);

      if (result.outcome === "accepted" && result.offer) {
        const sessionId = sessionState.negotiations?.slice(-1)[0]?.id;
        if (sessionId) {
          const acceptedState = acceptTransferSession(sessionState, sessionId);
          next = {
            ...acceptedState,
            transfers: acceptedState.transfers.filter((listing) => listing.playerId !== playerId),
          };
        } else {
          next = sessionState;
        }
        events.push({
          id: `event-transfer-${events.length + 1}`,
          date: next.time.date,
          type: "transfer",
          description: `${player.name} moved ${seller.name} -> ${buyer.name} for ${result.offer.fee}`,
        } as any);
        transferred = true;
      } else if (result.outcome === "counter" && result.offer && round < 2) {
        // Continue negotiation with counter-offer
        const sessionId = sessionState.negotiations?.slice(-1)[0]?.id;
        if (sessionId) {
          sessionState = addNegotiationEntry(
            sessionState,
            sessionId,
            seller.id,
            result.offer,
            result.message,
          );
        }
        currentOffer = result.offer;
        // On round 2, buyer accepts counter (negotiation pressure)
        if (round === 1) {
          // Buyer's turn: evaluate if they can afford the counter
          const buyerResult = evaluateOffer(
            sessionState,
            seller.id,
            buyer.id,
            playerId,
            result.offer,
          );
          if (buyerResult.outcome !== "rejected") {
            currentOffer = result.offer;
          }
        }
      } else {
        events.push({
          id: `event-transfer-pass-${events.length + 1}`,
          date: next.time.date,
          type: "transfer",
          description: `No deal for ${player.name}`,
        } as any);
        break;
      }
    }

    if (!transferred && sessionState !== next) {
      next = sessionState;
    }
  }

  // FIXED: Merge events arrays instead of replacing
  // acceptTransferSession() creates TRANSFER_COMPLETED events that must be preserved
  const finalEvents = [...(next.events ?? []), ...events];
  return { ...next, events: finalEvents };
}

export {};
