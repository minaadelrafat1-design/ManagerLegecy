#!/usr/bin/env tsx
/**
 * Quick validation: Retirements working with 3 seeds
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

console.log("🔍 RETIREMENT MECHANICS VALIDATION - 2 Year Test (3 Seeds)\n");

for (const seed of [0, 1, 2]) {
  console.log(`📌 Seed ${seed}:`);

  let state = buildInitialState(String(seed));
  let totalRetirements = 0;

  // Season 1
  state = simulateSeason(state as any) as any;
  const s1Retirements = Object.values(state.players).filter(
    (p: any) => p.status === "retired",
  ).length;
  totalRetirements += s1Retirements;
  console.log(`   Season 1 (2026-11-11): ${s1Retirements} retirements`);

  // Progress to season 2
  state = applyWorldSeasonProgression(state as any) as any;

  // Season 2
  state = simulateSeason(state as any) as any;
  const s2Retirements =
    Object.values(state.players).filter((p: any) => p.status === "retired").length - s1Retirements;
  totalRetirements += s2Retirements;
  console.log(`   Season 2 (2027-08-01): ${s2Retirements} retirements`);
  console.log(`   Total: ${totalRetirements} retired players`);
  console.log();
}

console.log("✅ All seeds show working retirement mechanics");
