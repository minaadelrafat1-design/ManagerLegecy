import { dailyHooks, DAILY_HOOK_ORDER, runDailyTick } from "../src/state/calendar";
import type { GameState } from "../src/state/types";

// Wrap each hook to record invocation order and counts.
const counts: Record<string, number> = {};
const order: string[] = [];

for (const name of DAILY_HOOK_ORDER) {
  const original = dailyHooks[name];
  counts[name] = 0;
  dailyHooks[name] = (state: GameState, time) => {
    counts[name] += 1;
    order.push(name);
    return original(state, time);
  };
}

// Minimal state with calendar `time` to exercise runDailyTick.
const baseState = {
  time: { date: "2026-11-30", day: 1, week: 1, seasonStartDate: "2026-08-01" },
} as unknown as GameState;

const after = runDailyTick(baseState, baseState.time);

let ok = true;
for (const name of DAILY_HOOK_ORDER) {
  if (counts[name] !== 1) {
    console.error(`FAIL: hook '${name}' called ${counts[name]} times (expected 1)`);
    ok = false;
  }
}

// Verify order matches DAILY_HOOK_ORDER
const orderMatches = order.every((n, i) => n === DAILY_HOOK_ORDER[i]);
if (!orderMatches) {
  console.error("FAIL: hook invocation order does not match DAILY_HOOK_ORDER");
  console.error("Expected:", DAILY_HOOK_ORDER.join(","));
  console.error("Actual:", order.join(","));
  ok = false;
}

if (ok) {
  console.log("PASS — daily hooks invoked once and in correct order.");
  process.exit(0);
} else {
  process.exit(1);
}
