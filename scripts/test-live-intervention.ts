/* Test live manager interventions during match
 * Run with: npx tsx scripts/test-live-intervention.ts
 */

const { buildInitialState } = await import("../src/state/seed");
const { playerToSim, simulateMatch, DEFAULT_HOME_TACTICS } =
  await import("../src/lib/match-engine");
const { applyCondition } = await import("../src/lib/ai-match-adapter");

const state = buildInitialState();
const pids = Object.keys(state.players).slice(0, 15);
const xi = pids.slice(0, 11).map((id) => state.players[id]);
const bench = pids.slice(11, 15).map((id) => state.players[id]);

const home = {
  id: "home",
  name: "Test Club",
  xi: xi.map((p) => applyCondition(playerToSim(p), p.morale ?? 50, p.form ?? 50)),
  bench: bench.map((p) => applyCondition(playerToSim(p), p.morale ?? 50, p.form ?? 50)),
  tactics: { ...DEFAULT_HOME_TACTICS },
  formation: state.currentClub.formation,
};
const away = {
  id: "away",
  name: "Opp",
  xi: [],
  bench: [],
  tactics: { tempo: 72, pressing: 60, directness: 58, mentality: 55, width: 68, depth: 55 },
  homeAdvantage: false,
  formation: "4-4-2",
};

// baseline
const base = simulateMatch(home, away, 55);
console.log("Baseline score", base.finalScore);

// intervention: at 74', change mentality -> 80, pressing -> 80
const interventions = [
  {
    minute: 74,
    side: "home",
    type: "tactics",
    payload: { mentality: 80, pressing: 80, tempo: 78 },
  },
  // also force a substitution at 75'
  {
    minute: 75,
    side: "home",
    type: "sub",
    payload: { outId: home.xi[8].id, inId: home.bench[0].id },
  },
];

const res = simulateMatch(home, away, 56, interventions);
console.log("With interventions final score", res.finalScore);

if (base.finalScore.home === res.finalScore.home && base.finalScore.away === res.finalScore.away) {
  console.log("WARNING: interventions did not change final score");
} else {
  console.log("PASS — interventions affected match outcome");
}
process.exit(0);
