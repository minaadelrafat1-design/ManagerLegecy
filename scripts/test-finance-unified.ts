import { buildInitialState } from "../src/state/seed";
import { computeClubFinancials } from "../src/state/club-finance";
import { ensureAiLedgerEntry } from "../src/state/ai-transfers";

const state = buildInitialState();

// pick managed club and a sample AI club
const managedClubId = state.manager?.clubId ?? state.currentClub.id;
const aiClubId = Object.values(state.clubs).find((c) => c.aiManager && c.id !== managedClubId)?.id;
if (!aiClubId) {
  console.error("No AI club found in seed");
  process.exit(1);
}

const managedFin = computeClubFinancials(state, managedClubId);
const aiFin = computeClubFinancials(state, aiClubId);

// ensure AI ledger seeds from authoritative model
const res = ensureAiLedgerEntry(state, aiClubId);
const ledger = res.ledger;

if (!ledger) {
  console.error("FAIL — ensureAiLedgerEntry did not produce a ledger");
  process.exit(1);
}

// Check that ledger values match authoritative snapshot
const matchesTransfer = ledger.transferBudget === aiFin.transferBudget;
const matchesWage = ledger.wageBudgetWeekly === aiFin.wageBudgetWeekly;

if (matchesTransfer && matchesWage) {
  console.log("PASS — AI ledger seeded from authoritative club financials.");
  console.log(`Managed club balance: ${managedFin.balance}, AI club balance: ${aiFin.balance}`);
  process.exit(0);
} else {
  console.error("FAIL — AI ledger does not match authoritative financial snapshot");
  console.error("aiFin:", aiFin);
  console.error("ledger:", ledger);
  process.exit(1);
}
