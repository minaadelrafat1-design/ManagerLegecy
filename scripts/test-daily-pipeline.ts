/* =============================================================================
 * Daily simulation pipeline regression test
 * =============================================================================
 * Verifies that advancing one game day runs the project-wide daily hook
 * pipeline in order and that the built-in persistence system can save the
 * updated state. This uses only the existing state, side-effect hook
 * registration modules, and persistence helpers — no new gameplay mechanics.
 * ---------------------------------------------------------------------------*/

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
const { advanceGameDays, getTransferWindowStatus } = await import("../src/state/calendar.ts");
const { saveToStorage, loadFromStorage } = await import("../src/state/persistence.ts");
const { GAME_STATE_VERSION } = await import("../src/state/store.tsx");

// Ensure all daily hook registration side effects are loaded.
await import("../src/state/ai-contracts.ts");
await import("../src/state/ai-transfers.ts");
await import("../src/state/ai-evolution.ts");
await import("../src/state/training.ts");
await import("../src/state/board.ts");
await import("../src/state/fans.ts");
await import("../src/state/events-engine.ts");

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? "PASS" : "FAIL"} — ${label}${ok ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`,
  );
  if (!ok) failures++;
}
function checkTrue(label: string, condition: boolean, detail = "") {
  console.log(
    `${condition ? "PASS" : "FAIL"} — ${label}${condition || !detail ? "" : ` (${detail})`}`,
  );
  if (!condition) failures++;
}

const seeded = buildInitialState();
const currentDate = seeded.time.date;
const currentDay = seeded.time.day;
const currentClub = seeded.currentClub;

// Create a deterministic training day for the manager's first player.
const playerId = currentClub.playerIds[0];
const startingPlayer = seeded.players[playerId];
const trainingPlan = {
  id: "pipeline-training",
  name: "Daily Conditioning",
  focus: "Fitness",
  intensity: "medium",
  assignedPlayerIds: [playerId],
};

// Pick an AI club player with a near-term contract so the AI contracts hook
// has a deterministic opportunity to create a session.
const aiClub = Object.values(seeded.clubs).find(
  (club) => club.aiManager && club.id !== currentClub.id,
);
checkTrue("found an AI club for contract hook coverage", Boolean(aiClub));
if (!aiClub) process.exit(1);
const aiPlayerId = aiClub.playerIds[0];
const aiPlayer = seeded.players[aiPlayerId];
checkTrue("found an AI player for contract hook coverage", Boolean(aiPlayer));
if (!aiPlayer) process.exit(1);

const initialState = {
  ...seeded,
  players: {
    ...seeded.players,
    [playerId]: { ...startingPlayer, fatigue: 20 },
    [aiPlayerId]: { ...aiPlayer, contractYears: 1 },
  },
  training: [...(seeded.training ?? []), trainingPlan],
};

const advanced = gameReducer(initialState, { type: "ADVANCE_DAY" });
const expectedDate = advanceGameDays(initialState, 1).time.date;
const expectedDay = currentDay + 1;

check("advance one day updates the calendar date", advanced.time.date, expectedDate);
check("advance one day updates the calendar day", advanced.time.day, expectedDay);
check(
  "advanceGameDays matches reducer ADVANCE_DAY",
  advanced.time,
  advanceGameDays(initialState, 1).time,
);

const nextPlayer = advanced.players[playerId];
checkTrue("training+recovery pipeline processed a player fatigue update", Boolean(nextPlayer));
if (nextPlayer) {
  checkTrue(
    "player fatigue remains within valid range after training/recovery",
    typeof nextPlayer.fatigue === "number" && nextPlayer.fatigue >= 0 && nextPlayer.fatigue <= 100,
  );
}

const negotiationSessions = advanced.negotiations.length - (initialState.negotiations?.length ?? 0);
check("AI contracts hook created a negotiation session", negotiationSessions > 0, true);

const storageKey = "ml_game_state";
const saved = saveToStorage(storageKey, GAME_STATE_VERSION, advanced);
check("persistence helper can save the advanced state", saved, true);
const loaded = loadFromStorage<typeof advanced>(storageKey, GAME_STATE_VERSION);
check("saved state reloads with status ok", loaded.status, "ok");
if (loaded.status === "ok") {
  check("reloaded state preserves the new date", loaded.data.time.date, advanced.time.date);
  check("reloaded state preserves the new day", loaded.data.time.day, advanced.time.day);
}

const transferWindow = getTransferWindowStatus(advanced.time.date, advanced.time.season);
checkTrue(
  "transfer window status still returns a valid object",
  transferWindow.isOpen === true || transferWindow.isOpen === false,
);

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} failure(s).`}`);
process.exit(failures === 0 ? 0 : 1);
