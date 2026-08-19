import type { GameState } from "./types";
import { buildWeeklyFinanceSnapshot, parseMoney } from "./finance";
import { FacilityKey, getFacilityUpgradeCostForKey, getFacilityRating } from "./facilities";

export interface ClubFinancials {
  clubId: string;
  balance: number; // numeric cents (euros)
  transferBudget: number;
  wageBudgetWeekly: number;
  wageCommitmentsWeekly: number;
  income: ReturnType<typeof buildWeeklyFinanceSnapshot> extends infer R
    ? R extends { income: infer I }
      ? I
      : any
    : any;
  expenses: ReturnType<typeof buildWeeklyFinanceSnapshot> extends infer R
    ? R extends { expenses: infer E }
      ? E
      : any
    : any;
  healthTier: "healthy" | "stable" | "vulnerable" | "crisis";
}

export function calculateClubWeeklyWageCommitment(state: GameState, clubId: string): number {
  const club = state.clubs[clubId];
  if (!club) return 0;

  return club.playerIds.reduce((sum, playerId) => {
    const player = state.players[playerId];
    if (!player || player.status === "retired") return sum;
    return sum + parseMoney(player.salary ?? "€0");
  }, 0);
}

export function computeClubFinancials(state: GameState, clubId: string): ClubFinancials {
  const club = state.clubs[clubId];
  const snapshot = buildWeeklyFinanceSnapshot(state, clubId);
  if (!club) {
    return {
      clubId,
      balance: Math.max(0, snapshot.income.total - snapshot.expenses.total),
      transferBudget: 0,
      wageBudgetWeekly: snapshot.expenses.playerSalaries,
      wageCommitmentsWeekly: snapshot.expenses.playerSalaries,
      income: snapshot.income,
      expenses: snapshot.expenses,
      healthTier: "stable",
    };
  }

  // Balance: for managed club we may have a literal `state.finances.balance` string
  const managedClubId = state.manager?.clubId ?? state.currentClub?.id;
  const rawBalance = managedClubId === clubId ? state.finances?.balance : undefined;
  const ledgerBalance = state.meta?.aiLedgers?.[clubId]?.balance;
  const balance = rawBalance
    ? parseMoney(rawBalance)
    : typeof ledgerBalance === "number"
      ? ledgerBalance
      : Math.max(0, snapshot.income.total - snapshot.expenses.total);

  // More realistic authoritative model
  // Annualised estimates (simple projection from weekly snapshot)
  const estAnnualIncome = snapshot.income.total * 52;
  const estAnnualExpenses = snapshot.expenses.total * 52;
  const estNetAnnual = estAnnualIncome - estAnnualExpenses;

  // Conservative emergency reserve: prefer keeping a buffer depending on scale
  const reserveFromBalance = Math.round(Math.min(balance * 0.15, 2_000_000));
  const reserveFromExpenses = Math.round(Math.min(estAnnualExpenses * 0.05, 3_000_000));
  const emergencyReserve = Math.max(reserveFromBalance, reserveFromExpenses);

  const wageCommitmentsWeekly = calculateClubWeeklyWageCommitment(state, clubId);

  // Transfer budget factors in: available balance after reserve, a modest
  // fraction of expected near-term revenue, and a discount for future wage
  // obligations (annualised).
  const availableForTransfers = Math.max(0, balance - emergencyReserve);
  const nearTermRevenueBuffer = Math.round(estAnnualIncome * 0.05); // 5% of annual income
  const futureWageLiability = Math.round(wageCommitmentsWeekly * 52 * 0.2); // 20% of annual wages as buffer
  const transferBudgetFactor = club.identity?.transferBudgetFactor ?? 1;
  const baseTransferBudget = Math.max(
    0,
    Math.round(availableForTransfers * 0.5 + nearTermRevenueBuffer - futureWageLiability),
  );
  const transferBudget = Math.max(0, Math.round(baseTransferBudget * transferBudgetFactor));

  // Wage budget weekly: allow growth room but respect current commitments.
  const freeAnnualCash = Math.max(0, estNetAnnual - emergencyReserve);
  const proposedWageIncreaseAnnual = Math.round(freeAnnualCash * 0.25);
  const proposedWageBudgetWeekly = Math.round(
    proposedWageIncreaseAnnual / 52 + wageCommitmentsWeekly,
  );
  const wageBudgetWeekly = Math.max(wageCommitmentsWeekly, proposedWageBudgetWeekly);

  // Health tier heuristic (more granular)
  const net = estNetAnnual;
  const healthTier: ClubFinancials["healthTier"] =
    net > 2_000_000 ? "healthy" : net > 0 ? "stable" : net > -2_000_000 ? "vulnerable" : "crisis";

  return {
    clubId,
    balance,
    transferBudget,
    wageBudgetWeekly,
    wageCommitmentsWeekly,
    income: snapshot.income,
    expenses: snapshot.expenses,
    healthTier,
  };
}

