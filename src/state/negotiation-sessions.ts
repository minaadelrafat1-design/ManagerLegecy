import type {
  GameState,
  NegotiationSession,
  NegotiationEntry,
  ContractOffer,
  EventLogEntry,
  InboxMessage,
  TransferNegotiationStage,
} from "./types";
import { addDaysISO } from "./calendar";
import { allocateAiWageCommitment, creditAiLedgerAmount } from "./club-finance";
import { deductAiLedgerForOffer } from "./ai-transfers";
import { completeTransferAtomically } from "./transfer-hardening";
import { parseMoney, formatMoney, formatWageBudget } from "./finance";
import { getBoardTransferBudgetLimit } from "./board-pressure";
import { evaluateOffer, evaluatePlayerTransferOffer } from "./negotiation";

function nowIso(state: GameState) {
  return state.time.date;
}

function makeId(prefix: string, n: number) {
  return `${prefix}-${n}`;
}

function isNegotiationActive(status: NegotiationSession["status"] | string | undefined) {
  return status === "open" || status === "active" || status === "progressing";
}

function buildNegotiationKey(
  buyerClubId: string,
  sellerClubId: string,
  playerId: string,
  type: "transfer" | "contract" = "transfer",
) {
  return `${type}|${buyerClubId}|${sellerClubId}|${playerId}`;
}

function appendUniqueEvent(state: GameState, event: EventLogEntry): GameState {
  const existingKey = event.meta?.["eventKey"] ?? event.id;
  const duplicate = (state.events ?? []).some((existing) => {
    if (existing.id === event.id) return true;
    const existingKeyValue = existing.meta?.["eventKey"] ?? existing.id;
    return existingKeyValue === existingKey;
  });
  if (duplicate) return state;
  return { ...state, events: [...(state.events ?? []), event] };
}

function appendShortlistApproachMessage(
  state: GameState,
  buyerClubId: string,
  playerId: string,
): GameState {
  if (!state.shortlistPlayerIds?.includes(playerId)) return state;
  if (buyerClubId === state.currentClub?.id) return state;

  const player = state.players[playerId];
  const club = state.clubs[buyerClubId];
  const dedupeDays = state.inboxSettings?.dedupeWindowDays ?? 1;
  const cutoff = new Date(state.time.date);
  cutoff.setDate(cutoff.getDate() - dedupeDays);

  const duplicate = (state.inbox ?? []).some((message) => {
    if (!message || message.archivedAt) return false;
    if (message.category !== "transfers") return false;
    if (message.relatedEntityId !== playerId) return false;
    if (message.action !== "view_player") return false;
    if (new Date(message.date) < cutoff) return false;
    return true;
  });

  if (duplicate) return state;

  const message: InboxMessage = {
    id: `inbox-shortlist-${playerId}-${buyerClubId}`,
    date: state.time.date,
    category: "transfers",
    title: `Another club is approaching ${player?.name ?? "a shortlisted player"}`,
    body: `${player?.name ?? "This player"} is on your shortlist and ${club?.name ?? "another club"} has started negotiations. Review the player profile to decide whether to act.`,
    priority: "high",
    isRead: false,
    relatedEntityId: playerId,
    action: "view_player",
    sourceEventId: `negotiation_shortlist_${playerId}_${buyerClubId}`,
  };

  return {
    ...state,
    inbox: [...(state.inbox ?? []), message],
  };
}

