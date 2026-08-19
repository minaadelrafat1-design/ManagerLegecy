/**
 * Calendar utilities for fixture scheduling
 * Provides month/year calculations, fixture grouping, and calendar grid generation
 */

export interface CalendarDay {
  dayOfMonth: number;
  dateISO: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: number; // 0-6, 0 = Sunday
}

export interface CalendarMonth {
  year: number;
  month: number; // 1-12
  days: CalendarDay[];
  monthName: string;
}

/**
 * Convert ISO date string (YYYY-MM-DD) to Date object at UTC midnight
 */
export function isoToDate(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

/**
 * Convert Date object to ISO date string (YYYY-MM-DD)
 */
export function dateToISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get today's date in ISO format
 */
export function getTodayISO(): string {
  return dateToISO(new Date());
}

/**
 * Compare two ISO dates
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareISODates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Generate calendar month data for display
 * @param year Full year (e.g., 2026)
 * @param month Month number (1-12)
 * @param todayISO Today's date in ISO format
 * @returns Calendar month object with day grid
 */
export function generateCalendarMonth(
  year: number,
  month: number,
  todayISO: string,
): CalendarMonth {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthName = monthNames[month - 1] ?? "Unknown";

  // Get first day of month and number of days in month
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  const daysInMonth = lastDay.getUTCDate();
  const startingDayOfWeek = firstDay.getUTCDay(); // 0 = Sunday

  // Get last few days of previous month for grid
  const prevMonthLastDay = new Date(Date.UTC(year, month - 1, 0));
  const prevMonthDaysInMonth = prevMonthLastDay.getUTCDate();
  const prevMonthStartIndex = prevMonthDaysInMonth - startingDayOfWeek + 1;

  const days: CalendarDay[] = [];

  // Previous month's days
  for (let i = prevMonthStartIndex; i <= prevMonthDaysInMonth; i++) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const dateObj = new Date(Date.UTC(prevYear, prevMonth - 1, i));
    days.push({
      dayOfMonth: i,
      dateISO: dateToISO(dateObj),
      isCurrentMonth: false,
      isToday: dateToISO(dateObj) === todayISO,
      dayOfWeek: dateObj.getUTCDay(),
    });
  }

  // Current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateObj = new Date(Date.UTC(year, month - 1, i));
    days.push({
      dayOfMonth: i,
      dateISO: dateToISO(dateObj),
      isCurrentMonth: true,
      isToday: dateToISO(dateObj) === todayISO,
      dayOfWeek: dateObj.getUTCDay(),
    });
  }

  // Next month's days
  const remainingCells = 42 - days.length; // 6 rows × 7 days
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const dateObj = new Date(Date.UTC(nextYear, nextMonth - 1, i));
    days.push({
      dayOfMonth: i,
      dateISO: dateToISO(dateObj),
      isCurrentMonth: false,
      isToday: dateToISO(dateObj) === todayISO,
      dayOfWeek: dateObj.getUTCDay(),
    });
  }

  return {
    year,
    month,
    monthName,
    days,
  };
}

/**
 * Navigate to next month
 */
export function nextMonth(year: number, month: number): [number, number] {
  if (month === 12) {
    return [year + 1, 1];
  }
  return [year, month + 1];
}

/**
 * Navigate to previous month
 */
export function previousMonth(year: number, month: number): [number, number] {
  if (month === 1) {
    return [year - 1, 12];
  }
  return [year, month - 1];
}

/**
 * Get current month and year from ISO date
 */
export function getMonthYearFromISO(dateISO: string): [number, number] {
  const date = isoToDate(dateISO);
  return [date.getUTCFullYear(), date.getUTCMonth() + 1];
}

/**
 * Format ISO date for display (e.g., "Sat, 6 Dec 2026")
 */
export function formatDateLong(dateISO: string): string {
  const date = isoToDate(dateISO);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const dayName = dayNames[date.getUTCDay()];
  const dayOfMonth = date.getUTCDate();
  const monthName = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  return `${dayName}, ${dayOfMonth} ${monthName} ${year}`;
}

/**
 * Format ISO date for compact display (e.g., "6 Dec")
 */
export function formatDateShort(dateISO: string): string {
  const date = isoToDate(dateISO);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const dayOfMonth = date.getUTCDate();
  const monthName = monthNames[date.getUTCMonth()];

  return `${dayOfMonth} ${monthName}`;
}

/**
 * Get day of week name
 */
export function getDayOfWeekName(dayOfWeek: number): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return dayNames[dayOfWeek % 7] ?? "Unknown";
}
