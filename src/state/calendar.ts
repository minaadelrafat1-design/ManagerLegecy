/* =============================================================================
 * Game calendar — engine (game rules)
 * =============================================================================
 * Phase B1. Pure functions only: (state, ...) -> value, same discipline as
 * `reducer.ts` and `lib/match-engine.ts` — no React, no localStorage, no
 * direct mutation. This module owns:
 *
 *  - reading the clock (`GameState.time`): date, season, week, day
 *  - reading what's next (`selectNextFixture`) and the transfer-window
 *    status (`getTransferWindowStatus`)
 *  - advancing the clock (`advanceGameDays`) — the ONE reliable way time
 *    moves forward. It always reads/writes through `GameState.time`; nothing
 *    here touches `Date.now()` or any other ambient clock.
 *
 * Extension points
 * ----------------
 * `dailyHooks` has one entry per system named in the Phase B1 spec —
 * training, recovery, injuries, development, fixtures, finances, events,
 * news. Every hook is a no-op today. A later phase implements one system by
 * reassigning its entry (e.g. `dailyHooks.training = simulateTrainingDay`)
 * — `advanceGameDays`/`runDailyTick` never need to change, and neither does
 * any other hook. This intentionally stops short of a season engine: no
 * hook here decides outcomes, injuries, results, or news content yet.
 * ---------------------------------------------------------------------------*/

import type { Fixture, GameCalendarState, GameState } from "./types";
import { applyWeeklyFinanceTick } from "./finance";
import { syncAiLedgers } from "./club-finance";

// ---- date arithmetic ---------------------------------------------------------
// All of this treats dates as UTC midnight ISO strings ("YYYY-MM-DD") so the
// math is unaffected by the host machine's timezone/DST — important because
// this same code runs in the browser (store.tsx) and in tests/SSR.

const MS_PER_DAY = 86_400_000;

function toUtcMidnight(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = toUtcMidnight(dateISO);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Whole days from `fromISO` to `toISO` (positive when `toISO` is later). */
export function daysBetweenISO(fromISO: string, toISO: string): number {
  return Math.round(
    (toUtcMidnight(toISO).getTime() - toUtcMidnight(fromISO).getTime()) / MS_PER_DAY,
  );
}

/**
 * PHASE AAA-REPAIR-4: Calculate player age from date of birth.
 * Age is the number of complete years from DOB to the given date.
 */
export function calculateAge(dateOfBirth: string, currentDateISO: string): number {
  if (!dateOfBirth) return 0;
  const birthDate = toUtcMidnight(dateOfBirth);
  const currentDate = toUtcMidnight(currentDateISO);

  let age = currentDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = currentDate.getUTCMonth() - birthDate.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && currentDate.getUTCDate() < birthDate.getUTCDate())) {
    age--;
  }

  return Math.max(0, age);
}

/**
 * PHASE AAA-REPAIR-4: Generate a date of birth from age and current date.
 * Used to backfill DOB for existing players who only have age.
 * Returns birth year such that player is currently the specified age on currentDateISO.
 */
