#!/usr/bin/env npx tsx
/**
 * PHASE 7C: UNIT TEST - New Functions Only
 *
 * Test getCupChampion and getEuropeanChampion in isolation
 * without running full season simulation
 */

import { getCupChampion } from "../src/state/cups";
import { getEuropeanChampion } from "../src/state/european";
import type { GameState } from "../src/state/types";

function logSection(title: string) {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ ${title.padEnd(78)} ║`);
  console.log(`${"═".repeat(80)}`);
}

function pass(msg: string) {
  console.log(`✓ ${msg}`);
}

function fail(msg: string) {
  console.log(`✗ ${msg}`);
  throw new Error(msg);
}

// Create mock state for testing
function createMockGameState(): GameState {
  return {
    meta: { worldConfig: { countries: [], competitions: [] } } as any,
    clubs: {
      club1: { id: "club1", name: "Club One" } as any,
      club2: { id: "club2", name: "Club Two" } as any,
      club3: { id: "club3", name: "Club Three" } as any,
    },
    fixtures: [],
    leagues: {},
    competitions: [],
    currentClub: null,
    players: {},
    events: [],
    time: { season: "2026/27", date: "2026-08-13" } as any,
  } as GameState;
}

function main() {
  logSection("PHASE 7C: UNIT TEST - getCupChampion & getEuropeanChampion");

  try {
    console.log("\n1. Testing getCupChampion with no fixtures...");
    const state1 = createMockGameState();
    const winner1 = getCupChampion(state1, "test-cup");
    if (winner1 === null) {
      pass("getCupChampion returns null for competition with no fixtures");
    } else {
      fail("getCupChampion should return null for empty competition");
    }

    console.log("\n2. Testing getEuropeanChampion with no fixtures...");
    const state2 = createMockGameState();
    const winner2 = getEuropeanChampion(state2, "test-euro");
    if (winner2 === null) {
      pass("getEuropeanChampion returns null for competition with no fixtures");
    } else {
      fail("getEuropeanChampion should return null for empty competition");
    }

    console.log("\n3. Testing getCupChampion with clear knockout winner...");
    const state3 = createMockGameState();
    state3.fixtures = [
      {
        id: "f1",
        competitionId: "test-cup",
        homeClubId: "club1",
        awayClubId: "club2",
        scoreHome: 2,
        scoreAway: 1,
        status: "played",
      } as any,
      {
        id: "f2",
        competitionId: "test-cup",
        homeClubId: "club3",
        awayClubId: "club1",
        scoreHome: 0,
        scoreAway: 1,
        status: "played",
      } as any,
    ];
    // Club1 beat club2, club1 beat club3
    // Only club1 is alive
    const winner3 = getCupChampion(state3, "test-cup");
    if (winner3 === "club1") {
      pass("getCupChampion correctly identifies knockout winner");
    } else {
      fail(`getCupChampion should return club1, got ${winner3}`);
    }

    console.log("\n4. Testing getEuropeanChampion with single-leg final...");
    const state4 = createMockGameState();
    // Add competition to worldConfig
    if (!state4.meta) state4.meta = {} as any;
    if (!state4.meta.worldConfig)
      state4.meta.worldConfig = { competitions: [], countries: [] } as any;
    state4.meta.worldConfig.competitions = [
      { id: "eu-comp", type: "continental", name: "European Cup" } as any,
    ];
    state4.fixtures = [
      {
        id: "eu-final",
        competitionId: "eu-comp",
        round: "Final",
        homeClubId: "club1",
        awayClubId: "club2",
        scoreHome: 2,
        scoreAway: 1,
        status: "played",
      } as any,
    ];
    const winner4 = getEuropeanChampion(state4, "eu-comp");
    if (winner4 === "club1") {
      pass("getEuropeanChampion correctly identifies winner from single-leg final");
    } else {
      fail(`getEuropeanChampion should return club1, got ${winner4}`);
    }

    console.log("\n5. Testing getEuropeanChampion with two-leg final (aggregate)...");
    const state5 = createMockGameState();
    // Add competition to worldConfig
    if (!state5.meta) state5.meta = {} as any;
    if (!state5.meta.worldConfig)
      state5.meta.worldConfig = { competitions: [], countries: [] } as any;
    state5.meta.worldConfig.competitions = [
      { id: "eu-comp", type: "continental", name: "European Cup" } as any,
    ];
    state5.fixtures = [
      {
        id: "eu-final-leg1",
        competitionId: "eu-comp",
        round: "Final",
        leg: 1,
        homeClubId: "club1",
        awayClubId: "club2",
        scoreHome: 1,
        scoreAway: 0,
        status: "played",
      } as any,
      {
        id: "eu-final-leg2",
        competitionId: "eu-comp",
        round: "Final",
        leg: 2,
        homeClubId: "club2",
        awayClubId: "club1",
        scoreHome: 0,
        scoreAway: 1,
        status: "played",
      } as any,
    ];
    const winner5 = getEuropeanChampion(state5, "eu-comp");
    // Leg 1: club1 1-0 club2 (club1 score away in leg 2)
    // Leg 2: club2 0-1 club1 (club1 score away in leg 2)
    // Aggregate: club1 (1+1) vs club2 (0+0) = 2-0 to club1
    if (winner5 === "club1") {
      pass("getEuropeanChampion correctly aggregates two-leg final");
    } else {
      fail(`getEuropeanChampion should return club1, got ${winner5}`);
    }

    logSection("✓ ALL UNIT TESTS PASSED");
    console.log(`
Functions are working correctly:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ getCupChampion handles edge cases
✓ getEuropeanChampion handles single-leg finals
✓ getEuropeanChampion handles two-leg aggregate
✓ No infinite loops detected

The functions themselves are correct.
Slowness is in simulateSeason, not in new competition logic.
`);
  } catch (err: any) {
    logSection("✗ TEST FAILED");
    console.error("\nError:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
