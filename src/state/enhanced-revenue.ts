/**
 * Enhanced Revenue Systems (Phase D2.1)
 * =====================================
 * Comprehensive business logic for 8 new revenue streams:
 * 1. Merchandise Sales (T-shirts, jerseys, apparel)
 * 2. Broadcasting Rights (TV, streaming, international)
 * 3. Training Partnerships (facility rental)
 * 4. Season Tickets & VIP Packages
 * 5. Commercial Partnerships (kit deals, naming rights)
 * 6. Youth Academy Sales (sell academy prospects)
 * 7. Loan-Out Fees (receive fees for loaned-out players)
 * 8. Player Sale Revenue (transfer_sell activation)
 *
 * All functions return either weekly amounts or one-time transaction values.
 */

import { GameState, Club, FinancialTransaction, BroadcastingRights } from "./types";
import { addDaysISO } from "./calendar";
import { seededUnit, deterministicId } from "./utils";

// ============================================================================
// MERCHANDISE SALES
// ============================================================================

/**
 * Calculate weekly merchandise revenue from all channels
 * - Official Store: online + in-stadium sales
 * - Licensing deals: 3rd party apparel
 * - Online: direct e-commerce
 * - Stadium Shop: match day sales
 *
 * Base calculation:
 * Monthly revenue varies by club reputation + attendance + merchandising
 * Formula: BaseMonthly × (1 + reputation×0.001) × (1 + attendance_factor)
 */
export function calculateMerchandiseRevenue(club: Club | undefined): number {
  if (!club?.merchandise) return 0;

  const { channels, lastUpdatedDate } = club.merchandise;
  let totalMonthly = 0;

  for (const channel of channels) {
    if (!channel.isActive) continue;

    // Base revenue with profit margin applied
    let channelRevenue = channel.monthlyRevenue * channel.profitMargin;

    // Boost based on reputation (elite clubs sell more merchandise)
    const reputationBoost = 1 + (club.reputation || 50) * 0.0015;
    channelRevenue *= reputationBoost;

    // The existing stadium shop upgrade improves only the stadium-shop
    // merchandise channel; other merchandise channels retain their normal
    // reputation-driven economics.
    if (channel.type === "stadium" && club.stadium) {
      const shopLevel = club.stadium.componentLevels.shop ?? 1;
      channelRevenue *= 1 + (shopLevel - 1) * 0.06;
    }

    totalMonthly += channelRevenue;
  }

  // Convert monthly to weekly
  return Math.round(totalMonthly / 4.33);
}

/**
 * Initialize merchandise system for a club
 */