export function generateDOBFromAge(age: number, currentDateISO: string): string {
  const currentDate = toUtcMidnight(currentDateISO);
  const birthYear = currentDate.getUTCFullYear() - age;
  // Use the same month/day as current date to keep it simple
  const month = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getUTCDate()).padStart(2, "0");
  return `${birthYear}-${month}-${day}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Sat", "Sun", ... — for screens that want a short weekday label without
 * pulling in a date-formatting library for one word. */
export function getDayOfWeekLabel(dateISO: string): (typeof DAY_NAMES)[number] {
  return DAY_NAMES[toUtcMidnight(dateISO).getUTCDay()] ?? "Sun";
}

// ---- the clock itself ----------------------------------------------------------

/** Advances a `GameCalendarState` by `days` (default 1) and recomputes
 * `day`/`week` from `seasonStartDate` — the only place that math happens, so
 * `day`/`week` can never drift out of sync with `date`. Pure: returns a new
 * object, never mutates `calendar`. */
export function advanceCalendarClock(calendar: GameCalendarState, days = 1): GameCalendarState {
  const date = addDaysISO(calendar.date, days);
  const daysSinceStart = daysBetweenISO(calendar.seasonStartDate, date); // 0-based
  return {
    ...calendar,
    date,
    day: daysSinceStart + 1,
    week: Math.floor(daysSinceStart / 7) + 1,
  };
}

// ---- next fixture --------------------------------------------------------------

/** The next fixture still to be played, in fixture-list order. A
 * `"postponed"` fixture is skipped (it isn't happening on schedule, so it
 * shouldn't surface as "next") — only `"scheduled"` counts.
 *
 * For the manager's club, this prioritizes:
 * 1. Today's scheduled fixture — this is the matchday lock before kickoff
 * 2. Next future scheduled fixture (if no fixture today)
 *
 * Once a fixture has been played, it should no longer be treated as the
 * current match-day action on the home dashboard. The match screen keeps
 * a captured fixture ID while the live match is running, but the dashboard
 * must move on to the next future scheduled fixture instead of prompting
 * the user to play the same result again. */
export function selectNextFixture(state: GameState): Fixture | undefined {
  const today = state.time.date;
  const managedClubId = state.currentClub.id;

  const todayManagerFixture = state.fixtures.find(
    (f) =>
      f.calendarDate === today &&
      f.status === "scheduled" &&
      (f.homeClubId === managedClubId || f.awayClubId === managedClubId),
  );
  if (todayManagerFixture) return todayManagerFixture;

  return state.fixtures.find((f) => f.status === "scheduled");
}

/** Returns the manager fixture that is actively blocking calendar progression
 * on the current date, if any. A blocked day is a true game-state lock, not a
 * generic "waiting" state. */
export function getPendingManagerFixtureForToday(state: GameState): Fixture | undefined {
  if (!state.pendingManagerFixtureId) return undefined;

  const pendingFixture = state.fixtures.find((f) => f.id === state.pendingManagerFixtureId);
  if (!pendingFixture) return undefined;

  const managedClubId = state.currentClub?.id ?? state.manager?.clubId;
  const isManagerFixture =
    managedClubId != null &&
    (pendingFixture.homeClubId === managedClubId || pendingFixture.awayClubId === managedClubId);

  if (!isManagerFixture) return undefined;
  if (pendingFixture.status !== "scheduled") return undefined;
  if (pendingFixture.calendarDate !== state.time.date) return undefined;

  return pendingFixture;
}

export function canAdvanceGameDay(state: GameState): boolean {
  return !getPendingManagerFixtureForToday(state);
}

// ---- transfer-window status ----------------------------------------------------

export type TransferWindowName = "Summer" | "Winter";

export interface TransferWindowStatus {
  isOpen: boolean;
  /** Which window is currently open; `null` when the market is closed. */
  windowName: TransferWindowName | null;
  /** ISO date the *next* (or, if open, the current) window opens. */
  opensOn: string;
  /** ISO date the current window closes; `null` when the market is closed. */
  closesOn: string | null;
}

/** Two fixed windows per calendar year, matching how real football
 * calendars work:
 *  - Summer window: 1 Jun – 31 Aug
 *  - Winter window: 1 Jan – 31 Jan
 * Computed from `dateISO`'s own year (not parsed from `season`) so this
 * stays correct no matter how many days/seasons `advanceGameDays` has
 * moved past the save's original season — `season` is accepted for a
 * future phase that wants board/league-specific window variation, but
 * isn't needed for the fixed calendar today. Deliberately simple —
 * exactly the kind of detail a later phase can refine behind this same
 * function signature without touching any caller. */
export function getTransferWindowStatus(dateISO: string, _season: string): TransferWindowStatus {
  const year = parseInt(dateISO.slice(0, 4), 10);

  const windows = [year - 1, year, year + 1].flatMap((y) => [
    { name: "Summer" as const, opensOn: `${y}-06-01`, closesOn: `${y}-09-01` },
    { name: "Winter" as const, opensOn: `${y}-01-01`, closesOn: `${y}-02-01` },
  ]);

  const current = windows.find((w) => dateISO >= w.opensOn && dateISO < w.closesOn);
  if (current) {
    return {
      isOpen: true,
      windowName: current.name,
      opensOn: current.opensOn,
      closesOn: current.closesOn,
    };
  }

  const next = windows
    .filter((w) => w.opensOn > dateISO)
    .sort((a, b) => (a.opensOn < b.opensOn ? -1 : 1))[0];
  // `next` is always defined: the year+1 windows are unconditionally later
  // than any date within `year`.
  return { isOpen: false, windowName: null, opensOn: next!.opensOn, closesOn: null };
}

// ---- extension points -----------------------------------------------------------

export type DailyHookName =
  | "fixtures"
  | "training"
  | "recovery"
  | "injuries"
  | "development"
  | "ai"
  | "scouting"
  | "finances"
  | "events"
  | "news";

/** A daily system hook: given the state *after* the clock has advanced and
 * the new `GameCalendarState`, return the (possibly updated) state. Must be
 * pure, like everything else in this file — no dispatch, no I/O. */
export type DailyHook = (state: GameState, time: GameCalendarState) => GameState;

const noop: DailyHook = (state) => state;

/** One entry per system named in the Phase B1 spec. Replace an entry to
 * "turn on" that system's daily tick — e.g.:
 *
 *   import { registerDailyHook } from "@/state/calendar";
 *   registerDailyHook("training", (state, time) => ({ ...state, players: ... }));
 *
 * Every entry defaults to a no-op (`state => state`) until its owning phase
 * fills it in. Do not add season-engine logic directly in this file. */
export const dailyHooks: Record<DailyHookName, DailyHook> = {
  fixtures: noop,
  training: noop,
  recovery: noop,
  injuries: noop,
  development: noop,
  ai: noop,
  scouting: noop,
  finances: noop,
  events: noop,
  news: noop,
};

const registeredDailyHooks: Record<DailyHookName, DailyHook[]> = {
  fixtures: [],
  training: [],
  recovery: [],
  injuries: [],
  development: [],
  ai: [],
  scouting: [],
  finances: [],
  events: [],
  news: [],
};

const DAY_ADVANCE_DEBUG = false;

function countStateMetrics(state: GameState) {
  return {
    clubs: Object.keys(state.clubs ?? {}).length,
    players: Object.keys(state.players ?? {}).length,
    transfers: (state.transfers ?? []).length,
    negotiations: (state.negotiations ?? []).length,
    events: (state.events ?? []).length,
    news: (state.news ?? []).length,
    fixtures: (state.fixtures ?? []).length,
  };
}

function debugAdvanceDay(...args: unknown[]) {
  if (DAY_ADVANCE_DEBUG) {
    console.log(...args);
  }
}

// ---- Timing collection for profiling -----
export interface DayTimingRecord {
  date: string;
  dayNum: number;
  startMs: number;
  totalMs: number;
  hooks: Record<string, number>;
  metrics: {
    clubs: number;
    players: number;
    transfers: number;
    negotiations: number;
    events: number;
    news: number;
    fixtures: number;
  };
}

class TimingCollector {
  private enabled = false;
  private timings: DayTimingRecord[] = [];
  private currentDay: DayTimingRecord | null = null;
  private hookTimings: Record<string, number> = {};

  startProfiling() {
    this.enabled = true;
    this.timings = [];
  }

  stopProfiling() {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  recordDayStart(date: string, dayNum: number, metrics: Record<string, number>) {
    if (!this.enabled) return;
    this.currentDay = {
      date,
      dayNum,
      startMs: performance.now(),
      totalMs: 0,
      hooks: {},
      metrics: metrics as DayTimingRecord["metrics"],
    };
    this.hookTimings = {};
  }

  recordHookStart(hookName: string, hookIndex = 0) {
    if (!this.enabled) return;
    this.hookTimings[`${hookName}[${hookIndex}]`] = performance.now();
  }

  recordHookEnd(hookName: string, hookIndex = 0) {
    if (!this.enabled || !this.currentDay) return;
    const individualName = `${hookName}[${hookIndex}]`;
    const startTime = this.hookTimings[individualName];
    if (startTime !== undefined) {
      const elapsed = performance.now() - startTime;
      this.currentDay.hooks[individualName] = (this.currentDay.hooks[individualName] ?? 0) + elapsed;
      if (!this.currentDay.hooks[hookName]) {
        this.currentDay.hooks[hookName] = 0;
      }
      this.currentDay.hooks[hookName] += elapsed;
    }
  }

  recordDayEnd() {
    if (!this.enabled || !this.currentDay) return;
    this.currentDay.totalMs = performance.now() - this.currentDay.startMs;
    this.timings.push(this.currentDay);

    // Save to localStorage
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("__advanceDayProfiler_data", JSON.stringify(this.timings));
      } catch (e) {
        // Quota exceeded or not available
      }
    }
  }

  getTimings(): DayTimingRecord[] {
    return this.timings;
  }

  loadFromStorage() {
    if (typeof localStorage !== "undefined") {
      try {
        const data = localStorage.getItem("__advanceDayProfiler_data");
        if (data) {
          this.timings = JSON.parse(data);
        }
      } catch (e) {
        // Parse error or not available
      }
    }
  }

  clearStorage() {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem("__advanceDayProfiler_data");
      } catch (e) {
        // Not available
      }
    }
    this.timings = [];
  }

  getReport(): string {
    const lines: string[] = [];
    lines.push("\n" + "=".repeat(100));
    lines.push("ADVANCE DAY PERFORMANCE REPORT");
    lines.push("=".repeat(100));

    let totalMs = 0;
    const hookTotals: Record<string, { total: number; count: number; max: number }> = {};

    for (const day of this.timings) {
      lines.push(`\nDate: ${day.date} Day#${day.dayNum} Total: ${day.totalMs.toFixed(2)}ms`);
      lines.push(
        `  Metrics: Clubs=${day.metrics.clubs} Players=${day.metrics.players} Transfers=${day.metrics.transfers} Negotiations=${day.metrics.negotiations}`,
      );

      for (const [hookName, hookMs] of Object.entries(day.hooks)) {
        lines.push(`    └─ ${hookName}: ${hookMs.toFixed(2)}ms`);
        if (!hookTotals[hookName]) {
          hookTotals[hookName] = { total: 0, count: 0, max: 0 };
        }
        hookTotals[hookName].total += hookMs;
        hookTotals[hookName].count += 1;
        hookTotals[hookName].max = Math.max(hookTotals[hookName].max, hookMs);
      }

      totalMs += day.totalMs;
    }

    lines.push("\n" + "-".repeat(100));
    lines.push("HOOK SUMMARY (sorted by total time)");
    lines.push("-".repeat(100));

    const sorted = Object.entries(hookTotals).sort((a, b) => b[1].total - a[1].total);
    for (const [hookName, stats] of sorted) {
      const avg = stats.total / stats.count;
      lines.push(
        `${hookName}: Total=${stats.total.toFixed(2)}ms Avg=${avg.toFixed(2)}ms Max=${stats.max.toFixed(2)}ms Calls=${stats.count}`,
      );
    }

    const avgPerDay = totalMs / this.timings.length;
    lines.push("\n" + "-".repeat(100));
    lines.push(
      `TOTALS: ${this.timings.length} days | Total time: ${totalMs.toFixed(2)}ms | Avg per day: ${avgPerDay.toFixed(2)}ms`,
    );
    lines.push("=".repeat(100) + "\n");

    return lines.join("\n");
  }
}

