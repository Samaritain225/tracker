/**
 * Pure cycle calculation functions.
 * No database access, no side effects.
 * All inputs/outputs use Gregorian ISO strings or plain Date objects.
 */

import {
  FERTILE_DAYS_AFTER_OVULATION,
  FERTILE_DAYS_BEFORE_OVULATION,
  OVULATION_OFFSET_FROM_END,
} from '@/constants/cycle';
import { addDays, daysBetween, isSameDay, parseISODate, toISODate } from './date';

export type DayType = 'period' | 'ovulation' | 'fertile' | 'predicted' | 'none';

/**
 * Computes the average cycle length from sorted period start dates.
 * Returns the fallback value if fewer than 2 dates are available.
 */
export function computeCycleLength(
  sortedPeriodDates: string[],
  fallback: number,
): number {
  if (sortedPeriodDates.length < 2) {
    return fallback;
  }

  let totalGaps = 0;
  const gapCount = sortedPeriodDates.length - 1;

  for (let i = 0; i < gapCount; i++) {
    const a = parseISODate(sortedPeriodDates[i]);
    const b = parseISODate(sortedPeriodDates[i + 1]);
    totalGaps += daysBetween(a, b);
  }

  return Math.round(totalGaps / gapCount);
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
