import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");
state = simulateSeasonQuick(state);

const transfers = state.events.filter((e: any) => e.type === "transfer");
console.log("Transfer events:");
for (const t of transfers.slice(0, 15)) {
  console.log(`  ${t.description}`);
}
console.log(`Total: ${transfers.length}`);

const moved = transfers.filter((e: any) => e.description?.includes("moved"));
console.log(`\nWith 'moved': ${moved.length}`);
for (const t of moved.slice(0, 5)) {
  console.log(`  ${t.description}`);
}

const noMove = transfers.filter((e: any) => !e.description?.includes("moved"));
console.log(`\nWithout 'moved': ${noMove.length}`);
for (const t of noMove.slice(0, 5)) {
  console.log(`  ${t.description}`);
}