export function initializeMerchandise(club: Club, state: GameState): void {
  if (club.merchandise) return; // Already initialized

  club.merchandise = {
    channels: [
      {
        id: `${club.id}-official-store`,
        name: "Official Store",
        type: "official",
        monthlyRevenue: Math.round(12000 + club.reputation * 180),
        profitMargin: 0.65,
        isActive: true,
      },
      {
        id: `${club.id}-stadium-shop`,
        name: "Stadium Shop",
        type: "stadium",
        monthlyRevenue: Math.round(8000 + club.reputation * 120),
        profitMargin: 0.55,
        isActive: true,
      },
      {
        id: `${club.id}-licensing`,
        name: "Licensing Deals",
        type: "licensing",
        monthlyRevenue: Math.round(6000 + club.reputation * 90),
        profitMargin: 0.75,
        isActive: false, // Must be unlocked
      },
    ],
    designs: [
      { id: "home-kit", name: "Home Kit", sales: 0 },
      { id: "away-kit", name: "Away Kit", sales: 0 },
      { id: "training-wear", name: "Training Wear", sales: 0 },
    ],
    totalMonthlyRevenue: 0,
  };

  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }
  state.financialTransactions.push({
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:${club.id}:youth-sale`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "merchandise_sales",
    description: `${club.name}: Merchandise system initialized`,
    amount: 0,
    category: "revenue",
  });
}

// ============================================================================
// BROADCASTING RIGHTS
// ============================================================================

/**
 * Calculate weekly broadcasting revenue from all competitions
 *
 * Comprised of:
 * - Domestic Deal: national TV rights (varies by competition prestige)
 * - International Deal: foreign broadcasters (3-5x domestic)
 * - Streaming Deal: digital platforms (growing revenue stream)
 *
 * Factors:
 * - Competition type (league > cup > continental in base value)
 * - Club reputation (direct multiplier)
 * - Participation in competition (only if actively competing)
 */
export function calculateBroadcastingRevenue(club: Club | undefined): number {
  if (!club?.broadcastingRights) return 0;

  let totalWeekly = 0;

  for (const deal of club.broadcastingRights) {
    // Only count active deals (will be tied to current season/matchday)
    totalWeekly += deal.domesticDealPerWeek;
    totalWeekly += deal.internationalDealPerWeek;
    totalWeekly += deal.streamingDealPerWeek;
  }

  return Math.round(totalWeekly);
}

/**
 * Initialize broadcasting rights for a club in a competition
 * Called when club enters a competition
 */
export function initializeBroadcastingDeal(
  club: Club,
  competitionId: string,
  competitionType: "league" | "cup" | "continental",
  state: GameState,
): void {
  if (!club.broadcastingRights) {
    club.broadcastingRights = [];
  }

  // Don't double-initialize
  if (club.broadcastingRights.some((d) => d.competitionId === competitionId)) {
    return;
  }

  const baseByType = {
    league: 28000,
    cup: 8000,
    continental: 18000,
  };

  const base = baseByType[competitionType];
  const reputationMultiplier = 1 + (club.reputation || 50) * 0.005;

  const deal: BroadcastingRights = {
    leagueId: competitionId, // Simplified: treating leagueId as competitionId
    competitionId,
    domesticDealPerWeek: Math.round(base * reputationMultiplier * 0.5),
    internationalDealPerWeek: Math.round(base * reputationMultiplier * 2.5),
    streamingDealPerWeek: Math.round(base * reputationMultiplier * 0.8),
    dealStartDate: state.time.date,
    totalPerWeek: 0,
  };

  deal.totalPerWeek =
    deal.domesticDealPerWeek + deal.internationalDealPerWeek + deal.streamingDealPerWeek;

  club.broadcastingRights.push(deal);

  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }
  state.financialTransactions.push({
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:broadcasting:${club.id}`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "broadcasting_rights",
    description: `${club.name}: Broadcasting deal initiated (${competitionType})`,
    amount: 0,
    category: "revenue",
  });
}

// ============================================================================
// TRAINING PARTNERSHIPS
// ============================================================================

/**
 * Calculate weekly revenue from training/facility partnerships
 *
 * These are deals where other clubs rent your training facilities,
 * develop youth players at your academy, or collaborate on training methods.
 *
 * Structure:
 * - Partner Club ID
 * - Monthly Fee (lump sum, paid at month start or weekly)
 * - Details (what type of partnership)
 * - Active Status
 */
export function calculateTrainingPartnershipRevenue(
  club: Club | undefined,
  currentDate?: string,
): number {
  if (!club?.trainingPartnerships) return 0;

  let totalMonthly = 0;

  for (const partnership of club.trainingPartnerships) {
    if (!partnership.isActive) continue;

    // Check if partnership is still within valid date range
    if (currentDate && partnership.startedAt && partnership.startedAt > currentDate) {
      continue; // Not started yet
    }
    if (currentDate && partnership.endsAt && partnership.endsAt < currentDate) {
      continue; // Ended
    }

    totalMonthly += partnership.monthlyFee;
  }

  // Convert monthly to weekly
  return Math.round(totalMonthly / 4.33);
}

/**
 * Create a new training partnership
 */
