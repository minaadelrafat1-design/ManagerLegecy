import { buildInitialState } from "../src/state/seed.ts";

// Manually simulate just season 8 startup to trace the transfers
let state = buildInitialState("0");

// Fast-forward to season 8
for (let s = 1; s <= 7; s++) {
  const { simulateSeasonQuick } = await import("../src/state/season.ts");
  state = simulateSeasonQuick(state);
}

// Now run ONE step of season 8 and trace
const { runEnhancedTransferWindow } = await import("../src/state/transfers-enhanced.ts");

console.log(`\n=== BEFORE Transfer Window (Season 8) ===`);
const haugenId = "haugen";
const haugenBefore = state.players[haugenId];
console.log(`Player.clubId: ${haugenBefore?.clubId}`);
console.log(
  `In rosters: ${Object.entries(state.clubs)
    .filter(([, c]) => c.playerIds?.includes(haugenId))
    .map(([, c]) => c.name)
    .join(", ")}`,
);

state = runEnhancedTransferWindow(state);

console.log(`\n=== AFTER Transfer Window (Season 8) ===`);
const haugenAfter = state.players[haugenId];
console.log(`Player.clubId: ${haugenAfter?.clubId}`);
console.log(
  `In rosters: ${Object.entries(state.clubs)
    .filter(([, c]) => c.playerIds?.includes(haugenId))
    .map(([, c]) => c.name)
    .join(", ")}`,
);

// Check events
const transferEvents = (state.events ?? []).filter(
  (e) => e.date === state.time.date && (e.meta as any)?.playerId === haugenId,
);
console.log(`\nTransfer events for this player on this date: ${transferEvents.length}`);
for (const e of transferEvents) {
  const meta = e.meta as any;
  console.log(`  ${e.type}: from ${meta.fromClubId} to ${meta.toClubId}`);
}