const timingCollector = new TimingCollector();

export function startAdvanceDayProfiling() {
  timingCollector.startProfiling();
}

export function stopAdvanceDayProfiling() {
  timingCollector.stopProfiling();
}

export function getAdvanceDayTimings(): readonly DayTimingRecord[] {
  return timingCollector.getTimings();
}

// Export to window for browser access
if (typeof window !== "undefined") {
  (window as any).__advanceDayProfiler = {
    start: () => timingCollector.startProfiling(),
    stop: () => timingCollector.stopProfiling(),
    report: () => console.log(timingCollector.getReport()),
    data: () => timingCollector.getTimings(),
    load: () => timingCollector.loadFromStorage(),
    clear: () => timingCollector.clearStorage(),
    exportJSON: () => JSON.stringify(timingCollector.getTimings(), null, 2),
    exportCSV: () => {
      const data = timingCollector.getTimings();
      let csv = "Date,Day,TotalMs,Clubs,Players,Transfers,Negotiations,Events,News,Fixtures,";
      csv += [
        "fixtures",
        "training",
        "recovery",
        "injuries",
        "development",
        "ai",
        "scouting",
        "finances",
        "events",
        "news",
      ]
        .map((h) => h + "Ms")
        .join(",");
      csv += "\n";
      for (const day of data) {
        csv += `${day.date},${day.dayNum},${day.totalMs.toFixed(2)},${day.metrics.clubs},${day.metrics.players},${day.metrics.transfers},${day.metrics.negotiations},${day.metrics.events},${day.metrics.news},${day.metrics.fixtures},`;
        const hookNames = [
          "fixtures",
          "training",
          "recovery",
          "injuries",
          "development",
          "ai",
          "scouting",
          "finances",
          "events",
          "news",
        ];
        csv += hookNames.map((h) => (day.hooks[h] ?? 0).toFixed(2)).join(",");
        csv += "\n";
      }
      return csv;
    },
  };
}

