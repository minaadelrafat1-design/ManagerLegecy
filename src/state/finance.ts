import type { GameState } from "./types";

export interface FinanceSnapshot {
  matchRevenue: number;
  sponsorship: number;
  prizeMoney: number;
  playerSales: number;
  competitionRevenue: number;
  total: number;
}

export interface FinanceExpenseSnapshot {
  playerSalaries: number;
  staff: number;
  transfers: number;
  facilities: number;
  scouting: number;
  medical: number;
  operations: number;
  total: number;
}

function clampNumber(value: number, min = 0) {
  return Math.max(min, Math.round(value));
}

export function parseMoney(display: string | number | undefined): number {
  if (typeof display === "number") return Math.round(display);
  if (!display) return 0;
  const match = /([\d.-]+)\s*([MK])?/i.exec(String(display).replace(/[^0-9.MK-]/g, ""));
  if (!match?.[1]) return 0;
  const n = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000_000) return `€${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000)
    return `€${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `€${amount.toLocaleString("en-US")}`;
  return `€${amount.toLocaleString("en-US")}`;
}

export function formatTransferBudget(amount: number): string {
  return formatMoney(amount);
}

export function formatWageBudget(amount: number): string {
  return `${formatMoney(amount)} / wk`;
}

function getManagedClubId(state: GameState): string | undefined {
  return state.manager?.clubId ?? state.currentClub?.id;
}

function getManagedClub(state: GameState) {
  const clubId = getManagedClubId(state);
  return clubId ? (state.clubs[clubId] ?? state.currentClub) : state.currentClub;
}

function getCurrentPlayers(state: GameState, clubId: string) {
  return (state.currentClub?.playerIds ?? []).filter((id) => state.players[id]?.clubId === clubId);
}