export function createNegotiationSession(
  state: GameState,
  buyerClubId: string,
  sellerClubId: string,
  playerId: string,
  initialOffer: NegotiationEntry["offer"],
  message = "Initial offer",
  type: "transfer" | "contract" = "transfer",
  stage?: TransferNegotiationStage,
): GameState {
  const sessions = state.negotiations ?? [];
  const hasActiveEquivalent = sessions.some(
    (session) =>
      session.playerId === playerId &&
      session.type === type &&
      session.buyerClubId === buyerClubId &&
      session.sellerClubId === sellerClubId &&
      isNegotiationActive(session.status),
  );
  if (hasActiveEquivalent) {
    return state;
  }

  const id = makeId("neg", sessions.length + 1);
  const entry: NegotiationEntry = {
    id: `${id}-e1`,
    fromClubId: buyerClubId,
    offer: initialOffer,
    message,
    date: nowIso(state),
  };
  const session: NegotiationSession = {
    id,
    playerId,
    buyerClubId,
    sellerClubId,
    status: "open",
    entries: [entry],
    type,
    ...(stage ? { stage } : {}),
  };
  const event: EventLogEntry = {
    id: `event-neg-${(state.events?.length ?? 0) + 1}`,
    date: nowIso(state),
    type: "transfer",
    description: `Negotiation started: ${buyerClubId} -> ${sellerClubId} for ${playerId}`,
    meta: {
      action: "negotiation_start",
      buyerClubId,
      sellerClubId,
      playerId,
      sessionId: id,
      type,
      ...(stage ? { stage } : {}),
      eventKey: `negotiation_start|${buildNegotiationKey(buyerClubId, sellerClubId, playerId, type)}|${nowIso(state)}`,
    },
  };
  const next = { ...state, negotiations: [...sessions, session] };
  const withEvent = appendUniqueEvent(next, event);
  return appendShortlistApproachMessage(withEvent, buyerClubId, playerId);
}

export function startTransferNegotiation(
  state: GameState,
  buyerClubId: string,
  playerId: string,
  initialOffer: NegotiationEntry["offer"],
  message = "Initial transfer approach",
): GameState {
  const player = state.players[playerId];
  if (!player || !state.clubs[buyerClubId] || player.clubId === buyerClubId) return state;
  const sellerClubId = player.clubId ?? "free-agent";
  const stage: TransferNegotiationStage = player.clubId ? "club" : "player";
  return createNegotiationSession(
    state,
    buyerClubId,
    sellerClubId,
    playerId,
    initialOffer,
    message,
    "transfer",
    stage,
  );
}

export function addNegotiationEntry(
  state: GameState,
  sessionId: string,
  fromClubId: string,
  offer: NegotiationEntry["offer"],
  message: string,
): GameState {
  const sessions = state.negotiations ?? [];
  const found = sessions.find((s) => s.id === sessionId);
  if (!found) return state;
  const entry: NegotiationEntry = {
    id: `${sessionId}-e${found.entries.length + 1}`,
    fromClubId,
    offer,
    message,
    date: nowIso(state),
  };
  const updated: NegotiationSession = { ...found, entries: [...found.entries, entry] };
  const nextSessions = sessions.map((s) => (s.id === sessionId ? updated : s));
  const event: EventLogEntry = {
    id: `event-neg-${state.events.length + 1}`,
    date: nowIso(state),
    type: "transfer",
    description: `Negotiation update on ${sessionId}: ${message}`,
    meta: {
      action: "negotiation_update",
      sessionId,
      fromClubId,
      playerId: found.playerId,
      buyerClubId: found.buyerClubId,
      sellerClubId: found.sellerClubId,
      stage: found.stage,
      eventKey: `negotiation_update|${sessionId}|${found.playerId}|${nowIso(state)}`,
    },
  };
  return appendUniqueEvent({ ...state, negotiations: nextSessions }, event);
}

