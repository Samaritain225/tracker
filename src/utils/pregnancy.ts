/**
 * Pregnancy dates and the app's mode. Pure functions, no database or
 * Expo imports, so every rule here is tested directly.
 *
 * Gestational age is counted the medical way: completed weeks plus days
 * ("20 weeks + 3 days"), from the first day of the last period, or from
 * a scan due date minus 280 days when one is entered.
 */

import { addDays, daysBetween, parseISODate, toISODate } from './date';

/** Standard length of a pregnancy, from the first day of the last period. */
export const PREGNANCY_LENGTH_DAYS = 280;
/** Within this many days of a birth, "my period has come back" asks for
 * confirmation: bleeding in the first weeks is usually not a period. */
export const POSTPARTUM_CONFIRM_DAYS = 42;
/** After a pregnancy, this many cycles are labelled "Estimated", because
 * cycles are often irregular for a while. */
export const POST_PREGNANCY_IRREGULAR_CYCLES = 3;

export type PregnancyLike = {
  id: string;
  lastPeriodDate: string;
  scanDueDate: string | null;
  endedOn: string | null;
  outcome: string | null;
};

/** First day of the last period + 280 days. */
export function calculatedDueDate(lastPeriodDate: string): string {
  return toISODate(addDays(parseISODate(lastPeriodDate), PREGNANCY_LENGTH_DAYS));
}

/** The scan due date when one was entered, otherwise the calculated one. */
export function effectiveDueDate(p: Pick<PregnancyLike, 'lastPeriodDate' | 'scanDueDate'>): string {
  return p.scanDueDate ?? calculatedDueDate(p.lastPeriodDate);
}

/**
 * Day 0 of the gestational count. Derived from the effective due date so
 * that a scan which moves the due date moves the week count with it.
 */
export function gestationStartDate(p: Pick<PregnancyLike, 'lastPeriodDate' | 'scanDueDate'>): string {
  return toISODate(addDays(parseISODate(effectiveDueDate(p)), -PREGNANCY_LENGTH_DAYS));
}

export type GestationalAge = {
  /** Completed weeks: 20 for "20 weeks + 3 days". */
  weeks: number;
  /** Days into the current week, 0 to 6. */
  days: number;
  /** Days since gestation start; never negative. */
  totalDays: number;
};

export function gestationalAge(
  p: Pick<PregnancyLike, 'lastPeriodDate' | 'scanDueDate'>,
  todayISO: string,
): GestationalAge {
  const totalDays = Math.max(
    0,
    daysBetween(parseISODate(gestationStartDate(p)), parseISODate(todayISO)),
  );
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7, totalDays };
}

export type Trimester = 1 | 2 | 3;

/** First is 0+0 to 13+6, second 14+0 to 27+6, third 28+0 onwards. */
export function trimesterFor(completedWeeks: number): Trimester {
  if (completedWeeks < 14) return 1;
  if (completedWeeks < 28) return 2;
  return 3;
}

/** Days until the effective due date; negative once it has passed. */
export function daysUntilDue(
  p: Pick<PregnancyLike, 'lastPeriodDate' | 'scanDueDate'>,
  todayISO: string,
): number {
  return daysBetween(parseISODate(todayISO), parseISODate(effectiveDueDate(p)));
}

/** Progress through 40 weeks, 0 to 1, held at 1 once past the due date. */
export function pregnancyProgress(
  p: Pick<PregnancyLike, 'lastPeriodDate' | 'scanDueDate'>,
  todayISO: string,
): number {
  return Math.min(1, gestationalAge(p, todayISO).totalDays / PREGNANCY_LENGTH_DAYS);
}

/** The pregnancy still in progress, or null. The most recent wins if
 * there were ever two, so a stray row can't hide the real one. */
export function findActivePregnancy<T extends PregnancyLike>(list: T[]): T | null {
  let active: T | null = null;
  for (const p of list) {
    if (p.endedOn !== null) continue;
    if (!active || p.lastPeriodDate > active.lastPeriodDate) active = p;
  }
  return active;
}

/** The pregnancy that ended most recently, or null. */
export function findLatestEndedPregnancy<T extends PregnancyLike>(list: T[]): T | null {
  let latest: T | null = null;
  for (const p of list) {
    if (p.endedOn === null) continue;
    if (!latest || p.endedOn > latest.endedOn!) latest = p;
  }
  return latest;
}

export type AppMode<T extends PregnancyLike = PregnancyLike> =
  | { kind: 'cycle' }
  | { kind: 'pregnant'; pregnancy: T }
  | { kind: 'recovery'; pregnancy: T; outcome: 'birth' | 'loss' };

/**
 * Which mode the app is in, derived from data and never stored:
 *
 *  - pregnant: a pregnancy has no end date.
 *  - recovery: the most recent pregnancy has ended (birth or loss) and
 *    no period has been logged after it ended. The latest period on
 *    record is then the one from before the pregnancy, often months
 *    ago, so treating it as an ordinary cycle would show "90 days late"
 *    and the "I'm pregnant" prompt — right after a loss.
 *  - cycle: everything else.
 */
export function resolveMode<T extends PregnancyLike>(
  pregnancyList: T[],
  sortedPeriodStarts: string[],
): AppMode<T> {
  const active = findActivePregnancy(pregnancyList);
  if (active) return { kind: 'pregnant', pregnancy: active };

  const ended = findLatestEndedPregnancy(pregnancyList);
  if (ended) {
    const periodSince = sortedPeriodStarts.some((d) => d > ended.endedOn!);
    if (!periodSince) {
      return {
        kind: 'recovery',
        pregnancy: ended,
        outcome: ended.outcome === 'birth' ? 'birth' : 'loss',
      };
    }
  }

  return { kind: 'cycle' };
}

export type DateSpan = { start: string; end: string };

/**
 * The stretch of time each pregnancy covers, for leaving it out of the
 * average cycle length. An active pregnancy runs to the end of time.
 */
export function pregnancySpans(list: PregnancyLike[]): DateSpan[] {
  return list.map((p) => ({ start: p.lastPeriodDate, end: p.endedOn ?? '9999-12-31' }));
}

/**
 * How many periods have started since the most recent pregnancy ended —
 * the first few cycles after one are labelled "Estimated". Returns null
 * when there has never been an ended pregnancy.
 */
export function periodsSinceLastPregnancy(
  pregnancyList: PregnancyLike[],
  sortedPeriodStarts: string[],
): number | null {
  const ended = findLatestEndedPregnancy(pregnancyList);
  if (!ended) return null;
  return sortedPeriodStarts.filter((d) => d > ended.endedOn!).length;
}
