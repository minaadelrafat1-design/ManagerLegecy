import { buildInitialState } from "../src/state/seed";
import {
  advanceGameDays,
  getRegisteredDailyHookCount,
  DAILY_HOOK_ORDER,
} from "../src/state/calendar";
import "../src/state/store";

// Import all modules so hooks register
import "../src/state/ai-contracts";
import "../src/state/ai-evolution";
import "../src/state/ai-transfers";
import "../src/state/training";
import "../src/state/world-tick";

console.log("Registered daily hooks:");
for (const hookName of DAILY_HOOK_ORDER) {
  const count = getRegisteredDailyHookCount(hookName);
  console.log(`  ${hookName}: ${count} hooks`);
}

const state = buildInitialState();

console.log("\nMeasuring first advance day...");
const start = performance.now();
const result = advanceGameDays(state as any, 1);
const time = performance.now() - start;
console.log(`Total time: ${time.toFixed(2)}ms`);