/** Ensure the AI ledger for `clubId` exists and mirrors authoritative budgets. */
export function ensureAiLedgerFromClub(state: GameState, clubId: string) {
  const existing = state.meta?.aiLedgers?.[clubId];
  if (existing) return state;
  const fin = computeClubFinancials(state, clubId);
  const ledger = {
    transferBudget: fin.transferBudget,
    wageBudgetWeekly: fin.wageBudgetWeekly,
    currentWageCommitment: fin.wageCommitmentsWeekly,
    balance: fin.balance,
    lastUpdatedDate: state.time.date,
    lastUpdatedWeek: state.time.week,
  };
  const nextMeta = {
    ...(state.meta ?? {}),
    aiLedgers: { ...(state.meta?.aiLedgers ?? {}), [clubId]: ledger },
  };
  return { ...state, meta: nextMeta };
}

export function syncAiLedgerForClub(state: GameState, clubId: string) {
  const club = state.clubs[clubId];
  if (!club?.aiManager) return state;
  const seeded = ensureAiLedgerFromClub(state, clubId);
  const existing = seeded.meta?.aiLedgers?.[clubId];
  if (!existing) return seeded;
  const fin = computeClubFinancials(seeded, clubId);
  const actualWageCommitment = calculateClubWeeklyWageCommitment(seeded, clubId);
  const updatedLedger = {
    ...existing,
    balance: fin.balance,
    transferBudget: Math.max(0, fin.transferBudget),
    wageBudgetWeekly: Math.max(actualWageCommitment, fin.wageBudgetWeekly),
    currentWageCommitment: actualWageCommitment,
    lastUpdatedDate: seeded.time.date,
    lastUpdatedWeek: seeded.time.week,
  };
  return {
    ...seeded,
    meta: {
      ...(seeded.meta ?? {}),
      aiLedgers: { ...(seeded.meta?.aiLedgers ?? {}), [clubId]: updatedLedger },
    },
  };
}

export function syncAiLedgers(state: GameState) {
  // OPTIMIZATION: Only sync ledgers for manager's club and upcoming opponents
  // instead of iterating all AI clubs every week (expensive).
  const managedClubId = state.currentClub.id;
  const nextWeekDate = new Date(state.time.date);
  nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 14);
  const nextWeekDateISO = nextWeekDate.toISOString().slice(0, 10);

  const upcomingFixtures = state.fixtures.filter(
    (f) =>
      f.calendarDate >= state.time.date &&
      f.calendarDate <= nextWeekDateISO &&
      (f.homeClubId === managedClubId || f.awayClubId === managedClubId),
  );

  const relevantClubIds = new Set([
    managedClubId,
    ...upcomingFixtures.flatMap((f) => [f.homeClubId, f.awayClubId]),
  ]);

  return Array.from(relevantClubIds).reduce((next, clubId) => {
    const club = next.clubs[clubId];
    if (!club?.aiManager) return next;
    return syncAiLedgerForClub(next, clubId);
  }, state);
}

export function deductAiLedgerAmount(state: GameState, clubId: string, amount: number) {
  const existing = state.meta?.aiLedgers?.[clubId];
  if (!existing) {
    const seeded = ensureAiLedgerFromClub(state, clubId);
    return deductAiLedgerAmount(seeded, clubId, amount);
  }
  const ledger = { ...existing };
  ledger.transferBudget = Math.max(0, ledger.transferBudget - amount);
  ledger.balance = Math.max(0, (ledger.balance ?? 0) - amount);
  const nextMeta = {
    ...(state.meta ?? {}),
    aiLedgers: { ...(state.meta?.aiLedgers ?? {}), [clubId]: ledger },
  };
  return { ...state, meta: nextMeta };
}

