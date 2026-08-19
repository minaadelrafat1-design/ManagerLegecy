import { buildInitialState } from "../src/state/seed";
import { advanceGameDays } from "../src/state/calendar";
import "../src/state/store";

// Import all modules so hooks register
import "../src/state/ai-contracts";
import "../src/state/ai-evolution";
import "../src/state/ai-transfers";
import "../src/state/training";
import "../src/state/world-tick";

const state = buildInitialState();

console.log("Measuring advance day performance...");

const iterations = 5;
const times: number[] = [];

for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  const result = advanceGameDays(state as any, 1);
  const time = performance.now() - start;
  times.push(time);
  console.log(`Iteration ${i + 1}: ${time.toFixed(2)}ms`);
}

const avg = times.reduce((a, b) => a + b, 0) / times.length;
const max = Math.max(...times);
const min = Math.min(...times);

console.log(`\nResults:`);
console.log(`Average: ${avg.toFixed(2)}ms`);
console.log(`Max: ${max.toFixed(2)}ms`);
console.log(`Min: ${min.toFixed(2)}ms`);
