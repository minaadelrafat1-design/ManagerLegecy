import { buildInitialState, preInitializeAiLedgers } from "./src/state/seed";
import { gameReducer } from "./src/state/reducer";
import {
  DAILY_HOOK_ORDER,
  dailyHooks,
  registerDailyHook,
  clearDailyHooks,
} from "./src/state/calendar";
import type { GameState, GameCalendarState } from "./src/state/types";

// Wrap each hook with timing
clearDailyHooks();

// Re-import to register all hooks
await import("./src/state/world-tick");
await import("./src/state/training");
await import("./src/state/ai-evolution");
await import("./src/state/form-updates-hook");
await import("./src/state/events-engine");
await import("./src/state/transfer-requests");
await import("./src/state/board");
await import("./src/state/ai-contracts");
await import("./src/state/ai-transfers");
await import("./src/state/manager-reputation-tracking");
await import("./src/state/media");
await import("./src/state/fans");
await import("./src/state/negotiation-expiry");

let s = preInitializeAiLedgers(buildInitialState());

// Advance to day 106 (Nov 14 - the expensive day)
console.log("Advancing to day 106...");
for (let i = 0; i < 105; i++) {
  s = gameReducer(s, { type: "ADVANCE_DAY", days: 1 });
}

console.log("\n=== Profiling Day 106 (Nov 14) ===");
console.log("Current date:", s.time.date);
console.log("Current day:", s.time.day);

// Now manually advance one day with hook profiling
const t0 = Date.now();
s = gameReducer(s, { type: "ADVANCE_DAY", days: 1 });
const t1 = Date.now();

console.log("\nTotal time:", t1 - t0 + "ms");
console.log("Final date:", s.time.date);