export function allocateAiWageCommitment(state: GameState, clubId: string, weeklySalary: number) {
  const existing = state.meta?.aiLedgers?.[clubId];
  if (!existing) {
    const seeded = ensureAiLedgerFromClub(state, clubId);
    return allocateAiWageCommitment(seeded, clubId, weeklySalary);
  }

  const actualWageCommitment = calculateClubWeeklyWageCommitment(state, clubId);
  const projectedWageCommitment = actualWageCommitment + Math.max(0, weeklySalary);
  const ledger = { ...existing };
  if ((ledger.wageBudgetWeekly ?? 0) < projectedWageCommitment) return state;

  ledger.wageBudgetWeekly = Math.max(0, (ledger.wageBudgetWeekly ?? 0) - Math.max(0, weeklySalary));
  ledger.currentWageCommitment = projectedWageCommitment;
  const nextMeta = {
    ...(state.meta ?? {}),
    aiLedgers: { ...(state.meta?.aiLedgers ?? {}), [clubId]: ledger },
  };
  return { ...state, meta: nextMeta };
}

export function creditAiLedgerAmount(state: GameState, clubId: string, amount: number) {
  const existing = state.meta?.aiLedgers?.[clubId];
  if (!existing) {
    const seeded = ensureAiLedgerFromClub(state, clubId);
    return creditAiLedgerAmount(seeded, clubId, amount);
  }
  const ledger = { ...existing };
  ledger.transferBudget = Math.max(0, ledger.transferBudget + amount);
  ledger.balance = (ledger.balance ?? 0) + amount;
  const nextMeta = {
    ...(state.meta ?? {}),
    aiLedgers: { ...(state.meta?.aiLedgers ?? {}), [clubId]: ledger },
  };
  return { ...state, meta: nextMeta };
}

export function upgradeFacilityForClub(state: GameState, clubId: string, facility: FacilityKey) {
  const club = state.clubs[clubId];
  if (!club) return state;
  const currentLevel = club.facilityLevels?.[facility] ?? 1;
  const nextLevel = Math.min(5, currentLevel + 1);
  if (nextLevel === currentLevel) return state;
  const cost = getFacilityUpgradeCostForKey(facility, currentLevel);
  const stateWithLedger = ensureAiLedgerFromClub(state, clubId);
  const ledger = stateWithLedger.meta?.aiLedgers?.[clubId];
  if (!ledger) return stateWithLedger;
  if (ledger.transferBudget < cost) return stateWithLedger;
  // deduct from ledger
  const nextState = deductAiLedgerAmount(stateWithLedger, clubId, cost);

  const nextFacilityLevels = {
    ...(club.facilityLevels ?? { training: 1, youth: 1, medical: 1, scouting: 1 }),
    [facility]: nextLevel,
  };
  const newRating = getFacilityRating({ ...club, facilityLevels: nextFacilityLevels }, facility);
  const updatedClub = {
    ...club,
    facilityLevels: nextFacilityLevels,
    facilities: { ...club.facilities, [facility]: newRating },
  };
  const updatedClubs = { ...nextState.clubs, [clubId]: updatedClub };
  const ev = {
    id: `event-facility-${(nextState.events?.length ?? 0) + 1}`,
    date: nextState.time.date,
    type: "milestone" as const,
    description: `${facility} upgraded to level ${nextLevel} for ${updatedClub.name}`,
  };
  return { ...nextState, clubs: updatedClubs, events: [...(nextState.events ?? []), ev] };
}

/**
 * Financial Forecasting: Project club balance N weeks into the future.
 * Accounts for fixed wage commitments, estimated matchday revenue,
 * and potential transfer activity.
 */
export interface FinancialForecast {
  clubId: string;
  clubName: string;
  currentDate: string;
  projectionWeeks: number;
  currentBalance: number;
  projectedBalance: number;
  estimatedWeeklyNet: number;
  runoutDate: string | null; // when balance reaches zero (if negative trajectory)
  healthRating: "healthy" | "stable" | "vulnerable" | "critical";
  breakdown: {
    weeklyWageCommitment: number;
    weeklyMatchdayRevenue: number;
    weeklyOperatingCosts: number;
    weeklyNetCashflow: number;
    projectionPeriodCost: number;
    projectionPeriodRevenue: number;
  };
  warnings: string[];
}

