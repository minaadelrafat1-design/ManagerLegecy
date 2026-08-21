import { getTransferWindowStatus, registerDailyHook } from "./calendar";
import {
  determineSellCandidatesForClub,
  determineSquadNeedForClub,
  identifyTransferTargets,
  buildFinancialProfile,
  buildTransferMarketIndex,
  type SimpleSquadNeed,
} from "./ai-decisions";
import { evaluateOffer } from "./negotiation";
import {
  addNegotiationEntry,
  closeNegotiation,
  createNegotiationSession,
  acceptTransferSession,
} from "./negotiation-sessions";
import { canSignPlayer } from "./transfer-rules";
import type { GameState, Player, TransferListing, EventLogEntry } from "./types";
import type { Offer } from "./negotiation";
import { ensureAiLedgerFromClub } from "./club-finance";
import computeClubFinancials from "./club-finance";

const NEED_TO_POS: Record<string, string[]> = {
  goalkeeper: ["GK"],
  defender: ["CB", "RB", "LB"],
  midfielder: ["CM", "CDM", "CAM"],
  winger: ["RW", "LW"],
  striker: ["ST"],
};

const AI_TRANSFER_DEBUG = false;

function debugAiTransfer(...args: unknown[]) {
  if (AI_TRANSFER_DEBUG) console.log(...args);
}

function findPlayerClub(state: GameState, playerId: string) {
  return Object.values(state.clubs).find((club) => club.playerIds.includes(playerId)) ?? null;
}

function findTransferListing(state: GameState, playerId: string) {
  return state.transfers.find((listing) => listing.playerId === playerId);
}

function updateTransferListingStatus(
  state: GameState,
  listingId: string,
  status: TransferListing["status"],
) {
  const listing = state.transfers.find((item) => item.id === listingId);
  if (!listing) return state;
  const updatedListing = { ...listing, status };
  return {
    ...state,
    transfers: state.transfers.map((item) => (item.id === listingId ? updatedListing : item)),
  };
}

function isPlayerInMarket(state: GameState, playerId: string) {
  return Boolean(findTransferListing(state, playerId));
}

interface TransferEvaluationMemo {
  signability: Map<string, { allowed: boolean; reason?: string }>;
  affordability: Map<string, { state: GameState; canAfford: boolean }>;
}

function createTransferEvaluationMemo(): TransferEvaluationMemo {
  return {
    signability: new Map(),
    affordability: new Map(),
  };
}

function memoizedSignability(
  memo: TransferEvaluationMemo,
  state: GameState,
  playerId: string,
  targetClubId: string,
) {
  const key = `${playerId}|${targetClubId}|${state.time.date}`;
  const cached = memo.signability.get(key);
  if (cached) return cached;
  const result = canSignPlayer(state, playerId, targetClubId, state.time.date);
  memo.signability.set(key, result);
  return result;
}

function memoizedAffordability(
  memo: TransferEvaluationMemo,
  state: GameState,
  buyer: GameState["clubs"][string],
  offer: Offer,
) {
  const key = `${buyer.id}|${offer.fee ?? 0}|${offer.salaryWeekly ?? 0}|${offer.loanFee ?? 0}|${offer.bonuses ?? 0}`;
  const cached = memo.affordability.get(key);
  if (cached) return cached;
  const result = canBuyerAfford(state, buyer, offer);
  memo.affordability.set(key, result);
  return result;
}

function appendUniqueEvent(state: GameState, event: EventLogEntry): GameState {
  const eventKey = event.meta?.["eventKey"] ?? event.id;
  const seen = new Set<string>();

  for (const existing of state.events ?? []) {
    if (!existing) continue;
    if (existing.id === event.id) return state;
    const existingKey = existing.meta?.["eventKey"] ?? existing.id;
    seen.add(existingKey);
    seen.add(existing.id);
  }

  if (seen.has(eventKey) || seen.has(event.id)) return state;
  return { ...state, events: [...(state.events ?? []), event] };
}

function activeTransferSessionsForPlayer(state: GameState, playerId: string) {
  return (state.negotiations ?? []).filter(
    (session) =>
      session.type === "transfer" && session.status === "open" && session.playerId === playerId,
  );
}


function getLastEntry(session: NonNullable<GameState["negotiations"]>[number]) {
  return session.entries[session.entries.length - 1];
}

function offerTotal(offer: Offer) {
  return (offer.fee ?? 0) + (offer.bonuses ?? 0) + (offer.loanFee ?? 0);
}

function closeOtherOpenTransferSessions(
  state: GameState,
  playerId: string,
  acceptedSessionId: string,
  message: string,
) {
  let next = state;
  const sessions = (next.negotiations ?? []).filter(
    (session) =>
      session.type === "transfer" &&
      session.status === "open" &&
      session.playerId === playerId &&
      session.id !== acceptedSessionId,
  );
  for (const session of sessions) {
    next = closeNegotiation(next, session.id, "withdrawn", message);
  }
  return next;
}

