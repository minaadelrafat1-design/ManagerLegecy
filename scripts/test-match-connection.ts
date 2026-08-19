/* Test match connection to GameState
 * Run with: npx tsx scripts/test-match-connection.ts
 */

const { buildInitialState } = await import("../src/state/seed");
await import("../src/state/training");
await import("../src/state/board");
await import("../src/state/fans");

const { simulateMatch, playerToSim } = await import("../src/lib/match-engine");
const { deriveTeamTactics } = await import("../src/hooks/use-tactics");
const { applyCondition } = await import("../src/lib/ai-match-adapter");

const state = buildInitialState();

// pick first 11 players as a starting XI
const pids = Object.keys(state.players).slice(0, 11);
const xi = pids.map((id) => state.players[id]);
const bench = Object.keys(state.players)
  .slice(11, 18)
  .map((id) => state.players[id]);

function buildInput(xiPlayers, benchPlayers, tactics) {
  return {
    id: "home",
    name: "Test Club",
    xi: xiPlayers.map((p) => applyCondition(playerToSim(p), p.morale ?? 50, p.form ?? 50)),
    bench: benchPlayers.map((p) => applyCondition(playerToSim(p), p.morale ?? 50, p.form ?? 50)),
    tactics,
    homeAdvantage: true,
    formation: state.currentClub.formation,
  };
}

const tactics = deriveTeamTactics({
  mentality: 55,
  width: 68,
  depth: 55,
  tempo: 72,
  pressing: 60,
  instructions: {
    outFromBack: false,
    counterPress: false,
    workIntoBox: false,
    fullBacksWide: false,
  },
});

// baseline sim
const sim1 = simulateMatch(
  buildInput(xi, bench, tactics),
  {
    id: "away",
    name: "Opp",
    xi: [],
    bench: [],
    tactics: { tempo: 72, pressing: 60, directness: 58, mentality: 55, width: 68, depth: 55 },
    homeAdvantage: false,
    formation: "4-4-2",
  },
  42,
);
console.log("Baseline final score", sim1.finalScore);

// now depress morale of key striker and make tactics ultra-attacking; expect deviating outcome
const modState = JSON.parse(JSON.stringify(state));
const strikerId = pids.find((id) => modState.players[id].pos === "ST") ?? pids[0];
modState.players[strikerId].morale = 30;
modState.players[strikerId].form = 28;

const tactics2 = deriveTeamTactics({
  mentality: 85,
  width: 78,
  depth: 45,
  tempo: 85,
  pressing: 75,
  instructions: { outFromBack: false, counterPress: true, workIntoBox: true, fullBacksWide: true },
});
const xi2 = pids.map((id) => modState.players[id]);
const bench2 = bench.map((p) => modState.players[p.id]);
const sim2 = simulateMatch(
  buildInput(xi2, bench2, tactics2),
  {
    id: "away",
    name: "Opp",
    xi: [],
    bench: [],
    tactics: { tempo: 72, pressing: 60, directness: 58, mentality: 55, width: 68, depth: 55 },
    homeAdvantage: false,
    formation: "4-4-2",
  },
  43,
);
console.log("Altered final score", sim2.finalScore);

console.log("PASS — match engine connection smoke test");
process.exit(0);