/**
 * Project a club's balance forward N weeks.
 * Assumes current run-rate for wages, revenue, and costs.
 * Does NOT account for transfer spending (too variable to predict).
 */
export function projectClubBalance(
  state: GameState,
  clubId: string,
  projectionWeeks = 4,
): FinancialForecast {
  const club = state.clubs[clubId];
  const snapshot = buildWeeklyFinanceSnapshot(state, clubId);
  const fin = computeClubFinancials(state, clubId);

  const currentBalance = fin.balance;
  const weeklyWages = snapshot.expenses.playerSalaries;
  const weeklyMatchRevenue = snapshot.income.matchRevenue; // Changed from matchdayRevenue
  const weeklyOtherCosts = snapshot.expenses.total - weeklyWages;

  const weeklyNet = weeklyMatchRevenue - weeklyWages - weeklyOtherCosts;
  const projectionPeriodNet = weeklyNet * projectionWeeks;
  const projectedBalance = currentBalance + projectionPeriodNet;

  // Calculate runout date (when balance hits zero at current trajectory)
  let runoutDate: string | null = null;
  if (weeklyNet < 0 && currentBalance > 0) {
    const weeksUntilRunout = Math.ceil(currentBalance / Math.abs(weeklyNet));
    const runoutCalc = new Date(state.time.date);
    runoutCalc.setUTCDate(runoutCalc.getUTCDate() + weeksUntilRunout * 7);
    runoutDate = runoutCalc.toISOString().slice(0, 10);
  }

  // Health rating
  let healthRating: "healthy" | "stable" | "vulnerable" | "critical" = "healthy";
  if (projectedBalance < 0) healthRating = "critical";
  else if (projectedBalance < weeklyWages * 4) healthRating = "vulnerable";
  else if (weeklyNet < 0) healthRating = "stable";

  // Warnings
  const warnings: string[] = [];
  if (weeklyNet < 0) {
    warnings.push(`Negative cashflow: -€${Math.abs(weeklyNet).toFixed(0)}/week`);
  }
  if (projectedBalance < 0) {
    warnings.push(`Balance will be negative in ${projectionWeeks} weeks without intervention`);
  }
  if (weeklyWages > weeklyMatchRevenue) {
    warnings.push(
      `Wage bill exceeds match revenue (€${weeklyWages.toFixed(0)} vs €${weeklyMatchRevenue.toFixed(0)}/week)`,
    );
  }

  return {
    clubId,
    clubName: club?.name ?? "Unknown",
    currentDate: state.time.date,
    projectionWeeks,
    currentBalance,
    projectedBalance: Math.round(projectedBalance),
    estimatedWeeklyNet: Math.round(weeklyNet),
    runoutDate,
    healthRating,
    breakdown: {
      weeklyWageCommitment: Math.round(weeklyWages),
      weeklyMatchdayRevenue: Math.round(weeklyMatchRevenue),
      weeklyOperatingCosts: Math.round(weeklyOtherCosts),
      weeklyNetCashflow: Math.round(weeklyNet),
      projectionPeriodCost: Math.round((weeklyWages + weeklyOtherCosts) * projectionWeeks),
      projectionPeriodRevenue: Math.round(weeklyMatchRevenue * projectionWeeks),
    },
    warnings,
  };
}

/**
 * Bulk project all AI clubs' balances.
 * Useful for identifying clubs in financial distress.
 */
export function projectAllClubsBalance(state: GameState, projectionWeeks = 4): FinancialForecast[] {
  return Object.values(state.clubs)
    .filter((club) => club?.aiManager)
    .map((club) => projectClubBalance(state, club.id, projectionWeeks));
}

/**
 * Get clubs at risk of financial crisis.
 * Returns clubs with negative projected balance or imminent runout.
 */
export function getClubsAtFinancialRisk(
  state: GameState,
  projectionWeeks = 4,
): FinancialForecast[] {
  const projections = projectAllClubsBalance(state, projectionWeeks);
  return projections.filter(
    (f) =>
      f.healthRating === "critical" || f.healthRating === "vulnerable" || f.runoutDate !== null,
  );
}

export default computeClubFinancials;
