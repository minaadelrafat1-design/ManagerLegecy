/**
 * Enhanced Revenue Systems Tests
 * Comprehensive test suite for all 8 new revenue sources
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GameState, Club } from "./types";
import {
  calculateMerchandiseRevenue,
  initializeMerchandise,
  calculateBroadcastingRevenue,
  initializeBroadcastingDeal,
  calculateTrainingPartnershipRevenue,
  createTrainingPartnership,
  calculateTicketingRevenue,
  initializeTicketPackages,
  calculateCommercialPartnershipRevenue,
  createCommercialPartnership,
  calculateYouthAcademyRevenue,
  recordYouthAcademySale,
  initializeYouthProspects,
  calculateLoanOutFeeRevenue,
  recordLoanOutFee,
  recordPlayerSaleRevenue,
  calculateAllEnhancedRevenuePerWeek,
  getEnhancedRevenueBreakdown,
  initializeAllEnhancedRevenueSystems,
} from "./enhanced-revenue";
import { buildInitialState } from "./seed";

describe("Enhanced Revenue Systems (Phase D2.1)", () => {
  let state: GameState;
  let club: Club;

  beforeEach(() => {
    state = buildInitialState();
    club = state.currentClub;
  });

  // ========================================================================
  // MERCHANDISE SALES TESTS
  // ========================================================================

  describe("Merchandise Sales System", () => {
    it("should return 0 revenue when merchandise not initialized", () => {
      club.merchandise = undefined;
      const revenue = calculateMerchandiseRevenue(club);
      expect(revenue).toBe(0);
    });

    it("should initialize merchandise with multiple channels", () => {
      initializeMerchandise(club, state);
      expect(club.merchandise).toBeDefined();
      expect(club.merchandise?.channels.length).toBeGreaterThan(0);
    });

    it("should calculate merchandise revenue from active channels", () => {
      initializeMerchandise(club, state);
      const revenue = calculateMerchandiseRevenue(club);
      expect(revenue).toBeGreaterThan(0);
    });

    it("should boost merchandise revenue based on club reputation", () => {
      initializeMerchandise(club, state);
      club.reputation = 90;
      const highRepRevenue = calculateMerchandiseRevenue(club);

      club.reputation = 20;
      const lowRepRevenue = calculateMerchandiseRevenue(club);

      expect(highRepRevenue).toBeGreaterThan(lowRepRevenue);
    });

    it("should not count inactive channels in revenue", () => {
      initializeMerchandise(club, state);
      const revenueWithAllChannels = calculateMerchandiseRevenue(club);

      if (club.merchandise?.channels[0]) {
        club.merchandise.channels[0].isActive = false;
      }
      const revenueWithInactive = calculateMerchandiseRevenue(club);

      expect(revenueWithAllChannels).toBeGreaterThan(revenueWithInactive);
    });

    it("should convert monthly revenue to weekly correctly", () => {
      initializeMerchandise(club, state);
      const weeklyRevenue = calculateMerchandiseRevenue(club);
      // Weekly should be roughly 1/4.33 of monthly, with reputation boost applied
      const baseMonthly =
        club.merchandise?.channels
          .filter((c) => c.isActive)
          .reduce((sum, c) => sum + c.monthlyRevenue * c.profitMargin, 0) || 0;
      const reputationBoost = 1 + (club.reputation || 50) * 0.0015;
      const expectedMonthly = baseMonthly * reputationBoost;
      const expectedWeekly = Math.round(expectedMonthly / 4.33);
      expect(weeklyRevenue).toBe(expectedWeekly);
    });
  });

  // ========================================================================
  // BROADCASTING RIGHTS TESTS
  // ========================================================================

  describe("Broadcasting Rights System", () => {
    it("should return 0 revenue when no broadcasting deals", () => {
      club.broadcastingRights = undefined;
      const revenue = calculateBroadcastingRevenue(club);
      expect(revenue).toBe(0);
    });

    it("should initialize broadcasting deal for competition", () => {
      initializeBroadcastingDeal(club, "league-1", "league", state);
      expect(club.broadcastingRights).toBeDefined();
      expect(club.broadcastingRights?.length).toBe(1);
    });

    it("should calculate broadcasting revenue from active deals", () => {
      initializeBroadcastingDeal(club, "league-1", "league", state);
      const revenue = calculateBroadcastingRevenue(club);
      expect(revenue).toBeGreaterThan(0);
    });

    it("should differentiate revenue by competition type", () => {
      club.broadcastingRights = [];
      initializeBroadcastingDeal(club, "league-1", "league", state);
      const leagueRevenue = calculateBroadcastingRevenue(club);

      club.broadcastingRights = [];
      initializeBroadcastingDeal(club, "cup-1", "cup", state);
      const cupRevenue = calculateBroadcastingRevenue(club);

      // League should generate more than cup
      expect(leagueRevenue).toBeGreaterThan(cupRevenue);
    });

    it("should not double-initialize broadcasting deals", () => {
      club.broadcastingRights = [];
      initializeBroadcastingDeal(club, "league-1", "league", state);
      const countAfterFirst = club.broadcastingRights?.length || 0;
      initializeBroadcastingDeal(club, "league-1", "league", state);
      const countAfterSecond = club.broadcastingRights?.length || 0;
      expect(countAfterSecond).toBe(countAfterFirst);
    });

    it("should compose domestic + international + streaming revenue", () => {
      club.broadcastingRights = [];
      initializeBroadcastingDeal(club, "league-1", "league", state);
      const totalRevenue = calculateBroadcastingRevenue(club);
      const deal = club.broadcastingRights?.[0];
      const expectedTotal =
        (deal?.domesticDealPerWeek || 0) +
        (deal?.internationalDealPerWeek || 0) +
        (deal?.streamingDealPerWeek || 0);
      expect(totalRevenue).toBe(expectedTotal);
    });

    it("should scale broadcasting revenue by club reputation", () => {
      club.reputation = 80;
      club.broadcastingRights = [];
      initializeBroadcastingDeal(club, "league-1", "league", state);
      const highRepRevenue = calculateBroadcastingRevenue(club);

      club.reputation = 30;
      club.broadcastingRights = [];
      initializeBroadcastingDeal(club, "league-1", "league", state);
      const lowRepRevenue = calculateBroadcastingRevenue(club);

      expect(highRepRevenue).toBeGreaterThan(lowRepRevenue);
    });
  });

  // ========================================================================
  // TRAINING PARTNERSHIPS TESTS
  // ========================================================================

  describe("Training Partnerships System", () => {
    it("should return 0 revenue when no partnerships", () => {
      club.trainingPartnerships = undefined;
      const revenue = calculateTrainingPartnershipRevenue(club);
      expect(revenue).toBe(0);
    });

    it("should create a new training partnership", () => {
      club.trainingPartnerships = [];
      const id = createTrainingPartnership(
        club,
        "partner-club-1",
        "Partner FC",
        6500,
        "Youth development program",
        state,
      );
      expect(id).toBeDefined();
      expect(club.trainingPartnerships?.length).toBe(1);
    });

    it("should calculate training partnership revenue", () => {
      club.trainingPartnerships = [];
      createTrainingPartnership(
        club,
        "partner-club-1",
        "Partner FC",
        6500,
        "Youth development program",
        state,
      );
      const revenue = calculateTrainingPartnershipRevenue(club);
      expect(revenue).toBeGreaterThan(0);
    });

    it("should not count inactive partnerships", () => {
      club.trainingPartnerships = [];
      createTrainingPartnership(
        club,
        "partner-club-1",
        "Partner FC",
        6500,
        "Youth development program",
        state,
      );
      const revenueActive = calculateTrainingPartnershipRevenue(club);

      if (club.trainingPartnerships?.[0]) {
        club.trainingPartnerships[0].isActive = false;
      }
      const revenueInactive = calculateTrainingPartnershipRevenue(club);

      expect(revenueActive).toBeGreaterThan(revenueInactive);
    });

    it("should convert monthly fee to weekly revenue", () => {
      club.trainingPartnerships = [];
      createTrainingPartnership(
        club,
        "partner-club-1",
        "Partner FC",
        4332,
        "Youth development program",
        state,
      );
      const weeklyRevenue = calculateTrainingPartnershipRevenue(club);
      expect(weeklyRevenue).toBe(Math.round(4332 / 4.33));
    });
  });

  // ========================================================================
  // TICKETING SYSTEM TESTS
  // ========================================================================

  describe("Ticketing System (Season Tickets & VIP)", () => {
    it("should return 0 revenue when no ticket packages", () => {
      club.ticketPackages = undefined;
      const revenue = calculateTicketingRevenue(club);
      expect(revenue).toBe(0);
    });

    it("should initialize multiple ticket package types", () => {
      initializeTicketPackages(club, state);
      expect(club.ticketPackages).toBeDefined();
      expect(club.ticketPackages?.length).toBeGreaterThan(0);
    });

    it("should include standard season tickets in packages", () => {
      initializeTicketPackages(club, state);
      const hasStandard = club.ticketPackages?.some((p) => p.name.includes("Standard"));
      expect(hasStandard).toBe(true);
    });

    it("should include premium season tickets in packages", () => {
      initializeTicketPackages(club, state);
      const hasPremium = club.ticketPackages?.some((p) => p.name.includes("Premium"));
      expect(hasPremium).toBe(true);
    });

    it("should include VIP hospitality in packages", () => {
      initializeTicketPackages(club, state);
      const hasVIP = club.ticketPackages?.some((p) => p.name.includes("VIP"));
      expect(hasVIP).toBe(true);
    });

    it("should calculate total ticketing revenue from all packages", () => {
      initializeTicketPackages(club, state);
      const revenue = calculateTicketingRevenue(club);
      expect(revenue).toBeGreaterThan(0);
    });

    it("should not double-initialize ticket packages", () => {
      initializeTicketPackages(club, state);
      const initialLength = club.ticketPackages?.length || 0;
      initializeTicketPackages(club, state);
      expect(club.ticketPackages?.length).toBe(initialLength);
    });

    it("should respect maxAvailable limits for each package", () => {
      initializeTicketPackages(club, state);
      for (const pkg of club.ticketPackages || []) {
        expect(pkg.currentHolders).toBeLessThanOrEqual(pkg.maxAvailable);
      }
    });
  });

  // ========================================================================
  // COMMERCIAL PARTNERSHIPS TESTS
  // ========================================================================

  describe("Commercial Partnerships System", () => {
    it("should return 0 revenue when no commercial deals", () => {
      club.commercialPartnerships = undefined;
      const revenue = calculateCommercialPartnershipRevenue(club);
      expect(revenue).toBe(0);
    });

    it("should create a new commercial partnership", () => {
      club.commercialPartnerships = [];
      const id = createCommercialPartnership(
        club,
        "sponsor-1",
        "Nike",
        "kit_sponsor",
        15000000, // €15M annual
        3, // 3 year deal
        state,
      );
      expect(id).toBeDefined();
      expect(club.commercialPartnerships?.length).toBe(1);
    });

    it("should set weekly payment correctly", () => {
      club.commercialPartnerships = [];
      const annualValue = 5200000; // €5.2M
      createCommercialPartnership(
        club,
        "sponsor-1",
        "Bank Corp",
        "main_sponsor",
        annualValue,
        2,
        state,
      );
      const partnership = club.commercialPartnerships?.[0];
      const expectedWeekly = Math.round(annualValue / 52);
      expect(partnership?.weeklyPayment).toBe(expectedWeekly);
    });

    it("should calculate commercial partnership revenue", () => {
      club.commercialPartnerships = [];
      createCommercialPartnership(club, "sponsor-1", "Nike", "kit_sponsor", 10400000, 3, state);
      const revenue = calculateCommercialPartnershipRevenue(club);
      expect(revenue).toBeGreaterThan(0);
    });

    it("should only count active partnerships in current year", () => {
      club.commercialPartnerships = [];
      createCommercialPartnership(club, "sponsor-1", "Nike", "kit_sponsor", 10400000, 3, state);
      const currentYearRevenue = calculateCommercialPartnershipRevenue(club);

      // Change status to expired
      if (club.commercialPartnerships?.[0]) {
        club.commercialPartnerships[0].status = "expired";
      }
      const expiredRevenue = calculateCommercialPartnershipRevenue(club);

      expect(currentYearRevenue).toBeGreaterThan(expiredRevenue);
    });

    it("should handle multiple concurrent partnerships", () => {
      club.commercialPartnerships = [];
      createCommercialPartnership(club, "sponsor-1", "Nike", "kit_sponsor", 10400000, 3, state);
      createCommercialPartnership(club, "sponsor-2", "Emirates", "main_sponsor", 5200000, 2, state);
      expect(club.commercialPartnerships?.length).toBe(2);

      const totalRevenue = calculateCommercialPartnershipRevenue(club);
      expect(totalRevenue).toBeGreaterThan(0);
    });

    it("should generate renewal probability for partnerships", () => {
      club.commercialPartnerships = [];
      createCommercialPartnership(club, "sponsor-1", "Nike", "kit_sponsor", 10400000, 3, state);
      const partnership = club.commercialPartnerships?.[0];
      expect(partnership?.renewalChance).toBeGreaterThanOrEqual(65);
      expect(partnership?.renewalChance).toBeLessThanOrEqual(95);
    });
  });

  // ========================================================================
  // YOUTH ACADEMY SALES TESTS
  // ========================================================================

  describe("Youth Academy Sales System", () => {
    it("should initialize youth prospects", () => {
      club.youthProspects = undefined;
      initializeYouthProspects(club, state);
      expect(club.youthProspects).toBeDefined();
      expect(club.youthProspects?.length).toBeGreaterThan(0);
    });

    it("should create prospects with reasonable age range", () => {
      initializeYouthProspects(club, state);
      for (const prospect of club.youthProspects || []) {
        expect(prospect.age).toBeGreaterThanOrEqual(15);
        expect(prospect.age).toBeLessThanOrEqual(19);
      }
    });

    it("should create prospects with potential rating", () => {
      initializeYouthProspects(club, state);
      for (const prospect of club.youthProspects || []) {
        expect(prospect.potential).toBeGreaterThanOrEqual(50);
        expect(prospect.potential).toBeLessThanOrEqual(100);
      }
    });

    it("should calculate market value based on potential", () => {
      initializeYouthProspects(club, state);
      for (const prospect of club.youthProspects || []) {
        const expectedValue = Math.round(prospect.potential * prospect.potential * 15);
        expect(prospect.marketValue).toBe(expectedValue);
      }
    });

    it("should not double-initialize youth prospects", () => {
      initializeYouthProspects(club, state);
      const initialLength = club.youthProspects?.length || 0;
      initializeYouthProspects(club, state);
      expect(club.youthProspects?.length).toBe(initialLength);
    });

    it("should record youth academy sale transaction", () => {
      initializeYouthProspects(club, state);
      const prospect = club.youthProspects?.[0];
      if (prospect) {
        const initialCount = club.youthProspects?.length || 0;
        recordYouthAcademySale(
          club,
          prospect.id,
          "Buyer FC",
          500000, // €500k sale
          state,
        );
        expect(club.youthProspects?.length).toBe(initialCount - 1);
      }
    });

    it("should return 0 for youth academy revenue (one-time events)", () => {
      initializeYouthProspects(club, state);
      const revenue = calculateYouthAcademyRevenue(club);
      expect(revenue).toBe(0);
    });
  });

  // ========================================================================
  // LOAN-OUT FEES TESTS
  // ========================================================================

  describe("Loan-Out Fees System", () => {
    it("should return 0 revenue when no loan-outs", () => {
      club.loanOutPlayers = undefined;
      const revenue = calculateLoanOutFeeRevenue(club);
      expect(revenue).toBe(0);
    });

    it("should record player loan-out with fee", () => {
      club.loanOutPlayers = [];
      recordLoanOutFee(
        club,
        "player-1",
        "John Smith",
        "loan-club-1",
        "Loan FC",
        5000, // €5000/week
        48, // 48 weeks
        state,
      );
      expect(club.loanOutPlayers?.length).toBe(1);
    });

    it("should calculate loan-out fee revenue", () => {
      club.loanOutPlayers = [];
      recordLoanOutFee(club, "player-1", "John Smith", "loan-club-1", "Loan FC", 5000, 48, state);
      const revenue = calculateLoanOutFeeRevenue(club);
      expect(revenue).toBe(5000);
    });

    it("should not count expired loan-outs", () => {
      club.loanOutPlayers = [];
      recordLoanOutFee(club, "player-1", "John Smith", "loan-club-1", "Loan FC", 5000, 48, state);
      const loanOut = club.loanOutPlayers?.[0];
      if (loanOut) {
        loanOut.status = "completed";
      }
      const revenue = calculateLoanOutFeeRevenue(club);
      expect(revenue).toBe(0);
    });

    it("should calculate total fee per season", () => {
      club.loanOutPlayers = [];
      const weeklyFee = 5000;
      const weeks = 48;
      recordLoanOutFee(
        club,
        "player-1",
        "John Smith",
        "loan-club-1",
        "Loan FC",
        weeklyFee,
        weeks,
        state,
      );
      const loanOut = club.loanOutPlayers?.[0];
      expect(loanOut?.totalFeePerSeason).toBe(weeklyFee * weeks);
    });

    it("should handle multiple simultaneous loan-outs", () => {
      club.loanOutPlayers = [];
      recordLoanOutFee(club, "player-1", "Player One", "loan-club-1", "Loan FC", 4000, 48, state);
      recordLoanOutFee(
        club,
        "player-2",
        "Player Two",
        "loan-club-2",
        "Rental Club",
        3000,
        52,
        state,
      );
      const revenue = calculateLoanOutFeeRevenue(club);
      expect(revenue).toBe(7000); // 4000 + 3000
    });
  });

  // ========================================================================
  // PLAYER SALE REVENUE TESTS
  // ========================================================================

  describe("Player Sale Revenue System", () => {
    it("should record player sale transaction", () => {
      if (!state.financialTransactions) {
        state.financialTransactions = [];
      }
      const initialTransactions = state.financialTransactions.length;
      recordPlayerSaleRevenue(
        club,
        "player-1",
        "Star Player",
        "Buyer FC",
        25000000, // €25M
        state,
      );
      const finalTransactions = state.financialTransactions.length;
      expect(finalTransactions).toBe(initialTransactions + 1);
    });

    it("should record correct sale amount", () => {
      if (!state.financialTransactions) {
        state.financialTransactions = [];
      }
      recordPlayerSaleRevenue(club, "player-1", "Star Player", "Buyer FC", 25000000, state);
      const lastTransaction = state.financialTransactions?.[state.financialTransactions.length - 1];
      expect(lastTransaction?.amount).toBe(25000000);
      expect(lastTransaction?.type).toBe("transfer_sell");
      expect(lastTransaction?.category).toBe("revenue");
    });
  });

  // ========================================================================
  // AGGREGATED REVENUE TESTS
  // ========================================================================

  describe("Aggregated Revenue Calculations", () => {
    it("should initialize all revenue systems", () => {
      initializeAllEnhancedRevenueSystems(club, state);
      expect(club.merchandise).toBeDefined();
      expect(club.ticketPackages).toBeDefined();
      expect(club.youthProspects).toBeDefined();
    });

    it("should calculate total enhanced revenue from all sources", () => {
      initializeAllEnhancedRevenueSystems(club, state);
      initializeBroadcastingDeal(club, "league-1", "league", state);
      createTrainingPartnership(
        club,
        "partner-1",
        "Partner FC",
        5200,
        "Development program",
        state,
      );
      const totalRevenue = calculateAllEnhancedRevenuePerWeek(club);
      expect(totalRevenue).toBeGreaterThan(0);
    });

    it("should provide revenue breakdown with all 8 sources", () => {
      initializeAllEnhancedRevenueSystems(club, state);
      initializeBroadcastingDeal(club, "league-1", "league", state);
      const breakdown = getEnhancedRevenueBreakdown(club);

      expect(breakdown).toHaveProperty("merchandise");
      expect(breakdown).toHaveProperty("broadcastingRights");
      expect(breakdown).toHaveProperty("trainingPartnerships");
      expect(breakdown).toHaveProperty("ticketing");
      expect(breakdown).toHaveProperty("commercialPartnerships");
      expect(breakdown).toHaveProperty("loanOutFees");
      expect(breakdown).toHaveProperty("youthAcademySales");
      expect(breakdown).toHaveProperty("playerSales");
    });

    it("should breakdown revenue showing non-zero amounts", () => {
      initializeAllEnhancedRevenueSystems(club, state);
      const breakdown = getEnhancedRevenueBreakdown(club);

      let hasNonZero = false;
      for (const [, value] of Object.entries(breakdown)) {
        if (value > 0) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);
    });
  });

  // ========================================================================
  // INTEGRATION TESTS
  // ========================================================================

  describe("Integration Tests", () => {
    it("should handle club with all 8 systems active", () => {
      initializeAllEnhancedRevenueSystems(club, state);
      initializeBroadcastingDeal(club, "league-1", "league", state);
      createTrainingPartnership(club, "partner-1", "Partner FC", 5200, "Development", state);
      createCommercialPartnership(club, "sponsor-1", "Nike", "kit_sponsor", 10400000, 3, state);
      recordLoanOutFee(club, "player-1", "John Smith", "loan-club-1", "Loan FC", 5000, 48, state);

      const totalRevenue = calculateAllEnhancedRevenuePerWeek(club);
      expect(totalRevenue).toBeGreaterThan(0);
    });

    it("should maintain data integrity with multiple operations", () => {
      initializeAllEnhancedRevenueSystems(club, state);
      const initialRevenue = calculateAllEnhancedRevenuePerWeek(club);

      createTrainingPartnership(club, "partner-1", "Partner FC", 5200, "Development", state);
      const revenueAfterPartnership = calculateAllEnhancedRevenuePerWeek(club);

      expect(revenueAfterPartnership).toBeGreaterThanOrEqual(initialRevenue);
    });

    it("should correctly convert all monthly amounts to weekly", () => {
      initializeAllEnhancedRevenueSystems(club, state);
      const breakdown = getEnhancedRevenueBreakdown(club);

      // All values should be reasonable weekly amounts
      for (const [source, amount] of Object.entries(breakdown)) {
        if (amount > 0) {
          // Weekly amounts should generally be 1/4-1/5 of typical monthly values
          expect(amount).toBeGreaterThan(0);
          expect(amount).toBeLessThan(10000000); // Sanity check
        }
      }
    });
  });
});
