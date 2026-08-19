#!/usr/bin/env tsx
/**
 * FAST DIAGNOSTIC: Why are transfers 0?
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import { runMonthlyPlayerDevelopment } from "../src/state/player-development";

let state = buildInitialState("0");

console.log(`🔍 TRANSFER SYSTEM DIAGNOSTIC\n`);

// Check initial state
console.log(`Initial state transfers:`, {
  total: (state.transfers ?? []).length,
  completed: (state.transfers ?? []).filter((t: any) => t.status === "completed").length,
  proposed: (state.transfers ?? []).filter((t: any) => t.status === "proposed").length,
  negotiating: (state.transfers ?? []).filter((t: any) => t.status === "negotiating").length,
});

// Run 1 season
console.log(`\nRunning 1 season...`);
for (let m = 0; m < 12; m++) {
  state = runMonthlyPlayerDevelopment(state as any) as any;
}
state = simulateSeasonQuick(state as any) as any;

console.log(`\nAfter season 1:`);
console.log(`Total transfers:`, {
  total: (state.transfers ?? []).length,
  completed: (state.transfers ?? []).filter((t: any) => t.status === "completed").length,
  proposed: (state.transfers ?? []).filter((t: any) => t.status === "proposed").length,
  negotiating: (state.transfers ?? []).filter((t: any) => t.status === "negotiating").length,
});

// Check transfer window dates
const transfersArray = state.transfers ?? [];
if (transfersArray.length > 0) {
  console.log(`\nFirst 5 transfers:`);
  transfersArray.slice(0, 5).forEach((t: any, i: number) => {
    console.log(`  ${i + 1}. ${t.playerName} ${t.status} | Proposed: ${t.dateProposed}`);
  });
}

// Check if transfer window system exists
console.log(`\nGame date:`, state.gameDate);
console.log(`Current season:`, state.currentSeason);
console.log(`Transfer window open?`, (state as any).transferWindowOpen);

// Check AI decisions system
const aiDecisions = (state as any).aiDecisions ?? {};
console.log(`\nAI decisions count:`, Object.keys(aiDecisions).length);

// Check club finances to see if they can afford transfers
const clubs = Object.values(state.clubs) as any[];
console.log(`\nClub finances (top 3):`);
clubs.slice(0, 3).forEach((c: any) => {
  console.log(`  ${c.name}: $${c.balance} balance, ${c.playerIds.length} squad`);
});

process.exit(0);
