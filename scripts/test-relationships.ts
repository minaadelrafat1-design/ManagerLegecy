/* Test relationships and delayed events
 * Run with: npx tsx scripts/test-relationships.ts
 */

const { buildInitialState } = await import("../src/state/seed");
await import("../src/state/relationships");
await import("../src/state/events-engine");
const { gameReducer } = await import("../src/state/reducer");

let state = buildInitialState();

// pick a player and force low morale and poor relationship
const pid = Object.keys(state.players)[0];
state = { ...state };
state = { ...state, players: { ...state.players, [pid]: { ...state.players[pid], morale: 28 } } };
// set a low relationship
state = (await import("../src/state/relationships")).setRelationship(
  state,
  "manager",
  state.manager.id,
  "player",
  pid,
  35,
);

console.log("Initial morale:", state.players[pid].morale);
console.log(
  "Initial rel:",
  (await import("../src/state/relationships")).getRelationship(
    state,
    "manager",
    state.manager.id,
    "player",
    pid,
  ),
);

// advance 1 day to let emergent generator run (creates delayed event)
state = gameReducer(state, { type: "ADVANCE_DAY", days: 1 });

const created = state.events.slice(-5);
console.log(
  "Recent events:",
  created.map((e) => ({ id: e.id, desc: e.description, meta: e.meta })),
);

// advance 4 more days to pass delayedUntil (3 days) and process effects
state = gameReducer(state, { type: "ADVANCE_DAY", days: 4 });

console.log("After processing, morale:", state.players[pid].morale);
console.log(
  "After processing, rel:",
  (await import("../src/state/relationships")).getRelationship(
    state,
    "manager",
    state.manager.id,
    "player",
    pid,
  ),
);

console.log("PASS — relationships engine simulated");
process.exit(0);
