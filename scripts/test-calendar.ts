/* =============================================================================
 * Phase B1 — game calendar smoke tests
 * =============================================================================
 * No test runner is wired into this project yet, so this is a small
 * standalone script (run with `npx tsx scripts/test-calendar.ts`) rather
 * than a `*.test.ts` file. It exercises exactly what the phase brief asks
 * for: dates/season/week/day advance correctly, `advanceDay` goes through
 * `GameState`, and the result persists across a reload.
 *
 * A minimal `localStorage` is stubbed on `globalThis.window` before any
 * app module is imported, since `state/persistence.ts` only touches
 * storage when `typeof window !== "undefined"` — this reproduces that
 * branch under plain Node without needing a browser or jsdom.
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
const {
  advanceCalendarClock,
  advanceGameDays,
  getDayOfWeekLabel,
  getTransferWindowStatus,
  selectNextFixture,
} = await import("../src/state/calendar.ts");
const { saveToStorage, loadFromStorage } = await import("../src/state/persistence.ts");
const { GAME_STATE_VERSION, GAME_STATE_MIGRATIONS } = await import("../src/state/store.tsx");

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? "PASS" : "FAIL"} — ${label}${ok ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`,
  );
  if (!ok) failures++;
}

// ---- 1. seeded clock is internally consistent ----------------------------------

const seeded = buildInitialState();
check("seed: date", seeded.time.date, "2026-11-30");
check("seed: season", seeded.time.season, "2026/27");
check("seed: day matches date/anchor", seeded.time.day, 122); // Aug 1 -> Nov 30 inclusive
check("seed: week matches day", seeded.time.week, Math.floor((seeded.time.day - 1) / 7) + 1);

// ---- 2. advanceCalendarClock: pure, single-day math ----------------------------

const oneDayLater = advanceCalendarClock(seeded.time, 1);
check("advanceCalendarClock: date +1", oneDayLater.date, "2026-12-01");
check("advanceCalendarClock: day +1", oneDayLater.day, seeded.time.day + 1);
check("advanceCalendarClock: original untouched (purity)", seeded.time.date, "2026-11-30");

const oneWeekLater = advanceCalendarClock(seeded.time, 7);
check("advanceCalendarClock: week +1 after 7 days", oneWeekLater.week, seeded.time.week + 1);

// ---- 3. advancing through GameState / the reducer -------------------------------

const afterOneDispatch = gameReducer(seeded, { type: "ADVANCE_DAY" });
check("reducer ADVANCE_DAY: default is 1 day", afterOneDispatch.time.date, "2026-12-01");
check(
  "reducer ADVANCE_DAY: only .time changed shape-wise",
  Object.keys(afterOneDispatch).length,
  Object.keys(seeded).length,
);
check(
  "reducer ADVANCE_DAY: players untouched (extension points are no-ops)",
  afterOneDispatch.players,
  seeded.players,
);

const afterFiveDays = gameReducer(seeded, { type: "ADVANCE_DAY", days: 5 });
check("reducer ADVANCE_DAY: multi-day", afterFiveDays.time.date, "2026-12-05");
check("reducer ADVANCE_DAY: multi-day day count", afterFiveDays.time.day, seeded.time.day + 5);

const advancedDirect = advanceGameDays(seeded, 5);
check(
  "advanceGameDays matches reducer for the same input",
  advancedDirect.time,
  afterFiveDays.time,
);

// ---- 4. next fixture + transfer-window status -----------------------------------

check("selectNextFixture: finds the unplayed fixture", selectNextFixture(seeded)?.id, "fx-14");
check(
  "selectNextFixture: none left once all played",
  selectNextFixture({
    ...seeded,
    fixtures: seeded.fixtures.map((f) => ({ ...f, status: "played" as const })),
  }),
  undefined,
);

check(
  "transfer window: closed on seed date (30 Nov)",
  getTransferWindowStatus(seeded.time.date, seeded.time.season).isOpen,
  false,
);
check(
  "transfer window: next window is Winter",
  getTransferWindowStatus(seeded.time.date, seeded.time.season).windowName,
  null,
);
check(
  "transfer window: opens 1 Jan",
  getTransferWindowStatus(seeded.time.date, seeded.time.season).opensOn,
  "2027-01-01",
);

const midJanuary = advanceGameDays(seeded, 33); // 30 Nov -> 2 Jan
check(
  "transfer window: open mid-January",
  getTransferWindowStatus(midJanuary.time.date, midJanuary.time.season).isOpen,
  true,
);
check(
  "transfer window: window name is Winter",
  getTransferWindowStatus(midJanuary.time.date, midJanuary.time.season).windowName,
  "Winter",
);

const midJuly = advanceGameDays(seeded, 227); // into next season's summer window
check(
  "transfer window: open in the following summer",
  getTransferWindowStatus(midJuly.time.date, midJuly.time.season).isOpen,
  true,
);
check(
  "transfer window: window name is Summer",
  getTransferWindowStatus(midJuly.time.date, midJuly.time.season).windowName,
  "Summer",
);

check("getDayOfWeekLabel: known Sunday", getDayOfWeekLabel("2026-11-29"), "Sun");

// ---- 5. persistence: advance, save, "reload" (fresh load from storage) ---------

const STORAGE_KEY = "ml_game_state";
const advancedTenDays = gameReducer(seeded, { type: "ADVANCE_DAY", days: 10 });
saveToStorage(STORAGE_KEY, GAME_STATE_VERSION, advancedTenDays);

const reloaded = loadFromStorage<Awaited<ReturnType<typeof buildInitialState>>>(
  STORAGE_KEY,
  GAME_STATE_VERSION,
);
check("persistence: reload status is ok", reloaded.status, "ok");
if (reloaded.status === "ok") {
  check("persistence: date survives reload", reloaded.data.time.date, "2026-12-10");
  check("persistence: day survives reload", reloaded.data.time.day, seeded.time.day + 10);
  check("persistence: season survives reload", reloaded.data.time.season, "2026/27");
}

// ---- 6. old-shape (pre-Phase-B1) save migrates cleanly --------------------------

const legacyStateWithoutTime = { ...seeded } as Record<string, unknown>;
delete legacyStateWithoutTime.time;
saveToStorage(STORAGE_KEY, 1, legacyStateWithoutTime);
// Uses the real `GAME_STATE_MIGRATIONS` (not a hand-copied subset) so this
// exercises the exact multi-step chain (1->2->3, ...) a save from before
// Phase B1 actually goes through today, not just its first step.
const migrated = loadFromStorage<Awaited<ReturnType<typeof buildInitialState>>>(
  STORAGE_KEY,
  GAME_STATE_VERSION,
  GAME_STATE_MIGRATIONS,
);
check("migration: legacy save (no `time`) loads ok", migrated.status, "ok");
if (migrated.status === "ok") {
  check("migration: backfilled clock is valid", migrated.data.time.date, "2026-11-30");
  check(
    "migration: fixtures backfilled with status (Phase B2)",
    migrated.data.fixtures.every((f) => f.status === "played" || f.status === "scheduled"),
    true,
  );
  check(
    "migration: leagues backfilled with competitionId (Phase B2)",
    Object.values(migrated.data.leagues).every((l) => typeof l.competitionId === "string"),
    true,
  );
}

// ---- summary ---------------------------------------------------------------------

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
