/**
 * Calendar utilities tests
 * Validates month generation, date formatting, and navigation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateCalendarMonth,
  nextMonth,
  previousMonth,
  getMonthYearFromISO,
  formatDateLong,
  formatDateShort,
  getDayOfWeekName,
  compareISODates,
  isoToDate,
  dateToISO,
} from "@/lib/calendar-utils";

describe("Calendar Utilities", () => {
  describe("generateCalendarMonth", () => {
    it("should generate a valid calendar month for August 2026", () => {
      const calendar = generateCalendarMonth(2026, 8, "2026-08-15");

      expect(calendar.year).toBe(2026);
      expect(calendar.month).toBe(8);
      expect(calendar.monthName).toBe("August");
      expect(calendar.days.length).toBe(42); // 6 weeks × 7 days
    });

    it("should mark today's date correctly", () => {
      const today = "2026-08-15";
      const calendar = generateCalendarMonth(2026, 8, today);

      const todayDay = calendar.days.find((d) => d.isToday);
      expect(todayDay).toBeDefined();
      expect(todayDay?.dateISO).toBe(today);
      expect(todayDay?.dayOfMonth).toBe(15);
    });

    it("should mark current month days and previous/next month days", () => {
      const calendar = generateCalendarMonth(2026, 8, "2026-08-15");

      const currentMonthDays = calendar.days.filter((d) => d.isCurrentMonth);
      const otherMonthDays = calendar.days.filter((d) => !d.isCurrentMonth);

      expect(currentMonthDays.length).toBeGreaterThan(0);
      expect(otherMonthDays.length).toBeGreaterThan(0);
      expect(currentMonthDays.length + otherMonthDays.length).toBe(42);
    });

    it("should have August 2026 start on Saturday (day 6)", () => {
      const calendar = generateCalendarMonth(2026, 8, "2026-08-15");
      const firstCurrentMonthDay = calendar.days.find(
        (d) => d.isCurrentMonth && d.dayOfMonth === 1,
      );

      expect(firstCurrentMonthDay).toBeDefined();
      expect(firstCurrentMonthDay?.dayOfWeek).toBe(6); // Saturday
    });
  });

  describe("Month Navigation", () => {
    it("nextMonth should move forward correctly", () => {
      const [nextYear, nextMonthNum] = nextMonth(2026, 8);
      expect(nextYear).toBe(2026);
      expect(nextMonthNum).toBe(9);
    });

    it("nextMonth should wrap year at December", () => {
      const [nextYear, nextMonthNum] = nextMonth(2026, 12);
      expect(nextYear).toBe(2027);
      expect(nextMonthNum).toBe(1);
    });

    it("previousMonth should move backward correctly", () => {
      const [prevYear, prevMonthNum] = previousMonth(2026, 8);
      expect(prevYear).toBe(2026);
      expect(prevMonthNum).toBe(7);
    });

    it("previousMonth should wrap year at January", () => {
      const [prevYear, prevMonthNum] = previousMonth(2026, 1);
      expect(prevYear).toBe(2025);
      expect(prevMonthNum).toBe(12);
    });
  });

  describe("Date Formatting", () => {
    it("formatDateShort should format as 'D Mon'", () => {
      const formatted = formatDateShort("2026-08-15");
      expect(formatted).toBe("15 Aug");
    });

    it("formatDateLong should format as 'Day, D Mon Year'", () => {
      const formatted = formatDateLong("2026-08-15");
      expect(formatted).toContain("Aug");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("15");
    });

    it("getDayOfWeekName should return correct abbreviation", () => {
      // August 15, 2026 is a Saturday
      const dayName = getDayOfWeekName(6);
      expect(dayName).toBe("Sat");
    });

    it("getDayOfWeekName should handle all days of week", () => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 0; i < 7; i++) {
        expect(getDayOfWeekName(i)).toBe(days[i]);
      }
    });
  });

  describe("Date Comparison", () => {
    it("compareISODates should return -1 for earlier date", () => {
      const result = compareISODates("2026-08-10", "2026-08-15");
      expect(result).toBe(-1);
    });

    it("compareISODates should return 1 for later date", () => {
      const result = compareISODates("2026-08-20", "2026-08-15");
      expect(result).toBe(1);
    });

    it("compareISODates should return 0 for same date", () => {
      const result = compareISODates("2026-08-15", "2026-08-15");
      expect(result).toBe(0);
    });

    it("compareISODates should work across years", () => {
      expect(compareISODates("2025-12-31", "2026-01-01")).toBe(-1);
      expect(compareISODates("2026-01-01", "2025-12-31")).toBe(1);
    });
  });

  describe("ISO Date Conversion", () => {
    it("isoToDate should convert ISO string to Date", () => {
      const date = isoToDate("2026-08-15");
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(7); // 0-indexed
      expect(date.getUTCDate()).toBe(15);
    });

    it("dateToISO should convert Date to ISO string", () => {
      const date = new Date(Date.UTC(2026, 7, 15)); // UTC: Aug 15, 2026
      const iso = dateToISO(date);
      expect(iso).toBe("2026-08-15");
    });

    it("dateToISO should be consistent with isoToDate", () => {
      const original = "2026-08-15";
      const date = isoToDate(original);
      const iso = dateToISO(date);
      expect(iso).toBe(original);
    });
  });

  describe("getMonthYearFromISO", () => {
    it("should extract month and year from ISO date", () => {
      const [year, month] = getMonthYearFromISO("2026-08-15");
      expect(year).toBe(2026);
      expect(month).toBe(8);
    });

    it("should work for first day of month", () => {
      const [year, month] = getMonthYearFromISO("2026-08-01");
      expect(year).toBe(2026);
      expect(month).toBe(8);
    });

    it("should work for last day of month", () => {
      const [year, month] = getMonthYearFromISO("2026-08-31");
      expect(year).toBe(2026);
      expect(month).toBe(8);
    });

    it("should work across year boundaries", () => {
      const [year1, month1] = getMonthYearFromISO("2025-12-31");
      expect(year1).toBe(2025);
      expect(month1).toBe(12);

      const [year2, month2] = getMonthYearFromISO("2026-01-01");
      expect(year2).toBe(2026);
      expect(month2).toBe(1);
    });
  });

  describe("Season Calendar Edge Cases", () => {
    it("should handle season transition from 2026 to 2027", () => {
      // Season 2026/27 runs Aug 1, 2026 - May 31, 2027
      const augustCalendar = generateCalendarMonth(2026, 8, "2026-08-15");
      const mayCalendar = generateCalendarMonth(2027, 5, "2027-05-20");

      expect(augustCalendar.year).toBe(2026);
      expect(mayCalendar.year).toBe(2027);

      // Both should have valid days
      expect(augustCalendar.days.length).toBe(42);
      expect(mayCalendar.days.length).toBe(42);
    });

    it("should navigate correctly across season boundaries", () => {
      // From May 2027 to June 2027 (end of season)
      const [year1, month1] = nextMonth(2027, 5);
      expect(year1).toBe(2027);
      expect(month1).toBe(6);

      // From June 2027 back to May 2027
      const [year2, month2] = previousMonth(2027, 6);
      expect(year2).toBe(2027);
      expect(month2).toBe(5);
    });

    it("should handle months with 28, 29, 30, 31 days", () => {
      const calendars = [
        generateCalendarMonth(2026, 2, "2026-02-15"), // February (28 days in non-leap year)
        generateCalendarMonth(2026, 4, "2026-04-15"), // April (30 days)
        generateCalendarMonth(2026, 5, "2026-05-15"), // May (31 days)
      ];

      for (const calendar of calendars) {
        expect(calendar.days.length).toBe(42);
        const currentMonthDays = calendar.days.filter((d) => d.isCurrentMonth);
        expect(currentMonthDays.length).toBeGreaterThan(0);
      }
    });
  });
});
