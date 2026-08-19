import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const { buildSimTeamInput } = await import("../src/lib/ai-match-adapter.ts");
const { simulateMatch, playerToSim } = await import("../src/lib/match-engine.ts");

// This test builds the same two teams once as "player-controlled" (via
// `routes/match.tsx`-style building) and once via the AI adapter, then
// runs the engine with the same seed and asserts the engine inputs/outputs
// match closely.

const state = buildInitialState();
const homeClub = state.currentClub;
const awayClub = state.clubs["westport-united"];

const homeInputAI = buildSimTeamInput("home", homeClub, state.players, true);
const awayInputAI = buildSimTeamInput("away", awayClub, state.players, false);

// Construct a player-controlled-style home input: mimic `routes/match.tsx`'s
// behavior by converting `Player` records with `playerToSim` + `applyCondition`.
const startingXI = homeClub.playerIds.slice(0, 11).map((id) => state.players[id]);
const bench = homeClub.playerIds.slice(11).map((id) => state.players[id]);
const homeInputPlayer = {
  id: "home",
  name: homeClub.name,
  xi: startingXI.map((p) => playerToSim(p as any)),
  bench: bench.map((p) => playerToSim(p as any)),
  tactics: homeInputAI.tactics,
  homeAdvantage: true,
  formation: homeClub.formation,
};

const seed = 424242;
const simAI = simulateMatch(homeInputAI, awayInputAI, seed);
const simPlayer = simulateMatch(homeInputPlayer, awayInputAI, seed);

console.log("AI final", simAI.finalScore, "Player final", simPlayer.finalScore);

// Assert same final score when inputs are effectively the same (allow minor diffs)
if (
  simAI.finalScore.home === simPlayer.finalScore.home &&
  simAI.finalScore.away === simPlayer.finalScore.away
) {
  console.log("PASS — player-controlled and AI inputs produced same outcome");
  process.exit(0);
}

console.error("FAIL — outcomes differ");
process.exit(2);
