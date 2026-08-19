/* Small smoke test for D2.2 AI transfers: advance through several days
 * including a winter transfer window and assert AI clubs performed some
 * transfer-related actions (promotions/listings/transfers). Run with
 * `npx tsx scripts/test-ai-transfers.ts`. */

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: new MemoryStorage(),
};

const { buildInitialState } = await import("../src/state/seed.ts");
const { advanceGameDays } = await import("../src/state/calendar.ts");

// Import the AI transfers module so it registers its daily hook
await import("../src/state/ai-transfers.ts");

let state = buildInitialState();
const initialEvents = state.events.length;
const initialTransfers = state.transfers.length;

// Advance 40 days (crosses into winter window from seed date 2026-11-30)
for (let i = 0; i < 40; i++) {
  state = advanceGameDays(state, 1);
}

const afterEvents = state.events.length;
const afterTransfers = state.transfers.length;
const negotiationCount = state.negotiations?.length ?? 0;
const transferEvents = state.events.filter((event) => event.type === "transfer").length;

console.log(`events: ${initialEvents} -> ${afterEvents}`);
console.log(`transfer events: ${transferEvents}`);
console.log(`transfer listings: ${initialTransfers} -> ${afterTransfers}`);
console.log(`negotiations created: ${negotiationCount}`);

if (transferEvents > 0 || afterTransfers !== initialTransfers || negotiationCount > 0) {
  console.log("PASS — AI transfer market activity observed in winter window");
  process.exit(0);
}

console.error("FAIL — no AI transfer activity observed");
process.exit(2);
