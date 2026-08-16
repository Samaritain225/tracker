/**
 * Tests for pure date helper functions.
 */

import { addDays, daysBetween, isSameDay, parseISODate, toISODate } from './date';

describe('toISODate / parseISODate roundtrip', () => {
  it('roundtrips a normal date', () => {
    const d = new Date(2025, 3, 1); // April 1, 2025
    expect(toISODate(parseISODate(toISODate(d)))).toBe(toISODate(d));
  });

  it('pads single-digit month and day', () => {
    const d = new Date(2025, 0, 5); // Jan 5, 2025
    expect(toISODate(d)).toBe('2025-01-05');
  });

  it('parses back to the same calendar date', () => {
    const iso = '2025-12-31';
    const d = parseISODate(iso);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });
});

describe('daysBetween', () => {
  it('returns 0 for the same day', () => {
    const d = new Date(2025, 5, 15);
    expect(daysBetween(d, d)).toBe(0);
  });

  it('returns a positive count for a later date', () => {
    const a = new Date(2025, 0, 1);
    const b = new Date(2025, 0, 11);
    expect(daysBetween(a, b)).toBe(10);
  });

  it('returns a negative count when b is earlier than a', () => {
    const a = new Date(2025, 0, 11);
    const b = new Date(2025, 0, 1);
    expect(daysBetween(a, b)).toBe(-10);
  });

  it('is correct across a year boundary', () => {
    const a = new Date(2024, 11, 28); // Dec 28, 2024
    const b = new Date(2025, 0, 3); // Jan 3, 2025
    expect(daysBetween(a, b)).toBe(6);
  });

  it('is correct across a leap day (2024 is a leap year)', () => {
    const a = new Date(2024, 1, 28); // Feb 28, 2024
    const b = new Date(2024, 2, 1); // Mar 1, 2024
    expect(daysBetween(a, b)).toBe(2); // Feb 29 exists in between
  });

  it('is correct across a non-leap-year February', () => {
    const a = new Date(2025, 1, 28); // Feb 28, 2025
    const b = new Date(2025, 2, 1); // Mar 1, 2025
    expect(daysBetween(a, b)).toBe(1); // no Feb 29 in 2025
  });

  it('is correct across a DST spring-forward boundary (US, 2025-03-09)', () => {
    const a = new Date(2025, 2, 8); // Mar 8, 2025
    const b = new Date(2025, 2, 10); // Mar 10, 2025
    expect(daysBetween(a, b)).toBe(2);
  });

  it('is correct across a DST fall-back boundary (US, 2025-11-02)', () => {
    const a = new Date(2025, 10, 1); // Nov 1, 2025
    const b = new Date(2025, 10, 3); // Nov 3, 2025
    expect(daysBetween(a, b)).toBe(2);
  });
});

describe('addDays', () => {
  it('adds days within a month', () => {
    const d = new Date(2025, 5, 10);
    expect(toISODate(addDays(d, 5))).toBe('2025-06-15');
  });

  it('rolls over a month boundary', () => {
    const d = new Date(2025, 0, 30); // Jan 30, 2025
    expect(toISODate(addDays(d, 3))).toBe('2025-02-02');
  });

  it('rolls over a year boundary', () => {
    const d = new Date(2025, 11, 30); // Dec 30, 2025
    expect(toISODate(addDays(d, 3))).toBe('2026-01-02');
  });

  it('subtracts days with a negative n', () => {
    const d = new Date(2025, 0, 2);
    expect(toISODate(addDays(d, -3))).toBe('2024-12-30');
  });

  it('handles Feb 29 on a leap year correctly', () => {
    const d = new Date(2024, 1, 28); // Feb 28, 2024
    expect(toISODate(addDays(d, 1))).toBe('2024-02-29');
  });
});

describe('isSameDay', () => {
  it('returns true for identical dates', () => {
    expect(isSameDay(new Date(2025, 5, 1), new Date(2025, 5, 1))).toBe(true);
  });

  it('returns false for different days', () => {
    expect(isSameDay(new Date(2025, 5, 1), new Date(2025, 5, 2))).toBe(false);
  });

  it('ignores time-of-day differences', () => {
    const a = new Date(2025, 5, 1, 3, 0, 0);
    const b = new Date(2025, 5, 1, 23, 59, 0);
    expect(isSameDay(a, b)).toBe(true);
  });
});
