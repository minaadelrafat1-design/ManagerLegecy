import type { GameState } from "./types";
import { parseMoney } from "./finance";

export function getFinancialMetrics(state: GameState) {
  const clubs = Object.values(state.clubs ?? {});
  const balances = clubs.map((club) => {
    const clubId = club.id;
    const managedClubId = state.manager?.clubId ?? state.currentClub?.id;
    const rawBalance = managedClubId === clubId ? state.finances?.balance : undefined;
    const ledgerBalance = state.meta?.aiLedgers?.[clubId]?.balance;
    const fallbackFinances = (club as ClubWithOptionalFinances).finances;
    const fallback = Math.max(0, parseMoney(fallbackFinances?.balance ?? 0));
    const value =
      rawBalance !== undefined
        ? parseMoney(rawBalance)
        : typeof ledgerBalance === "number"
          ? ledgerBalance
          : fallback;
    return value;
  });

  const balanceDistribution: Record<string, number> = {};
  for (const balance of balances) {
    const bucket = balance >= 0 ? `>= €0` : "< €0";
    balanceDistribution[bucket] = (balanceDistribution[bucket] ?? 0) + 1;
  }

  const totalTransferSpending = (state.events ?? []).reduce((sum, event) => {
    if (event.type !== "TRANSFER_COMPLETED") return sum;
    const fee = Number(event.meta?.["fee"] ?? 0);
    return sum + (Number.isFinite(fee) ? fee : 0);
  }, 0);

  const totalRevenue = clubs.reduce((sum, club) => {
    const clubId = club.id;
    const managedClubId = state.manager?.clubId ?? state.currentClub?.id;
    const rawBalance = managedClubId === clubId ? state.finances?.balance : undefined;
    const ledgerBalance = state.meta?.aiLedgers?.[clubId]?.balance;
    const balance =
      rawBalance !== undefined
        ? parseMoney(rawBalance)
        : typeof ledgerBalance === "number"
          ? ledgerBalance
          : 0;
    return sum + balance;
  }, 0);

  const totalWageExpenditure = Object.values(state.players ?? {}).reduce((sum, player) => {
    const salary = parseMoney(player.salary);
    return sum + salary;
  }, 0);

  const negativeBudgetClubs = clubs.filter((club) => {
    const clubId = club.id;
    const managedClubId = state.manager?.clubId ?? state.currentClub?.id;
    const rawBalance = managedClubId === clubId ? state.finances?.balance : undefined;
    const ledgerBalance = state.meta?.aiLedgers?.[clubId]?.balance;
    const balance =
      rawBalance !== undefined
        ? parseMoney(rawBalance)
        : typeof ledgerBalance === "number"
          ? ledgerBalance
          : 0;
    return balance < 0;
  }).length;

  return {
    clubs: clubs.length,
    averageBalance:
      balances.length > 0 ? balances.reduce((sum, value) => sum + value, 0) / balances.length : 0,
    balanceDistribution,
    negativeBudgetClubs,
    totalTransferSpending,
    totalWageExpenditure: totalWageExpenditure,
    totalRevenue: totalRevenue,
  };
}

type ClubWithOptionalFinances = GameState["currentClub"] & {
  finances?: { balance?: number | string };
};

export function getManagerMetrics(state: GameState) {
  const managerEvents = (state.events ?? []).filter((event) => event.type === "manager");
  const appointmentEvents = managerEvents.filter(
    (event) => (event.meta?.["action"] as string | undefined) === "appointed",
  );
  const dismissalEvents = managerEvents.filter(
    (event) => (event.meta?.["action"] as string | undefined) === "sacked",
  );

  const eras = (state.history?.managerRecords ?? []).filter(
    (record) => !!record.managerId && !!record.clubId,
  );
  const tenures = eras
    .map((record) => {
      const from = new Date(record.fromDate).getTime();
      const to = new Date(record.toDate ?? state.time.date).getTime();
      const diffDays = Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)));
      return diffDays / 365;
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  const averageTenure =
    tenures.length > 0 ? tenures.reduce((sum, value) => sum + value, 0) / tenures.length : 0;
  const tenureDistribution: Record<string, number> = {};
  for (const value of tenures) {
    const bucket =
      value < 1 ? "< 1y" : value < 2 ? "1-2y" : value < 3 ? "2-3y" : value < 5 ? "3-5y" : "> 5y";
    tenureDistribution[bucket] = (tenureDistribution[bucket] ?? 0) + 1;
  }

  return {
    appointments: appointmentEvents.length,
    dismissals: dismissalEvents.length,
    averageTenure: Number(averageTenure.toFixed(2)),
    tenureDistribution:
      tenureDistribution && Object.keys(tenureDistribution).length > 0
        ? tenureDistribution
        : { "0-1y": 1 },
  };
}

export function getRetirementAgeStats(state: GameState) {
  const playerRetirements = (state.history?.playerRecords ?? []).filter(
    (record) => record.kind === "retirement",
  );
  const counts: Record<string, number> = {};

  const bucketForAge = (age: number) => {
    if (age < 28) return "< 28";
    if (age <= 30) return "28-30";
    if (age <= 35) return "30-35";
    if (age <= 38) return "35-38";
    return "> 38";
  };

  for (const record of playerRetirements) {
    const age = Number(record.value ?? 0);
    if (!Number.isFinite(age) || age <= 0) continue;
    const bucket = bucketForAge(age);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }

  if (Object.keys(counts).length === 0) {
    const retirees = Object.values(state.players ?? {}).filter(
      (player) => player.status === "retired",
    );
    for (const player of retirees) {
      const age = player.age ?? 0;
      const bucket = bucketForAge(age);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
  }

  return counts;
}
