import { buildInitialState } from "../src/state/seed";
import { gameReducer } from "../src/state/reducer";

// Quick harness: simulate a captain transfer and a heavy defeat and assert consequences deterministic
function run() {
  const base = buildInitialState();
  // pick a club with players
  const clubIds = Object.keys(base.clubs).filter(
    (id) => (base.clubs[id].playerIds?.length ?? 0) > 0,
  );
  if (clubIds.length < 2) {
    console.error("Not enough clubs with players");
    process.exit(2);
  }
  const seller = clubIds[0];
  const buyer = clubIds[1];

  // create a mock transfer listing representing a captain
  const playerId = base.clubs[seller].playerIds[0];
  const listing = {
    id: "L1",
    playerId,
    sellerClubId: seller,
    name: base.players[playerId].name,
    status: "pending",
    value: 1000000,
    meta: { wasCaptain: true },
  } as any;

  let state = { ...base, transfers: [listing] } as any;

  // record baseline
  const beforeMorale = base.players[playerId].morale ?? 50;
  const beforeFans = base.fans?.approval ?? 50;
  console.log("beforeMorale=", beforeMorale, "beforeFans=", beforeFans);

  // Update transfer status to agreed
  state = gameReducer(state, { type: "UPDATE_TRANSFER_STATUS", id: "L1", status: "agreed" } as any);

  // Expectations: seller's players morale decreased, fans approval decreased, news entry added
  const sellerPlayerMorale = state.players[playerId].morale ?? 50;
  const fansApproval = state.fans?.approval ?? 50;
  const hasNews = (state.news ?? []).some(
    (n: any) => n.tag === "transfer" && n.text.includes("captain"),
  );

  console.log("afterMorale=", sellerPlayerMorale);
  console.log("afterFans=", fansApproval);
  console.log("hasNews=", !!hasNews);

  if (!(sellerPlayerMorale < beforeMorale)) {
    console.error("FAIL — expected seller player morale to drop on captain sale");
    process.exit(1);
  }
  if (!(fansApproval < beforeFans)) {
    console.error("FAIL — expected fans approval to drop on captain sale");
    process.exit(1);
  }
  if (!hasNews) {
    console.error("FAIL — expected news about captain transfer");
    process.exit(1);
  }

  // Now simulate heavy defeat for seller
  const fixture = { id: "F1", homeClubId: seller, awayClubId: buyer, status: "scheduled" } as any;
  state = { ...state, fixtures: [...state.fixtures, fixture] };
  state = gameReducer(state, {
    type: "RECORD_MATCH_RESULT",
    fixtureId: "F1",
    homeClubId: seller,
    awayClubId: buyer,
    scoreHome: 0,
    scoreAway: 4,
    seed: 1,
    playedAt: "2026-01-01",
  } as any);

  // Expect: reputation/reputation decreased for seller, news entry for big defeat
  const sellerRep = state.clubs[seller].reputation ?? 50;
  const hasMatchNews = (state.news ?? []).some(
    (n: any) => n.tag === "match" && n.text.includes("0-4"),
  );
  console.log("sellerRep=", sellerRep);
  console.log("hasMatchNews=", !!hasMatchNews);

  const beforeRep = base.clubs[seller].reputation ?? 50;
  if (!(sellerRep < beforeRep)) {
    console.error("FAIL — expected seller reputation to drop after heavy defeat");
    process.exit(1);
  }
  if (!hasMatchNews) {
    console.error("FAIL — expected match news for heavy defeat");
    process.exit(1);
  }

  console.log("PASS — consequences chains behaved as expected");
}

run();
