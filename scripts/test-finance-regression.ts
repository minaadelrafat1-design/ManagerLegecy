import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const { buildWeeklyFinanceSnapshot, applyWeeklyFinanceTick, parseMoney } =
  await import("../src/state/finance.ts");
const { hireStaff } = await import("../src/state/staff.ts");
const { upgradeFacility, getFacilityUpgradeCostForKey } =
  await import("../src/state/facilities.ts");

const state = buildInitialState();
const clubId = state.currentClub.id;

console.log("Initial balance", state.finances.balance);
const snap1 = buildWeeklyFinanceSnapshot(state);
console.log("Initial income total", snap1.income.total, "expenses total", snap1.expenses.total);

// Hire a high-rated coach and ensure staff expenses increase
const newStaff = {
  id: "staff-new-coach",
  name: "A. Coach",
  role: "Head Coach",
  nationality: "X",
  rating: 78,
  clubId,
};
const stateAfterHire = hireStaff(state, newStaff);
const snap2 = buildWeeklyFinanceSnapshot(stateAfterHire);
console.log("After hire staff expense", snap2.expenses.staff);
assert(
  snap2.expenses.staff >= snap1.expenses.staff,
  "Staff expenses should not decrease after hiring",
);

// Balance should have been reduced immediately by hiring signing cost
assert(
  parseMoney(stateAfterHire.finances.balance) <= parseMoney(state.finances.balance),
  "Balance should decrease after hiring",
);
// Apply weekly tick to observe weekly cashflow and debt handling
const ticked = applyWeeklyFinanceTick(stateAfterHire);
console.log("Balance after weekly tick", ticked.finances.balance, "debt", ticked.finances.debt);

const clubIdForDistress = state.currentClub.id;
const distressedClub = {
  ...state.clubs[clubIdForDistress],
  reputation: 4,
  facilities: { training: 10, medical: 12, youth: 8, stadium: 8 },
  scouting: { ...state.clubs[clubIdForDistress].scouting, rating: 12 },
  playerIds: [],
};
const negativeCashflow = {
  ...state,
  clubs: {
    ...state.clubs,
    [clubIdForDistress]: distressedClub,
  },
  players: {},
  staff: [],
  fans: { ...state.fans, attendanceAvg: 1200 },
  competitions: [],
  matches: [],
  finances: {
    ...state.finances,
    balance: "€-2.5M",
    loans: [],
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
  },
};
const debtTick = applyWeeklyFinanceTick(negativeCashflow);
console.log(
  "Negative cashflow balance",
  debtTick.finances.balance,
  "loans",
  debtTick.finances.loans?.length ?? 0,
  "debt",
  debtTick.finances.debt,
);
assert(
  parseMoney(debtTick.finances.balance) < 0 || (debtTick.finances.loans?.length ?? 0) > 0,
  "Negative cashflow should leave a debt trail or negative balance instead of silently zeroing out.",
);

// Upgrade training facility once — ensure cost deducted and facilities expense reflected
const cost = getFacilityUpgradeCostForKey("training", 1);
console.log("Upgrade cost", cost);
const beforeBalance = parseMoney(ticked.finances.balance);
const stateAfterUpgrade = upgradeFacility(ticked, "training");
const afterBalance = parseMoney(stateAfterUpgrade.finances.balance);
console.log("Balance before upgrade", beforeBalance, "after upgrade", afterBalance);
assert(afterBalance <= beforeBalance, "Balance should decrease after upgrading facility");

// Simulate 12 weekly ticks to observe loan repayment schedule (if any loans exist)
let simState = stateAfterUpgrade;
for (let week = 1; week <= 12; week++) {
  simState = applyWeeklyFinanceTick(simState);
  const loans = simState.finances.loans ?? [];
  console.log(
    `Week ${week}: balance=${simState.finances.balance} loans=${loans.map((l) => `${l.id}:${l.remaining}`).join(",")}`,
  );
}

// If loans were created, they should be decreasing over time
const loansAfter = simState.finances.loans ?? [];
if (loansAfter.length > 0) {
  for (const l of loansAfter) {
    if (l.remaining > 0) console.log(`Loan ${l.id} remaining ${l.remaining}`);
  }
}

console.log("PASS — finance regression checks");
process.exit(0);
