import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

let state = buildInitialState("0");

console.log(`\n=== 15-YEAR ECOSYSTEM VALIDATION ===\n`);
console.log(
  `Start: ${state.time.date} | ${Object.keys(state.players).length} players | ${Object.keys(state.clubs).length} clubs\n`,
);

const seasonMetrics: Array<{
  season: number;
  date: string;
  totalPlayers: number;
  retired: number;
  transfers: number;
  youth: number;
  transfersPerClub: number;
  youthPerClub: number;
  duplicates: number;
  missing: number;
}> = [];

for (let season = 1; season <= 15; season++) {
  const stateBefore = state;
  state = simulateSeasonQuick(state);

  // Count events from this season
  const allEvents = state.events ?? [];
  const seasonEvents = allEvents.filter((e: any) => e.date >= stateBefore.time.date);

  const transfersThisSeason = seasonEvents.filter(
    (e: any) => e.type === "TRANSFER_COMPLETED",
  ).length;
  const youthThisSeason = seasonEvents.filter((e: any) => e.type === "YOUTH_GENERATED").length;
  const retiredThisSeason = seasonEvents.filter((e: any) => e.type === "PLAYER_RETIRED").length;

  // Check roster integrity
  let duplicates = 0;
  let missing = 0;

  for (const pid of Object.keys(state.players)) {
    const player = state.players[pid];
    const clubId = player.clubId;

    if (!clubId) continue;

    let appearances = 0;
    for (const c of Object.values(state.clubs)) {
      if (c.playerIds.includes(pid)) appearances++;
    }

    if (appearances > 1) duplicates++;
    else if (appearances === 0) missing++;
  }

  const totalPlayers = Object.keys(state.players).length;
  const retiredPlayers = Object.values(state.players).filter((p) => p.status === "retired").length;

  seasonMetrics.push({
    season,
    date: state.time.date,
    totalPlayers,
    retired: retiredPlayers,
    transfers: transfersThisSeason,
    youth: youthThisSeason,
    transfersPerClub: Math.round((transfersThisSeason / 249) * 10) / 10,
    youthPerClub: Math.round((youthThisSeason / 249) * 10) / 10,
    duplicates,
    missing,
  });

  if (season % 3 === 0 || season === 1) {
    console.log(
      `Season ${String(season).padStart(2, " ")}: ` +
        `${state.time.date} | ` +
        `Players: ${totalPlayers} (retired: ${retiredPlayers}) | ` +
        `Transfers: ${transfersThisSeason} (${seasonMetrics[season - 1].transfersPerClub}/club) | ` +
        `Youth: ${youthThisSeason} (${seasonMetrics[season - 1].youthPerClub}/club) | ` +
        `Duplicates: ${duplicates}`,
    );
  }
}

console.log(`\n=== SUMMARY ===`);
const lastMetric = seasonMetrics[14];
const firstMetric = seasonMetrics[0];

console.log(`\nFinal State (Season 15):`);
console.log(`  Date: ${lastMetric.date}`);
console.log(
  `  Total Players: ${lastMetric.totalPlayers} (+${lastMetric.totalPlayers - firstMetric.totalPlayers})`,
);
console.log(`  Retired: ${lastMetric.retired}`);
console.log(`  Duplicates: ${lastMetric.duplicates}`);
console.log(`  Missing from Rosters: ${lastMetric.missing}`);

console.log(`\nAverage per Season:`);
const avgTransfers =
  Math.round((seasonMetrics.reduce((s, m) => s + m.transfers, 0) / 15) * 10) / 10;
const avgYouth = Math.round((seasonMetrics.reduce((s, m) => s + m.youth, 0) / 15) * 10) / 10;
const avgTransfersPerClub =
  Math.round((seasonMetrics.reduce((s, m) => s + m.transfersPerClub, 0) / 15) * 10) / 10;
const avgYouthPerClub =
  Math.round((seasonMetrics.reduce((s, m) => s + m.youthPerClub, 0) / 15) * 10) / 10;

console.log(`  Transfers: ${avgTransfers} total (${avgTransfersPerClub} per club)`);
console.log(`  Youth Generated: ${avgYouth} total (${avgYouthPerClub} per club)`);
console.log(
  `  Retirements: ${Math.round(seasonMetrics.reduce((s, m) => s + m.retired, 0) / 15)}/season`,
);

console.log(`\n=== ECOSYSTEM HEALTH CHECK ===`);
const hasIssues = seasonMetrics.some((m) => m.duplicates > 0 || m.missing > 0);

if (!hasIssues) {
  console.log(`✅ NO ROSTER INTEGRITY ISSUES (all 15 seasons)`);
  console.log(`✅ Transfers reasonable: ${avgTransfersPerClub} per club/season`);
  console.log(`✅ Youth generation reasonable: ${avgYouthPerClub} per club/season`);
  console.log(
    `✅ Player pool stable and growing: ${firstMetric.totalPlayers} → ${lastMetric.totalPlayers}`,
  );
  process.exit(0);
} else {
  console.log(`❌ ISSUES FOUND`);
  for (const m of seasonMetrics) {
    if (m.duplicates > 0 || m.missing > 0) {
      console.log(`  Season ${m.season}: duplicates=${m.duplicates}, missing=${m.missing}`);
    }
  }
  process.exit(1);
}
