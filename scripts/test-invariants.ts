import { checkAllInvariants } from "../src/state/event-invariants";
import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";
import { GameState } from "../src/state/types";

async function testInvariants(years: number, seed: string) {
  console.log(`Testing ${years}-year run with seed ${seed}...`);
  let state = buildInitialState(seed) as GameState;

  for (let i = 0; i < years; i++) {
    state = simulateSeason(state);
    state = applyWorldSeasonProgression(state);
  }

  const violations = checkAllInvariants(state);
  console.log(`Found ${violations.length} violations`);

  const byType: Record<string, number> = {};
  violations.forEach((v) => {
    byType[v.type] = (byType[v.type] || 0) + 1;
  });

  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  if (violations.length > 0) {
    console.log("\nFirst 5 violations:");
    violations.slice(0, 5).forEach((v) => {
      console.log(`  - ${v.type}: ${v.description}`);
    });
  }

  return violations.length;
}

async function main() {
  console.log("PHASE AAA-90.1 INVARIANT VALIDATION\n");
  for (const years of [1, 5, 10]) {
    for (const seed of ["0", "1", "2"]) {
      const count = await testInvariants(years, seed);
      console.log();
    }
  }
}

main().catch(console.error);
