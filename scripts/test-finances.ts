import assert from "node:assert/strict";

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
const { applyWeeklyFinanceTick, parseMoney } = await import("../src/state/finance.ts");
const { gameReducer } = await import("../src/state/reducer.ts");

const state = buildInitialState();
const next = applyWeeklyFinanceTick(state, { ...state.time, day: 8, week: 2 });

assert(
  next.finances.balance !== state.finances.balance,
  "weekly finance tick should change the balance",
);
assert(parseMoney(next.finances.transferBudget) >= 0, "transfer budget should remain non-negative");
assert(parseMoney(next.finances.wageBudget) >= 0, "wage budget should remain non-negative");
assert(next.finances.income?.total !== undefined, "finance tick should populate income totals");
assert(next.finances.expenses?.total !== undefined, "finance tick should populate expense totals");

const afterTransfer = gameReducer(state, {
  type: "RECORD_TRANSFER",
  fee: 4_000_000,
  wageWeeklyDelta: 45_000,
  description: "Signed a new midfielder",
});

assert(
  parseMoney(afterTransfer.finances.transferBudget) < parseMoney(state.finances.transferBudget),
  "transfer spending should reduce the transfer budget",
);
assert(
  parseMoney(afterTransfer.finances.wageBudget) < parseMoney(state.finances.wageBudget),
  "wage spending should reduce the wage budget",
);

console.log("Finance engine checks passed.");
