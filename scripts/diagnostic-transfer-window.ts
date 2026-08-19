#!/usr/bin/env npx tsx
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");

console.log(`\n=== TRANSFER WINDOW DIAGNOSTIC ===`);
for (let season = 1; season <= 3; season++) {
  const before = {
    transferEvents: (state.events ?? []).filter((e) => e.type === "TRANSFER_COMPLETED").length,
    negotiations: state.negotiations?.length ?? 0,
    acceptedNegotiations: (state.negotiations ?? []).filter((n) => n.status === "accepted").length,
  };

  state = simulateSeasonQuick(state);

  const after = {
    transferEvents: (state.events ?? []).filter((e) => e.type === "TRANSFER_COMPLETED").length,
    negotiations: state.negotiations?.length ?? 0,
    acceptedNegotiations: (state.negotiations ?? []).filter((n) => n.status === "accepted").length,
  };

  console.log(`\nSeason ${season}:`);
  console.log(
    `  Transfer Events: ${before.transferEvents} -> ${after.transferEvents} (new: ${after.transferEvents - before.transferEvents})`,
  );
  console.log(`  Negotiations: ${before.negotiations} -> ${after.negotiations}`);
  console.log(`  Accepted: ${before.acceptedNegotiations} -> ${after.acceptedNegotiations}`);

  // Check for duplicate players
  const dupes: Record<string, number> = {};
  for (const [clubId, club] of Object.entries(state.clubs)) {
    for (const playerId of club.playerIds) {
      dupes[playerId] = (dupes[playerId] ?? 0) + 1;
    }
  }
  const dupCount = Object.values(dupes).filter((c) => c > 1).length;
  console.log(`  Duplicate players: ${dupCount}`);

  // Show some negotiation details
  if ((state.negotiations?.length ?? 0) > 0) {
    const recent = state.negotiations!.slice(-2);
    for (const n of recent) {
      const player = state.players[n.playerId];
      console.log(
        `    ${n.type}[${n.status}] ${player?.name} (${n.playerId}): ${n.sellerClubId} -> ${n.buyerClubId}`,
      );
    }
  }
}
