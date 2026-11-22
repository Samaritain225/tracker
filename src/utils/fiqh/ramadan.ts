/**
 * Ramadan dates and the suggested count of fasts to make up. Pure apart
 * from the calendar conversion, which uses the same Umm al-Qura calendar
 * the app already shows (Intl's islamic-umalqura).
 *
 * The real start of Ramadan follows the local moon sighting and can
 * differ from this calendar by a day or two, so the count is only ever
 * a suggestion she can change.
 */

import { addDays, parseISODate, toISODate } from '../date';
import { bleedingDates } from './bleeding';

export type RamadanRange = { hijriYear: number; start: string; end: string };

// Built once: creating a formatter per day made scanning years of
// history slow on a phone.
let formatter: Intl.DateTimeFormat | null = null;
function hijriMonthYear(date: Date): { month: number; year: number } {
  formatter ??= new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    month: 'numeric',
    year: 'numeric',
  });
  let month = 0;
  let year = 0;
  for (const part of formatter.formatToParts(date)) {
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'year') year = parseInt(part.value, 10);
  }
  return { month, year };
}

/**
 * Every Ramadan (Hijri month 9) that overlaps the span between two
 * dates, each in full even when the span starts or ends inside it.
 */
export function ramadanRanges(fromISO: string, toISO: string): RamadanRange[] {
  const ranges: RamadanRange[] = [];
  // Start a month early so a Ramadan already under way is caught whole.
  let day = addDays(parseISODate(fromISO), -31);
  const stop = addDays(parseISODate(toISO), 31);
  while (day <= stop) {
    const { month, year } = hijriMonthYear(day);
    if (month === 9) {
      const iso = toISODate(day);
      const last = ranges[ranges.length - 1];
      if (last && last.hijriYear === year) last.end = iso;
      else ranges.push({ hijriYear: year, start: iso, end: iso });
    }
    day = addDays(day, 1);
  }
  return ranges.filter((r) => r.end >= fromISO && r.start <= toISO);
}

type PeriodLike = { startDate: string; endDate: string | null };
type PregnancyLike = { lastPeriodDate: string; endedOn: string | null; outcome: string | null };

/**
 * Days she bled that count toward the suggestion: periods and logged
 * flow, but not bleeding during a pregnancy (left out by bleedingDates)
 * and not the bleeding after a loss, up to her next period. Whether
 * either counted as haid or nifas is the verdict this option doesn't
 * give; she can raise the number herself.
 */
export function missedFastBleedingDates(
  periods: PeriodLike[],
  flowDates: Set<string>,
  defaultDurationDays: number,
  pregnancies: PregnancyLike[],
): Set<string> {
  const dates = bleedingDates(periods, flowDates, defaultDurationDays, pregnancies);
  for (const p of pregnancies) {
    if (p.outcome !== 'loss' || !p.endedOn) continue;
    const nextPeriod = periods.map((x) => x.startDate).filter((d) => d > p.endedOn!).sort()[0];
    for (const d of [...dates]) {
      if (d > p.endedOn && (!nextPeriod || d < nextPeriod)) dates.delete(d);
    }
  }
  return dates;
}

/** The Ramadan days, up to today, that fell on bleeding days. */
export function suggestedMissedFasts(range: RamadanRange, bleeding: Set<string>, todayISO: string): string[] {
  const missed: string[] = [];
  for (let d = parseISODate(range.start); toISODate(d) <= range.end; d = addDays(d, 1)) {
    const iso = toISODate(d);
    if (iso > todayISO) break;
    if (bleeding.has(iso)) missed.push(iso);
  }
  return missed;
}
