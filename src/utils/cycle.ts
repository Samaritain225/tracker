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
import { addDays, daysBetween, isSameDay, parseISODate, toISODate } from './date';

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
 * Determines the display type for a given calendar date.
 * Priority: period > ovulation > fertile > predicted > none.
 */
export function getDayType(
  date: Date,
  periodStartDates: string[],
  periodDurationDays: number,
  fertileWindow: { start: Date; end: Date },
  ovulationDate: Date,
  nextPeriodDate: Date,
): DayType {
  const dateIso = toISODate(date);

  // Check if date falls within any logged period range
  for (const startStr of periodStartDates) {
    const periodStart = parseISODate(startStr);
    const periodEnd = addDays(periodStart, periodDurationDays - 1);
    if (date >= periodStart && date <= periodEnd) {
      return 'period';
    }
  }

  // Check ovulation
  if (isSameDay(date, ovulationDate)) {
    return 'ovulation';
  }

  // Check fertile window
  if (date >= fertileWindow.start && date <= fertileWindow.end) {
    return 'fertile';
  }

  // Check predicted period (next period start + duration)
  const predictedEnd = addDays(nextPeriodDate, periodDurationDays - 1);
  if (date >= nextPeriodDate && date <= predictedEnd) {
    return 'predicted';
  }

  return 'none';
}
