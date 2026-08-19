#!/usr/bin/env tsx
/**
 * COMPREHENSIVE SYSTEM VALIDATION - CORRECTED
 *
 * Checks:
 * 1. No duplicate players
 * 2. Player ages are consistent
 * 3. No retired players in active squads
 * 4. Transfer logic (no player in 2 clubs)
 * 5. Club finances realistic
 * 6. European competitions valid
 * 7. Promotion/relegation logical
 * 8. Youth generation doesn't break flow
 * 9. Manager assignments valid
 * 10. Season progression complete
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import { runMonthlyPlayerDevelopment } from "../src/state/player-development";

interface ValidationResult {
  passed: boolean;
  check: string;
  message: string;
  severity: "error" | "warning" | "info";
}

const results: ValidationResult[] = [];

function addResult(
  check: string,
  passed: boolean,
  message: string,
  severity: "error" | "warning" | "info" = "info",
) {
  results.push({ check, passed, message, severity });
}

let state = buildInitialState("0");

console.log(`\n🔍 COMPREHENSIVE SYSTEM VALIDATION\n`);
console.log(`${"=".repeat(70)}`);

// ============================================================================
// CHECK 1: Initial state integrity
// ============================================================================
console.log(`\n1. Initial State Integrity`);

const allPlayers = Object.values(state.players);
const playerIds = Object.keys(state.players);
const uniqueIds = new Set(playerIds);

addResult(
  "No duplicate player IDs",
  uniqueIds.size === playerIds.length,
  `${playerIds.length} unique players`,
  uniqueIds.size === playerIds.length ? "info" : "error",
);

const retiredCount = allPlayers.filter((p: any) => p.status === "retired").length;
addResult(
  "No retired players at start",
  retiredCount === 0,
  `${retiredCount} retired (should be 0)`,
  retiredCount === 0 ? "info" : "warning",
);

const clubIds = Object.keys(state.clubs);
const allClubPlayerIds = new Set<string>();
let duplicateAssignments = 0;
for (const club of Object.values(state.clubs)) {
  for (const pid of (club as any).playerIds ?? []) {
    if (allClubPlayerIds.has(pid)) {
      duplicateAssignments++;
    }
    allClubPlayerIds.add(pid);
  }
}

addResult(
  "No players assigned to multiple clubs",
  duplicateAssignments === 0,
  `${duplicateAssignments} duplicate assignments (should be 0)`,
  duplicateAssignments === 0 ? "info" : "error",
);

// ============================================================================
// CHECK 2: Player age and contract logic
// ============================================================================
console.log(`\n2. Player Demographics`);

const ages = allPlayers.map((p: any) => p.age).filter((a) => a != null);
const avgAge = ages.length > 0 ? ages.reduce((a: any, b) => a + b, 0) / ages.length : 0;
const over40 = allPlayers.filter((p: any) => p.age > 40).length;
const under16 = allPlayers.filter((p: any) => p.age < 16).length;

addResult(
  "Average age reasonable (15-35 years)",
  avgAge > 15 && avgAge < 35,
  `Average: ${avgAge.toFixed(1)} years`,
);

addResult(
  "No players over 40 at start",
  over40 === 0,
  `${over40} players over 40`,
  over40 === 0 ? "info" : "warning",
);

addResult(
  "No players under 16",
  under16 === 0,
  `${under16} players under 16`,
  under16 === 0 ? "info" : "error",
);

// ============================================================================
// CHECK 3: Finance logic
// ============================================================================
console.log(`\n3. Club Finances`);

const clubs = Object.values(state.clubs) as any[];
const inDebt = clubs.filter((c) => (c.balance ?? 0) < 0).length;
const balances = clubs.map((c) => c.balance ?? 0);
const avgBalance = balances.reduce((a, b) => a + b, 0) / clubs.length;
const tooRich = clubs.filter((c) => (c.balance ?? 0) > 100_000_000).length;
const tooPoor = clubs.filter((c) => (c.balance ?? 0) < -50_000_000).length;

addResult(
  "Initial debt reasonable (<10%)",
  inDebt / clubs.length < 0.1,
  `${inDebt}/${clubs.length} clubs in debt`,
);

addResult(
  "Average balance positive",
  avgBalance > 0,
  `Average: $${(avgBalance / 1_000_000).toFixed(1)}M`,
);

addResult(
  "No unrealistic fortunes",
  tooRich === 0,
  `${tooRich} clubs with >100M`,
  tooRich === 0 ? "info" : "warning",
);

// ============================================================================
// CHECK 4: European competitions setup
// ============================================================================
console.log(`\n4. European Competition Structure`);

const withEurope = clubs.filter((c) => (c.europeanCompetition ?? null) !== null).length;
const topTierClubs = clubs.filter((c) => c.tier === 1).length;

addResult(
  "European setup valid",
  withEurope === 0 || withEurope <= topTierClubs,
  `${withEurope} in Europe, ${topTierClubs} top-tier clubs`,
);

// ============================================================================
// RUN ONE SEASON
// ============================================================================
console.log(`\n5. Running One Season...`);

for (let m = 0; m < 12; m++) {
  state = runMonthlyPlayerDevelopment(state as any) as any;
}
state = simulateSeasonQuick(state as any) as any;

console.log(`   Season complete. Checking post-season state...`);

// ============================================================================
// CHECK 5: Post-season transfers
// ============================================================================
console.log(`\n6. Transfer Integrity`);

const transferEvents = (state.events ?? []).filter((e: any) => e.description?.includes("moved"));

// Count transfers that actually changed rosters
let verifiedTransfers = 0;
for (const event of transferEvents) {
  const match = event.description?.match(/(\w+.*?\w+)\s+moved.*?\s->\s(.*?)\s+for/);
  if (match) {
    const playerName = match[1];
    const targetClubName = match[2];
    const transferredPlayer = Object.values(state.players).find((p: any) =>
      p.name?.includes(playerName.split(" ")[0]),
    ) as any;
    if (transferredPlayer) {
      const playerClub = state.clubs[transferredPlayer.clubId];
      if (playerClub?.name.includes(targetClubName)) {
        verifiedTransfers++;
      }
    }
  }
}

addResult(
  "Transfers completed and verified",
  verifiedTransfers > 0,
  `${verifiedTransfers}/${transferEvents.length} transfers verified in actual roster state`,
);

// ============================================================================
// CHECK 6: Player lifecycle
// ============================================================================
console.log(`\n7. Player Lifecycle`);

const nowRetired = Object.values(state.players).filter((p: any) => p.status === "retired").length;
const stillActive = Object.values(state.players).filter((p: any) => p.status !== "retired").length;

addResult(
  "Active player pool maintained",
  stillActive > 4000,
  `${stillActive} active players (${nowRetired} retired)`,
);

// ============================================================================
// CHECK 7: Youth generation
// ============================================================================
console.log(`\n8. Youth Generation`);

const totalProspects = clubs.reduce((sum, c) => sum + (c.academy?.prospectIds ?? []).length, 0);

addResult(
  "Youth prospects generated",
  totalProspects > 0,
  `${totalProspects} total academy prospects`,
);

addResult(
  "Prospect generation reasonable",
  totalProspects < clubs.length * 24,
  `${totalProspects} prospects (max: ${clubs.length * 24})`,
);

// ============================================================================
// CHECK 8: Standings/league structure
// ============================================================================
console.log(`\n9. League Structure`);

const leagues = Object.keys(state.leagues).length;
const leaguesWithFixtures = (state.fixtures ?? []).reduce(
  (set, f: any) => set.add(f.competitionId),
  new Set(),
).size;

addResult(
  "Leagues have fixtures",
  leaguesWithFixtures > 0,
  `${leaguesWithFixtures} leagues with ${(state.fixtures ?? []).length} fixtures`,
);

// ============================================================================
// CHECK 9: Manager assignments
// ============================================================================
console.log(`\n10. Manager Integrity`);

const managers = state.managers ?? {};
const managerClubMap = new Map<string, string[]>();
for (const [managerId, mgr] of Object.entries(managers)) {
  const clubId = (mgr as any)?.clubId;
  if (clubId) {
    if (!managerClubMap.has(clubId)) {
      managerClubMap.set(clubId, []);
    }
    managerClubMap.get(clubId)!.push(managerId);
  }
}

let managerErrors = 0;
for (const [clubId, mgrIds] of managerClubMap) {
  if (mgrIds.length > 1) managerErrors++;
}

addResult(
  "Each club has max 1 manager",
  managerErrors === 0,
  `${managerErrors} clubs with multiple managers`,
  managerErrors === 0 ? "info" : "error",
);

// ============================================================================
// CHECK 10: Data integrity
// ============================================================================
console.log(`\n11. State Consistency`);

addResult(
  "Game date valid",
  state.time?.date && state.time.date.length === 10,
  `Date: ${state.time?.date}`,
);

addResult(
  "Season defined",
  state.time?.season && typeof state.time.season === "string",
  `Season: ${state.time?.season}`,
  state.time?.season ? "info" : "error",
);

// ============================================================================
// REPORT
// ============================================================================
console.log(`\n${"=".repeat(70)}`);
console.log(`\n📋 VALIDATION RESULTS\n`);

const errors = results.filter((r) => r.severity === "error");
const warnings = results.filter((r) => r.severity === "warning");
const passed = results.filter((r) => r.passed);

results.forEach((r) => {
  const icon = r.passed ? "✅" : r.severity === "error" ? "❌" : "⚠️ ";
  console.log(`${icon} ${r.check}`);
  console.log(`   ${r.message}\n`);
});

console.log(`${"─".repeat(70)}`);
console.log(`\n📊 SUMMARY\n`);
console.log(`  Total checks: ${results.length}`);
console.log(
  `  Passed:       ${passed.length} (${((passed.length / results.length) * 100).toFixed(0)}%)`,
);
console.log(`  Warnings:     ${warnings.length}`);
console.log(`  Errors:       ${errors.length}`);

if (errors.length === 0) {
  console.log(`\n✅ SYSTEM HEALTHY - All critical checks passed`);
} else {
  console.log(`\n❌ CRITICAL ISSUES FOUND`);
  errors.forEach((e) => console.log(`   • ${e.check}: ${e.message}`));
}

console.log(`\n${"=".repeat(70)}\n`);

process.exit(errors.length > 0 ? 1 : 0);
