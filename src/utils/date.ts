/**
 * Pure date helper functions.
 * No side effects, no imports from hooks or db.
 * All functions operate on standard Date objects or ISO date strings.
 */

import { toHijri, formatHijriMonthHeader, getHijriDay } from "./hijri";


/**
 * Converts a Date to an ISO date string (YYYY-MM-DD).
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses an ISO date string (YYYY-MM-DD) into a Date object (midnight local).
 */
export function parseISODate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Returns the signed integer number of days between two dates (b - a).
 */
export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

/**
 * Returns a new Date that is `n` days after the given date.
 */
export function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * Returns true if two dates represent the same calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Formats a date for display, respecting locale and calendar type.
 *
 * Gregorian: 'April 1, 2025' (en) / '1 avril 2025' (fr)
 * Hijri: 'Ramadan 1, 1446' (en) / '1 Ramadan 1446' (fr)
 */
export function formatDisplayDate(
  date: Date,
  locale: 'en' | 'fr',
  calendarType: 'gregorian' | 'hijri',
): string {
  if (calendarType === 'hijri') {
    const hijri = toHijri(date);
    if (locale === 'fr') {
      return `${hijri.day} ${hijri.monthName} ${hijri.year}`;
    }
    return `${hijri.monthName} ${hijri.day}, ${hijri.year}`;
  }

  const fmt = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return fmt.format(date);
}

/**
 * Formats the month/year header for the calendar.
 */
export function formatMonthHeader(
  year: number,
  month: number,
  locale: 'en' | 'fr',
  calendarType: 'gregorian' | 'hijri',
): string {
  if (calendarType === 'hijri') {
    return formatHijriMonthHeader(year, month, locale);
  }

  const date = new Date(year, month, 1);
  const fmt = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  });
  return fmt.format(date);
}

/**
 * Returns the day number to display in a calendar cell.
 */
export function getDisplayDay(
  date: Date,
  calendarType: 'gregorian' | 'hijri',
): number {
  if (calendarType === 'hijri') {
    return getHijriDay(date);
  }
  return date.getDate();
}
