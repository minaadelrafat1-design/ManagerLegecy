/**
 * Performance monitoring system for Advance Day profiling.
 *
 * Collects timing data from each daily hook and daily cycle.
 * Exported for analysis and optimization.
 */

export interface HookTiming {
  name: string;
  hookIndex?: number;
  startMs: number;
  endMs: number;
  elapsedMs: number;
}

export interface DayTiming {
  date: string;
  dayOfSeason: number;
  startMs: number;
  endMs: number;
  elapsedMs: number;
  hooks: HookTiming[];
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

export interface ProfileSession {
  startMs: number;
  days: DayTiming[];
  totalElapsedMs: number;
  avgTimePerDay: number;
  slowestHookOverall: { name: string; elapsedMs: number; onDate: string };
  slowestDayOverall: { date: string; elapsedMs: number };
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private isRecording = false;
  private currentSession: ProfileSession | null = null;
  private currentDayTiming: DayTiming | null = null;
  private currentHookStack: HookTiming[] = [];
  private consoleLogs: string[] = [];
  private originalConsoleLog: typeof console.log;

  private constructor() {
    this.originalConsoleLog = console.log;
    this.interceptConsole();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private interceptConsole() {
    console.log = (...args: unknown[]) => {
      this.originalConsoleLog(...args);
      if (!this.isRecording) return;

      const message = args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          return JSON.stringify(arg);
        })
        .join(" ");

      this.consoleLogs.push(message);

      // Parse ADVANCE_DAY debug messages
      if (message.includes("[ADVANCE_DAY]")) {
        this.parseAdvanceDayLog(message);
      }
    };
  }

