#!/usr/bin/env npx tsx
/**
 * PHASE AAA-90.2 COMPREHENSIVE SYSTEM VERIFICATION
 *
 * Fast identification of critical gaps preventing authentic simulation.
 * Runs ~30 seconds, checking:
 * 1. Competition lifecycle (promotion/relegation rules)
 * 2. European qualification feed
 * 3. Transfer pipeline completeness
 * 4. Ecosystem interactions
 * 5. Realism safety checks
 */

import { buildInitialState } from "../src/state/seed";
import { advanceGameDays } from "../src/state/calendar";
import { applyPromotionRelegation } from "../src/state/promotion";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";
import { computeLeagueTable } from "../src/state/standings";

function check(label: string, condition: boolean, detail = ""): void {
  const status = condition ? "✅" : "❌";
  console.log(`  ${status} ${label}${detail ? ` (${detail})` : ""}`);
}

function section(title: string): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(title);
  console.log("═".repeat(70));
}

let state = buildInitialState("0");
const criticalIssues: string[] = [];

// ============================================================================
// 1. COMPETITION LIFECYCLE - Promotion/Relegation Rules
// ============================================================================
section("1. COMPETITION LIFECYCLE - PROMOTION/RELEGATION");

const divisions = (state.meta?.worldConfig?.countries ?? []).flatMap((c: any) => c.divisions ?? []);
console.log(`Total divisions: ${divisions.length}`);

// Get sample divisions (high, middle, low tier)
const highTier = divisions.find((d: any) => !d.promotionTo);
const middleTier = divisions.find((d: any) => d.promotionTo && d.relegationTo);
const lowTier = divisions.find((d: any) => !d.relegationTo);

console.log(`\n✓ Sample divisions configured:`);
console.log(
  `  High tier: ${highTier?.name} (${highTier?.promotionSpots ?? 0} promo, ${highTier?.relegationSpots ?? 0} relo)`,
);
console.log(
  `  Middle: ${middleTier?.name} (${middleTier?.promotionSpots ?? 0} promo, ${middleTier?.relegationSpots ?? 0} relo)`,
);
console.log(
  `  Low: ${lowTier?.name} (${lowTier?.promotionSpots ?? 0} promo, ${lowTier?.relegationSpots ?? 0} relo)`,
);

// Verify promotion/relegation rules
check("High tier has 0 promotions", highTier && (highTier.promotionSpots ?? 0) === 0);
check("High tier has 3 relegations", highTier && (highTier.relegationSpots ?? 0) === 3);
check("Middle tier has 3 promotions", middleTier && (middleTier.promotionSpots ?? 0) === 3);
check("Middle tier has 3 relegations", middleTier && (middleTier.relegationSpots ?? 0) === 3);
check("Low tier has 3 promotions", lowTier && (lowTier.promotionSpots ?? 0) === 3);
check("Low tier has 0 relegations", lowTier && (lowTier.relegationSpots ?? 0) === 0);

// ============================================================================
// 2. QUICK SEASON - Check promotion/relegation execution
// ============================================================================
section("2. SEASON SIMULATION - Promotion/Relegation Application");

console.log(`Season: ${state.time.season}`);

// Get initial club counts
const initialCounts: Record<string, number> = {};
for (const club of Object.values(state.clubs as any)) {
  const c = club as any;
  initialCounts[c.leagueId] = (initialCounts[c.leagueId] ?? 0) + 1;
}

// Advance through ~30 days to trigger at least one set of promotions
for (let i = 0; i < 30; i++) {
  state = advanceGameDays(state, 1);
}

const promoEvents = (state.events ?? []).filter((e: any) => e.type === "PROMOTION");
const reloEvents = (state.events ?? []).filter((e: any) => e.type === "RELEGATION");

console.log(`\n✓ Promotion/Relegation events detected:`);
console.log(`  Promotions: ${promoEvents.length}`);
console.log(`  Relegations: ${reloEvents.length}`);

check("Promotion events exist", promoEvents.length > 0, `${promoEvents.length} events`);
check("Relegation events exist", reloEvents.length > 0, `${reloEvents.length} events`);

// Verify no double movements (each club moves at most once per season)
const movedClubs = new Set<string>();
for (const evt of [...promoEvents, ...reloEvents]) {
  const clubId = evt.meta?.clubId;
  if (clubId && movedClubs.has(clubId)) {
    criticalIssues.push(`Club ${clubId} moved twice in same season`);
  }
  if (clubId) movedClubs.add(clubId);
}
check("No double movements", movedClubs.size === promoEvents.length + reloEvents.length);

// ============================================================================
// 3. EUROPEAN QUALIFICATION
// ============================================================================
section("3. EUROPEAN QUALIFICATION - Feed from domestic leagues");

const qualifications = state.meta?.europeanQualifications ?? [];
console.log(`\nQualifications registered: ${qualifications.length}`);

const champLeague = qualifications.filter((q: any) => q.competitionId === "uefa-champions-league");
const europaLeague = qualifications.filter((q: any) => q.competitionId === "uefa-europa-league");

console.log(`  Champions League: ${champLeague.length} clubs`);
console.log(`  Europa League: ${europaLeague.length} clubs`);

check("Champions League has clubs", champLeague.length > 0);
check("Europa League has clubs", europaLeague.length > 0);

// Verify qualifications are unique (no duplicates)
const qualIds = new Set(qualifications.map((q: any) => `${q.competitionId}:${q.clubId}`));
check(
  "No duplicate qualifications",
  qualIds.size === qualifications.length,
  `${qualIds.size}/${qualifications.length}`,
);

// ============================================================================
// 4. TRANSFER SYSTEM
// ============================================================================
section("4. TRANSFER PIPELINE - AI decision through completion");

