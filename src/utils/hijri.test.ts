/**
 * Tests for Hijri (Islamic, Umm al-Qura) calendar conversion.
 *
 * These double as a canary: they rely on Node's ICU build supporting
 * the `islamic-umalqura` calendar via Intl. If Hermes on Android does
 * NOT support it, these Node tests can still pass while the real app
 * silently falls back to the Gregorian calendar on device — so this
 * suite is necessary but not sufficient. Verify Hijri output on a
 * physical Android device as well (see plan Phase 5).
 */

import { formatHijriMonthHeader, getHijriDay, toHijri } from './hijri';

// Reference points cross-checked against Node's own Intl output for the
// islamic-umalqura calendar (`new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', ...)`),
// since this is the same calculation toHijri wraps.
const REFERENCE_PAIRS: Array<{ gregorian: [number, number, number]; hijriDay: number; hijriYear: number }> = [
  { gregorian: [2025, 0, 1], hijriDay: 1, hijriYear: 1446 }, // Jan 1, 2025 -> 1 Rajab 1446
  { gregorian: [2000, 0, 1], hijriDay: 24, hijriYear: 1420 }, // Jan 1, 2000 -> 24 Ramadan 1420
];

describe('toHijri', () => {
  it('converts known Gregorian reference dates to plausible Hijri parts', () => {
    for (const { gregorian, hijriDay, hijriYear } of REFERENCE_PAIRS) {
      const [y, m, d] = gregorian;
      const result = toHijri(new Date(y, m, d));

      // Guard against a silent fallback to the Gregorian calendar: if
      // ICU doesn't support islamic-umalqura, the year would land near
      // the Gregorian year instead of ~600 years behind it.
      expect(result.year).toBeLessThan(y - 500);
      expect(result.year).toBe(hijriYear);
      expect(result.day).toBe(hijriDay);
      expect(result.monthName.length).toBeGreaterThan(0);
    }
  });

  it('returns a day number within a valid Hijri month range', () => {
    const result = toHijri(new Date(2025, 5, 15));
    expect(result.day).toBeGreaterThanOrEqual(1);
    expect(result.day).toBeLessThanOrEqual(30);
  });
});

describe('getHijriDay', () => {
  it('matches the day returned by toHijri for the same date', () => {
    const date = new Date(2025, 3, 10);
    expect(getHijriDay(date)).toBe(toHijri(date).day);
  });
});

describe('formatHijriMonthHeader', () => {
  it('produces a non-empty label for both locales', () => {
    const en = formatHijriMonthHeader(2025, 0, 'en');
    const fr = formatHijriMonthHeader(2025, 0, 'fr');
    expect(en.length).toBeGreaterThan(0);
    expect(fr.length).toBeGreaterThan(0);
  });

  it('includes a 4-digit Hijri year', () => {
    const header = formatHijriMonthHeader(2025, 0, 'en');
    expect(header).toMatch(/1\d{3}/);
  });
});