let dailyHooksEnabled = true;

export function setDailyHooksEnabled(enabled: boolean) {
  dailyHooksEnabled = enabled;
  if (!enabled) {
    clearDailyHooks();
  }
}

/**
 * CRITICAL FIX: Prevent duplicate hook registration.
 *
 * Problem: If a module is imported multiple times (hot reload, SSR, etc),
 * registerDailyHook gets called multiple times with the same hook function,
 * causing it to run multiple times per day (training applied twice, injuries
 * triggered twice, etc). This is a stability/correctness bug.
 *
 * Solution: Use a WeakMap to track hook registrations by their function
 * reference. If a hook is already registered for this name, skip it.
 *
 * This prevents the same hook from running multiple times per daily tick
 * while still allowing the hook system to function correctly.
 */
const registeredHookReferences = new WeakMap<DailyHook, Set<DailyHookName>>();

export function registerDailyHook(name: DailyHookName, hook: DailyHook) {
  if (!dailyHooksEnabled) return;

  // Track which hook names this function has been registered for
  if (!registeredHookReferences.has(hook)) {
    registeredHookReferences.set(hook, new Set());
  }
  const hookRegistrations = registeredHookReferences.get(hook)!;

  // Only register if this hook hasn't been registered for this name yet
  if (!hookRegistrations.has(name)) {
    registeredDailyHooks[name].push(hook);
    hookRegistrations.add(name);
  }
}

