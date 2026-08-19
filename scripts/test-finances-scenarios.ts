import { buildInitialState, HOME_CLUB_ID } from "../src/state/seed";
import computeClubFinancials from "../src/state/club-finance";

function printClub(financials: ReturnType<typeof computeClubFinancials>) {
  console.log("Club:", financials.clubId);
  console.log(" Balance:", financials.balance);
  console.log(" Transfer budget:", financials.transferBudget);
  console.log(" Wage budget weekly:", financials.wageBudgetWeekly);
  console.log(" Wage commitments weekly:", financials.wageCommitmentsWeekly);
  console.log(" Health tier:", financials.healthTier);
  console.log(" Income total (weekly):", financials.income.total);
  console.log(" Expenses total (weekly):", financials.expenses.total);
  console.log("---");
}

async function main() {
  const state = buildInitialState();
  // pick a few representative clubs
  const clubIds = [HOME_CLUB_ID, Object.keys(state.clubs)[0]];
  for (const id of clubIds) {
    const fin = computeClubFinancials(state, id);
    printClub(fin);
  }
  // print a sample of 5 clubs
  const sample = Object.keys(state.clubs).slice(0, 5);
  for (const id of sample) {
    const fin = computeClubFinancials(state, id);
    printClub(fin);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
