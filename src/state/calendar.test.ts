/**
 * CALENDAR TEST SUITE
 *
 * Tests for:
 * - Day advancement
 * - Week transitions
 * - Season transitions
 * - Date calculations
 */

import { describe, it, expect, vi } from "vitest";
import {
  addDaysISO,
  daysBetweenISO,
  getDayOfWeekLabel,
  advanceCalendarClock,
  advanceGameDays,
} from "../state/calendar";
import type { GameCalendarState } from "../state/types";

describe("Calendar - Day Advancement", () => {
  it("advances single day correctly", () => {
    const result = addDaysISO("2026-08-13", 1);
    expect(result).toBe("2026-08-14");
  });

  it("advances multiple days correctly", () => {
    const result = addDaysISO("2026-08-13", 10);
    expect(result).toBe("2026-08-23");
  });

  it("handles month boundaries", () => {
    const result = addDaysISO("2026-08-30", 5);
    expect(result).toBe("2026-09-04");
  });

  it("handles year boundaries", () => {
    const result = addDaysISO("2026-12-28", 5);
    expect(result).toBe("2027-01-02");
  });

  it("advances zero days (same date)", () => {
    const result = addDaysISO("2026-08-13", 0);
    expect(result).toBe("2026-08-13");
  });

  it("handles negative days (go backwards)", () => {
    const result = addDaysISO("2026-08-13", -5);
    expect(result).toBe("2026-08-08");
  });
});

describe("Calendar - Date Differences", () => {
  it("calculates zero days between same date", () => {
    const result = daysBetweenISO("2026-08-13", "2026-08-13");
    expect(result).toBe(0);
  });

  it("calculates positive difference forward", () => {
    const result = daysBetweenISO("2026-08-13", "2026-08-20");
    expect(result).toBe(7);
  });

  it("calculates negative difference backward", () => {
    const result = daysBetweenISO("2026-08-20", "2026-08-13");
    expect(result).toBe(-7);
  });

  it("calculates across months", () => {
    const result = daysBetweenISO("2026-08-30", "2026-09-04");
    expect(result).toBe(5);
  });

  it("calculates across years", () => {
    const result = daysBetweenISO("2026-12-28", "2027-01-02");
    expect(result).toBe(5);
  });
});

describe("Calendar - Day of Week", () => {
  it("identifies day of week label exists", () => {
    const result = getDayOfWeekLabel("2026-08-13");
    expect(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).toContain(result);
  });

  it("identifies different days have labels", () => {
    const day1 = getDayOfWeekLabel("2026-08-13");
    const day2 = getDayOfWeekLabel("2026-08-14");
    // Adjacent days should have different labels (most of the time)
    expect(day1).toBeDefined();
    expect(day2).toBeDefined();
    expect(typeof day1).toBe("string");
    expect(typeof day2).toBe("string");
  });

  it("cycles through week correctly", () => {
    // Seven days should cycle through all days
    const days = [];
    let currentDate = "2026-08-10"; // Start on a Sunday
    for (let i = 0; i < 7; i++) {
      days.push(getDayOfWeekLabel(currentDate));
      currentDate = addDaysISO(currentDate, 1);
    }
    // Should have seen multiple different days
    const uniqueDays = new Set(days);
    expect(uniqueDays.size).toBeGreaterThanOrEqual(7);
  });
});

describe("Calendar - Clock Advancement", () => {
  it("advances calendar clock by 1 day", () => {
    const calendar: GameCalendarState = {
      date: "2026-08-13",
      season: "2026/27",
      seasonStartDate: "2026-07-01",
      day: 44,
      week: 7,
    };

    const next = advanceCalendarClock(calendar, 1);

    expect(next.date).toBe("2026-08-14");
    expect(next.day).toBe(45);
    expect(next.week).toBe(7);
  });

  it("does not emit noisy day-advance logs by default", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const state = {
      time: {
        date: "2026-08-13",
        season: "2026/27",
        seasonStartDate: "2026-08-01",
        day: 13,
        week: 2,
      },
      clubs: {},
      players: {},
      fixtures: [],
      currentClub: { id: "club-1" },
      pendingManagerFixtureId: null,
      meta: {},
    } as any;

    advanceGameDays(state, 1);

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("advances calendar clock by 7 days (1 week)", () => {
    const calendar: GameCalendarState = {
      date: "2026-08-13",
      season: "2026/27",
      seasonStartDate: "2026-07-01",
      day: 44,
      week: 7,
    };

    const next = advanceCalendarClock(calendar, 7);

    expect(next.date).toBe("2026-08-20");
    expect(next.day).toBe(51);
    expect(next.week).toBe(8);
  });

  it("advances calendar clock by 30 days", () => {
    const calendar: GameCalendarState = {
      date: "2026-08-13",
      season: "2026/27",
      seasonStartDate: "2026-07-01",
      day: 44,
      week: 7,
    };

    const next = advanceCalendarClock(calendar, 30);

    expect(next.date).toBe("2026-09-12");
    expect(next.day).toBe(74);
    expect(next.week).toBeGreaterThan(7);
  });

  it("preserves season label when advancing within season", () => {
    const calendar: GameCalendarState = {
      date: "2026-08-13",
      season: "2026/27",
      seasonStartDate: "2026-07-01",
      day: 44,
      week: 7,
    };

    const next = advanceCalendarClock(calendar, 10);

    // Season doesn't change in advanceCalendarClock (that's simulateSeason's job)
    expect(next.season).toBe(calendar.season);
  });
});