export function clearDailyHooks() {
  for (const name of DAILY_HOOK_ORDER) {
    registeredDailyHooks[name] = [];
  }
}

export function getRegisteredDailyHookCount(name: DailyHookName): number {
  return registeredDailyHooks[name].length;
}

/** Fixed run order for `dailyHooks` — e.g. fixtures resolve before finances
 * would react to matchday revenue, injuries update before development
 * reads fitness. Exported so tests/tools can assert on it without
 * duplicating the list. */
export const DAILY_HOOK_ORDER: readonly DailyHookName[] = [
  "fixtures",
  "training",
  "recovery",
  "injuries",
  "development",
  "ai",
  "scouting",
  "finances",
  "events",
  "news",
];

/** Runs every registered hook, in `DAILY_HOOK_ORDER`, against `state` for
 * the given `time`. Exported mainly for tests — `advanceGameDays` below is
 * the entry point everything else should use. */
export function runDailyTick(state: GameState, time: GameCalendarState): GameState {
  if (!dailyHooksEnabled) {
    return state;
  }

  let next = state;
  const beforeMetrics = countStateMetrics(next);
  debugAdvanceDay(
    `[ADVANCE_DAY] [DATE] ${time.date} [START] runDailyTick count=${Object.keys(registeredDailyHooks).length} metrics=${JSON.stringify(beforeMetrics)}`,
  );

  for (const name of DAILY_HOOK_ORDER) {
    const registeredHooks = registeredDailyHooks[name];
    if (registeredHooks.length === 0) {
      continue;
    }

    const hookStart = performance.now();
    debugAdvanceDay(
      `[ADVANCE_DAY] [DATE] ${time.date} [START] hook-group:${name} hooks=${registeredHooks.length} metrics=${JSON.stringify(countStateMetrics(next))}`,
    );

    next = dailyHooks[name](next, time);

    for (let i = 0; i < registeredHooks.length; i++) {
      const hook = registeredHooks[i];
      if (!hook) continue;
      const subHookStart = performance.now();
      debugAdvanceDay(
        `[ADVANCE_DAY] [DATE] ${time.date} [START] hook:${name}[${i}] metrics=${JSON.stringify(countStateMetrics(next))}`,
      );
      timingCollector.recordHookStart(name, i);
      next = hook(next, time);
      timingCollector.recordHookEnd(name, i);
      debugAdvanceDay(
        `[ADVANCE_DAY] [DATE] ${time.date} [END] hook:${name}[${i}] elapsedMs=${(performance.now() - subHookStart).toFixed(2)} metrics=${JSON.stringify(countStateMetrics(next))}`,
      );
    }

    debugAdvanceDay(
      `[ADVANCE_DAY] [DATE] ${time.date} [END] hook-group:${name} elapsedMs=${(performance.now() - hookStart).toFixed(2)} metrics=${JSON.stringify(countStateMetrics(next))}`,
    );
  }

  debugAdvanceDay(
    `[ADVANCE_DAY] [DATE] ${time.date} [END] runDailyTick elapsedMs=... metrics=${JSON.stringify(countStateMetrics(next))}`,
  );
  return next;
}