export function createTrainingPartnership(
  club: Club,
  partnerClubId: string,
  partnerClubName: string,
  monthlyFee: number,
  details: string,
  state: GameState,
): string {
  if (!club.trainingPartnerships) {
    club.trainingPartnerships = [];
  }

  const id = deterministicId(
    "partnership",
    `${state.gameSeed ?? "0"}:${state.time.date}:${club.id}:${partnerClubId}`,
    club.trainingPartnerships.length,
  );

  club.trainingPartnerships.push({
    id,
    partnerClubId,
    partnerClubName,
    monthlyFee,
    details,
    isActive: true,
    startedAt: state.time.date,
  });

  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }
  state.financialTransactions.push({
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:training:${club.id}`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "training_partnership",
    description: `${club.name}: Training partnership with ${partnerClubName} (€${monthlyFee}/month)`,
    amount: 0,
    category: "revenue",
  });

  return id;
}

// ============================================================================
// TICKETING (Season Tickets & VIP Packages)
// ============================================================================

/**
 * Calculate weekly revenue from season tickets and VIP packages
 *
 * These are recurring season-based revenue:
 * - Season tickets: ~€200-500 per seat, 20-40 week season
 * - VIP packages: Premium hospitality, €5k-20k per package
 * - Family bundles: 4 seats + perks, €800-1500
 * - Corporate suites: €10k-50k per suite
 *
 * Revenue is spread across the season (typically 34-40 weeks)
 */
export function calculateTicketingRevenue(club: Club | undefined): number {
  if (!club?.ticketPackages) return 0;

  let totalSeasonRevenue = 0;
  let remainingCapacity = club.stadium?.capacity ?? 45_000;

  for (const pkg of club.ticketPackages) {
    // Calculate what this package type generates per season
    const seasonWeeks = 36; // Typical league season

    // Only count if currently active or recently updated
    const seatsPerHolder = Math.max(1, pkg.seatsIncluded);
    const supportedHolders = Math.min(
      pkg.currentHolders,
      Math.floor(Math.max(0, remainingCapacity) / seatsPerHolder),
    );
    const revenue = (supportedHolders * pkg.pricePerSeason) / seasonWeeks;
    totalSeasonRevenue += revenue;
    remainingCapacity -= supportedHolders * seatsPerHolder;
  }

  return Math.round(totalSeasonRevenue);
}

/**
 * Initialize default ticket packages for a club
 */
export function initializeTicketPackages(club: Club, state: GameState): void {
  if (club.ticketPackages && club.ticketPackages.length > 0) return;

  const stadiumCapacity = club.stadium?.capacity ?? 45_000;

  club.ticketPackages = [
    {
      id: `${club.id}-season-standard`,
      name: "Standard Season Pass",
      type: "season_ticket",
      pricePerSeason: 300,
      seatsIncluded: 1,
      perks: ["All home matches"],
      currentHolders: Math.round(stadiumCapacity * 0.12), // Reduced from 0.15
      maxAvailable: Math.round(stadiumCapacity * 0.2),
    },
    {
      id: `${club.id}-season-premium`,
      name: "Premium Season Pass",
      type: "season_ticket",
      pricePerSeason: 650,
      seatsIncluded: 1,
      perks: ["All home matches", "Priority booking", "Free parking"],
      currentHolders: Math.round(stadiumCapacity * 0.06), // Reduced from 0.08
      maxAvailable: Math.round(stadiumCapacity * 0.1),
    },
    {
      id: `${club.id}-vip-hospitality`,
      name: "VIP Hospitality Package",
      type: "vip",
      pricePerSeason: 2500,
      seatsIncluded: 2,
      perks: ["Premium seating", "Lounge access", "Complimentary meals", "Meet player access"],
      currentHolders: 80, // Reduced from stadiumCapacity * 0.02 (900)
      maxAvailable: 200,
    },
    {
      id: `${club.id}-family-bundle`,
      name: "Family Bundle (4 seats)",
      type: "family",
      pricePerSeason: 900,
      seatsIncluded: 4,
      perks: ["Family section seating", "Kids activities"],
      currentHolders: Math.round(stadiumCapacity * 0.08), // Reduced from 0.1
      maxAvailable: Math.round(stadiumCapacity * 0.15),
    },
  ];

  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }
  state.financialTransactions.push({
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:season-tickets:${club.id}`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "season_ticket_sales",
    description: `${club.name}: Ticket packages system initialized`,
    amount: 0,
    category: "revenue",
  });
}

// ============================================================================
// COMMERCIAL PARTNERSHIPS
// ============================================================================

/**
 * Calculate weekly revenue from commercial/sponsorship partnerships
 *
 * Categories:
 * - Kit Sponsor (Nike, Adidas, Puma) - highest value (~€10-50M/year)
 * - Main Sponsor (airline, bank) - (~€5-30M/year)
 * - Sleeve Sponsor - (~€1-5M/year)
 * - Naming Rights (stadium/competition) - (~€2-10M/year)
 */
export function calculateCommercialPartnershipRevenue(
  club: Club | undefined,
  currentYear?: number,
): number {
  if (!club?.commercialPartnerships) return 0;

  let totalWeekly = 0;

  for (const partnership of club.commercialPartnerships) {
    if (partnership.status !== "active") continue;

    // Check if within year range
    if (
      currentYear !== undefined &&
      (currentYear < partnership.startYear || currentYear > partnership.endYear)
    ) {
      continue;
    }

    totalWeekly += partnership.weeklyPayment;
  }

  return Math.round(totalWeekly);
}

/**
 * Create a new commercial partnership deal
 */
