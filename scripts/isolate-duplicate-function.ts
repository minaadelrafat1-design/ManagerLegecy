import { buildInitialState } from "../src/state/seed.ts";
import { runEnhancedTransferWindow } from "../src/state/transfers-enhanced.ts";
import { runSeasonalPlayerLifecycle } from "../src/state/player-development.ts";
import { runSeasonalYouthGeneration } from "../src/state/academy.ts";
import { applyEuropeanQualificationRegistrations } from "../src/state/qualification.ts";
import { applyPromotionRelegation } from "../src/state/promotion.ts";
import { generateSeasonAwards } from "../src/state/awards.ts";
import { applyLongTermEvolution } from "../src/state/evolution.ts";
import { applyWorldHistoryInvariants } from "../src/state/world-history.ts";
import { applyWorldSeasonProgression } from "../src/state/world.ts";
import { generateLeagueFixtures } from "../src/state/season.ts";

let state = buildInitialState("0");
for (let s = 1; s <= 7; s++) {
  const { simulateSeasonQuick } = await import("../src/state/season.ts");
  state = simulateSeasonQuick(state);
}

const haugenId = "haugen";

const checkDupe = () => {
  const dupes =
    state.clubs["northfield-united"]?.playerIds?.includes(haugenId) &&
    state.clubs["norland-league-two-club-6"]?.playerIds?.includes(haugenId);
  return dupes ? "*** DUPLICATE ***" : "ok";
};

console.log(`Start: ${checkDupe()}`);

state = runEnhancedTransferWindow(state as any);
console.log(`After transfer window: ${checkDupe()}`);

state = runSeasonalPlayerLifecycle(state as any);
console.log(`After lifecycle: ${checkDupe()}`);

state = runSeasonalYouthGeneration(state as any);
console.log(`After youth: ${checkDupe()}`);

state = applyEuropeanQualificationRegistrations(state as any);
console.log(`After euro qual: ${checkDupe()}`);

state = applyPromotionRelegation(state as any);
console.log(`After promo/reloc: ${checkDupe()}`);

state = generateSeasonAwards(state as any);
console.log(`After awards: ${checkDupe()}`);

state = applyLongTermEvolution(state as any);
console.log(`After evolution: ${checkDupe()}`);

state = applyWorldHistoryInvariants(state as any);
console.log(`After world history: ${checkDupe()}`);

state = applyWorldSeasonProgression(state as any);
console.log(`After season progression: ${checkDupe()}`);

state = generateLeagueFixtures(state as any);
console.log(`After fixtures: ${checkDupe()}`);
