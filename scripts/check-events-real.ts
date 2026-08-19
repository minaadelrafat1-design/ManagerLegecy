import { buildInitialState } from "../src/state/seed.ts";
import { simulateSeasonQuick } from "../src/state/season.ts";

let state = buildInitialState("0");

console.log(`Initial state:`);
console.log(`  Date: ${state.time.date}`);
console.log(`  Total events: ${state.events?.length ?? 0}`);
console.log(`  Total players: ${Object.keys(state.players).length}`);

console.log(`\n=== SEASON PROGRESSION ===`);
for (let season = 1; season <= 5; season++) {
  console.log(`\nBefore season ${season}:`);
  console.log(`  Date: ${state.time.date}`);

  state = simulateSeasonQuick(state);

  console.log(`After season ${season}:`);
  console.log(`  Date: ${state.time.date}`);
  console.log(`  Total events: ${state.events?.length ?? 0}`);

  // Count all event types
  const eventTypes = new Map();
  for (const event of state.events ?? []) {
    const count = (eventTypes.get(event.type) ?? 0) + 1;
    eventTypes.set(event.type, count);
  }

  console.log(`  Event types:`);
  for (const [type, count] of [...eventTypes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }

  const totalPlayers = Object.keys(state.players).length;
  const retired = Object.values(state.players).filter((p) => p.status === "retired").length;
  console.log(`  Players: ${totalPlayers} (retired: ${retired})`);
}
