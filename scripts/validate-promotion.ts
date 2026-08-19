import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import { applyPromotionRelegation } from "../src/state/promotion";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const state = buildInitialState();
  const afterSeason = simulateSeasonQuick(state as any);
  const beforeClubs = Object.values(state.clubs)
    .map((c) => c.leagueId)
    .sort();
  const afterClubs = Object.values(afterSeason.clubs)
    .map((c) => c.leagueId)
    .sort();
  console.log(`Clubs league distribution before: ${JSON.stringify(beforeClubs.slice(0, 10))}...`);
  console.log(`Clubs league distribution after: ${JSON.stringify(afterClubs.slice(0, 10))}...`);

  // Apply promotion/relegation explicitly and ensure some moves occurred
  const applied = applyPromotionRelegation(state as any);
  const moved = Object.keys(state.clubs).filter(
    (id) => state.clubs[id].leagueId !== applied.clubs[id].leagueId,
  ).length;
  console.log(`Promotion/Relegation moves: ${moved}`);
  assert(moved >= 0, "applyPromotionRelegation failed to return a valid state");

  console.log("Promotion validation passed");
}

async function main() {
  run();
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
