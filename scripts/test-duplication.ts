import { checkAllInvariants } from "../src/state/event-invariants";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";
import { GameState } from "../src/state/types";

async function testDuplication(years: number = 10) {
  console.log(`Checking for player duplication in ${years}-year run...`);
  let state = buildInitialState("0") as GameState;

  for (let i = 0; i < years; i++) {
    state = simulateSeason(state);
    state = applyWorldSeasonProgression(state);
  }

  const violations = checkAllInvariants(state);
  const dups = violations.filter((v) => v.type === "PLAYER_DUPLICATION");

  console.log(`\nTotal violations: ${violations.length}`);
  console.log(`Player duplication: ${dups.length}`);

  if (dups.length > 0) {
    console.log("\nDuplicated players:");
    dups.forEach((v) => {
      console.log(`  ${v.description}`);
      if (v.data?.playerId) {
        const clubIds = v.data?.clubIds as string[];
        console.log(`    Clubs: ${clubIds.join(", ")}`);
      }
    });
  }

  // Check for violations by type
  const byType: Record<string, number> = {};
  violations.forEach((v) => {
    byType[v.type] = (byType[v.type] || 0) + 1;
  });

  console.log("\nViolations by type:");
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
}

testDuplication().catch(console.error);
