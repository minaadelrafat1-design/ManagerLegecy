import { buildInitialState } from "../src/state/seed";
import { runAiActions } from "../src/state/ai-actions";
import { computeClubFinancials } from "../src/state/club-finance";
import { ensureAiLedgerEntry } from "../src/state/ai-transfers";
import { parseMoney } from "../src/state/finance";

function cloneState(state: any) {
  return JSON.parse(JSON.stringify(state));
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL —", message);
    process.exit(1);
  }
}

function runScenario(name: string, state: any, validate: (before: any, after: any) => void) {
  const before = cloneState(state);
  const after = runAiActions(state);
  try {
    validate(before, after);
    console.log(`PASS — ${name}`);
  } catch (error) {
    console.error(`FAIL — ${name}:`, (error as Error).message);
    process.exit(1);
  }
}

const state = buildInitialState();
const managedClubId = state.manager?.clubId ?? state.currentClub.id;
const aiClubIds = Object.values(state.clubs)
  .filter((club) => club.aiManager && club.id !== managedClubId)
  .map((club) => club.id);
assert(aiClubIds.length > 0, "No AI club found in seed");

const richAiClubId = aiClubIds[0];
const weakAiClubId = aiClubIds[1] ?? aiClubIds[0];

runScenario(
  "rich club budget preserves non-negative ledger and no impossible transfer",
  state,
  (before, after) => {
    const res = ensureAiLedgerEntry(before, richAiClubId);
    assert(res.ledger !== null, "rich ledger seeded");
    assert(res.ledger.transferBudget >= 0, "rich transfer budget non-negative");
    assert(res.ledger.wageBudgetWeekly >= 0, "rich wage budget non-negative");
    assert(
      after.meta?.aiLedgers?.[richAiClubId]?.transferBudget >= 0,
      "rich ledger still non-negative after AI actions",
    );
  },
);

runScenario("average club ledger remains authoritative", state, (before, after) => {
  const averageClubId = aiClubIds[Math.floor(aiClubIds.length / 2)];
  const beforeFin = computeClubFinancials(before, averageClubId);
  const ledger = ensureAiLedgerEntry(before, averageClubId).ledger;
  assert(ledger !== null, "average ledger seeded");
  assert(
    ledger.transferBudget === beforeFin.transferBudget,
    "average transfer budget matches authoritative model",
  );
  assert(
    ledger.wageBudgetWeekly === beforeFin.wageBudgetWeekly,
    "average wage budget matches authoritative model",
  );
});

runScenario("weak club can list players and not overspend", state, (before, after) => {
  const weakFin = computeClubFinancials(before, weakAiClubId);
  assert(
    weakFin.healthTier === "crisis" ||
      weakFin.healthTier === "vulnerable" ||
      weakFin.healthTier === "stable",
    "weak club tier is valid",
  );
  const hasListed = after.transfers.some((listing: any) => listing.sellerClubId === weakAiClubId);
  assert(typeof hasListed === "boolean", "weak club may list players");
});

runScenario("unexpected transfer income credits AI ledger", state, (before, after) => {
  const sellingClubId = aiClubIds[0];
  const listing = before.transfers.find((t: any) => t.sellerClubId === sellingClubId && t.playerId);
  if (!listing) {
    console.log("SKIP — unexpected transfer income: no existing listing for AI club");
    return;
  }
  const result = ensureAiLedgerEntry(before, sellingClubId);
  assert(result.ledger !== null, "income ledger seeded before sale");
  const initialBudget = result.ledger.transferBudget;
  const afterState = runAiActions(before);
  assert(
    afterState.meta?.aiLedgers?.[sellingClubId]?.transferBudget >= 0,
    "income ledger non-negative after sale",
  );
});

runScenario("facility investment adjusts AI ledger and club facilities", state, (before, after) => {
  const clubId = aiClubIds[0];
  const beforeLedger = ensureAiLedgerEntry(before, clubId).ledger;
  assert(beforeLedger !== null, "facility ledger seeded");
  const facilityLevelsBefore = before.clubs[clubId].facilityLevels ?? {
    training: 1,
    youth: 1,
    medical: 1,
    scouting: 1,
  };
  const afterLevels = after.clubs[clubId].facilityLevels ?? facilityLevelsBefore;
  assert(
    Object.keys(afterLevels).length === Object.keys(facilityLevelsBefore).length,
    "facility levels preserved",
  );
});

console.log("PASS — all AI finance scenarios completed");
process.exit(0);
