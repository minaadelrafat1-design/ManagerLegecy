import assert from "node:assert/strict";

const { simulateMatch, playerToSim, EXTENDED_DEFAULT_HOME_TACTICS, EXTENDED_DEFAULT_AWAY_TACTICS } =
  await import("../src/lib/match-engine.ts");
const { players } = await import("../src/data/squad.ts");

function takeXI(samplePlayers: any[], count = 11) {
  return samplePlayers.slice(0, count).map((p: any) => playerToSim(p));
}

const homeXi = takeXI(players);
const awayXi = takeXI(players.slice(11));

// Scenario A: both teams play possession build-up
const homeA = {
  id: "home",
  name: "Home",
  xi: homeXi,
  bench: [],
  tactics: { ...EXTENDED_DEFAULT_HOME_TACTICS, buildUp: "possession", directness: 30 },
};
const awayA = {
  id: "away",
  name: "Away",
  xi: awayXi,
  bench: [],
  tactics: { ...EXTENDED_DEFAULT_AWAY_TACTICS, buildUp: "possession", directness: 30 },
};

// Scenario B: away team plays direct counter
const homeB = { ...homeA };
const awayB = {
  ...awayA,
  tactics: { ...awayA.tactics, buildUp: "direct", directness: 80, counterTendency: 78 },
};

const seed = 12345;
const a = simulateMatch(homeA, awayA, seed);
const b = simulateMatch(homeB, awayB, seed);

console.log(
  "Scenario A final:",
  a.finalScore,
  "shots",
  a.snapshots[a.fullTimeMinute].home.shots,
  a.snapshots[a.fullTimeMinute].away.shots,
);
console.log(
  "Scenario B final:",
  b.finalScore,
  "shots",
  b.snapshots[b.fullTimeMinute].home.shots,
  b.snapshots[b.fullTimeMinute].away.shots,
);

// Basic assertions: simulations should run and produce results
assert(
  Number.isInteger(a.finalScore.home) && Number.isInteger(a.finalScore.away),
  "scores should be integers",
);
assert(
  Number.isInteger(b.finalScore.home) && Number.isInteger(b.finalScore.away),
  "scores should be integers",
);

// Expect some divergence when tactics differ in the away team
if (a.finalScore.home !== b.finalScore.home || a.finalScore.away !== b.finalScore.away) {
  console.log("PASS — differing tactics produced different outcomes");
  process.exit(0);
}

console.error("FAIL — differing tactics did not change outcome");
process.exit(2);
