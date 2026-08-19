import assert from "node:assert/strict";
import { players } from "../src/data/squad.ts";
import {
  EXTENDED_DEFAULT_HOME_TACTICS,
  EXTENDED_DEFAULT_AWAY_TACTICS,
  playerToSim,
  simulateMatch,
} from "../src/lib/match-engine.ts";

function makeTeam(
  side: "home" | "away",
  xi: ReturnType<typeof playerToSim>[],
  tactics: Parameters<typeof simulateMatch>[0]["tactics"],
) {
  return {
    id: side,
    name: side === "home" ? "Home" : "Away",
    xi,
    bench: [],
    tactics,
    homeAdvantage: side === "home",
  } as const;
}

const homeXi = players.slice(0, 11).map(playerToSim);
const awayXi = players.slice(11, 22).map(playerToSim);

const homeTactics = { ...EXTENDED_DEFAULT_HOME_TACTICS, buildUp: "possession", directness: 40 };
const awayTactics = {
  ...EXTENDED_DEFAULT_AWAY_TACTICS,
  buildUp: "direct",
  directness: 78,
  mentality: 60,
};

const homeTeam = makeTeam("home", homeXi, homeTactics);
const awayTeam = makeTeam("away", awayXi, awayTactics);

const seeds = [13, 37, 56, 79, 101, 123, 149, 172, 199, 223];
let anyChaseOrProtect = false;
let anyAutoAdjustEvent = false;
let matchedEvents = 0;

for (const seed of seeds) {
  const result = simulateMatch(homeTeam, awayTeam, seed);
  const managerEvents = result.events.filter(
    (event) =>
      event.type === "info" &&
      (event.text.includes("urges") ||
        event.text.includes("sit deeper") ||
        event.text.includes("asks")),
  );
  if (managerEvents.length > 0) {
    anyAutoAdjustEvent = true;
    matchedEvents += managerEvents.length;
  }
  if (result.finalScore.home !== result.finalScore.away) {
    anyChaseOrProtect = anyChaseOrProtect || managerEvents.length > 0;
  }
}

console.log(`Adaptive match engine validation:`);
console.log(`- seeds evaluated: ${seeds.length}`);
console.log(`- manager adaptive events seen: ${matchedEvents}`);
console.log(`- adaptive events in at least one non-draw simulation: ${anyChaseOrProtect}`);

assert(
  anyAutoAdjustEvent,
  "Expected the match engine to generate at least one manager tactic adjustment event",
);
assert(
  anyChaseOrProtect,
  "Expected adaptive manager events to appear in a non-draw match scenario",
);

console.log(
  "PASS — adaptive match engine behaviour is present and firing across realistic fixtures.",
);
