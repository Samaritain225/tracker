/**
 * Pure cycle calculation functions.
 * No database access, no side effects.
 * All inputs/outputs use Gregorian ISO strings or plain Date objects.
 */

import {
  FERTILE_DAYS_AFTER_OVULATION,
  FERTILE_DAYS_BEFORE_OVULATION,
  MAX_PLAUSIBLE_CYCLE_GAP_DAYS,
  MIN_PLAUSIBLE_CYCLE_GAP_DAYS,
  OVULATION_OFFSET_FROM_END,
  RECENT_CYCLE_WINDOW,
} from '@/constants/cycle';
import { addDays, daysBetween, parseISODate, toISODate } from './date';

export type DayType = 'period' | 'ovulation' | 'fertile' | 'predicted' | 'none';

/**
 * Computes the average cycle length from sorted period start dates,
 * as the median of the most recent gaps. Returns the fallback value if
 * fewer than 2 dates are available.
 *
 * This is the single source of truth for "average cycle length" —
 * both the Home prediction and the Insights screen call this (and
 * computeCycleVariance below) so the two screens never disagree.
 */
export function computeCycleLength(
  sortedPeriodDates: string[],
  fallback: number,
): number {
  const gaps = recentPlausibleGaps(sortedPeriodDates);
  if (gaps === null) {
    return fallback;
  }
  return median(gaps);
}

/**
 * Computes the typical variance (mean absolute deviation from the
 * median) across the same recent gaps computeCycleLength uses. Returns
 * null if fewer than 2 dates are available.
 */
export function computeCycleVariance(sortedPeriodDates: string[]): number | null {
  const gaps = recentPlausibleGaps(sortedPeriodDates);
  if (gaps === null) {
    return null;
  }
  return meanAbsoluteDeviation(gaps, median(gaps));
}

/**
 * Returns the gaps (in days) between the most recent RECENT_CYCLE_WINDOW
 * consecutive period start dates, preferring only "plausible" gaps
 * (within MIN/MAX_PLAUSIBLE_CYCLE_GAP_DAYS) as a guard against a single
 * mistyped date permanently skewing the average. If every recent gap
 * falls outside that range — e.g. a genuinely very irregular cycle — the
 * unfiltered set is used rather than discarding the signal entirely.
 * Returns null when fewer than 2 dates are available.
 */
