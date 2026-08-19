import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

console.log("🏃 FAST 10-YEAR COMPREHENSIVE ECOSYSTEM VALIDATION\n");

let state = buildInitialState("0");
const startDate = state.time.date;

console.log(`Start: ${startDate}`);
console.log(
  `Initial: ${Object.keys(state.clubs).length} clubs, ${Object.keys(state.players).length} players\n`,
);

const metrics = {
  seasons: [] as any[],
  totalTransfers: 0,
  totalRetirements: 0,
  totalYouthGenerated: 0,
  totalMatches: 0,
  totalGoals: 0,
  totalDuplicates: 0,
};

for (let season = 1; season <= 10; season++) {
  const t0 = Date.now();
  state = simulateSeasonQuick(state);
  const elapsed = Date.now() - t0;

  // Count events this season
  const seasonEvents = (state.events ?? []).filter(
    (e: any) => e.date >= state.time.date.slice(0, 4) - 1,
  );
  const transfers = seasonEvents.filter((e: any) => e.type === "TRANSFER_COMPLETED").length;
  const retirements = seasonEvents.filter((e: any) => e.type === "PLAYER_RETIRED").length;
  const youth = seasonEvents.filter((e: any) => e.type === "YOUTH_GENERATED").length;

  // Check for duplicates
  const dupes = new Map();
  for (const [clubId, club] of Object.entries(state.clubs)) {
    for (const pid of club.playerIds ?? []) {
      const arr = dupes.get(pid) || [];
      arr.push(clubId);
      dupes.set(pid, arr);
    }
  }
  const duplicates = [...dupes.entries()].filter(([, clubs]) => clubs.length > 1);

  // Count matches and goals
  const matchResults = state.matchResults ?? [];
  const seasonMatches = matchResults.filter(
    (m: any) => m.date >= (season === 1 ? startDate : state.time.date),
  );
  const goals = seasonMatches.reduce(
    (sum: number, m: any) => sum + (m.homeGoals ?? 0) + (m.awayGoals ?? 0),
    0,
  );

  const totalPlayers = Object.keys(state.players).length;
  const retiredPlayers = Object.values(state.players).filter(
    (p: any) => p.status === "retired",
  ).length;

  metrics.seasons.push({
    season,
    date: state.time.date,
    clubs: Object.keys(state.clubs).length,
    players: totalPlayers,
    retired: retiredPlayers,
    transfers,
    retirements,
    youth,
    matches: seasonMatches.length,
    goals,
    duplicates: duplicates.length,
    elapsed,
  });

  metrics.totalTransfers += transfers;
  metrics.totalRetirements += retirements;
  metrics.totalYouthGenerated += youth;
  metrics.totalMatches += seasonMatches.length;
  metrics.totalGoals += goals;
  metrics.totalDuplicates += duplicates.length;

  const status = duplicates.length > 0 ? "❌" : "✅";
  console.log(
    `S${String(season).padStart(2, " ")} (${state.time.date}): ${status} ` +
      `${transfers}T | ${retirements}R | ${youth}Y | ${seasonMatches.length}M | ${goals}G | ${duplicates.length}D | ${elapsed}ms`,
  );
}

console.log(`\n=== 10-YEAR SUMMARY ===\n`);

const firstS = metrics.seasons[0];
const lastS = metrics.seasons[9];

console.log(`Timeline:`);
console.log(`  Start: ${firstS.date}`);
console.log(`  End: ${lastS.date}`);
console.log(`  Duration: 10 seasons\n`);

console.log(`Ecosystem Size:`);
console.log(`  Clubs: ${lastS.clubs} (${firstS.clubs} → ${lastS.clubs})`);
console.log(
  `  Players: ${lastS.players} (${firstS.players} → ${lastS.players}, +${lastS.players - firstS.players})`,
);
console.log(`  Retired: ${lastS.retired} total\n`);