export function submitTransferOffer(
  state: GameState,
  sessionId: string,
  offer: NegotiationEntry["offer"],
): GameState {
  const session = (state.negotiations ?? []).find((item) => item.id === sessionId);
  if (!session || session.type !== "transfer" || session.status !== "open") return state;

  let next = addNegotiationEntry(state, sessionId, session.buyerClubId, offer, "Manager submitted a revised proposal.");
  if (session.stage === "club") {
    const result = evaluateOffer(next, session.buyerClubId, session.sellerClubId, session.playerId, offer);
    if (result.outcome === "counter" && result.offer) {
      return addNegotiationEntry(next, sessionId, session.sellerClubId, result.offer, result.message);
    }
    if (result.outcome === "accepted") {
      const accepted = closeNegotiation(next, sessionId, "accepted", "Club accepted your offer.");
      return createNegotiationSession(
        accepted,
        session.buyerClubId,
        session.sellerClubId,
        session.playerId,
        offer,
        "Club terms agreed. The player and agent are reviewing the contract.",
        "transfer",
        "player",
      );
    }
    return closeNegotiation(next, sessionId, "rejected", result.message);
  }

  if (session.stage === "player") {
    const result = evaluatePlayerTransferOffer(next, session.buyerClubId, session.playerId, offer);
    if (result.outcome === "counter" && result.offer) {
      return addNegotiationEntry(next, sessionId, session.sellerClubId, result.offer, result.message);
    }
    if (result.outcome === "accepted") return acceptTransferSession(next, sessionId);
    return closeNegotiation(next, sessionId, "rejected", result.message);
  }

  return next;
}

export function closeNegotiation(
  state: GameState,
  sessionId: string,
  status: NegotiationSession["status"],
  message: string,
): GameState {
  const sessions = state.negotiations ?? [];
  const found = sessions.find((s) => s.id === sessionId);
  if (!found) return state;
  const updated: NegotiationSession = { ...found, status };
  const nextSessions = sessions.map((s) => (s.id === sessionId ? updated : s));
  const event: EventLogEntry = {
    id: `event-neg-${state.events.length + 1}`,
    date: nowIso(state),
    type: "transfer",
    description: `${message}`,
    meta: {
      action: "negotiation_close",
      sessionId,
      playerId: found.playerId,
      buyerClubId: found.buyerClubId,
      sellerClubId: found.sellerClubId,
      stage: found.stage,
      status,
      eventKey: `negotiation_close|${sessionId}|${status}|${nowIso(state)}`,
    },
  };
  return appendUniqueEvent({ ...state, negotiations: nextSessions }, event);
}

export function acceptContractSession(
  state: GameState,
  sessionId: string,
  offer: ContractOffer,
): GameState {
  const sessions = state.negotiations ?? [];
  const found = sessions.find((s) => s.id === sessionId);
  if (!found) return state;

  const player = state.players[found.playerId];
  if (!player) return state;

  const managedClubId = state.manager?.clubId ?? state.currentClub?.id;
  const buyerIsManaged = found.buyerClubId === managedClubId;
  let next = state;

  if (!buyerIsManaged) {
    next = allocateAiWageCommitment(next, found.buyerClubId, offer.salaryWeekly ?? 0);
  } else if (typeof offer.salaryWeekly === "number") {
    const currentWageBudget = parseMoney(next.finances?.wageBudget);
    const nextWageBudget = Math.max(0, currentWageBudget - offer.salaryWeekly);
    next = {
      ...next,
      finances: {
        ...(next.finances ?? {}),
        wageBudget: formatWageBudget(nextWageBudget),
      },
    };
  }

  // FIXED: Check if this is a transfer (player moving clubs) or renewal (staying at same club)
  // If transfer, use atomic operation. If renewal, just update contract.
  if (player.clubId !== found.buyerClubId) {
    // Player is transferring to a new club - use atomic transfer operation
    const fromClubId = player.clubId ?? found.playerId; // Fallback to avoid undefined
    const transferResult = completeTransferAtomically(
      next,
      found.playerId,
      fromClubId, // current club (from)
      found.buyerClubId, // new club (to)
      offer.signingBonus, // signing bonus if any
      offer.salaryWeekly,
    );
    if (!transferResult.success) {
      return closeNegotiation(
        state,
        sessionId,
        "rejected",
        `Transfer failed: ${transferResult.reason}`,
      );
    }
    next = transferResult.state;
  } else {
    // Player is renewing at same club - just update contract without roster changes
    const salaryStr = `€${Math.round(offer.salaryWeekly).toLocaleString("en-US")} / wk`;
    next = {
      ...next,
      players: {
        ...next.players,
        [found.playerId]: {
          ...player,
          salary: salaryStr,
          contractYears: offer.years,
          contractUntil: `Jun ${Number(String(next.time.season).split("/")[0]) + Number(offer.years)}`,
          morale: Math.min(100, (player.morale ?? 50) + 10),
        },
      },
      contracts: [
        ...(next.contracts ?? []),
        { playerId: found.playerId, clubId: found.buyerClubId, status: "active" },
      ],
    };
  }

  const updated: NegotiationSession = { ...found, status: "accepted" };
  const nextSessions = sessions.map((s) => (s.id === sessionId ? updated : s));
  const ev: EventLogEntry = {
    id: `event-neg-${next.events.length + 1}`,
    date: next.time.date,
    type: "transfer",
    description: `Contract accepted: ${found.playerId}`,
  };
  ev.meta = {
    action: "contract_accepted",
    playerId: found.playerId,
    buyerClubId: found.buyerClubId,
    sellerClubId: found.sellerClubId,
  };
  return { ...next, negotiations: nextSessions, events: [...next.events, ev] };
}