function movePlayerBetweenClubs(
  state: GameState,
  playerId: string,
  fromClubId: string | undefined,
  toClubId: string,
) {
  if (!fromClubId) return state;
  const fromClub = state.clubs[fromClubId];
  const toClub = state.clubs[toClubId];
  if (!fromClub || !toClub || !state.players[playerId]) return state;

  const nextFromPlayerIds = fromClub.playerIds.filter((id) => id !== playerId);
  const nextToPlayerIds = [...new Set([...toClub.playerIds, playerId])];

  return {
    ...state,
    clubs: {
      ...state.clubs,
      [fromClubId]: { ...fromClub, playerIds: nextFromPlayerIds },
      [toClubId]: { ...toClub, playerIds: nextToPlayerIds },
    },
    players: {
      ...state.players,
      [playerId]: { ...state.players[playerId], clubId: toClubId },
    },
  };
}

function parseMoney(display: string): number {
  const cleaned = String(display)
    .replace(/[€$£,]/g, "")
    .trim();
  const match = /^(-?[\d.]+)\s*([MK])?/i.exec(cleaned);
  if (!match?.[1]) return 0;
  const n = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

interface AiLedger {
  transferBudget: number;
  wageBudgetWeekly: number;
  currentWageCommitment: number;
  balance?: number;
}

function getPersistedAiLedgers(state: GameState) {
  return state.meta?.aiLedgers ?? {};
}

export function ensureAiLedgerEntry(
  state: GameState,
  clubId: string,
): { state: GameState; ledger: AiLedger | null } {
  const existing = getPersistedAiLedgers(state)[clubId];
  if (existing) return { state, ledger: existing };
  const club = state.clubs[clubId];
  if (!club) return { state, ledger: null };
  // Use authoritative club financials to seed AI ledger entry.
  const nextState = ensureAiLedgerFromClub(state, clubId);
  const ledgerOut = nextState.meta?.aiLedgers?.[clubId] ?? null;
  return { state: nextState, ledger: ledgerOut };
}

export function canBuyerAfford(state: GameState, buyer: GameState["clubs"][string], offer: Offer) {
  const result = ensureAiLedgerEntry(state, buyer.id);
  const ledger = result.ledger;
  if (!ledger) return { state: result.state, canAfford: false };
  const totalCost = (offer.fee ?? 0) + (offer.loanFee ?? 0);
  // Additional check: ensure club wont be left with dangerously low balance
  const fin = computeClubFinancials(result.state, buyer.id);
  const minBuffer = Math.round((fin.expenses.total ?? 0) * 4); // keep ~4 weeks of expenses
  const remainingBalance = (ledger.balance ?? fin.balance) - totalCost;
  const affordableByLedger =
    ledger.transferBudget >= totalCost &&
    (ledger.balance ?? fin.balance) >= totalCost &&
    ledger.wageBudgetWeekly >= (offer.salaryWeekly ?? 0);
  const passesBuffer = remainingBalance >= -minBuffer; // allow slight overdraft but not deep
  return { state: result.state, canAfford: affordableByLedger && passesBuffer };
}

export function deductAiLedgerForOffer(state: GameState, clubId: string, offer: Offer) {
  const result = ensureAiLedgerEntry(state, clubId);
  const ledger = result.ledger;
  if (!ledger) return result.state;
  const totalCost = (offer.fee ?? 0) + (offer.loanFee ?? 0);
  const salaryWeekly = offer.salaryWeekly ?? 0;
  const updatedLedger = {
    ...ledger,
    transferBudget: Math.max(0, ledger.transferBudget - totalCost),
    balance: Math.max(0, (ledger.balance ?? 0) - totalCost),
    wageBudgetWeekly: Math.max(0, ledger.wageBudgetWeekly - salaryWeekly),
    currentWageCommitment: ledger.currentWageCommitment + salaryWeekly,
  };
  return {
    ...result.state,
    meta: {
      ...(result.state.meta ?? {}),
      aiLedgers: {
        ...(result.state.meta?.aiLedgers ?? {}),
        [clubId]: updatedLedger,
      },
    },
  };
}

function buildReleaseClause(player: Player): string | null {
  const market = parseMoney(player.value ?? "0");
  if ((player.contractYears ?? 0) <= 1 && market > 0) {
    return `€${Math.round(market * 1.15).toLocaleString("en-US")}`;
  }
  return null;
}

export function listPlayerForTransfer(
  state: GameState,
  playerId: string,
  clubId: string,
  options?: {
    loan?: boolean;
    loanDurationWeeks?: number;
    releaseClause?: string | null;
    status?: "new" | "interested" | "bid" | "agreed" | "rejected";
  },
): GameState {
  const existing = findTransferListing(state, playerId);
  if (existing && existing.status !== "rejected") return state;
  const player = state.players[playerId];
  if (!player) return state;

  const listing: TransferListing = {
    id: `ai-listing-${clubId}-${playerId}`,
    playerId,
    sellerClubId: clubId,
    ...(options?.loan !== undefined ? { loan: options.loan } : {}),
    ...(options?.loanDurationWeeks !== undefined
      ? { loanDurationWeeks: options.loanDurationWeeks }
      : {}),
    ...(options?.releaseClause !== undefined ? { releaseClause: options.releaseClause } : {}),
    name: player.name,
    position: player.pos,
    rating: player.overall,
    nationality: player.nationality,
    age: player.age,
    value: player.value ?? "€0",
    status: options?.status ?? "new",
  };
  const event: EventLogEntry = {
    id: `event-transferlist-${clubId}-${playerId}-${state.time.date}`,
    date: state.time.date,
    type: "transfer" as const,
    description: `${state.clubs[clubId]?.name ?? clubId} listed ${player.name} for ${listing.loan ? "loan" : "transfer"}`,
    meta: {
      action: listing.loan ? "loan_listed" : "listed",
      clubId,
      playerId,
      loan: listing.loan,
      loanDurationWeeks: options?.loanDurationWeeks,
      eventKey: `transfer_listing|${clubId}|${playerId}|${state.time.date}`,
    },
  };
  const nextState = { ...state, transfers: [...state.transfers, listing] };
  return appendUniqueEvent(nextState, event);
}

function listFreeAgentForMarket(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  if (isPlayerInMarket(state, playerId)) return state;
  const listing: TransferListing = {
    id: `freeagent-${state.transfers.length + 1}`,
    playerId,
    loan: false,
    releaseClause: null,
    name: player.name,
    position: player.pos,
    rating: player.overall,
    nationality: player.nationality,
    age: player.age,
    value: player.value ?? "€0",
    status: "new",
  };
  const event = {
    id: `event-transferlist-${state.events.length + 1}`,
    date: state.time.date,
    type: "transfer" as const,
    description: `Free agent ${player.name} entered the market`,
    meta: { action: "free_agent_listed", playerId },
  };
  return { ...state, transfers: [...state.transfers, listing], events: [...state.events, event] };
}

export function buildTransferOffer(
  state: GameState,
  buyer: GameState["clubs"][string],
  listing: TransferListing,
) {
  if (!listing.playerId) return { fee: 0 };
  const player = state.players[listing.playerId];
  const marketValue = player?.marketValue ?? parseMoney(listing.value);
  const baseFee = Math.max(10_000, Math.round(marketValue * (listing.loan ? 0.12 : 0.78)));
  const spenderFactor =
    buyer.aiManager?.financialTendency === "spender"
      ? 1.15
      : buyer.aiManager?.financialTendency === "frugal"
        ? 0.85
        : 1;
  const fee = Math.round(baseFee * spenderFactor);
  const releaseClause = listing.releaseClause ? parseMoney(listing.releaseClause) : null;
  const salaryWeekly = player?.salary
    ? parseMoney(player.salary)
    : Math.max(5_000, Math.round(marketValue * 0.001));
  const offer: any = {
    fee: releaseClause ? Math.max(fee, releaseClause) : fee,
    installments: 1,
    bonuses: listing.loan ? 0 : Math.round(Math.max(0, fee * 0.08)),
    releaseClause,
    salaryWeekly,
  };
  if (listing.loan) {
    offer.loan = true;
    offer.loanDurationWeeks = listing.loanDurationWeeks ?? 12;
    offer.loanFee = Math.round(Math.max(0, fee * 0.25));
  }
  return offer;
}

function createPlayerRecordFromListing(listing: TransferListing) {
  return {
    id: `market-signed-${listing.id}`,
    name: listing.name,
    shortName: listing.name.split(" ")[0],
    number: 99,
    pos: (listing.position as any) ?? "ST",
    role: "",
    nationality: listing.nationality ?? "",
    age: listing.age ?? 20,
    overall: listing.rating ?? 60,
    potential: Math.max(listing.rating ?? 60, 65),
    fitness: 90,
    morale: 70,
    form: 70,
    formTrend: "flat",
    attrs: { pace: 60, shooting: 60, passing: 60, dribbling: 60, defending: 60, physical: 60 },
    professionalism: 60,
    personality: "",
    value: listing.value ?? "€0",
    salary: "€5,000",
    contractUntil: "Jun 2028",
    contractYears: 2,
    trainingFocus: "",
    trainingProgress: 0,
    starter: false,
  } as any;
}

function resolveOpenNegotiations(state: GameState) {
  let next = state;
  const sessions = (state.negotiations ?? []).filter(
    (s) => s.status === "open" && s.type === "transfer",
  );
  const sessionsByPlayer = sessions.reduce<Record<string, typeof sessions>>((acc, session) => {
    const playerKey = session.playerId;
    if (!playerKey) return acc;
    acc[playerKey] = acc[playerKey] ?? [];
    acc[playerKey].push(session);
    return acc;
  }, {});

  for (const playerId of Object.keys(sessionsByPlayer)) {
    const player = next.players[playerId];
    if (!player) {
      for (const session of sessionsByPlayer[playerId] ?? []) {
        next = closeNegotiation(
          next,
          session.id,
          "withdrawn",
          "Negotiation ended: player unavailable.",
        );
      }
      continue;
    }

    const playerSessions = sessionsByPlayer[playerId] ?? [];
    const buyerOriginSessions = playerSessions
      .map((session) => ({ session, last: getLastEntry(session) }))
      .filter(
        (item) => item.last !== undefined && item.last.fromClubId === item.session.buyerClubId,
      )
      .map((item) => ({ session: item.session, last: item.last! }));

    const buyerResults = buyerOriginSessions.map(({ session, last }) => ({
      session,
      result: evaluateOffer(next, session.buyerClubId, session.sellerClubId, playerId, last.offer),
    }));

    const acceptedOffers = buyerResults.filter(
      (item) => item.result.outcome === "accepted" && item.result.offer,
    );
    if (acceptedOffers.length > 0) {
      acceptedOffers.sort((a, b) => offerTotal(b.result.offer!) - offerTotal(a.result.offer!));
      const winner = acceptedOffers[0]!;
      next = acceptTransferSession(next, winner.session.id);
      next = {
        ...next,
        transfers: next.transfers.filter((listing) => listing.playerId !== playerId),
      };
      next = closeOtherOpenTransferSessions(
        next,
        playerId,
        winner.session.id,
        "Transfer completed with another club.",
      );
      continue;
    }

    for (const { session, result } of buyerResults) {
      if (result.outcome === "counter" && result.offer) {
        next = addNegotiationEntry(
          next,
          session.id,
          session.sellerClubId,
          result.offer,
          result.message,
        );
        const listing = state.transfers.find((item) => item.playerId === playerId);
        if (listing) {
          next = updateTransferListingStatus(next, listing.id, "interested");
        }
      } else {
        next = closeNegotiation(next, session.id, "rejected", result.message);
      }
    }

    const currentSessions = (next.negotiations ?? []).filter(
      (s) => s.status === "open" && s.type === "transfer" && s.playerId === playerId,
    );
    for (const session of currentSessions.filter((s) => {
      const last = getLastEntry(s);
      return last?.fromClubId === s.sellerClubId;
    })) {
      const last = getLastEntry(session);
      if (!last) continue;
      const buyer = next.clubs[session.buyerClubId];
      const affordability = buyer
        ? memoizedAffordability(
            createTransferEvaluationMemo(),
            next,
            buyer,
            last.offer,
          )
        : { state: next, canAfford: false };
      next = affordability.state;
      if (affordability.canAfford) {
        next = addNegotiationEntry(
          next,
          session.id,
          session.buyerClubId,
          last.offer,
          "Buyer accepts the seller's counter.",
        );
        next = acceptTransferSession(next, session.id);
        next = closeOtherOpenTransferSessions(
          next,
          playerId,
          session.id,
          "Transfer completed with another club.",
        );
        break;
      }
      next = closeNegotiation(
        next,
        session.id,
        "withdrawn",
        "Buyer withdrew after seller counter-offer.",
      );
    }
  }

  return next;
}

function listExpiringTransfersIfNeeded(state: GameState, clubId: string) {
  const club = state.clubs[clubId];
  if (!club) return state;
  const sellCandidates = determineSellCandidatesForClub(state, clubId, 2);
  if (!sellCandidates.length) return state;
  const candidate = sellCandidates[0];
  if (!candidate || !candidate.playerId) return state;
  const player = state.players[candidate.playerId];
  if (!player) return state;
  if (isPlayerInMarket(state, player.id)) return state;
  return listPlayerForTransfer(state, player.id, clubId, {
    loan: false,
    releaseClause: buildReleaseClause(player),
    status: "new",
  });
}

function ensureValidMarketListings(state: GameState): GameState {
  let next = state;
  for (const club of Object.values(next.clubs)) {
    if (!club.aiManager) continue;
    const sellCandidates = determineSellCandidatesForClub(next, club.id, 2);
    for (const candidate of sellCandidates) {
      if (!candidate.playerId) continue;
      const player = next.players[candidate.playerId];
      if (!player) continue;
      if (next.transfers.some((listing) => listing.playerId === candidate.playerId)) continue;
      next = listPlayerForTransfer(next, player.id, club.id, {
        loan: false,
        releaseClause: buildReleaseClause(player),
        status: "new",
      });
    }
  }
  return next;
}

function aiDailyTick(state: GameState): GameState {
  const hookStart = performance.now();
  const { date, season } = state.time;
  const window = getTransferWindowStatus(date, String(season));
  if (!window || !window.isOpen) return state;

  let next = ensureValidMarketListings(state);
  next = resolveOpenNegotiations(next);

  const activeNegotiationPlayers = new Set(
    (next.negotiations ?? [])
      .filter((session) => session.type === "transfer" && session.status === "open")
      .map((session) => session.playerId),
  );
  const listingByPlayer = new Map<string, TransferListing>();
  for (const listing of next.transfers) {
    if (listing.playerId) listingByPlayer.set(listing.playerId, listing);
  }
  const marketIndex = buildTransferMarketIndex(next);
  const financialProfiles = new Map<string, ReturnType<typeof buildFinancialProfile>>();
  const squadNeeds = new Map<string, SimpleSquadNeed>();
  const evaluationMemo = createTransferEvaluationMemo();

  for (const club of Object.values(next.clubs)) {
    if (!club.aiManager) continue;
    const fin =
      financialProfiles.get(club.id) ??
      buildFinancialProfile(club, club.aiManager.financialTendency, undefined, next);
    financialProfiles.set(club.id, fin);
    const need = squadNeeds.get(club.id) ?? determineSquadNeedForClub(next, club.id);
    squadNeeds.set(club.id, need);

    if (club.academy?.prospectIds?.length && club.aiManager.youthPreference >= 50) {
      const prospectId = club.academy.prospectIds[0];
      if (prospectId && !club.playerIds.includes(prospectId)) {
        const prospectPlayer = next.players[prospectId];
        if (!prospectPlayer) continue;
        const oldClubId = prospectPlayer?.clubId;
        const clubsUpdate = { ...next.clubs };
        for (const [candidateClubId, candidateClub] of Object.entries(clubsUpdate)) {
          if (candidateClub.playerIds.includes(prospectId)) {
            clubsUpdate[candidateClubId] = {
              ...candidateClub,
              playerIds: [...new Set(candidateClub.playerIds.filter((id) => id !== prospectId))],
            };
          }
        }
        const updatedClub = { ...club, playerIds: [...new Set([...club.playerIds, prospectId])] };
        clubsUpdate[club.id] = updatedClub;
        // FIXED: Update player.clubId and remove from old club if needed
        const updatedPlayer: Player = { ...prospectPlayer, clubId: club.id };
        next = {
          ...next,
          players: { ...next.players, [prospectId]: updatedPlayer },
          clubs: clubsUpdate,
          events: [
            ...next.events,
            {
              id: `event-promote-${next.events.length + 1}`,
              date: next.time.date,
              type: "transfer" as const,
              description: `${club.name} promoted youth ${prospectId}`,
              meta: { action: "promote", clubId: club.id, playerId: prospectId },
            },
          ],
        };
      }
      continue;
    }

    if (fin.spendingPower < 30 && club.playerIds.length > 14) {
      next = listExpiringTransfersIfNeeded(next, club.id);
      continue;
    }

    const canSign = fin.spendingPower >= 35;
    if (!canSign) continue;

    const targets = identifyTransferTargets(next, club.id, 3, need, marketIndex).filter((target) => {
      const listing = marketIndex.listingById.get(target.listingId) ?? listingByPlayer.get(target.playerId ?? "");
      if (!listing) return false;
      if (listing.playerId && listing.sellerClubId) {
        return (
          listing.sellerClubId !== club.id &&
          memoizedSignability(evaluationMemo, next, listing.playerId, club.id).allowed
        );
      }
      return false;
    });

    const target = targets[0];
    if (target) {
      const listing = marketIndex.listingById.get(target.listingId) ?? listingByPlayer.get(target.playerId ?? "");
      if (!listing) {
        continue;
      }

      if (!listing.playerId && !listing.sellerClubId) {
        // sign a market target listing by creating a new squad player.
        const newPlayer = { ...createPlayerRecordFromListing(listing), clubId: club.id };
        const updatedClub = {
          ...club,
          playerIds: [...new Set([...club.playerIds, newPlayer.id])],
        };
        next = {
          ...next,
          players: { ...next.players, [newPlayer.id]: newPlayer },
          clubs: { ...next.clubs, [club.id]: updatedClub },
          transfers: next.transfers.filter((item) => item.id !== listing.id),
          events: [
            ...next.events,
            {
              id: `event-transfer-${next.events.length + 1}`,
              date: next.time.date,
              type: "transfer" as const,
              description: `${club.name} signed target ${listing.name}`,
              meta: { action: "target_signed", clubId: club.id, listingId: listing.id },
            },
          ],
        };
        continue;
      }

      if (listing.playerId && listing.sellerClubId) {
        const hasOpenBuyerSession =
          next.negotiations?.some(
            (session) =>
              session.type === "transfer" &&
              session.status === "open" &&
              session.playerId === listing.playerId &&
              session.buyerClubId === club.id,
          ) ?? false;
        if (hasOpenBuyerSession) {
          continue;
        }

        const offer = buildTransferOffer(next, club, listing);
        const affordability = memoizedAffordability(evaluationMemo, next, club, offer);
        next = affordability.state;
        if (affordability.canAfford) {
          const res = evaluateOffer(next, club.id, listing.sellerClubId, listing.playerId, offer);
          if (res.outcome === "accepted") {
            // DO NOT deduct ledger yet - only deduct after transfer confirmation
            next = createNegotiationSession(
              next,
              club.id,
              listing.sellerClubId,
              listing.playerId,
              offer,
              "AI transfer offer",
              "transfer",
            );
            const currentSession = next.negotiations?.[next.negotiations.length - 1];
            if (currentSession) {
              // acceptTransferSession will handle ledger deduction internally
              next = acceptTransferSession(next, currentSession.id);
            }
            next = {
              ...next,
              transfers: next.transfers.filter((item) => item.playerId !== listing.playerId),
            };
          } else if (res.outcome === "counter" && res.offer) {
            next = createNegotiationSession(
              next,
              club.id,
              listing.sellerClubId,
              listing.playerId,
              offer,
              "AI transfer offer",
              "transfer",
            );
            const currentSession = next.negotiations?.[next.negotiations.length - 1];
            if (currentSession) {
              next = addNegotiationEntry(
                next,
                currentSession.id,
                listing.sellerClubId,
                res.offer,
                res.message,
              );
            }
            next = updateTransferListingStatus(next, listing.id, "bid");
          }
        }
      }
      continue;
    }

    let freeAgentListing: TransferListing | undefined;
    for (const item of marketIndex.freeAgents) {
      if (!item.playerId) continue;
      if (memoizedSignability(evaluationMemo, next, item.playerId, club.id).allowed) {
        freeAgentListing = item;
        break;
      }
    }
    if (freeAgentListing && freeAgentListing.playerId) {
      const player = next.players[freeAgentListing.playerId];
      if (player && !findPlayerClub(next, player.id)) {
        const updatedClub = {
          ...club,
          playerIds: [...new Set([...club.playerIds, player.id])],
        };
        // FIXED: Update player.clubId to match club assignment
        const updatedPlayer = { ...player, clubId: club.id };
        next = {
          ...next,
          players: { ...next.players, [player.id]: updatedPlayer },
          clubs: { ...next.clubs, [club.id]: updatedClub },
          transfers: next.transfers.filter((item) => item.id !== freeAgentListing.id),
          events: [
            ...next.events,
            {
              id: `event-transfer-${next.events.length + 1}`,
              date: next.time.date,
              type: "transfer" as const,
              description: `${club.name} signed free agent ${player.name}`,
              meta: { action: "free_agent_signed", clubId: club.id, playerId: player.id },
            },
          ],
        };
        evaluationMemo.signability.clear();
        evaluationMemo.affordability.clear();
      }
    }
  }

  debugAiTransfer(
    `[ADVANCE_DAY] [DATE] ${state.time.date} [END] ai-transfers-event elapsedMs=${(performance.now() - hookStart).toFixed(2)} metrics=${JSON.stringify(
      {
        clubs: Object.keys(next.clubs ?? {}).length,
        players: Object.keys(next.players ?? {}).length,
        transfers: (next.transfers ?? []).length,
        negotiations: (next.negotiations ?? []).length,
        events: (next.events ?? []).length,
        date: next.time.date,
        day: next.time.day,
      },
    )}`,
  );
  return next;
}

registerDailyHook("events", (state, time) => {
  // OPTIMIZATION: Minimize transfer work on non-evaluation days.
  //
  // EVALUATION DAYS (every 2 days):
  //   - Resolve negotiations
  //   - Evaluate targets, make offers, list players
  //
  // OFF DAYS:
  //   - Do nothing (negotiations naturally progress on eval days)
  //
  // This keeps most days fast (<1ms) with market updates every other day.

  const transferWindow = getTransferWindowStatus(state.time.date, String(state.time.season));
  const beforeMetrics = {
    clubs: Object.keys(state.clubs ?? {}).length,
    players: Object.keys(state.players ?? {}).length,
    transfers: (state.transfers ?? []).length,
    negotiations: (state.negotiations ?? []).length,
    events: (state.events ?? []).length,
    date: state.time.date,
    day: state.time.day,
    windowIsOpen: !!transferWindow?.isOpen,
    windowName: transferWindow?.windowName ?? null,
    mod: state.time.day % 2,
  };
  debugAiTransfer(
    `[ADVANCE_DAY] [DATE] ${state.time.date} [START] ai-transfers-event ${JSON.stringify(beforeMetrics)}`,
  );

  if (!transferWindow?.isOpen) {
    debugAiTransfer(
      `[ADVANCE_DAY] [DATE] ${state.time.date} [END] ai-transfers-event skipped transfer-window-closed metrics=${JSON.stringify(beforeMetrics)}`,
    );
    return state;
  }

  const evaluationInterval = 2;
  if (state.time.day % evaluationInterval !== 0) {
    debugAiTransfer(
      `[ADVANCE_DAY] [DATE] ${state.time.date} [END] ai-transfers-event skipped non-eval-day metrics=${JSON.stringify(beforeMetrics)}`,
    );
    return state;
  }

  const hookStart = performance.now();
  const next = resolveOpenNegotiations(state);

  const { date, season } = state.time;

  let next2 = ensureValidMarketListings(next);

  // Build sets/maps for efficient deduplication during market evaluation
  const activeNegotiationPlayers = new Set(
    (next.negotiations ?? [])
      .filter((session) => session.type === "transfer" && session.status === "open")
      .map((session) => session.playerId),
  );
  const listingByPlayer = new Map<string, TransferListing>();
  for (const listing of next2.transfers) {
    if (listing.playerId) listingByPlayer.set(listing.playerId, listing);
  }
  const marketIndex = buildTransferMarketIndex(next2);
  const financialProfiles = new Map<string, ReturnType<typeof buildFinancialProfile>>();
  const squadNeeds = new Map<string, SimpleSquadNeed>();
  const evaluationMemo = createTransferEvaluationMemo();

  for (const club of Object.values(next2.clubs)) {
    if (!club.aiManager) continue;
    const fin =
      financialProfiles.get(club.id) ??
      buildFinancialProfile(club, club.aiManager.financialTendency, undefined, next2);
    financialProfiles.set(club.id, fin);
    const need = squadNeeds.get(club.id) ?? determineSquadNeedForClub(next2, club.id);
    squadNeeds.set(club.id, need);

    if (club.academy?.prospectIds?.length && club.aiManager.youthPreference >= 50) {
      const prospectId = club.academy.prospectIds[0];
      if (prospectId && !club.playerIds.includes(prospectId)) {
        const prospectPlayer = next2.players[prospectId];
        if (!prospectPlayer) continue;
        const oldClubId = prospectPlayer?.clubId;
        const clubsUpdate = { ...next2.clubs };
        for (const [candidateClubId, candidateClub] of Object.entries(clubsUpdate)) {
          if (candidateClub.playerIds.includes(prospectId)) {
            clubsUpdate[candidateClubId] = {
              ...candidateClub,
              playerIds: [...new Set(candidateClub.playerIds.filter((id) => id !== prospectId))],
            };
          }
        }
        const updatedClub = { ...club, playerIds: [...new Set([...club.playerIds, prospectId])] };
        clubsUpdate[club.id] = updatedClub;
        // FIXED: Update player.clubId and remove from old club if needed
        const updatedPlayer: Player = { ...prospectPlayer, clubId: club.id };
        next2 = {
          ...next2,
          players: { ...next2.players, [prospectId]: updatedPlayer },
          clubs: clubsUpdate,
          events: [
            ...next2.events,
            {
              id: `event-promote-${next2.events.length + 1}`,
              date: next2.time.date,
              type: "transfer" as const,
              description: `${club.name} promoted youth ${prospectId}`,
              meta: { action: "promote", clubId: club.id, playerId: prospectId },
            },
          ],
        };
      }
      continue;
    }

    if (fin.spendingPower < 30 && club.playerIds.length > 14) {
      next2 = listExpiringTransfersIfNeeded(next2, club.id);
      continue;
    }

    const canSign = fin.spendingPower >= 35;
    if (!canSign) continue;

    const targets = identifyTransferTargets(next2, club.id, 3, need, marketIndex).filter((target) => {
      const listing =
        marketIndex.listingById.get(target.listingId) ??
        listingByPlayer.get(target.playerId ?? "");
      if (!listing) return false;
      if (listing.playerId && listing.sellerClubId) {
        const alreadyNegotiating = activeNegotiationPlayers.has(listing.playerId);
        return (
          !alreadyNegotiating &&
          listing.sellerClubId !== club.id &&
          memoizedSignability(evaluationMemo, next2, listing.playerId, club.id).allowed
        );
      }
      return false;
    });

    const target = targets[0];
    if (target) {
      const listing =
        marketIndex.listingById.get(target.listingId) ??
        listingByPlayer.get(target.playerId ?? "");
      if (!listing) {
        continue;
      }

      if (!listing.playerId && !listing.sellerClubId) {
        // sign a market target listing by creating a new squad player.
        const newPlayer = { ...createPlayerRecordFromListing(listing), clubId: club.id };
        const updatedClub = {
          ...club,
          playerIds: [...new Set([...club.playerIds, newPlayer.id])],
        };
        next2 = {
          ...next2,
          players: { ...next2.players, [newPlayer.id]: newPlayer },
          clubs: { ...next2.clubs, [club.id]: updatedClub },
          transfers: next2.transfers.filter((item) => item.id !== listing.id),
          events: [
            ...next2.events,
            {
              id: `event-transfer-${next2.events.length + 1}`,
              date: next2.time.date,
              type: "transfer" as const,
              description: `${club.name} signed target ${listing.name}`,
              meta: { action: "target_signed", clubId: club.id, listingId: listing.id },
            },
          ],
        };
        continue;
      }

      if (listing.playerId && listing.sellerClubId) {
        const hasOpenBuyerSession =
          next2.negotiations?.some(
            (session) =>
              session.type === "transfer" &&
              (session.status === "open" ||
                session.status === "active" ||
                session.status === "progressing") &&
              session.playerId === listing.playerId &&
              session.buyerClubId === club.id,
          ) ?? false;
        if (hasOpenBuyerSession) {
          continue;
        }

        const offer = buildTransferOffer(next2, club, listing);
        const affordability = memoizedAffordability(evaluationMemo, next2, club, offer);
        next2 = affordability.state;
        if (affordability.canAfford) {
          const res = evaluateOffer(next2, club.id, listing.sellerClubId, listing.playerId, offer);
          if (res.outcome === "accepted") {
            // DO NOT deduct ledger yet - only deduct after transfer confirmation
            next2 = createNegotiationSession(
              next2,
              club.id,
              listing.sellerClubId,
              listing.playerId,
              offer,
              "AI transfer offer",
              "transfer",
            );
            const currentSession = next2.negotiations?.[next2.negotiations.length - 1];
            if (currentSession) {
              // acceptTransferSession will handle ledger deduction internally
              next2 = acceptTransferSession(next2, currentSession.id);
            }
            next2 = {
              ...next2,
              transfers: next2.transfers.filter((item) => item.playerId !== listing.playerId),
            };
          } else if (res.outcome === "counter" && res.offer) {
            next2 = createNegotiationSession(
              next2,
              club.id,
              listing.sellerClubId,
              listing.playerId,
              offer,
              "AI transfer offer",
              "transfer",
            );
            const currentSession = next2.negotiations?.[next2.negotiations.length - 1];
            if (currentSession) {
              next2 = addNegotiationEntry(
                next2,
                currentSession.id,
                listing.sellerClubId,
                res.offer,
                res.message,
              );
            }
            next2 = updateTransferListingStatus(next2, listing.id, "bid");
          }
        }
      }
      continue;
    }

    let freeAgentListing: TransferListing | undefined;
    for (const item of next2.transfers) {
      if (!item.playerId || item.sellerClubId) continue;
      if (memoizedSignability(evaluationMemo, next2, item.playerId, club.id).allowed) {
        freeAgentListing = item;
        break;
      }
    }
    if (freeAgentListing && freeAgentListing.playerId) {
      const player = next2.players[freeAgentListing.playerId];
      if (player && !findPlayerClub(next2, player.id)) {
        const updatedClub = {
          ...club,
          playerIds: [...new Set([...club.playerIds, player.id])],
        };
        // FIXED: Update player.clubId to match club assignment
        const updatedPlayer = { ...player, clubId: club.id };
        next2 = {
          ...next2,
          players: { ...next2.players, [player.id]: updatedPlayer },
          clubs: { ...next2.clubs, [club.id]: updatedClub },
          transfers: next2.transfers.filter((item) => item.id !== freeAgentListing.id),
          events: [
            ...next2.events,
            {
              id: `event-transfer-${next2.events.length + 1}`,
              date: next2.time.date,
              type: "transfer" as const,
              description: `${club.name} signed free agent ${player.name}`,
              meta: { action: "free_agent_signed", clubId: club.id, playerId: player.id },
            },
          ],
        };
        evaluationMemo.signability.clear();
        evaluationMemo.affordability.clear();
      }
    }
  }

  return next2;
});

export {};
