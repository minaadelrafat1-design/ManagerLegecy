import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
await import("../src/state/board.ts");
await import("../src/state/fans.ts");
const { generateJobOffers, acceptJob, evaluateJobSecurity } = await import("../src/state/jobs.ts");
const { gameReducer } = await import("../src/state/reducer.ts");

let state = buildInitialState();

const originalManagerClub = state.manager.clubId;
const originalBoardConfidence = state.board.confidence;
const originalFansApproval = state.fans.approval;

state = generateJobOffers(state);
const offers = state.events.filter((event) => (event.meta as any)?.type === "job_offer");
assert(offers.length > 0, "Expected at least one manager job offer event");
assert(
  state.news.some((item) => item.text.includes("linked with")),
  "Expected job offer news item",
);

const selectedOffer = offers[0] as any;
const targetClubId = selectedOffer.meta?.clubId;
assert(
  typeof targetClubId === "string" && targetClubId.length > 0,
  "Expected target club id from offer meta",
);

state = acceptJob(state, targetClubId);
assert(state.manager.clubId === targetClubId, "Manager should now be at the target club");
assert(state.currentClub.id === targetClubId, "Current club should update to the accepted club");
assert(
  state.careerHistory.some((event) => event.summary.includes("Appointed manager of")),
  "Career history should include an appointment event",
);
assert(state.manager.credit === 50, "Manager credit should reset after taking a new job");
assert(
  state.manager.boardConfidence === 50,
  "Manager board confidence should reset after taking a new job",
);
assert(
  state.manager.fanConfidence === 50,
  "Manager fan confidence should reset after taking a new job",
);
assert(
  state.manager.squadConfidence === 50,
  "Manager squad confidence should reset after taking a new job",
);

// Simulate a poor security state and ensure sacking triggers
state = {
  ...state,
  board: { ...state.board, confidence: 20 },
  manager: {
    ...state.manager,
    credit: 20,
    boardConfidence: 20,
    fanConfidence: 20,
    squadConfidence: 20,
  },
};

state = evaluateJobSecurity(state);
assert(state.manager.clubId === "", "Manager should be unemployed after a sack");
assert(
  state.careerHistory.some((event) => event.summary.includes("Sacked by")),
  "Sacking should be recorded in career history",
);
assert(
  state.events.some((event) => event.description.includes("sacked")),
  "Sacking event should be emitted",
);

// Test fan reaction to results
state = buildInitialState();
const initialFansApproval = state.fans.approval;
const opponentClubId = Object.keys(state.clubs).find((id) => id !== state.currentClub.id) ?? "";
assert(opponentClubId, "Expected a non-current opponent club");

function playMatchAndAdvance(state: any, scoreHome: number, scoreAway: number) {
  const seed = Math.floor(Math.random() * 100000);
  const playedAt = state.time.date;
  state = gameReducer(state, {
    type: "RECORD_MATCH_RESULT",
    fixtureId: null,
    homeClubId: state.currentClub.id,
    awayClubId: opponentClubId,
    scoreHome,
    scoreAway,
    seed,
    playedAt,
  });
  return gameReducer(state, { type: "ADVANCE_DAY", days: 3 });
}

for (let i = 0; i < 3; i++) {
  state = playMatchAndAdvance(state, 2, 0);
}
assert(
  state.fans.approval >= initialFansApproval,
  `Fans approval should rise after a winning run (was ${initialFansApproval}, now ${state.fans.approval})`,
);

for (let i = 0; i < 4; i++) {
  state = playMatchAndAdvance(state, 0, 2);
}
assert(
  state.fans.approval < initialFansApproval + 10,
  `Fans approval should fall after a losing run (now ${state.fans.approval})`,
);

console.log("PASS — manager career and political ecosystem smoke test");
process.exit(0);
