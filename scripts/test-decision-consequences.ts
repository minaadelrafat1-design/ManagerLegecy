import assert from "node:assert/strict";

await import("../src/state/training.ts");

const { buildInitialState } = await import("../src/state/seed.ts");
const { gameReducer } = await import("../src/state/reducer.ts");
const { applySeasonPerformance } = await import("../src/state/manager-progression.ts");
const { evaluateOffer } = await import("../src/state/negotiation.ts");
const { acceptJob, evaluateJobSecurity } = await import("../src/state/jobs.ts");

const playerIds = Object.keys(buildInitialState().players).slice(0, 6);

function averageFatigue(state: any) {
  const total = playerIds.reduce((sum, id) => sum + (state.players[id]?.fatigue ?? 0), 0);
  return total / playerIds.length;
}

const base = buildInitialState();
const highIntensity = gameReducer(
  { ...base, selectedTrainingPlanId: "plan-fitness" },
  { type: "ADVANCE_DAY", days: 14 },
);
const balanced = gameReducer(
  { ...base, selectedTrainingPlanId: "plan-balanced" },
  { type: "ADVANCE_DAY", days: 14 },
);

assert(
  averageFatigue(highIntensity) > averageFatigue(balanced),
  "High-intensity training should drive higher fatigue than balanced training over time.",
);

const seasonResult = applySeasonPerformance({ credit: 50, reputation: 60 }, "good");
assert(seasonResult.creditAfter > 50, "A strong season should lift manager credit.");

const stateWithHighCredit = {
  ...buildInitialState(),
  manager: {
    ...buildInitialState().manager,
    reputation: 78,
    credit: 85,
    boardConfidence: 80,
    fanConfidence: 82,
    squadConfidence: 80,
  },
  board: { ...buildInitialState().board, confidence: 60 },
};
const lowTrustState = {
  ...buildInitialState(),
  manager: {
    ...buildInitialState().manager,
    reputation: 78,
    credit: 18,
    boardConfidence: 20,
    fanConfidence: 20,
    squadConfidence: 20,
  },
  board: { ...buildInitialState().board, confidence: 22 },
};

assert(
  evaluateJobSecurity(stateWithHighCredit).manager.clubId === stateWithHighCredit.manager.clubId,
  "High manager credit and board trust should keep a manager employed.",
);
assert(
  evaluateJobSecurity(lowTrustState).manager.clubId === "",
  "Low manager credit and trust should create sack risk.",
);

const clubChangeState = acceptJob(
  buildInitialState(),
  Object.keys(buildInitialState().clubs).find((id) => id !== buildInitialState().manager.clubId) ??
    "",
);
assert(
  clubChangeState.manager.reputation === buildInitialState().manager.reputation,
  "Career reputation should carry to a new club.",
);
assert(
  clubChangeState.manager.credit === 50 &&
    clubChangeState.manager.boardConfidence === 50 &&
    clubChangeState.manager.fanConfidence === 50,
  "New club trust should reset while career reputation remains.",
);

const seller = buildInitialState();
const buyerClubId = Object.keys(seller.clubs).find((id) => id !== seller.manager.clubId) ?? "";
const buyerState = {
  ...seller,
  clubs: {
    ...seller.clubs,
    [buyerClubId]: { ...seller.clubs[buyerClubId], reputation: 90 },
  },
};
const playerId = Object.keys(buyerState.players)[0];
const realistic = evaluateOffer(buyerState, buyerClubId, seller.manager.clubId, playerId, {
  fee: 3_000_000,
  installments: 2,
  bonuses: 0,
  salaryWeekly: 12_000,
});
assert(
  realistic.outcome !== "random",
  "Negotiation outcomes should be deterministic from state and offer inputs.",
);
assert(
  realistic.outcome === "counter" ||
    realistic.outcome === "accepted" ||
    realistic.outcome === "rejected",
  "Negotiation should resolve to a real outcome.",
);

console.log("PASS — decision consequences and trust systems behave as expected");
process.exit(0);
