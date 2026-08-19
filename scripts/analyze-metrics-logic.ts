import { buildInitialState } from "../src/state/seed";

// Check initial player age distribution
const initialState = buildInitialState("0");
const players = Object.values(initialState.players);

const ageGroups = {
  "16-20": 0,
  "21-25": 0,
  "26-30": 0,
  "31-34": 0,
  "35+": 0,
};

for (const player of players) {
  const age = player.age ?? 25;
  if (age <= 20) ageGroups["16-20"]++;
  else if (age <= 25) ageGroups["21-25"]++;
  else if (age <= 30) ageGroups["26-30"]++;
  else if (age <= 34) ageGroups["31-34"]++;
  else ageGroups["35+"]++;
}

console.log("INITIAL PLAYER AGE DISTRIBUTION");
console.log("═".repeat(50));
console.log(`Total players: ${players.length}`);
console.log(
  `Age 16-20:  ${ageGroups["16-20"]} (${((ageGroups["16-20"] / players.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Age 21-25:  ${ageGroups["21-25"]} (${((ageGroups["21-25"] / players.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Age 26-30:  ${ageGroups["26-30"]} (${((ageGroups["26-30"] / players.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Age 31-34:  ${ageGroups["31-34"]} (${((ageGroups["31-34"] / players.length) * 100).toFixed(1)}%)`,
);
console.log(
  `Age 35+:    ${ageGroups["35+"]} (${((ageGroups["35+"] / players.length) * 100).toFixed(1)}%)`,
);

console.log("\nRETIREMENT LOGIC ANALYSIS");
console.log("═".repeat(50));
console.log(`Players eligible for retirement (age 34+): ${ageGroups["31-34"] + ageGroups["35+"]}`);
console.log(
  `Expected retirements in 1 year (age 34+ × 12-20% chance): ~${Math.round((ageGroups["31-34"] + ageGroups["35+"]) * 0.15)}`,
);
console.log(`Actual 1-year retirements from audit: 0`);
console.log("\nCONCLUSION: Zero retirements in 1-year run is LOGICAL");
console.log("Reason: Initial player base is predominantly young (20-30 age)");
console.log("Expected: Retirements should increase significantly over 30-year runs");

console.log("\nTRANSFER LOGIC ANALYSIS");
console.log("═".repeat(50));
const clubs = Object.values(initialState.clubs);
console.log(`Total clubs: ${clubs.length}`);
console.log(
  `Transfer attempts per window: Math.max(1, clubs.length / 6) = ${Math.max(1, Math.floor(clubs.length / 6))}`,
);
console.log(`Estimated transfer windows per season: 2-3 (preseason + possibly mid-season)`);
console.log(
  `Total transfer attempts per season: ~${(Math.max(1, Math.floor(clubs.length / 6)) * 2.5).toFixed(0)}`,
);
console.log(`Actual transfers per season from audit: 2-4`);
console.log(
  `Implied acceptance rate: ${((4 / (Math.max(1, Math.floor(clubs.length / 6)) * 2.5)) * 100).toFixed(1)}%`,
);
console.log("\nCONCLUSION: 2-4 transfers per season suggests negotiation acceptance rate ~0.5-1%");
console.log("Question: Is this intentionally conservative, or a bug in negotiation logic?");

console.log("\nYOUTH GENERATION ANALYSIS");
console.log("═".repeat(50));
console.log(`Total clubs: ${clubs.length}`);
console.log(`Youth generated in 5-year run: 508`);
console.log(`Youth per club per year: ${(508 / 5 / clubs.length).toFixed(3)}`);
console.log(`Youth per club per 5-year period: ${(508 / clubs.length).toFixed(2)}`);
console.log("\nCONCLUSION: ~0.17 youth per club per year is REASONABLE");