export function buildWeeklyFinanceSnapshot(state: GameState, clubId?: string) {
  const club = clubId ? (state.clubs[clubId] ?? undefined) : getManagedClub(state);
  const resolvedClubId = clubId ?? club?.id;
  if (!resolvedClubId || !club) {
    return {
      income: {
        matchRevenue: 0,
        sponsorship: 0,
        prizeMoney: 0,
        playerSales: 0,
        competitionRevenue: 0,
        total: 0,
      },
      expenses: {
        playerSalaries: 0,
        staff: 0,
        transfers: 0,
        facilities: 0,
        scouting: 0,
        medical: 0,
        operations: 0,
        total: 0,
      },
    };
  }

  const managedClubId = getManagedClubId(state);
  const lastUpdatedDate =
    managedClubId === resolvedClubId ? state.finances?.lastUpdatedDate : undefined;
  const recentMatches = (state.matches ?? []).filter((match) => {
    if (!match.playedAt) return false;
    if (lastUpdatedDate && match.playedAt <= lastUpdatedDate) return false;
    return match.homeClubId === resolvedClubId || match.awayClubId === resolvedClubId;
  });

  const reputationFactor = Math.max(0, club.reputation);
  const stadiumRating = club.facilities.stadium;
  const reportedAttendance = state.fans?.attendanceAvg;
  const estimatedAttendance = Math.round(10_000 + stadiumRating * 260 + reputationFactor * 140);
  const attendance = reportedAttendance ?? estimatedAttendance;
  const stadiumCapacity = Math.max(
    1,
    club.stadium?.capacity ?? Math.round(9_000 + stadiumRating * 300),
  );
  const actualAttendance = Math.min(Math.max(0, attendance), stadiumCapacity);

  const componentLevel = (id: string) => club.stadium?.componentLevels?.[id as keyof typeof club.stadium.componentLevels] ?? 1;
  const hospitalityLevel = componentLevel("hospitality");
  const vipLevel = componentLevel("vip");
  const corporateLevel = componentLevel("corporateBoxes");
  const concessionsLevel = componentLevel("concessions");

  const ticketPrice = Math.max(
    8,
    Math.min(35, Math.round(12 + (stadiumRating - 50) * 0.24 + (reputationFactor - 50) * 0.18)),
  );
  const gate = actualAttendance * ticketPrice;
  const corporate = Math.round(
    Math.max(
      0,
      gate * (0.12 + (hospitalityLevel - 1) * 0.012 + (vipLevel - 1) * 0.01) +
        stadiumCapacity * (1.5 + (corporateLevel - 1) * 0.18),
    ),
  );
  const concessions = Math.round(actualAttendance * (concessionsLevel - 1) * 1.25);

  const matchRevenue = recentMatches.reduce((sum, match) => {
    const home = match.homeClubId === resolvedClubId;
    const resultBonus =
      (home && match.scoreHome! > match.scoreAway!) ||
      (!home && match.scoreAway! > match.scoreHome!)
        ? 50_000
        : match.scoreHome !== match.scoreAway
          ? 18_000
          : 0;
    return sum + gate + corporate + concessions + resultBonus;
  }, 0);

  const sponsorship = clampNumber(
    900_000 +
      reputationFactor * 12_000 +
      Math.round(actualAttendance * 34) +
      Math.round(stadiumRating * 3_500),
  );

  const prizeMoney = clampNumber(
    recentMatches.reduce((sum, match) => {
      const competitiveBonus = match.scoreHome === match.scoreAway ? 0 : 28_000;
      const victoryBonus =
        (match.homeClubId === clubId && match.scoreHome! > match.scoreAway!) ||
        (match.awayClubId === clubId && match.scoreAway! > match.scoreHome!)
          ? 16_000
          : 0;
      return sum + competitiveBonus + victoryBonus;
    }, 0) +
      (state.competitions.filter((competition) => competition.status === "active").length || 0) *
        48_000,
  );

  const competitionRevenue = clampNumber(
    280_000 +
      state.competitions.filter((competition) => competition.status === "active").length * 120_000 +
      reputationFactor * 1_100,
  );

  const playerSales = 0;

  const playerSalaries = (club.playerIds ?? []).reduce((sum, playerId) => {
    const player = state.players[playerId];
    return sum + parseMoney(player?.salary);
  }, 0);

  const roleBaseWeekly: Record<string, number> = {
    "Assistant Manager": 1_400,
    "Head Physio": 1_200,
    "Chief Scout": 1_100,
    "Head Coach": 1_900,
    Analyst: 900,
    Scout: 850,
    Physio: 900,
  };
  const staffList = (state.staff ?? []).filter((m) => m.clubId === clubId);
  const staffWages = staffList.reduce((s, m) => {
    const base = roleBaseWeekly[m.role] ?? 1_000;
    const ratingFactor = 1 + ((m.rating ?? 50) - 50) / 300;
    return s + Math.round(base * ratingFactor);
  }, 0);
  const staff = clampNumber(staffWages + 35_000);

  const facilities = clampNumber(
    140_000 +
      ((club.facilities.training +
        club.facilities.medical +
        club.facilities.youth +
        stadiumRating) /
        4) *
        7_500,
  );
  const scouting = clampNumber(
    100_000 +
      (state.transfers?.filter((transfer) => transfer.status !== "rejected").length ?? 0) * 16_000 +
      club.scouting.rating * 1_100,
  );
  const medical = clampNumber(120_000 + (club.medical.playersInTreatment ?? 0) * 72_000);
  const operations = clampNumber(
    260_000 +
      (100 - (state.board?.confidence ?? 50)) * 1_800 +
      Math.round(stadiumRating * 1_100) +
      (club.stadium?.operatingCost ?? 0),
  );

  const income = {
    matchRevenue,
    sponsorship,
    prizeMoney,
    playerSales,
    competitionRevenue,
    total: matchRevenue + sponsorship + prizeMoney + playerSales + competitionRevenue,
  };

  const expenses = {
    playerSalaries,
    staff,
    transfers: 0,
    facilities,
    scouting,
    medical,
    operations,
    total: playerSalaries + staff + facilities + scouting + medical + operations,
  };

  return { income, expenses };
}

