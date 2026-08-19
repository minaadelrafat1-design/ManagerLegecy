/**
 * Realistic profiling test - with manual state injection
 * Simulates a career with active transfers/negotiations
 */

import { gameReducer } from "./src/state/reducer";
import { buildCareerState } from "./src/state/new-career";
import { STARTER_CLUBS } from "./src/data/starter-clubs";
import type { GameState, TransferListing, NegotiationSession } from "./src/state/types";

// Create a new game state
const starterClub = Object.values(STARTER_CLUBS)[0];
let state = buildCareerState({
  managerName: "Test Manager",
  managerNationality: "england",
  clubId: starterClub.id,
  philosophy: "balanced",
  attributeOverrides: {},
});

// Manually inject transfers and negotiations to simulate realistic state
const players = Object.values(state.players);
if (players.length > 3) {
  // Create some fake transfer listings
  const transfers: TransferListing[] = [];
  for (let i = 0; i < 5; i++) {
    transfers.push({
      id: `transfer-${i}`,
      playerId: players[i].id,
      sellingClubId: players[i].clubId,
      askingPrice: 1000000 + i * 100000,
      minPrice: 800000,
      date: state.time.date,
      status: "available",
      offers: [],
      history: [],
    });
  }

  // Create some fake negotiations
  const negotiations: NegotiationSession[] = [];
  for (let i = 0; i < 3; i++) {
    negotiations.push({
      id: `neg-${i}`,
      type: "transfer" as const,
      playerId: players[i].id,
      buyerClubId: Object.keys(state.clubs)[1],
      sellerClubId: players[i].clubId,
      status: "open" as const,
      startDate: state.time.date,
      lastOffer: {
        amount: 500000 + i * 100000,
        date: state.time.date,
      },
      history: [],
    });
  }

  state = {
    ...state,
    transfers,
    negotiations,
  };
}

console.log("\n" + "=".repeat(100));
console.log("REALISTIC PROFILING - 7 Day Test (with Transfers/Negotiations)");
console.log("=".repeat(100));

console.log(`\nInitial state:`);
console.log(`  Date: ${state.time.date}`);
console.log(`  Clubs: ${Object.keys(state.clubs).length}`);
console.log(`  Players: ${Object.keys(state.players).length}`);
console.log(`  Transfers: ${(state.transfers ?? []).length}`);
console.log(`  Negotiations: ${(state.negotiations ?? []).length}\n`);

const timings = [];

for (let i = 0; i < 7; i++) {
  const startTime = performance.now();
  const beforeDate = state.time.date;

  // Dispatch ADVANCE_DAY action
  state = gameReducer(state, { type: "ADVANCE_DAY", days: 1 });

  const elapsedMs = performance.now() - startTime;
  const afterDate = state.time.date;

  const dayNum = i + 1;
  console.log(
    `Day ${dayNum}: ${beforeDate} → ${afterDate} (${elapsedMs.toFixed(2)}ms) | Transfers: ${(state.transfers ?? []).length} | Negotiations: ${(state.negotiations ?? []).length} | Events: ${(state.events ?? []).length}`,
  );

  timings.push({
    dayNum,
    beforeDate,
    afterDate,
    elapsedMs,
    transferCount: (state.transfers ?? []).length,
    negotiationCount: (state.negotiations ?? []).length,
    eventCount: (state.events ?? []).length,
  });
}

const totalMs = timings.reduce((sum, t) => sum + t.elapsedMs, 0);
const avgMs = totalMs / timings.length;
const maxMs = Math.max(...timings.map((t) => t.elapsedMs));
const minMs = Math.min(...timings.map((t) => t.elapsedMs));

console.log("\n" + "-".repeat(100));
console.log("SUMMARY");
console.log("-".repeat(100));
console.log(`  Total Time: ${totalMs.toFixed(2)}ms`);
console.log(`  Average:    ${avgMs.toFixed(2)}ms per day`);
console.log(`  Max:        ${maxMs.toFixed(2)}ms`);
console.log(`  Min:        ${minMs.toFixed(2)}ms`);
console.log("=".repeat(100) + "\n");

export { timings };
