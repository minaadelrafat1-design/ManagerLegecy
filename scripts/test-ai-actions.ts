import assert from "assert";
const { buildInitialState } = await import("../src/state/seed.ts");
const { runAiActions } = await import("../src/state/ai-actions.ts");

let state = buildInitialState();

// ensure there are AI clubs
const aiClubs = Object.values(state.clubs).filter((c) => c.aiManager);
console.log("AI clubs:", aiClubs.length);
assert(aiClubs.length > 0, "Expected some AI clubs to exist in seed");

const beforeTransfers = state.transfers.length;
const beforeTraining = (state.training ?? []).length;

state = runAiActions(state as any) as any;

console.log("Transfers before:", beforeTransfers, "after:", state.transfers.length);
console.log("Training plans before:", beforeTraining, "after:", (state.training ?? []).length);

// Check that either transfers were listed/negotiations created or training plans added or starters set
const transfersChanged = state.transfers.length !== beforeTransfers;
const trainingChanged = (state.training ?? []).length !== beforeTraining;
const startersSet = Object.values(state.players).some((p: any) => p.starter === true);

assert(
  transfersChanged || trainingChanged || startersSet,
  "AI actions produced no observable state changes",
);

console.log("PASS — AI actions smoke test");
process.exit(0);
