/**
 * Counting bleeding and purity from her own logs, and choosing which
 * neutral reference applies. Pure functions; nothing here is a ruling.
 *
 * A period's days are the ones the calendar already draws for it
 * (computePeriodDuration: confirmed end, else logged flow, else the
 * settings default), not the 15-day window the day sheet uses to decide
 * which period a day belongs to. A period never marked as ended would
 * otherwise count as 15 days of bleeding, and the counts here would
 * disagree with the calendar she is looking at.
 */

import { computePeriodDuration } from '../cycle';
import { addDays, daysBetween, parseISODate, toISODate } from '../date';
import type { ReferenceNote, SchoolRules } from './types';

type PeriodLike = { startDate: string; endDate: string | null };
type PregnancyLike = {
  lastPeriodDate: string;
  endedOn: string | null;
  outcome: string | null;
};

export type BleedingRun = { start: string; end: string };

/** Whether a date falls inside a pregnancy (after its last period, up to its end). */
function inPregnancy(date: string, pregnancies: PregnancyLike[]): boolean {
  return pregnancies.some((p) => date > p.lastPeriodDate && (p.endedOn === null || date <= p.endedOn));
}

/**
 * Every day she bled, as far as her logs show: each period's days as
 * the calendar draws them, plus any day with flow logged. Days inside a
 * pregnancy are left out — whether that bleeding counts as haid is a
 * question this option doesn't answer.
 */
export function bleedingDates(
  periods: PeriodLike[],
  flowDates: Set<string>,
  defaultDurationDays: number,
  pregnancies: PregnancyLike[] = [],
): Set<string> {
  const days = new Set<string>();
  for (const period of periods) {
    const { days: length } = computePeriodDuration(period, flowDates, defaultDurationDays);
    for (let i = 0; i < length; i++) {
      days.add(toISODate(addDays(parseISODate(period.startDate), i)));
    }
  }
  for (const date of flowDates) days.add(date);
  for (const date of [...days]) if (inPregnancy(date, pregnancies)) days.delete(date);
  return days;
}

/**
 * Groups bleeding days into runs, bridging a single day with nothing
 * logged — the same "forgot to log yesterday" tolerance the cycle maths
 * uses — so one missed entry doesn't split a run in two.
 */
export function bleedingRuns(dates: Set<string>): BleedingRun[] {
  const sorted = [...dates].sort();
  const runs: BleedingRun[] = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && daysBetween(parseISODate(last.end), parseISODate(date)) <= 2) {
      last.end = date;
    } else {
      runs.push({ start: date, end: date });
    }
  }
  return runs;
}

/** Whole days of purity between two runs, or null for the first run. */
export function purityBefore(run: BleedingRun, runs: BleedingRun[]): number | null {
  const previous = runs.filter((r) => r.end < run.start).pop();
  if (!previous) return null;
  return daysBetween(parseISODate(previous.end), parseISODate(run.start)) - 1;
}

/** How many days after a bleeding run the card keeps showing the purity count. */
export const PURITY_SHOWN_FOR_DAYS = 15;

export type IslamicStatus =
  /** The option is off, or there is nothing to say (including after a loss). */
  | { kind: 'none' }
  /** Bleeding today, outside a pregnancy and any nifas window. */
  | { kind: 'bleeding'; day: number; notes: ReferenceNote[] }
  /** No bleeding today; days since the last run ended. */
  | { kind: 'purity'; days: number }
  /** Within the window after a birth, or bleeding that began in it. */
  | { kind: 'nifas'; daysSinceBirth: number; bleedingToday: boolean; notes: ReferenceNote[] }
  /** Bleeding logged today during a pregnancy: quote, never count. */
  | { kind: 'pregnancy_bleeding' };

type StatusInput = {
  rules: SchoolRules | null;
  mode: 'cycle' | 'pregnant' | 'recovery';
  recoveryOutcome?: 'birth' | 'loss';
  periods: PeriodLike[];
  flowDates: Set<string>;
  defaultDurationDays: number;
  pregnancies: PregnancyLike[];
  todayISO: string;
};

/**
 * What the Islamic card may say today. Ordered so the most specific
 * situation wins: pregnancy, then a loss (nothing at all), then the
 * window after a birth, then ordinary bleeding or purity.
 */
export function islamicStatus(input: StatusInput): IslamicStatus {
  const { rules, mode, periods, flowDates, pregnancies, todayISO } = input;
  if (!rules) return { kind: 'none' };

  if (mode === 'pregnant') {
    return flowDates.has(todayISO) ? { kind: 'pregnancy_bleeding' } : { kind: 'none' };
  }
  if (mode === 'recovery' && input.recoveryOutcome === 'loss') {
    return { kind: 'none' };
  }

  const dates = bleedingDates(periods, flowDates, input.defaultDurationDays, pregnancies);
  const runs = bleedingRuns(dates);
  const bleedingToday = dates.has(todayISO);
  const currentRun = bleedingToday ? runs.find((r) => r.start <= todayISO && r.end >= todayISO) : undefined;

  // The most recent birth, if its nifas window still governs today: in
  // recovery, always; in cycle mode, while the bleeding happening now
  // began within the window.
  const birth = pregnancies
    .filter((p) => p.outcome === 'birth' && p.endedOn !== null && p.endedOn <= todayISO)
    .sort((a, b) => b.endedOn!.localeCompare(a.endedOn!))[0];
  if (birth) {
    const daysSinceBirth = daysBetween(parseISODate(birth.endedOn!), parseISODate(todayISO));
    const runBeganInWindow =
      currentRun !== undefined &&
      daysBetween(parseISODate(birth.endedOn!), parseISODate(currentRun.start)) <= rules.nifasMaxDays;
    if (mode === 'recovery' || runBeganInWindow) {
      const notes: ReferenceNote[] =
        bleedingToday && daysSinceBirth > rules.nifasMaxDays ? ['beyond_nifas_max'] : [];
      return { kind: 'nifas', daysSinceBirth, bleedingToday, notes };
    }
  }

  if (currentRun) {
    const day = daysBetween(parseISODate(currentRun.start), parseISODate(todayISO)) + 1;
    const notes: ReferenceNote[] = [];
    if (day > rules.haidMaxDays) notes.push('beyond_haid_max');
    const purity = purityBefore(currentRun, runs);
    if (purity !== null && purity < rules.purityMinDays) notes.push('short_purity');
    return { kind: 'bleeding', day, notes };
  }

  const lastRun = runs.filter((r) => r.end < todayISO).pop();
  if (lastRun) {
    const days = daysBetween(parseISODate(lastRun.end), parseISODate(todayISO));
    if (days <= PURITY_SHOWN_FOR_DAYS) return { kind: 'purity', days };
  }
  return { kind: 'none' };
}
