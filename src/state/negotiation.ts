import type { GameState, ContractOffer, EventLogEntry, Club } from "./types";
import { buildFinancialProfile } from "./ai-decisions";
import { daysBetweenISO } from "./calendar";
import { getLeagueTransferAttractiveness } from "./league-strength";

// lightweight money parser
function parseMoney(display: string | number): number {
  const s = typeof display === "number" ? String(display) : String(display);
  const cleaned = s.replace(/[€$£,]/g, "").trim();
  const match = /^(-?[\d.]+)\s*([MK])?/i.exec(cleaned);
  if (!match?.[1]) return 0;
  const n = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

export interface Offer {
  fee?: number; // euros
  installments?: number; // number of installments (1 = upfront)
  bonuses?: number; // euros
  addOns?: number;
  performanceBonuses?: number;
  appearanceBonuses?: number;
  goalBonuses?: number;
  assistBonuses?: number;
  cleanSheetBonuses?: number;
  sellOnPercent?: number; // 0-100
  sellOnClause?: boolean;
  upfrontPayment?: number;
  futurePayment?: number;
  playerExchangeId?: string;
  playerPlusCash?: number;
  releaseClause?: number | null; // euros or null
  loan?: boolean;
  loanDurationWeeks?: number;
  loanFee?: number;
  wageContribution?: number;
  optionalPurchase?: number;
  mandatoryPurchase?: number;
  salaryWeekly?: number;
  years?: number;
  signingBonus?: number;
  guaranteedStarts?: boolean;
}

// ContractOffer now defined in types.ts

export type NegotiationOutcome = "accepted" | "rejected" | "counter" | "needs-improvement";

export interface NegotiationResult {
  outcome: NegotiationOutcome;
  message: string;
  offer?: Offer; // the accepted or counter offer
}

/** Present-value approximation used by both AI and manager negotiation paths. */
export function calculateOfferValue(offer: Offer): number {
  const guaranteed =
    (offer.upfrontPayment ?? offer.fee ?? 0) +
    (offer.futurePayment ?? 0) +
    (offer.loanFee ?? 0) +
    (offer.playerPlusCash ?? 0);
  const conditional =
    (offer.bonuses ?? 0) +
    (offer.addOns ?? 0) +
    (offer.performanceBonuses ?? 0) +
    (offer.appearanceBonuses ?? 0) +
    (offer.goalBonuses ?? 0) +
    (offer.assistBonuses ?? 0) +
    (offer.cleanSheetBonuses ?? 0);
  const sellOnValue = offer.sellOnPercent ? (offer.sellOnPercent / 100) * guaranteed : 0;
  return Math.round(guaranteed + conditional * 0.45 + sellOnValue * 0.25);
}

/** Deterministic player/agent stage; no roster or financial mutation occurs here. */
export function evaluatePlayerTransferOffer(
  state: GameState,
  buyerId: string,
  playerId: string,
  offer: Offer,
): NegotiationResult {
  const player = state.players[playerId];
  const buyer = state.clubs[buyerId];
  if (!player || !buyer) return { outcome: "rejected", message: "The player is no longer available." };

  const salary = parseMoney(player.salary ?? "0");
  const personality = (player.personality ?? "").toLowerCase();
  const ambition = (player.professionalism ?? 50) + (personality.includes("ambitious") ? 15 : 0);
  const requestedSalary = Math.max(1, Math.round(salary * (1.08 + ambition / 1000)));
  const offeredSalary = offer.salaryWeekly ?? 0;
  if ((offer.years ?? 0) < 1 || offeredSalary < requestedSalary * 0.7) {
    return { outcome: "rejected", message: "The player and agent have rejected the personal terms." };
  }
  if (offeredSalary >= requestedSalary) {
    return { outcome: "accepted", message: "The player and agent accept the personal terms.", offer };
  }
  return {
    outcome: "counter",
    message: "The player and agent want improved personal terms.",
    offer: { ...offer, salaryWeekly: requestedSalary, years: Math.max(2, offer.years ?? 1) },
  };
}

/** Calculate squad gap for a position: how many quality players are missing? */
function calculateSquadGap(club: Club, pos: string): number {
  // Simple heuristic: if missing starters in critical position, gap is higher
  // Positions: GK (1), CB (2), RB/LB (2), CM (2), ST (1)
  // Returns 0-1 scale of how critical the gap is
  const positionNeeds: Record<string, number> = {
    GK: 1,
    CB: 2,
    RB: 1,
    LB: 1,
    CM: 2,
    CAM: 1,
    CDM: 1,
    ST: 1,
    LW: 0.5,
    RW: 0.5,
  };

  // Default: less critical unless high need
  const need = positionNeeds[pos] ?? 0.5;
  return Math.min(1, need * 0.3); // scale to 0-0.3 range
}

/** Evaluate an incoming `offer` from `buyerId` to `sellerId` for `playerId`.
 * Pure function: returns a `NegotiationResult` with a human message and
 * an optional counter-offer. Does NOT mutate `GameState` — callers apply
 * changes when a deal is accepted.
 */
export function evaluateOffer(
  state: GameState,
  buyerId: string,
  sellerId: string,
  playerId: string,
  offer: Offer,
): NegotiationResult {
  const player = state.players[playerId];
  if (!player) return { outcome: "rejected", message: "Player not available." };

  const seller = state.clubs[sellerId];
  const buyer = state.clubs[buyerId];
  if (!seller || !buyer) return { outcome: "rejected", message: "Club not found." };

  const market =
    player.marketValue ??
    (player.value ? parseMoney(player.value) : Math.round(player.overall * 100_000));
  let baseAccept = Math.round(market * 0.85); // seller baseline wants at least 85%

  // REALISM: Squad role importance modifier
  // Strikers/key positions worth more to squads with gaps there
  const sellerSquadGap = calculateSquadGap(seller, player.pos ?? "ST");
  const roleMultiplier = 1 + sellerSquadGap * 0.15; // up to +15% for critical gaps
  baseAccept = Math.round(baseAccept * roleMultiplier);

  // REALISM: Contract expiration pressure
  // Players with <1 year left have weaker negotiating position for seller
  const contractYearsLeft = player.contractYears ?? 3;
  const expirationPressure = Math.max(0, 1 - contractYearsLeft * 0.15); // -15% per year remaining, 0% floor
  baseAccept = Math.round(baseAccept * (1 - expirationPressure * 0.2)); // contract expiry reduces threshold by up to 20%

  // REALISM: Competing offers
  // Check if other clubs are bidding for same player (tracked via events)
  const competingBidsCount = (state.events ?? []).filter(
    (e) =>
      e.type === "transfer" &&
      (e.meta as any)?.playerId === playerId &&
      (e.meta as any)?.clubId !== buyerId &&
      e.date &&
      daysBetweenISO(e.date.slice(0, 10), state.time.date) <= 30,
  ).length;
  const competitiveFactor = Math.min(0.3, competingBidsCount * 0.12); // +12% per competing offer, capped at +30%
  baseAccept = Math.round(baseAccept * (1 + competitiveFactor));

  // adjust seller threshold by reputation and financial needs
  const sellerFin = buildFinancialProfile(
    seller,
    seller.aiManager?.financialTendency ?? "balanced",
    undefined,
    state,
  );
  const reputationBonus = Math.round((seller.reputation - 50) * 2000); // reputation affects expectations
  const patienceFactor = (seller.aiManager?.patience ?? 50) / 100;
  const dynamicThreshold = Math.max(
    0,
    Math.round(
      baseAccept - reputationBonus * 0.01 - sellerFin.spendingPower * 1000 * (1 - patienceFactor),
    ),
  );

  // buyer ability influences how persuasive an offer looks
  const buyerFin = buildFinancialProfile(
    buyer,
    buyer.aiManager?.financialTendency ?? "balanced",
    undefined,
    state,
  );

  // acceptance logic: if offered fee + bonuses >= dynamicThreshold -> accept
  // Consider installments: reduce present-value for multi-installment offers
  const offerFee = offer.fee ?? 0;
  const installments = offer.installments ?? 1;
  const installmentDiscount = 1 - Math.min(0.25, 0.05 * (installments - 1)); // 1->1.0, 2->0.95, 3->0.90, 4->0.85
  const presentValue = Math.round(offerFee * installmentDiscount) + (offer.bonuses ?? 0);
  const totalOffer = calculateOfferValue(offer);
  if (totalOffer >= dynamicThreshold) {
    return { outcome: "accepted", message: "The club accepts the proposal.", offer };
  }

  // if offer is too far below market, outright reject
  if (totalOffer < market * 0.5) {
    return { outcome: "rejected", message: "The club considers the offer too low." };
  }

  // otherwise propose a counter-offer that bridges some gap; consider present value
  const gap = Math.max(0, dynamicThreshold - presentValue);
  const buyerCapacity = Math.round((buyerFin.spendingPower / 100) * market);
  // Suggest a counter that increases fee and may propose installments to bridge gap
  const counterFee = Math.min(market, offerFee + Math.round(gap * 0.7));
  const suggestedInstallments = offer.installments
    ? Math.max(1, Math.min(4, offer.installments))
    : 2;
  // If buyer appears cash-poor but can stretch, allow more installments
  const buyerCanPayUpfront = buyerFin.spendingPower > 50;
  const counterInstallments = buyerCanPayUpfront ? 1 : Math.min(4, suggestedInstallments + 1);
  const sellOn = Math.min(30, Math.round((seller.reputation / 100) * 10));

  // natural-language message
  const message =
    totalOffer < dynamicThreshold * 0.9
      ? "The club is willing to negotiate."
      : "The club has rejected the proposal.";

  // if buyer can't afford counter, reject
  if (buyerFin.spendingPower * market < counterFee * 0.5 && buyerFin.source === "estimated") {
    return { outcome: "rejected", message: "The club has rejected the proposal." };
  }

  const counter: Offer = {
    fee: counterFee,
    installments: counterInstallments,
    bonuses: Math.round(
      Math.max(0, (dynamicThreshold - Math.round(counterFee * installmentDiscount)) * 0.2),
    ),
    sellOnPercent: sellOn,
    releaseClause: null,
  };

  return { outcome: "counter", message, offer: counter };
}

export type ContractNegotiationOutcome = NegotiationOutcome | "player-lost-interest";

export interface ContractNegotiationResult {
  outcome: ContractNegotiationOutcome;
  message: string;
  counter?: ContractOffer;
}

function findPlayerClub(state: GameState, playerId: string) {
  for (const c of Object.values(state.clubs)) if (c.playerIds.includes(playerId)) return c;
  return null;
}

/** Evaluate a player's contract offer (renewal or signing). Pure function.
 * Factors considered: current salary, club reputation, player professionalism,
 * personality-driven ambition, promised playing time, and contract length.
 */
export function evaluateContractOffer(
  state: GameState,
  clubId: string,
  playerId: string,
  offer: ContractOffer,
): ContractNegotiationResult {
  const player = state.players[playerId];
  if (!player) return { outcome: "rejected", message: "Player not found." };
  const club = state.clubs[clubId];
  if (!club) return { outcome: "rejected", message: "Club not found." };

  const currentSalary = parseMoney(player.salary ?? "0");
  const salaryOffered = Math.round(offer.salaryWeekly);

  // derive simple ambition/professionalism scores
  const professionalism = player.professionalism ?? 50; // 0-100
  let ambition = 50;
  const p = (player.personality || "").toLowerCase();
  if (p.includes("ambitious")) ambition = 80;
  else if (p.includes("leader")) ambition = 40;
  else if (p.includes("professional")) ambition = 55;

  // club attractiveness: reputation and manager reputation
  const clubReputation = club.reputation ?? 50;
  const leagueAttractiveness = getLeagueTransferAttractiveness(club.leagueId, state);
  const clubAttractiveness = Math.round(clubReputation * 0.7 + leagueAttractiveness * 0.3);

  // playing time promise increases appeal especially for ambitious players
  const playingTimeBoost = offer.guaranteedStarts ? 10 : 0;

  // baseline thresholds
  const desiredRaise = Math.round(
    currentSalary *
      0.15 *
      (1 + (ambition - 50) / 200) *
      (1 + (50 - clubAttractiveness) / 500),
  );
  const desiredSalary = currentSalary + desiredRaise;

  // quick accept if salary meets or beats desired and length >= 1
  if (salaryOffered >= desiredSalary && offer.years >= 1) {
    return { outcome: "accepted", message: "Player accepts the contract offer." };
  }

  // if offer is unreasonable (much lower than current) player loses interest if ambitious
  if (
    salaryOffered < Math.round(currentSalary * 0.7) &&
    ambition > 65 &&
    clubAttractiveness < 65
  ) {
    return {
      outcome: "player-lost-interest",
      message: "The player has lost interest in negotiations.",
    };
  }

  // otherwise propose a counter offer improving salary and possibly length
  const salaryGap = Math.max(0, desiredSalary - salaryOffered);
  const counterSalary = salaryOffered + Math.round(salaryGap * 0.7);
  const counterYears = Math.max(1, Math.min(5, offer.years + (professionalism > 60 ? 1 : 0)));
  const counter: ContractOffer = {
    salaryWeekly: counterSalary,
    years: counterYears,
    signingBonus: Math.round(Math.max(0, salaryGap * 2)),
    guaranteedStarts: offer.guaranteedStarts ?? false,
  };

  const message = "The player is open to negotiation on salary and length.";
  return { outcome: "counter", message, counter };
}

/** Apply an accepted contract (renewal or new signing). Returns updated state. */
export function applyAcceptedContract(
  state: GameState,
  clubId: string,
  playerId: string,
  offer: ContractOffer,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  const salaryStr = `€${Math.round(offer.salaryWeekly).toLocaleString("en-US")} / wk`;
  const nextPlayers = {
    ...state.players,
    [playerId]: {
      ...player,
      salary: salaryStr,
      contractYears: offer.years,
      contractUntil: `Jun ${Number(String(state.time.season).split("/")[0]) + Number(offer.years)}`,
      clubId: clubId, // FIXED: Update player.clubId when transferring or renewing
    },
  };

  const currentClub = findPlayerClub(state, playerId);
  let nextClubs = { ...state.clubs };
  if (!currentClub || currentClub.id !== clubId) {
    if (currentClub) {
      nextClubs = {
        ...nextClubs,
        [currentClub.id]: {
          ...currentClub,
          playerIds: [...new Set(currentClub.playerIds.filter((id) => id !== playerId))],
        },
      };
    }
    const dest = state.clubs[clubId];
    if (!dest) return state;
    nextClubs = {
      ...nextClubs,
      [clubId]: {
        ...dest,
        playerIds: [...new Set([...dest.playerIds.filter((id) => id !== playerId), playerId])],
      },
    };
  }

  const contracts: GameState["contracts"] = [
    ...state.contracts,
    { playerId, clubId, status: "active" },
  ];

  const event: EventLogEntry = {
    id: `event-contract-${state.events.length + 1}`,
    date: state.time.date,
    type: "transfer" as const,
    description: `Contract signed: ${playerId} @ ${state.clubs[clubId]?.name ?? clubId}`,
  };
  event.meta = { action: "in", clubId, playerId, kind: "contract" };

  const existing = nextPlayers[playerId];
  if (existing)
    nextPlayers[playerId] = { ...existing, morale: Math.min(100, (existing.morale ?? 50) + 10) };

  return {
    ...state,
    players: nextPlayers,
    clubs: nextClubs,
    contracts,
    events: [...state.events, event],
  };
}

export function applyAcceptedTransfer(
  state: GameState,
  playerId: string,
  fromClubId: string,
  toClubId: string,
): GameState {
  // DEPRECATED: Use `completeTransferAtomically()` from transfer-hardening.ts instead.
  // This function is kept for backward compatibility with test scripts only.
  // It lacks the verification and atomicity guarantees of the new atomic operation.
  const player = state.players[playerId];
  if (!player) return state;
  if (!state.clubs[fromClubId] || !state.clubs[toClubId]) return state;
  if (fromClubId === toClubId) return state;
  const fromClub = state.clubs[fromClubId];
  const toClub = state.clubs[toClubId];
  if (player.clubId !== fromClubId) return state;
  if (!fromClub.playerIds.includes(playerId)) return state;
  if (toClub.playerIds.includes(playerId)) return state;

  const updatedFrom = {
    ...fromClub,
    playerIds: [...new Set(fromClub.playerIds.filter((id) => id !== playerId))],
  };
  const updatedTo = {
    ...toClub,
    playerIds: [...new Set([...toClub.playerIds.filter((id) => id !== playerId), playerId])],
  };

  const nextPlayers = {
    ...state.players,
    [playerId]: { ...player, clubId: toClubId },
  };

  const contracts: GameState["contracts"] = (state.contracts ?? []).map((contract) =>
    contract.playerId === playerId ? { ...contract, clubId: toClubId, status: "active" } : contract,
  );

  const afterTransferCount = Object.values({
    ...state.clubs,
    [fromClubId]: updatedFrom,
    [toClubId]: updatedTo,
  }).filter((club) => club.playerIds.includes(playerId)).length;
  if (afterTransferCount !== 1) return state;

  // Emit explicit TRANSFER_COMPLETED event with authoritative proof of state transition
  const event: EventLogEntry = {
    id: `event-transfer-${state.events.length + 1}`,
    date: state.time.date,
    type: "TRANSFER_COMPLETED",
    description: `${state.clubs[fromClubId].name} -> ${state.clubs[toClubId].name}: ${player.name}`,
    meta: {
      playerId,
      fromClubId,
      toClubId,
      fee: undefined,
    },
  };

  return {
    ...state,
    players: nextPlayers,
    clubs: { ...state.clubs, [fromClubId]: updatedFrom, [toClubId]: updatedTo },
    contracts,
    events: [...state.events, event],
  };
}

export {};