function recentPlausibleGaps(sortedPeriodDates: string[]): number[] | null {
  if (sortedPeriodDates.length < 2) {
    return null;
  }

  const allGaps: number[] = [];
  for (let i = 0; i < sortedPeriodDates.length - 1; i++) {
    const a = parseISODate(sortedPeriodDates[i]);
    const b = parseISODate(sortedPeriodDates[i + 1]);
    allGaps.push(daysBetween(a, b));
  }

  const recent = allGaps.slice(-RECENT_CYCLE_WINDOW);
  const plausible = recent.filter(
    (gap) => gap >= MIN_PLAUSIBLE_CYCLE_GAP_DAYS && gap <= MAX_PLAUSIBLE_CYCLE_GAP_DAYS,
  );

  return plausible.length > 0 ? plausible : recent;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function meanAbsoluteDeviation(values: number[], center: number): number {
  const deviation = values.reduce((sum, v) => sum + Math.abs(v - center), 0) / values.length;
  return Math.round(deviation);
}

/**
 * Computes the predicted next period start date.
 */
export function computeNextPeriod(
  lastPeriodDate: string,
  cycleLength: number,
): Date {
  return addDays(parseISODate(lastPeriodDate), cycleLength);
}

/**
 * Computes the estimated ovulation day (Knaus-Ogino method).
 * Ovulation = last period + (cycle length - 14 days).
 */
export function computeOvulationDay(
  lastPeriodDate: string,
  cycleLength: number,
): Date {
  return addDays(parseISODate(lastPeriodDate), cycleLength - OVULATION_OFFSET_FROM_END);
}

/**
 * Computes the fertile window around the ovulation date.
 * Start = ovulation - 5 days, End = ovulation + 1 day.
 */
export function computeFertileWindow(
  ovulationDate: Date,
): { start: Date; end: Date } {
  return {
    start: addDays(ovulationDate, -FERTILE_DAYS_BEFORE_OVULATION),
    end: addDays(ovulationDate, FERTILE_DAYS_AFTER_OVULATION),
  };
}

/**
 * Determines a single period's effective duration in days, instead of
 * assuming every period lasted the settings default. Priority:
 *   1. An explicit `endDate` on the period record (a user override).
 *   2. Consecutive daily-log entries with a non-null `flow`, starting
 *      at the period's start date — the real signal the app already
 *      collects but previously never used for calendar rendering.
 *   3. The settings-configured default duration, when neither of the
 *      above is available.
 */
export function computePeriodDuration(
  period: { startDate: string; endDate: string | null },
  flowLoggedDates: Set<string>,
  defaultDurationDays: number,
): number {
  if (period.endDate) {
    return daysBetween(parseISODate(period.startDate), parseISODate(period.endDate)) + 1;
  }

  let days = 0;
  let cursor = parseISODate(period.startDate);
  while (flowLoggedDates.has(toISODate(cursor))) {
    days++;
    cursor = addDays(cursor, 1);
  }

  return days > 0 ? days : defaultDurationDays;
}

/**
 * One menstrual cycle's worth of dates — either a logged historical
 * cycle or a projected future one. All dates are ISO strings so
 * comparisons in getDayType stay simple string comparisons.
 */
export type CycleWindow = {
  /** Period start date. Always a real logged date, even for the
   * "current, in-progress" cycle — only future cycles project this. */
  start: string;
  /** Period end date (start + effective duration - 1). */
  end: string;
  ovulation: string;
  fertileStart: string;
  fertileEnd: string;
  /** False for a cycle whose period was actually logged (even if its
   * ovulation/fertile window is still an estimate); true for a cycle
   * projected entirely from the average cycle length. */
  isPrediction: boolean;
};

/** How far forward to project future cycles, in days (~1 year). */
const PROJECTION_HORIZON_DAYS = 370;
/** Hard cap on projected cycles regardless of cycle length, as a
 * defensive bound rather than a realistic expectation. */
const MAX_PROJECTED_CYCLES = 24;

/**
 * Builds the full series of cycle windows: one per logged period
 * (using each period's own gap to the next logged period where known,
 * so historical ovulation estimates use the real cycle length rather
 * than today's average), followed by projected future cycles spaced by
 * the average cycle length, far enough out to cover roughly a year.
 *
 * Returns an empty array when no periods are logged — there's nothing
 * to build a series from.
 */
export function buildCycleWindows(
  sortedPeriods: { startDate: string; endDate: string | null }[],
  flowLoggedDates: Set<string>,
  averageCycleLength: number,
  defaultPeriodDurationDays: number,
): CycleWindow[] {
  if (sortedPeriods.length === 0) {
    return [];
  }

  const windows: CycleWindow[] = [];

  for (let i = 0; i < sortedPeriods.length; i++) {
    const period = sortedPeriods[i];
    const duration = computePeriodDuration(period, flowLoggedDates, defaultPeriodDurationDays);
    const end = toISODate(addDays(parseISODate(period.startDate), duration - 1));

    // Use the real gap to the next logged period when there is one —
    // that historical cycle's ovulation estimate is then based on what
    // actually happened, not the current best-guess average. The most
    // recent (still "open") cycle has no next period yet, so it falls
    // back to the average like a prediction would.
    const next = sortedPeriods[i + 1];
    const cycleLengthForThisWindow = next
      ? daysBetween(parseISODate(period.startDate), parseISODate(next.startDate))
      : averageCycleLength;

    const ovulationDate = computeOvulationDay(period.startDate, cycleLengthForThisWindow);
    const fertile = computeFertileWindow(ovulationDate);

    windows.push({
      start: period.startDate,
      end,
      ovulation: toISODate(ovulationDate),
      fertileStart: toISODate(fertile.start),
      fertileEnd: toISODate(fertile.end),
      isPrediction: false,
    });
  }

  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
  const projectionCount = Math.min(
    MAX_PROJECTED_CYCLES,
    Math.max(1, Math.ceil(PROJECTION_HORIZON_DAYS / Math.max(averageCycleLength, 1))),
  );

  let cursor = parseISODate(lastPeriod.startDate);
  for (let i = 0; i < projectionCount; i++) {
    cursor = addDays(cursor, averageCycleLength);
    const startISO = toISODate(cursor);
    const end = toISODate(addDays(cursor, defaultPeriodDurationDays - 1));
    const ovulationDate = computeOvulationDay(startISO, averageCycleLength);
    const fertile = computeFertileWindow(ovulationDate);

    windows.push({
      start: startISO,
      end,
      ovulation: toISODate(ovulationDate),
      fertileStart: toISODate(fertile.start),
      fertileEnd: toISODate(fertile.end),
      isPrediction: true,
    });
  }

  return windows;
}

/**
 * Determines the display type for a given calendar date against the
 * full cycle series, not just the current month's prediction — so
 * navigating the calendar forward or backward still shows fertile
 * windows and predictions instead of going blank.
 * Priority: period > ovulation > fertile > predicted > none.
 */
export function getDayType(date: Date, cycles: CycleWindow[]): DayType {
  const dateIso = toISODate(date);

  for (const cycle of cycles) {
    if (!cycle.isPrediction && dateIso >= cycle.start && dateIso <= cycle.end) {
      return 'period';
    }
  }

  for (const cycle of cycles) {
    if (dateIso === cycle.ovulation) {
      return 'ovulation';
    }
  }

  for (const cycle of cycles) {
    if (dateIso >= cycle.fertileStart && dateIso <= cycle.fertileEnd) {
      return 'fertile';
    }
  }

  for (const cycle of cycles) {
    if (cycle.isPrediction && dateIso >= cycle.start && dateIso <= cycle.end) {
      return 'predicted';
    }
  }

  return 'none';
}