export function createCommercialPartnership(
  club: Club,
  partnerId: string,
  partnerName: string,
  type: "kit_sponsor" | "main_sponsor" | "sleeve_sponsor" | "naming_rights" | "other",
  annualValue: number,
  durationYears: number,
  state: GameState,
): string {
  if (!club.commercialPartnerships) {
    club.commercialPartnerships = [];
  }

  const currentYear = Number(state.time.date.slice(0, 4));
  const id = deterministicId(
    "partnership",
    `${state.gameSeed ?? "0"}:${state.time.date}:${club.id}:${partnerId}`,
    club.commercialPartnerships.length,
  );
  const weeklyPayment = Math.round(annualValue / 52);

  club.commercialPartnerships.push({
    id,
    partnerId,
    partnerName,
    type,
    annualValue,
    weeklyPayment,
    startYear: currentYear,
    endYear: currentYear + durationYears - 1,
    status: "active",
    renewalChance:
      65 +
      seededUnit(`${state.gameSeed ?? "0"}:${state.time.date}:${club.id}:${partnerId}:renewal`) *
        30,
  });

  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }
  state.financialTransactions.push({
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:commercial:${club.id}`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "commercial_partnership",
    description: `${club.name}: ${type} with ${partnerName} (€${annualValue}/year)`,
    amount: 0,
    category: "revenue",
  });

  return id;
}

// ============================================================================
// YOUTH ACADEMY SALES
// ============================================================================

/**
 * Calculate weekly revenue from youth academy prospect sales
 * Note: This is one-time revenue when prospects are sold, not recurring
 */
export function calculateYouthAcademyRevenue(club: Club | undefined): number {
  // Youth sales are one-time events, not weekly recurring
  // This would be triggered when a prospect sale completes
  return 0; // See recordYouthAcademySale() for transaction recording
}

/**
 * Record when a youth prospect is sold
 * This should be called from a reducer action or negotiation system
 */
export function recordYouthAcademySale(
  club: Club,
  prospectId: string,
  buyerClubName: string,
  saleAmount: number,
  state: GameState,
): void {
  if (!club.youthProspects) return;

  const prospect = club.youthProspects.find((p) => p.id === prospectId);
  if (!prospect) return;

  // Remove from prospects list
  club.youthProspects = club.youthProspects.filter((p) => p.id !== prospectId);

  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }
  state.financialTransactions.push({
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:youth-sale:${club.id}:${prospectId}`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "youth_academy_sale",
    description: `${club.name}: Youth prospect ${prospect.name} sold to ${buyerClubName}`,
    amount: saleAmount,
    category: "revenue",
    relatedEntityId: prospectId,
  });
}

/**
 * Initialize youth academy prospects for a club
 * These are young players (academy prospects) that can be sold to other clubs
 */
