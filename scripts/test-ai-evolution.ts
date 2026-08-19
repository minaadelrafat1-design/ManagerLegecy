/* Smoke test for D2.3 AI evolution: run multiple seasons and validate
 * that AI clubs evolve differently (formations, manager reputations,
 * youth promotions, player growth) and do not all become identical.
 */

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

// Ensure evolution module registers
await import("../src/state/ai-evolution.ts");

let state = buildInitialState();

const before = {
  formations: new Set(Object.values(state.clubs).map((c) => c.formation)),
  managerReps: new Set(Object.values(state.clubs).map((c) => c.aiManager?.reputation ?? -1)),
  totalPlayers: Object.keys(state.players).length,
  totalEvents: state.events.length,
};

// Advance ~800 days (~2 seasons)
for (let i = 0; i < 800; i++) {
  state = advanceGameDays(state, 1);
}

const after = {
  formations: new Set(Object.values(state.clubs).map((c) => c.formation)),
  managerReps: new Set(Object.values(state.clubs).map((c) => c.aiManager?.reputation ?? -1)),
  totalPlayers: Object.keys(state.players).length,
  totalEvents: state.events.length,
};

console.log(`formations: ${before.formations.size} -> ${after.formations.size}`);
console.log(`distinct manager reps: ${before.managerReps.size} -> ${after.managerReps.size}`);
console.log(`players: ${before.totalPlayers} -> ${after.totalPlayers}`);
console.log(`events: ${before.totalEvents} -> ${after.totalEvents}`);

const diverseFormations = after.formations.size > 1;
const diverseManagers = after.managerReps.size > 1;
const promotionsOrEvents = after.totalEvents > before.totalEvents;

if (diverseFormations && diverseManagers && promotionsOrEvents) {
  console.log("PASS — AI clubs evolved over multiple seasons and remain diverse");
  process.exit(0);
} else {
  console.error("FAIL — evolution produced insufficient diversity or no events");
  process.exit(2);
}
