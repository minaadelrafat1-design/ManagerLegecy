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
const { gameReducer } = await import("../src/state/reducer.ts");
const { getFacilityLevel, getFacilityRating, getFacilityUpgradeCost } =
  await import("../src/state/facilities.ts");

const state = buildInitialState();
const beforeBalance = Number(state.finances.balance.replace(/[^0-9.-]/g, ""));
const beforeLevel = getFacilityLevel(state.currentClub, "training");

const upgraded = gameReducer(state, { type: "UPGRADE_FACILITY", facility: "training" });

assert(upgraded !== state, "upgrade should produce a new game state");
assert(
  getFacilityLevel(upgraded.currentClub, "training") === beforeLevel + 1,
  "facility level should increase by one",
);
assert(
  getFacilityRating(upgraded.currentClub, "training") >
    getFacilityRating(state.currentClub, "training"),
  "facility rating should improve",
);
assert(
  Number(upgraded.finances.balance.replace(/[^0-9.-]/g, "")) < beforeBalance,
  "upgrade should spend money",
);
assert(getFacilityUpgradeCost(beforeLevel) > 0, "upgrade cost should be positive");

console.log("Facility upgrade checks passed.");
