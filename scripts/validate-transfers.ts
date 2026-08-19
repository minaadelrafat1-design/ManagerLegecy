import { buildInitialState } from "../src/state/seed";
import { listPlayerForTransfer } from "../src/state/ai-transfers";
import { createNegotiationSession, acceptTransferSession } from "../src/state/negotiation-sessions";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  let state = buildInitialState();
  const managed = state.manager.clubId;
  // find a club (not managed) that has players and pick one player from it
  const sellerClubEntry = Object.values(state.clubs).find(
    (c) => c.id !== managed && (c.playerIds?.length ?? 0) > 0,
  );
  if (!sellerClubEntry) throw new Error("No external club with players found");
  const sellerClub = sellerClubEntry.id;
  const otherPlayerId = sellerClubEntry.playerIds[0];
  const otherPlayer = state.players[otherPlayerId];
  if (!otherPlayer) throw new Error("Player not found on seller club");

  // list player for transfer by seller
  state = listPlayerForTransfer(state as any, otherPlayer.id, sellerClub as string, {
    status: "new",
  });
  const listing = state.transfers.find((t) => t.playerId === otherPlayer.id);
  assert(listing, "Listing not created");

  // create negotiation: managed club buys
  state = createNegotiationSession(
    state as any,
    managed,
    sellerClub as string,
    otherPlayer.id,
    { fee: 500000 },
    "test offer",
    "transfer",
  );
  const session = state.negotiations?.[state.negotiations.length - 1];
  assert(session, "Negotiation session not created");

  // accept transfer by invoking acceptTransferSession
  const beforeFrom = state.clubs[sellerClub].playerIds.length;
  const beforeTo = state.clubs[managed].playerIds.length;
  state = acceptTransferSession(state as any, session.id as string);
  const afterFrom = state.clubs[sellerClub].playerIds.length;
  const afterTo = state.clubs[managed].playerIds.length;

  console.log(
    `Players before -> after: seller ${beforeFrom}->${afterFrom}, buyer ${beforeTo}->${afterTo}`,
  );
  assert(afterFrom === beforeFrom - 1, "Seller did not lose player");
  assert(afterTo === beforeTo + 1, "Buyer did not gain player");

  const ev = state.events.find(
    (e) => e.meta?.action === "transfer" && e.meta?.playerId === otherPlayer.id,
  );
  assert(ev, "Transfer event not recorded");

  console.log("Transfer validation passed");
}

async function main() {
  run();
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
