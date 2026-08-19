import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

let state = buildInitialState("0");

// Get a striker or midfielder age 34+ (threshold 34)
let player34 = Object.values(state.players).find(
  (p: any) =>
    p.age >= 34 && (p.pos === "ST" || p.pos === "CAM" || p.pos === "LW" || p.pos === "RW"),
);
if (!player34) {
  console.log("Looking for any player age 34+...");
  player34 = Object.values(state.players).find((p: any) => p.age >= 34);
}

if (!player34) {
  console.error("No player age 34+ found!");
  process.exit(1);
}

console.log(
  `Test player: ${player34.name}, age ${player34.age}, pos ${player34.pos}, overall ${player34.overall}, fitness ${player34.fitness}`,
);

// For this position, what's the threshold?
const posToThreshold: any = {
  GK: 38,
  CB: 36,
  RB: 36,
  LB: 36,
  CDM: 35,
  CM: 35,
  CAM: 35,
};
const threshold = posToThreshold[player34.pos] || 34;
console.log(`Retirement threshold for ${player34.pos}: ${threshold}`);
console.log(
  `Age vs threshold: ${player34.age} ${player34.age >= threshold ? ">=" : "<"} ${threshold}`,
);

if (player34.age < threshold) {
  console.log(`Player is below retirement threshold, won't retire.`);
  process.exit(0);
}

// Calculate retirement chance manually
const agePremium = Math.max(0, player34.age - threshold) * 0.12;
const baseChance = 0.12 + agePremium + (player34.age >= 38 ? 0.08 : 0);
const fitnessPenalty = player34.fitness < 55 ? 0.12 : 0;
const overallPenalty = player34.overall < 68 ? 0.1 : 0;
const injuryPenalty = player34.injury?.severity === "severe" ? 0.1 : 0;
const chance = Math.min(0.9, baseChance + fitnessPenalty + overallPenalty + injuryPenalty);
console.log(`\nRetirement chance: ${chance.toFixed(3)} (${(chance * 100).toFixed(1)}%)`);

// Now check what happens through season progression
console.log(`\nInitial status: ${player34.status ?? "active"}`);

// Simulate season 1
state = simulateSeason(state as any) as any;
let updated34 = state.players[player34.id];
console.log(`After S1 (2026-11-11): age ${updated34.age}, status ${updated34.status ?? "active"}`);

// Advance to season 2 opening
state = applyWorldSeasonProgression(state as any) as any;
console.log(`After progression: date ${state.time.date}`);

// Simulate season 2 - this is where shouldRetire should be called (2027-08-01)
state = simulateSeason(state as any) as any;
updated34 = state.players[player34.id];
console.log(`After S2 (2027-08-01): age ${updated34.age}, status ${updated34.status ?? "active"}`);

if (updated34.status !== "retired" && updated34.age >= threshold) {
  console.log(
    `\n⚠️ Player age ${updated34.age} with ${(chance * 100).toFixed(1)}% chance should have likely retired but didn't.`,
  );
}
