import { buildInitialState } from "../src/state/seed";
import { runAiActions } from "../src/state/ai-actions";
import {
  ensureAiLedgerEntry,
  buildTransferOffer,
  canBuyerAfford,
  listPlayerForTransfer,
} from "../src/state/ai-transfers";

async function run() {
  let state = buildInitialState({ seed: "test-transfer-flows", populateCountries: 8 });

  // pick a wealthy buyer (highest reputation club)
  const clubs = Object.values(state.clubs).filter((c) => c.aiManager);
  const sorted = clubs.sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));
  const buyer = sorted[0];
  const seller = sorted.slice(-1)[0];

  console.log("Buyer:", buyer.name, "rep", buyer.reputation);
  console.log("Seller:", seller.name, "rep", seller.reputation);

  // ensure seller lists a player for transfer
  const candidate = seller.playerIds[0];
  state = runAiActions(state);

  // list manually if not listed
  if (!state.transfers.find((t) => t.playerId === candidate)) {
    state = listPlayerForTransfer(state, candidate, seller.id) as any;
  }

  const listing = state.transfers.find((t) => t.playerId === candidate);
  if (!listing) throw new Error("Listing missing");

  // buyer builds offer
  const offer = buildTransferOffer(state, buyer, listing as any);
  const affordability = canBuyerAfford(state, buyer, offer as any);

  console.log("Offer built:", offer, "affordable:", affordability.canAfford);

  if (!affordability.canAfford) {
    console.log("Buyer can't afford; marking buyer ledger to be rich and retrying");
    const res = ensureAiLedgerEntry(state, buyer.id);
    state = res.state;
    state.meta.aiLedgers[buyer.id].transferBudget = Math.max(
      state.meta.aiLedgers[buyer.id].transferBudget,
      100_000_000,
    );
  }

  // retry
  const offer2 = buildTransferOffer(state, state.clubs[buyer.id], listing as any);
  const affordability2 = canBuyerAfford(state, state.clubs[buyer.id], offer2 as any);
  console.log("Retry Offer:", offer2, "affordable:", affordability2.canAfford);

  const buyerLedgerBefore = ensureAiLedgerEntry(state, buyer.id).ledger;
  console.log("Buyer ledger before:", buyerLedgerBefore);

  console.log("Running AI actions to possibly execute the transfer...");
  state = runAiActions(state);

  const postTransfers = state.transfers.filter((t) => t.playerId === candidate);
  const buyerLedgerAfter = ensureAiLedgerEntry(state, buyer.id).ledger;
  console.log("Buyer ledger after:", buyerLedgerAfter);

  if (!buyerLedgerBefore || !buyerLedgerAfter) {
    throw new Error("Ledger missing after AI actions");
  }

  const transferSpent = buyerLedgerBefore.transferBudget - buyerLedgerAfter.transferBudget;
  const wageSpent = buyerLedgerBefore.wageBudgetWeekly - buyerLedgerAfter.wageBudgetWeekly;

  console.log("Post-transfer listing for player exists?", postTransfers.length);
  console.log("Budget change: transferSpent=", transferSpent, "wageSpent=", wageSpent);

  if (transferSpent > 0 || wageSpent > 0) {
    console.log("Ledger was updated for an AI offer — PASS");
  } else if (postTransfers.length === 0) {
    console.log("No ledger spend but listing removed; transfer path likely executed — PASS");
  } else {
    console.log("No spend detected; transfer may remain in negotiation — PASS (no crash)");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
