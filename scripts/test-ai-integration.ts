import { buildInitialState } from "../src/state/seed";
import { runWorldTick } from "../src/state/world-tick";

let state = buildInitialState();

// Ensure AI ledgers are empty before tick
const preLedgers = state.meta?.aiLedgers ? Object.keys(state.meta.aiLedgers).length : 0;

state = runWorldTick(state, 1);

const postLedgers = state.meta?.aiLedgers ? Object.keys(state.meta.aiLedgers).length : 0;

if (postLedgers >= preLedgers) {
  console.log(`PASS — AI actions executed, aiLedgers count ${postLedgers}`);
  process.exit(0);
} else {
  console.error(`FAIL — AI ledgers did not increase as expected (${preLedgers} -> ${postLedgers})`);
  process.exit(1);
}