function advanceGameStateOneDay(state: GameState): GameState {
  // Guard: cannot advance past a pending manager fixture on the current day.
  // Centralized in `getPendingManagerFixtureForToday()` so the rule is explicit
  // and only blocks actual same-day match-day progression.
  if (getPendingManagerFixtureForToday(state)) {
    return state;
  }

  const dayStart = performance.now();
  const metrics = countStateMetrics(state);
  debugAdvanceDay(
    `[ADVANCE_DAY] [DATE] ${state.time.date} [START] advanceGameStateOneDay day=${state.time.day} metrics=${JSON.stringify(metrics)}`,
  );

  // Record day timing
  timingCollector.recordDayStart(state.time.date, state.time.day, metrics);

  const time = advanceCalendarClock(state.time);
  let afterHooks = runDailyTick({ ...state, time }, time);

  if (time.week > state.time.week) {
    const financeStart = performance.now();
    debugAdvanceDay(
      `[ADVANCE_DAY] [DATE] ${time.date} [START] weekly-finance day=${time.day} metrics=${JSON.stringify(countStateMetrics(afterHooks))}`,
    );
    afterHooks = applyWeeklyFinanceTick(afterHooks);
    afterHooks = syncAiLedgers(afterHooks);
    debugAdvanceDay(
      `[ADVANCE_DAY] [DATE] ${time.date} [END] weekly-finance elapsedMs=${(performance.now() - financeStart).toFixed(2)} metrics=${JSON.stringify(countStateMetrics(afterHooks))}`,
    );
  }

  debugAdvanceDay(
    `[ADVANCE_DAY] [DATE] ${time.date} [END] advanceGameStateOneDay elapsedMs=${(performance.now() - dayStart).toFixed(2)} metrics=${JSON.stringify(countStateMetrics(afterHooks))}`,
  );

  // Record day end
  timingCollector.recordDayEnd();

  return afterHooks;
}

/** Advances `state.time` by `days` (default 1), running the daily
 * extension-point hooks once per day, in order. This is the ONE reliable
 * way the game clock moves forward — the reducer's `ADVANCE_DAY` action is
 * a thin wrapper around this function, and UI code should dispatch that
 * action rather than mutate `state.time` directly. `days < 1` is treated as
 * 1 (advancing time can't go backwards or stand still). */
export function advanceGameDays(state: GameState, days = 1): GameState {
  const count = Number.isFinite(days) && days >= 1 ? Math.floor(days) : 1;
  let next = state;
  for (let i = 0; i < count; i++) {
    next = advanceGameStateOneDay(next);
  }
  return next;
}
