#!/usr/bin/env npx tsx
/**
 * PHASE AAA-REPAIR-3: Quick Format Validation Test
 */

import { buildInitialState } from "../src/state/seed";

const state = buildInitialState();
const worldConfig = state.meta?.worldConfig;
const continentalComps = (worldConfig?.competitions ?? []).filter(
  (c: any) => c.type === "continental",
);

console.log("PHASE AAA-REPAIR-3: Format Validation Test\n");

let validCount = 0;
let invalidCount = 0;

for (const comp of continentalComps) {
  const format = comp.format;
  if (!format) continue;

  const gs = format.groupStage;
  const ko = format.knockoutStage;

  if (gs && ko) {
    const groupsTotal = gs.numGroups ?? 1;
    const advancePerGroup = gs.advancePerGroup ?? 1;
    const qualifiedFromGroups = groupsTotal * advancePerGroup;
    const firstKORound = ko.rounds?.[0];

    if (firstKORound && (firstKORound.teams ?? 0) > 0) {
      const expectTeams = firstKORound.teams;
      const isValid = qualifiedFromGroups === expectTeams;

      if (isValid) {
        validCount++;
        console.log(
          `✓ ${comp.name}: ${qualifiedFromGroups} qualified teams → ${expectTeams} in first KO round`,
        );
      } else {
        invalidCount++;
        console.log(
          `✗ ${comp.name}: ${qualifiedFromGroups} qualified teams → ${expectTeams} in first KO round (INVALID)`,
        );
      }
    }

    // Check round progression
    if (ko.rounds && ko.rounds.length > 1) {
      for (let i = 0; i < ko.rounds.length - 1; i++) {
        const thisRound = ko.rounds[i];
        const nextRound = ko.rounds[i + 1];
        const thisTeams = thisRound.teams ?? 0;
        const nextTeams = nextRound.teams ?? 0;
        const expectedWinners = thisTeams / 2;

        if (expectedWinners !== nextTeams) {
          console.log(
            `  ✗ ${thisRound.name} (${thisTeams} teams) → ${nextRound.name} (${nextTeams} teams) - Expected ${expectedWinners}`,
          );
          invalidCount++;
        } else {
          console.log(
            `  ✓ ${thisRound.name} (${thisTeams} teams) → ${nextRound.name} (${nextTeams} teams)`,
          );
          validCount++;
        }
      }
    }
  }
}

console.log(`\n✓ Valid: ${validCount}`);
console.log(`✗ Invalid: ${invalidCount}`);

if (invalidCount === 0) {
  console.log("\n✓ All competition formats are VALID\n");
  process.exit(0);
} else {
  console.log("\n✗ Some competition formats are INVALID\n");
  process.exit(1);
}
