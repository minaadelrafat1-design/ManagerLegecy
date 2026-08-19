/* Test training intensity and fatigue dynamics
 * Run with: npx tsx scripts/test-training-fatigue.ts
 */

const { buildInitialState } = await import("../src/state/seed");
// ensure training hooks are registered in this test environment
await import("../src/state/training");
const { seededUnit } = await import("../src/state/utils");

let state = buildInitialState();

// create a training plan assigning a player to high intensity for 5 days
const pid = Object.keys(state.players)[0];
const plan = {
  id: "plan-high",
  name: "High",
  focus: "Fitness",
  intensity: "high",
  assignedPlayerIds: [pid],
};
state = { ...state, training: [...state.training, plan] };

console.log("Starting fatigue:", state.players[pid].fatigue);
for (let d = 0; d < 5; d++) {
  // advance by one day using reducer ADVANCE_DAY
  const { gameReducer } = await import("../src/state/reducer");
  state = gameReducer(state as any, { type: "ADVANCE_DAY", days: 1 } as any);
  console.log(`Day ${d + 1} fatigue:`, state.players[pid].fatigue);
}

// now remove from training to allow recovery
state = { ...state, training: state.training.filter((p) => p.id !== "plan-high") };
for (let d = 0; d < 5; d++) {
  const { gameReducer } = await import("../src/state/reducer");
  state = gameReducer(state as any, { type: "ADVANCE_DAY", days: 1 } as any);
  console.log(`Recovery day ${d + 1} fatigue:`, state.players[pid].fatigue);
}

console.log("PASS — training fatigue dynamics simulated");
process.exit(0);