  private parseAdvanceDayLog(message: string) {
    // Parse messages like:
    // [ADVANCE_DAY] [DATE] 2026-08-17 [START] advanceGameStateOneDay day=1 metrics=...
    // [ADVANCE_DAY] [DATE] 2026-08-17 [END] hook:fixtures[0] elapsedMs=123.45 metrics=...
    // [ADVANCE_DAY] [DATE] 2026-08-17 [END] advanceGameStateOneDay elapsedMs=500.00 metrics=...

    if (!this.isRecording) return;

    const dateMatch = message.match(/\[DATE\] (\d{4}-\d{2}-\d{2})/);
    const dateStr = dateMatch?.[1] || "";

    if (message.includes("[START] advanceGameStateOneDay")) {
      // Start of a new day
      const dayMatch = message.match(/day=(\d+)/);
      const dayNum = dayMatch?.[1] ? parseInt(dayMatch[1], 10) : 0;

      this.currentDayTiming = {
        date: dateStr,
        dayOfSeason: dayNum,
        startMs: performance.now(),
        endMs: 0,
        elapsedMs: 0,
        hooks: [],
        metrics: {
          clubs: 0,
          players: 0,
          transfers: 0,
          negotiations: 0,
          events: 0,
          news: 0,
          fixtures: 0,
        },
      };

      // Parse initial metrics
      const metricsMatch = message.match(/metrics=(\{[^}]+\})/);
      if (metricsMatch?.[1]) {
        try {
          const parsed = JSON.parse(metricsMatch[1]);
          this.currentDayTiming.metrics = parsed;
        } catch (e) {
          // metrics parsing failed
        }
      }
    } else if (message.includes("[END] advanceGameStateOneDay") && this.currentDayTiming) {
      // End of the current day
      const elapsedMatch = message.match(/elapsedMs=([\d.]+)/);
      const elapsed = elapsedMatch?.[1] ? parseFloat(elapsedMatch[1]) : 0;

      this.currentDayTiming.endMs = performance.now();
      this.currentDayTiming.elapsedMs = elapsed;

      if (this.currentSession) {
        this.currentSession.days.push(this.currentDayTiming);
      }

      this.currentDayTiming = null;
      this.currentHookStack = [];
    } else if (message.includes("[START] hook:") && this.currentDayTiming) {
      // Hook start: [START] hook:fixtures[0]
      const hookMatch = message.match(/hook:(\w+)\[(\d+)\]/);
      if (hookMatch?.[1] && hookMatch?.[2]) {
        const hookName = hookMatch[1] ?? "";
        const hookIndex = parseInt(hookMatch[2], 10);
        const hookTiming: HookTiming = {
          name: hookName,
          hookIndex,
          startMs: performance.now(),
          endMs: 0,
          elapsedMs: 0,
        };
        this.currentHookStack.push(hookTiming);
      }
    } else if (
      message.includes("[END] hook:") &&
      this.currentDayTiming &&
      this.currentHookStack.length > 0
    ) {
      // Hook end: [END] hook:fixtures[0] elapsedMs=123.45
      const elapsedMatch = message.match(/elapsedMs=([\d.]+)/);
      const elapsed = elapsedMatch?.[1] ? parseFloat(elapsedMatch[1]) : 0;

      const lastHook = this.currentHookStack.pop();
      if (lastHook) {
        lastHook.endMs = performance.now();
        lastHook.elapsedMs = elapsed;
        this.currentDayTiming.hooks.push(lastHook);
      }
    }
  }

  startSession(): ProfileSession {
    this.isRecording = true;
    this.consoleLogs = [];
    this.currentSession = {
      startMs: performance.now(),
      days: [],
      totalElapsedMs: 0,
      avgTimePerDay: 0,
      slowestHookOverall: { name: "", elapsedMs: 0, onDate: "" },
      slowestDayOverall: { date: "", elapsedMs: 0 },
    };
    return this.currentSession;
  }

  endSession(): ProfileSession | null {
    this.isRecording = false;
    if (!this.currentSession) return null;

    const session = this.currentSession;
    session.totalElapsedMs = performance.now() - session.startMs;
    session.avgTimePerDay =
      session.days.length > 0 ? session.totalElapsedMs / session.days.length : 0;

    // Find slowest hook overall
    let slowestHook: HookTiming | null = null;
    let slowestDay: DayTiming | null = null;
    for (const day of session.days) {
      if (day.elapsedMs > (slowestDay?.elapsedMs ?? 0)) {
        slowestDay = day;
      }
      for (const hook of day.hooks) {
        if (hook.elapsedMs > (slowestHook?.elapsedMs ?? 0)) {
          slowestHook = hook;
        }
      }
    }

    if (slowestHook) {
      const dayWithSlowHook = session.days.find((d) => d.hooks.includes(slowestHook!));
      session.slowestHookOverall = {
        name: slowestHook.name,
        elapsedMs: slowestHook.elapsedMs,
        onDate: dayWithSlowHook?.date || "",
      };
    }

    if (slowestDay) {
      session.slowestDayOverall = {
        date: slowestDay.date,
        elapsedMs: slowestDay.elapsedMs,
      };
    }

    this.currentSession = null;
    return session;
  }

  getConsoleLogs(): string[] {
    return this.consoleLogs;
  }

  isRecordingSession(): boolean {
    return this.isRecording;
  }

  getCurrentSession(): ProfileSession | null {
    return this.currentSession;
  }

  exportAsJSON(session: ProfileSession): string {
    return JSON.stringify(session, null, 2);
  }

  exportAsCSV(session: ProfileSession): string {
    let csv = "Date,Day,TotalMs,HookName,HookMs\n";

    for (const day of session.days) {
      for (const hook of day.hooks) {
        csv += `${day.date},${day.dayOfSeason},${day.elapsedMs.toFixed(2)},${hook.name},${hook.elapsedMs.toFixed(2)}\n`;
      }
    }

    return csv;
  }

  generateReport(session: ProfileSession): string {
    const lines: string[] = [];
    lines.push("=".repeat(80));
    lines.push("ADVANCE DAY PERFORMANCE REPORT");
    lines.push("=".repeat(80));
    lines.push("");

    lines.push("SUMMARY");
    lines.push("-".repeat(80));
    lines.push(`Total days profiled: ${session.days.length}`);
    lines.push(`Total session time: ${session.totalElapsedMs.toFixed(2)}ms`);
    lines.push(`Average time per day: ${session.avgTimePerDay.toFixed(2)}ms`);
    lines.push(
      `Slowest day: ${session.slowestDayOverall.date} (${session.slowestDayOverall.elapsedMs.toFixed(2)}ms)`,
    );
    lines.push(
      `Slowest hook: ${session.slowestHookOverall.name} on ${session.slowestHookOverall.onDate} (${session.slowestHookOverall.elapsedMs.toFixed(2)}ms)`,
    );
    lines.push("");

    lines.push("PER-DAY BREAKDOWN");
    lines.push("-".repeat(80));
    for (const day of session.days) {
      lines.push(
        `Date: ${day.date} | Day: ${day.dayOfSeason} | Total: ${day.elapsedMs.toFixed(2)}ms | Clubs: ${day.metrics.clubs} | Players: ${day.metrics.players} | Transfers: ${day.metrics.transfers} | Negotiations: ${day.metrics.negotiations}`,
      );
      for (const hook of day.hooks) {
        lines.push(`  └─ ${hook.name}: ${hook.elapsedMs.toFixed(2)}ms`);
      }
    }
    lines.push("");

    lines.push("HOOK PERFORMANCE SUMMARY");
    lines.push("-".repeat(80));
    const hookStats: { [key: string]: { count: number; totalMs: number; maxMs: number } } = {};
    for (const day of session.days) {
      for (const hook of day.hooks) {
        if (!hookStats[hook.name]) {
          hookStats[hook.name] = { count: 0, totalMs: 0, maxMs: 0 };
        }
        const stats = hookStats[hook.name];
        if (stats) {
          stats.count += 1;
          stats.totalMs += hook.elapsedMs;
          stats.maxMs = Math.max(stats.maxMs, hook.elapsedMs);
        }
      }
    }

    const sortedHooks = Object.entries(hookStats).sort((a, b) => b[1].totalMs - a[1].totalMs);
    for (const [hookName, stats] of sortedHooks) {
      const avgMs = stats.totalMs / stats.count;
      lines.push(
        `${hookName}: Total=${stats.totalMs.toFixed(2)}ms | Avg=${avgMs.toFixed(2)}ms | Max=${stats.maxMs.toFixed(2)}ms | Count=${stats.count}`,
      );
    }
    lines.push("");

    lines.push("=".repeat(80));
    return lines.join("\n");
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
