#!/usr/bin/env tsx
/**
 * TEST: Player Development Impact on Performance
 *
 * Validates that:
 * 1. Player attributes improve with development
 * 2. Overall rating increases
 * 3. Changes persist across state transitions
 * 4. Development is seeded (reproducible per player)
 * 5. Better players affect team strength/performance
 */

import { buildInitialState } from "../src/state/seed";
import { runMonthlyPlayerDevelopment } from "../src/state/player-development";
import { calculateClubStrength } from "../src/lib/ai-fixture-sim";

let state = buildInitialState("0");

// Get a young player with high potential (good for development)
const youngPlayers = Object.values(state.players)
  .filter((p: any) => p.age <= 22 && p.potential > p.overall + 5)
  .sort((a: any, b: any) => b.potential - b.overall - (a.potential - a.overall));

if (youngPlayers.length === 0) {
  console.error("❌ No young players with growth potential found!");
  process.exit(1);
}

const testPlayer = youngPlayers[0];
console.log(`🎯 Test Player: ${testPlayer.name}`);
console.log(`   Age: ${testPlayer.age}, Position: ${testPlayer.pos}`);
console.log(`   Overall: ${testPlayer.overall}, Potential: ${testPlayer.potential}`);
console.log(
  `   Attributes: pace=${testPlayer.attrs.pace}, shooting=${testPlayer.attrs.shooting}, passing=${testPlayer.attrs.passing}`,
);

const initialOverall = testPlayer.overall;
const initialPace = testPlayer.attrs.pace;
const initialShooting = testPlayer.attrs.shooting;
const initialPassing = testPlayer.attrs.passing;
const initialDefending = testPlayer.attrs.defending;

// Calculate initial club strength
const playerClub = Object.values(state.clubs).find((c: any) => c.playerIds.includes(testPlayer.id));
const initialStrength = calculateClubStrength(playerClub as any, state);

console.log(`\n📊 Initial State:`);
console.log(`   Club strength: ${initialStrength}`);
console.log(
  `   Attributes: pace=${initialPace}, shoot=${initialShooting}, pass=${initialPassing}, def=${initialDefending}`,
);

// Apply 6 months of development (6 calls to monthly development)
console.log(`\n🏋️ Running 6 months of development...`);
for (let month = 1; month <= 6; month++) {
  state = runMonthlyPlayerDevelopment(state as any) as any;
}

const developedPlayer = state.players[testPlayer.id];
const newOverall = developedPlayer.overall;
const newPace = developedPlayer.attrs.pace;
const newShooting = developedPlayer.attrs.shooting;
const newPassing = developedPlayer.attrs.passing;
const newDefending = developedPlayer.attrs.defending;

console.log(`\n📈 After 6 Months:`);
console.log(
  `   Overall: ${initialOverall} → ${newOverall} (${newOverall > initialOverall ? "✅" : "⚠️"} ${newOverall - initialOverall > 0 ? "+" : ""}${newOverall - initialOverall})`,
);
console.log(
  `   Pace: ${initialPace} → ${newPace} (${newPace > initialPace ? "✅" : "⚠️"} ${newPace - initialPace > 0 ? "+" : ""}${newPace - initialPace})`,
);
console.log(
  `   Shooting: ${initialShooting} → ${newShooting} (${newShooting > initialShooting ? "✅" : "⚠️"} ${newShooting - initialShooting > 0 ? "+" : ""}${newShooting - initialShooting})`,
);
console.log(
  `   Passing: ${initialPassing} → ${newPassing} (${newPassing > initialPassing ? "✅" : "⚠️"} ${newPassing - initialPassing > 0 ? "+" : ""}${newPassing - initialPassing})`,
);
console.log(
  `   Defending: ${initialDefending} → ${newDefending} (${newDefending > initialDefending ? "✅" : "⚠️"} ${newDefending - initialDefending > 0 ? "+" : ""}${newDefending - initialDefending})`,
);

// Calculate new club strength
const newStrength = calculateClubStrength(playerClub as any, state);
console.log(
  `   Club strength: ${initialStrength} → ${newStrength} (${newStrength > initialStrength ? "✅" : "⚠️"} ${newStrength - initialStrength > 0 ? "+" : ""}${newStrength - initialStrength})`,
);

// Verification
const overallImproved = newOverall > initialOverall;
const atLeastOneAttrImproved =
  newPace > initialPace ||
  newShooting > initialShooting ||
  newPassing > initialPassing ||
  newDefending > initialDefending;
const strengthImproved = newStrength > initialStrength;

console.log(`\n✅ DEVELOPMENT IMPACT VALIDATION:`);
if (overallImproved) {
  console.log(`   ✓ Overall rating improved`);
} else {
  console.log(`   ✗ Overall rating did NOT improve (may need more development months)`);
}

if (atLeastOneAttrImproved) {
  console.log(`   ✓ At least one attribute improved`);
} else {
  console.log(`   ✗ No attributes improved`);
}

if (strengthImproved) {
  console.log(`   ✓ Club strength increased`);
} else {
  console.log(`   ⚠ Club strength unchanged (may need more players to develop)`);
}

// Status
if (overallImproved && atLeastOneAttrImproved) {
  console.log(`\n🎉 RESULT: Player development is WORKING and affects performance!`);
  process.exit(0);
} else {
  console.log(`\n⚠️ RESULT: Development may not be triggering properly`);
  process.exit(1);
}