export function initializeYouthProspects(club: Club, state: GameState): void {
  if (club.youthProspects && club.youthProspects.length > 0) return;

  club.youthProspects = [];

  // Generate 5-8 random youth prospects
  const prospectSeed = `${state.gameSeed ?? "0"}:${state.time.date}:${club.id}:youth`;
  const prospectCount = 5 + Math.floor(seededUnit(prospectSeed, 1) * 4);

  for (let i = 0; i < prospectCount; i++) {
    const id = deterministicId(`youth-${club.id}`, prospectSeed, i);
    const potential = 50 + seededUnit(`${prospectSeed}:potential:${i}`, 2) * 50;
    const age = 15 + Math.floor(seededUnit(`${prospectSeed}:age:${i}`, 3) * 5);
    const marketValue = Math.round(potential * potential * 15); // Scales with potential

    club.youthProspects.push({
      id,
      playerId: `prospect-${id}`,
      name: `Youth Prospect #${i + 1}`, // Real names would be generated
      age,
      potential,
      marketValue,
      interested: [],
      isSelling: false,
    });
  }

  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }
  state.financialTransactions.push({
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:youth-init:${club.id}`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "youth_academy_sale",
    description: `${club.name}: Youth academy prospects system initialized (${prospectCount} prospects)`,
    amount: 0,
    category: "revenue",
  });
}

// ============================================================================
// LOAN-OUT FEES
// ============================================================================

/**
 * Calculate weekly revenue from loan-out fees
 * When you loan a player to another club, you receive a weekly/monthly fee
 */
export function calculateLoanOutFeeRevenue(club: Club | undefined, currentDate?: string): number {
  if (!club?.loanOutPlayers) return 0;

  let totalWeekly = 0;

  for (const loan of club.loanOutPlayers) {
    if (loan.status !== "active") continue;

    // Check if loan is still within valid date range
    if (currentDate && (loan.startedAt > currentDate || loan.endsAt < currentDate)) {
      continue;
    }

    totalWeekly += loan.weeklyFee;
  }

  return Math.round(totalWeekly);
}

/**
 * Record a player loan-out with associated fee
 * Called when a player is loaned out to another club
 */
export function recordLoanOutFee(
  club: Club,
  playerId: string,
  playerName: string,
  loanToClubId: string,
  loanToClubName: string,
  weeklyFee: number,
  loanDurationWeeks: number,
  state: GameState,
): void {
  if (!club.loanOutPlayers) {
    club.loanOutPlayers = [];
  }

  const startDate = state.time.date;
  const id = deterministicId(
    "loan",
    `${state.gameSeed ?? "0"}:${startDate}:${club.id}:${playerId}`,
    club.loanOutPlayers.length,
  );
  const endDateStr = addDaysISO(startDate, loanDurationWeeks * 7);

  const totalFeePerSeason = weeklyFee * loanDurationWeeks;

  club.loanOutPlayers.push({
    id,
    playerId,
    playerName,
    loanToClubId,
    loanToClubName,
    weeklyFee,
    totalFeePerSeason,
    startedAt: startDate || "",
    endsAt: endDateStr,
    status: "active",
  });

  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }
  state.financialTransactions.push({
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:loan:${club.id}:${playerId}`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "loan_out_fee",
    description: `${club.name}: ${playerName} loaned to ${loanToClubName} (€${weeklyFee}/week)`,
    amount: weeklyFee,
    category: "revenue",
    relatedEntityId: playerId,
  });
}

// ============================================================================
// PLAYER SALE REVENUE
// ============================================================================

/**
 * Record when a player is sold to another club (transfer_sell)
 * This activates the "transfer_sell" transaction type
 */
export function recordPlayerSaleRevenue(
  club: Club,
  playerId: string,
  playerName: string,
  buyerClubName: string,
  saleAmount: number,
  state: GameState,
): void {
  if (!state.financialTransactions) {
    state.financialTransactions = [];
  }

  const transaction: FinancialTransaction = {
    id: deterministicId(
      "trans",
      `${state.gameSeed ?? "0"}:${state.time.date}:sale:${club.id}:${playerId}`,
      state.financialTransactions.length,
    ),
    date: state.time.date,
    type: "transfer_sell",
    description: `${club.name}: ${playerName} sold to ${buyerClubName}`,
    amount: saleAmount,
    category: "revenue",
    relatedEntityId: playerId,
  };

  state.financialTransactions.push(transaction);
}

// ============================================================================
// AGGREGATED CALCULATIONS
// ============================================================================

/**
 * Calculate total weekly revenue from ALL 8 enhanced revenue sources
 */
export function calculateAllEnhancedRevenuePerWeek(club: Club): number {
  let total = 0;

  total += calculateMerchandiseRevenue(club);
  total += calculateBroadcastingRevenue(club);
  total += calculateTrainingPartnershipRevenue(club);
  total += calculateTicketingRevenue(club);
  total += calculateCommercialPartnershipRevenue(club);
  // Youth sales and loan fees are one-time, handled separately
  total += calculateLoanOutFeeRevenue(club);

  return Math.round(total);
}

/**
 * Breakdown of all 8 enhanced revenue sources (for UI display)
 */
export function getEnhancedRevenueBreakdown(club: Club) {
  return {
    merchandise: calculateMerchandiseRevenue(club),
    broadcastingRights: calculateBroadcastingRevenue(club),
    trainingPartnerships: calculateTrainingPartnershipRevenue(club),
    ticketing: calculateTicketingRevenue(club),
    commercialPartnerships: calculateCommercialPartnershipRevenue(club),
    loanOutFees: calculateLoanOutFeeRevenue(club),
    youthAcademySales: 0, // One-time events
    playerSales: 0, // One-time events (tracked via transfer_sell transactions)
  };
}

/**
 * Initialize all systems for a club (called on club creation or first access)
 */
export function initializeAllEnhancedRevenueSystems(club: Club, state: GameState): void {
  initializeMerchandise(club, state);
  initializeTicketPackages(club, state);
  initializeYouthProspects(club, state);

  // Broadcasting and partnerships are initialized on-demand
  // as they depend on competition/negotiation events
}