console.log(`Career Movements:`);
const avgTransfersPerSeason = Math.round((metrics.totalTransfers / 10) * 10) / 10;
const avgTransfersPerClub = Math.round((avgTransfersPerSeason / lastS.clubs) * 100) / 100;
console.log(
  `  Transfers: ${metrics.totalTransfers} total (${avgTransfersPerSeason}/season, ${avgTransfersPerClub}/club/season) ✓`,
);
const avgRetirementsPerSeason = Math.round((metrics.totalRetirements / 10) * 10) / 10;
const retirementRate = Math.round((avgRetirementsPerSeason / (lastS.players / 10)) * 1000) / 10;
console.log(
  `  Retirements: ${metrics.totalRetirements} total (${avgRetirementsPerSeason}/season, ${retirementRate}% of active players) ✓`,
);
const avgYouthPerSeason = Math.round((metrics.totalYouthGenerated / 10) * 10) / 10;
const avgYouthPerClub = Math.round((avgYouthPerSeason / lastS.clubs) * 100) / 100;
console.log(
  `  Youth Generated: ${metrics.totalYouthGenerated} total (${avgYouthPerSeason}/season, ${avgYouthPerClub}/club/season) ✓\n`,
);

console.log(`Match Performance:`);
const avgMatchesPerSeason = Math.round((metrics.totalMatches / 10) * 10) / 10;
const avgGoalsPerMatch = Math.round((metrics.totalGoals / metrics.totalMatches) * 100) / 100;
console.log(`  Fixtures: ${metrics.totalMatches} total (${avgMatchesPerSeason}/season)`);
console.log(`  Goals: ${metrics.totalGoals} total (${avgGoalsPerMatch}/match) ✓`);
const avgGoalsPerClubPerSeason = Math.round((metrics.totalGoals / lastS.clubs / 10) * 10) / 10;
console.log(`  Goals per club/season: ${avgGoalsPerClubPerSeason}\n`);

console.log(`Data Integrity:`);
console.log(
  `  Total Duplicates Found: ${metrics.totalDuplicates} ${metrics.totalDuplicates === 0 ? "✅" : "❌"}`,
);

if (metrics.totalDuplicates > 0) {
  console.log(`  ⚠️  Found ${metrics.totalDuplicates} duplicate memberships!`);
  process.exit(1);
}

console.log(`\n=== ECOSYSTEM HEALTH ASSESSMENT ===\n`);

const issues = [];

// Check transfer rates
if (avgTransfersPerClub < 0.05) {
  issues.push("❌ Transfers too low (< 0.05/club/season)");
} else if (avgTransfersPerClub > 0.5) {
  issues.push("❌ Transfers too high (> 0.5/club/season)");
} else {
  console.log(`✅ Transfers: ${avgTransfersPerClub}/club/season (reasonable 0.05-0.5 range)`);
}

// Check retirement rates
if (retirementRate < 1) {
  issues.push("❌ Retirements too low (< 1%)");
} else if (retirementRate > 10) {
  issues.push("❌ Retirements too high (> 10%)");
} else {
  console.log(`✅ Retirements: ${retirementRate}% per season (reasonable 1-10% range)`);
}

// Check youth generation
if (avgYouthPerClub < 0.5) {
  issues.push("❌ Youth generation too low (< 0.5/club/season)");
} else if (avgYouthPerClub > 3) {
  issues.push("❌ Youth generation too high (> 3/club/season)");
} else {
  console.log(`✅ Youth Generated: ${avgYouthPerClub}/club/season (reasonable 0.5-3 range)`);
}

// Check goal scoring
if (avgGoalsPerMatch < 1.5) {
  issues.push("❌ Goals per match too low (< 1.5)");
} else if (avgGoalsPerMatch > 4) {
  issues.push("❌ Goals per match too high (> 4)");
} else {
  console.log(`✅ Goals per match: ${avgGoalsPerMatch} (reasonable 1.5-4 range)`);
}

// Check fixtures
if (avgMatchesPerSeason < 50) {
  issues.push("❌ Too few matches (< 50/season)");
} else {
  console.log(`✅ Fixtures: ${avgMatchesPerSeason}/season (good variety)`);
}

// Check player pool growth
const playerGrowth = lastS.players - firstS.players;
const playerGrowthRate = Math.round((playerGrowth / firstS.players) * 1000) / 10;
if (playerGrowthRate < 5) {
  issues.push("❌ Player pool not growing (< 5%)");
} else if (playerGrowthRate > 50) {
  issues.push("❌ Player pool growing too fast (> 50%)");
} else {
  console.log(`✅ Player pool growth: +${playerGrowthRate}% (healthy growth)`);
}

if (issues.length === 0) {
  console.log(`\n✅ ALL SYSTEMS NOMINAL - PRODUCTION READY`);
  process.exit(0);
} else {
  console.log(`\n❌ ISSUES DETECTED:`);
  for (const issue of issues) {
    console.log(`  ${issue}`);
  }
  process.exit(1);
}
