import {
  applyMatchResultConsequences,
  applyTransferStatusConsequences,
  applyInjuryConsequences,
  applySeasonOutcomeConsequences,
  applyRecordTransferConsequences,
  applyManagerJobOfferConsequences,
} from "../src/state/ai-consequences";

function makeState() {
  return {
    time: { date: new Date().toISOString() },
    clubs: {
      c1: { id: "c1", name: "Club 1", reputation: 50, playerIds: ["p1"], formation: "4-4-2" },
      c2: { id: "c2", name: "Club 2", reputation: 50, playerIds: [], formation: "4-4-2" },
    },
    players: { p1: { id: "p1", name: "Player 1", morale: 50, clubId: "c1" } },
    fans: { approval: 50, attendanceAvg: 1000 },
    board: { confidence: 50, expectations: [], reputation: 50 },
    manager: { id: "m1", name: "Manager", credit: 50, reputation: 50 } as any,
    finances: { transferBudget: "€1000000", wageBudget: "€10000", balance: "€500000" },
    news: [],
    events: [],
    currentClub: { id: "c1" } as any,
  } as any;
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("Assertion failed:", msg);
    process.exit(2);
  }
}

async function run() {
  let state = makeState();

  // Big home win -> club reputation changes and news if goal diff >=3
  const fixture = { homeClubId: "c1", awayClubId: "c2" } as any;
  state = applyMatchResultConsequences(state, fixture, 4, 0);
  assert(
    state.news.some((n: any) => n.tag === "match"),
    "match news should be added for big win",
  );
  assert(
    (state.clubs["c1"].reputation ?? 0) > 50,
    "home club reputation should increase after win",
  );
  assert(
    (state.clubs["c2"].reputation ?? 0) < 50,
    "away club reputation should decrease after loss",
  );

  // Transfer: big fee should bump fans and possibly news
  const listing = { sellerClubId: "c1", name: "Star", meta: { wasCaptain: true } } as any;
  state = applyTransferStatusConsequences(state, listing, "agreed");
  assert((state.fans?.approval ?? 0) >= 0, "fans present after transfer");
  assert(
    state.news.some((n: any) => n.tag === "transfer"),
    "transfer news added",
  );

  // Injury consequences reduce squad morale and add news
  state = applyInjuryConsequences(state, "p1", { type: "hamstring", severity: "moderate" });
  assert(
    state.news.some((n: any) => n.tag === "injury"),
    "injury news added",
  );
  assert((state.players["p1"].morale ?? 0) < 50, "player morale reduced after injury");

  // Season outcome: promoted (great) should boost fans and board relative to current
  const beforeFans = state.fans?.approval ?? 0;
  const beforeBoard = state.board?.confidence ?? 0;
  state = applySeasonOutcomeConsequences(state, "c1", "great");
  assert(
    (state.fans?.approval ?? 0) > beforeFans,
    "fans should increase after promotion relative to previous",
  );
  assert(
    (state.board?.confidence ?? 0) > beforeBoard,
    "board confidence should increase after promotion relative to previous",
  );

  // Record transfer consequences (RECORD_TRANSFER) — small spend
  state = applyRecordTransferConsequences(state, 20000, 0, "Bought backup");
  assert(
    state.news.some((n: any) => n.tag === "transfer"),
    "record transfer news present",
  );

  // Manager linked with job offer
  const beforeBoard2 = state.board?.confidence ?? 0;
  state = applyManagerJobOfferConsequences(state, "other-club");
  assert(
    (state.board?.confidence ?? 0) < beforeBoard2 + 1,
    "board confidence should drop or stay similar after job link",
  );

  console.log("Media/fans/board consequence tests passed.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