export function applyWeeklyFinanceTick(state: GameState): GameState {
  const clubId = getManagedClubId(state);
  if (!clubId) return state;

  const { income, expenses } = buildWeeklyFinanceSnapshot(state);
  const currentBalance = parseMoney(state.finances?.balance);
  const nextBalance = currentBalance + income.total - expenses.total;
  // Loan handling: process existing loans (weekly payment & interest), and create a new loan if balance negative.
  const prevLoans = state.finances?.loans ?? [];
  const nextLoans: NonNullable<GameState["finances"]["loans"]> = [];
  let balanceAfterLoans = nextBalance;
  for (const loan of prevLoans) {
    // weekly interest and payment
    const weeklyRate = loan.annualRatePct / 100 / 52;
    const interest = Math.round(loan.remaining * weeklyRate);
    const principalPayment = Math.round(loan.weeklyPayment - interest);
    const remaining = Math.max(0, loan.remaining - principalPayment);
    const updatedLoan = { ...loan, remaining };
    // deduct payment from balance
    balanceAfterLoans -= loan.weeklyPayment;
    if (remaining > 0) nextLoans.push(updatedLoan);
  }
  // If balance (after incomes/expenses and loan payments) is negative,
  // convert the shortfall into a new loan (default 52-week term at 6% annual).
  let finalBalance = balanceAfterLoans;
  const transferSpendThisWeek = state.finances?.expenses?.transfers ?? 0;
  if (finalBalance < 0) {
    const shortfall = Math.abs(finalBalance);
    const principal = Math.round(shortfall);
    const annualRate = 6; // default 6% APR
    const termWeeks = 52;
    const weeklyRate = annualRate / 100 / 52;
    // amortised weekly payment
    const factor = Math.pow(1 + weeklyRate, termWeeks);
    const weeklyPayment = Math.round((principal * weeklyRate * factor) / (factor - 1));
    const newLoan = {
      id: `loan-${(state.finances?.loans?.length ?? 0) + nextLoans.length + 1}`,
      principal,
      remaining: principal,
      weeklyPayment,
      annualRatePct: annualRate,
      termWeeks,
      startedAt: state.time.date,
      approved: (state.board?.confidence ?? 50) >= 40,
    };
    nextLoans.push(newLoan);
    // keep the shortfall visible in the book rather than silently wiping it away
    finalBalance = Math.round(finalBalance);
  }

  const totalDebt = nextLoans.reduce((sum, loan) => sum + Math.max(0, loan.remaining), 0);
  const currentDebt = Math.max(0, -Math.min(0, Math.round(finalBalance)));
  const nextFinances = {
    ...state.finances,
    balance: formatMoney(Math.round(finalBalance)),
    debt: formatMoney(totalDebt || currentDebt),
    loans: nextLoans,
    income,
    expenses: {
      ...expenses,
      transfers: transferSpendThisWeek,
      total: expenses.total + transferSpendThisWeek,
    },
    lastUpdatedDate: state.time.date,
    lastUpdatedWeek: state.time.week,
  };

  const nextState: GameState = {
    ...state,
    finances: nextFinances,
  };

  if (income.matchRevenue > 0) {
    const ledgerId = `match-revenue-${state.time.date}`;
    const transactions = nextState.financialTransactions ?? [];
    if (!transactions.some((transaction) => transaction.id === ledgerId)) {
      nextState.financialTransactions = [
        ...transactions,
        {
          id: ledgerId,
          date: state.time.date,
          type: "match_revenue",
          description: `${state.clubs[clubId]?.name ?? clubId}: matchday revenue`,
          amount: income.matchRevenue,
          category: "revenue",
        },
      ];
    }
  }

  // OPTIMIZATION: Archive financial transactions older than 2 seasons to prevent unbounded growth
  // Keep only recent transactions to reduce state size in mature careers
  const twoDaysInSeasons = 730; // ~2 seasons worth of days
  const archiveDate = new Date(state.time.date);
  archiveDate.setDate(archiveDate.getDate() - twoDaysInSeasons);
  const archiveDateStr = archiveDate.toISOString().split("T")[0];

  if (nextState.financialTransactions && nextState.financialTransactions.length > 100) {
    nextState.financialTransactions = nextState.financialTransactions.filter((trans) => {
      return trans.date >= archiveDateStr;
    });
  }

  return nextState;
}