export function acceptTransferSession(state: GameState, sessionId: string): GameState {
  const sessions = state.negotiations ?? [];
  const found = sessions.find((s) => s.id === sessionId);
  if (!found) return state;
  if (found.status === "accepted" || found.status === "rejected" || found.status === "withdrawn") {
    return state;
  }
  if (found.type !== "transfer")
    return closeNegotiation(
      state,
      sessionId,
      "withdrawn",
      "Transfer session cannot be accepted as a non-transfer.",
    );

  if (found.stage === "club") {
    const player = state.players[found.playerId];
    if (!player || player.clubId !== found.sellerClubId) {
      return closeNegotiation(state, sessionId, "rejected", "Player is no longer at the seller.");
    }
    const lastEntry = found.entries[found.entries.length - 1];
    const clubResult = evaluateOffer(
      state,
      found.buyerClubId,
      found.sellerClubId,
      found.playerId,
      lastEntry?.offer ?? {},
    );
    if (clubResult.outcome === "counter" && clubResult.offer) {
      return addNegotiationEntry(
        state,
        sessionId,
        found.sellerClubId,
        clubResult.offer,
        clubResult.message,
      );
    }
    if (clubResult.outcome !== "accepted") {
      return closeNegotiation(state, sessionId, "rejected", clubResult.message);
    }
    const accepted = closeNegotiation(state, sessionId, "accepted", clubResult.message);
    return createNegotiationSession(
      accepted,
      found.buyerClubId,
      found.sellerClubId,
      found.playerId,
      lastEntry?.offer ?? {},
      "Club terms agreed. Negotiate personal terms with the player and agent.",
      "transfer",
      "player",
    );
  }

  if (found.stage === "player") {
    const lastEntry = found.entries[found.entries.length - 1];
    const playerResult = evaluatePlayerTransferOffer(
      state,
      found.buyerClubId,
      found.playerId,
      lastEntry?.offer ?? {},
    );
    if (playerResult.outcome === "counter" && playerResult.offer) {
      return addNegotiationEntry(
        state,
        sessionId,
        found.sellerClubId,
        playerResult.offer,
        playerResult.message,
      );
    }
    if (playerResult.outcome !== "accepted") {
      return closeNegotiation(state, sessionId, "rejected", playerResult.message);
    }
  }

  const lastEntry = found.entries[found.entries.length - 1];
  const offer = lastEntry?.offer as any | undefined;
  if (!offer || typeof offer.fee !== "number") {
    return closeNegotiation(
      state,
      sessionId,
      "rejected",
      "Transfer offer was missing required fee.",
    );
  }

  const beforeMove = state.players[found.playerId];
  if (!beforeMove || (found.sellerClubId !== "free-agent" && beforeMove.clubId !== found.sellerClubId)) {
    return closeNegotiation(state, sessionId, "rejected", "Player is no longer at the seller.");
  }

  let next: GameState;
  if (found.sellerClubId === "free-agent") {
    const buyer = state.clubs[found.buyerClubId];
    if (!buyer || buyer.playerIds.includes(found.playerId)) {
      return closeNegotiation(state, sessionId, "rejected", "The player is no longer available.");
    }
    next = {
      ...state,
      players: {
        ...state.players,
        [found.playerId]: { ...beforeMove, clubId: found.buyerClubId },
      },
      clubs: {
        ...state.clubs,
        [found.buyerClubId]: {
          ...buyer,
          playerIds: [...new Set([...buyer.playerIds, found.playerId])],
        },
      },
    };
  } else {
    const transferResult = completeTransferAtomically(
      state,
      found.playerId,
      found.sellerClubId,
      found.buyerClubId,
      offer.fee,
      offer.salaryWeekly,
    );
    if (!transferResult.success) {
      return closeNegotiation(
        state,
        sessionId,
        "rejected",
        `Transfer did not pass validation: ${transferResult.reason}`,
      );
    }
    next = transferResult.state;
  }

  try {
    const managedClubId = next.manager?.clubId ?? next.currentClub?.id;
    if (managedClubId) {
      const buyerIsManaged = found.buyerClubId === managedClubId;
      const sellerIsManaged = found.sellerClubId === managedClubId;
      const fee = offer.fee;

      // Check board pressure constraints for managed club buyer
      if (buyerIsManaged) {
        const boardBudgetLimit = getBoardTransferBudgetLimit(next);
        if (fee > boardBudgetLimit) {
          return closeNegotiation(
            state,
            sessionId,
            "rejected",
            `Board has restricted transfer budget to €${boardBudgetLimit.toLocaleString("en-US")} due to low confidence. This transfer exceeds the limit.`,
          );
        }
      }

      if (buyerIsManaged) {
        const currentBalance = parseMoney(next.finances?.balance);
        if ((offer.installments ?? 1) > 1) {
          const principal = fee;
          const annualRate = 4;
          const termWeeks = Math.max(1, (offer.installments ?? 1) * 52);
          const weeklyRate = annualRate / 100 / 52;
          const factor = Math.pow(1 + weeklyRate, termWeeks);
          const weeklyPayment = Math.round((principal * weeklyRate * factor) / (factor - 1));
          const newLoan = {
            id: `loan-${(next.finances?.loans?.length ?? 0) + 1}`,
            principal,
            remaining: principal,
            weeklyPayment,
            annualRatePct: annualRate,
            termWeeks,
            startedAt: next.time.date,
            approved: true,
          } as any;
          const loans = [...(next.finances?.loans ?? []), newLoan];
          next = {
            ...next,
            finances: {
              ...(next.finances ?? {}),
              loans,
              balance: formatMoney(Math.max(0, currentBalance)),
            },
          } as any;
        } else {
          const newBalance = Math.max(0, currentBalance - fee);
          next = {
            ...next,
            finances: { ...(next.finances ?? {}), balance: formatMoney(newBalance) },
          } as any;
        }
      } else {
        next = deductAiLedgerForOffer(next, found.buyerClubId, offer);
      }

      if (sellerIsManaged) {
        const newBalance = parseMoney(next.finances?.balance) + fee;
        next = {
          ...next,
          finances: { ...(next.finances ?? {}), balance: formatMoney(newBalance) },
        } as any;
      } else if (found.sellerClubId !== "free-agent") {
        next = creditAiLedgerAmount(next, found.sellerClubId, fee);
      }
    }
  } catch (e) {
    return closeNegotiation(state, sessionId, "rejected", "Transfer financial update failed.");
  }

  const updated: NegotiationSession = { ...found, status: "accepted" };
  const nextSessions = sessions.map((s) => (s.id === sessionId ? updated : s));
  const ev: EventLogEntry = {
    id: `event-neg-${next.events.length + 1}`,
    date: next.time.date,
    type: "transfer",
    description: `Transfer accepted: ${found.playerId}`,
  };
  ev.meta = {
    action: "transfer_accepted",
    playerId: found.playerId,
    buyerClubId: found.buyerClubId,
    sellerClubId: found.sellerClubId,
  };
  return { ...next, negotiations: nextSessions, events: [...next.events, ev] };
}

export {};