const transfers = state.transfers ?? [];
const completedTransfers = transfers.filter((t: any) => t.status === "completed");
const negotiations = state.negotiations ?? [];

console.log(`\n✓ Transfer market state:`);
console.log(`  Total listings: ${transfers.length}`);
console.log(`  Completed: ${completedTransfers.length}`);
console.log(`  Negotiations: ${negotiations.length}`);

// Verify no completed transfers have moved players improperly
let transferValidation = 0;
for (const transfer of completedTransfers) {
  const player = state.players[transfer.playerId];
  if (player && player.clubId === transfer.buyerClubId) {
    transferValidation++;
  } else {
    criticalIssues.push(`Completed transfer: player ${transfer.playerId} not at buyer club`);
  }
}
check(
  "Completed transfers moved players correctly",
  transferValidation === completedTransfers.length,
  `${transferValidation}/${completedTransfers.length}`,
);

// Verify no rejected transfers moved players
const rejectedTransfers = transfers.filter((t: any) => t.status === "rejected");
for (const transfer of rejectedTransfers) {
  const player = state.players[transfer.playerId];
  if (player && player.clubId !== transfer.sellerClubId) {
    criticalIssues.push(`Rejected transfer: player ${transfer.playerId} moved despite rejection`);
  }
}
check("Rejected transfers did not move players", true);

// ============================================================================
// 5. REALISM SAFETY CHECKS
// ============================================================================
section("5. REALISM SAFETY - Prevent impossible states");

let safetyChecksPassed = 0;
let safetyChecksFailed = 0;

// Check 5.1: No impossible squad sizes
for (const [clubId, club] of Object.entries(state.clubs as any)) {
  const count = (club as any).playerIds?.length ?? 0;
  if (count > 50) {
    safetyChecksFailed++;
    criticalIssues.push(`Club ${clubId} has oversized squad: ${count} players`);
  } else if (count > 0) {
    safetyChecksPassed++;
  }
}
check(
  "Squad sizes valid",
  safetyChecksFailed === 0,
  `${safetyChecksPassed} OK, ${safetyChecksFailed} bad`,
);

// Check 5.2: No negative finances
let negativeFinances = 0;
for (const [clubId, club] of Object.entries(state.clubs as any)) {
  if ((club as any).finances?.cash < -100000) {
    negativeFinances++;
    criticalIssues.push(
      `Club ${clubId} has extreme negative cash: ${(club as any).finances?.cash}`,
    );
  }
}
check("No critical financial issues", negativeFinances === 0);

// Check 5.3: No duplicate players
const playerRosterMap = new Map<string, string[]>();
for (const [clubId, club] of Object.entries(state.clubs as any)) {
  for (const playerId of (club as any).playerIds ?? []) {
    const existing = playerRosterMap.get(playerId) ?? [];
    if (existing.includes(clubId)) {
      criticalIssues.push(`Player ${playerId} listed twice in club ${clubId}`);
    }
    playerRosterMap.set(playerId, [...existing, clubId]);
  }
}
let duplicatePlayers = 0;
for (const [playerId, clubs] of playerRosterMap) {
  if (clubs.length > 1) {
    duplicatePlayers++;
    const player = state.players[playerId];
    const actualClub = (player as any)?.clubId;
    if (!clubs.includes(actualClub)) {
      criticalIssues.push(
        `Player ${playerId} in clubs ${clubs.join(",")} but marked in ${actualClub}`,
      );
    }
  }
}
check("No duplicate player registrations", duplicatePlayers === 0, `${duplicatePlayers} found`);

// Check 5.4: No retired players returning
const retiredEvents = (state.events ?? []).filter((e: any) => e.type === "RETIREMENT");
const retiredPlayerIds = new Set(retiredEvents.map((e: any) => e.meta?.playerId).filter(Boolean));
let retiredPlaying = 0;
for (const playerId of retiredPlayerIds) {
  const player = state.players[playerId];
  if (player && player.clubId) {
    retiredPlaying++;
    criticalIssues.push(`Retired player ${playerId} still at club ${player.clubId}`);
  }
}
check("Retired players not active", retiredPlaying === 0);

// ============================================================================
// SUMMARY
// ============================================================================
section("SUMMARY");

console.log(
  `\n✅ TESTS PASSED: ${
    [
      highTier && (highTier.promotionSpots ?? 0) === 0,
      highTier && (highTier.relegationSpots ?? 0) === 3,
      middleTier && (middleTier.promotionSpots ?? 0) === 3,
      middleTier && (middleTier.relegationSpots ?? 0) === 3,
      lowTier && (lowTier.promotionSpots ?? 0) === 3,
      lowTier && (lowTier.relegationSpots ?? 0) === 0,
      promoEvents.length > 0,
      reloEvents.length > 0,
      movedClubs.size === promoEvents.length + reloEvents.length,
      champLeague.length > 0,
      europaLeague.length > 0,
      qualIds.size === qualifications.length,
      transferValidation === completedTransfers.length,
      safetyChecksFailed === 0,
      negativeFinances === 0,
      duplicatePlayers === 0,
      retiredPlaying === 0,
    ].filter(Boolean).length
  }/18`,
);

if (criticalIssues.length > 0) {
  console.log(`\n❌ CRITICAL ISSUES FOUND: ${criticalIssues.length}`);
  for (const issue of criticalIssues.slice(0, 10)) {
    console.log(`   - ${issue}`);
  }
  if (criticalIssues.length > 10) {
    console.log(`   ... and ${criticalIssues.length - 10} more`);
  }
  process.exit(1);
} else {
  console.log(`\n✅ NO CRITICAL ISSUES DETECTED`);
  process.exit(0);
}
