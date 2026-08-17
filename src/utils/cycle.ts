/**
 * Pure cycle calculation functions.
 * No database access, no side effects.
 * All inputs/outputs use Gregorian ISO strings or plain Date objects.
 */

import {
  FERTILE_DAYS_AFTER_OVULATION,
  FERTILE_DAYS_BEFORE_OVULATION,
  MAX_FLOW_LOG_GAP_DAYS,
  MAX_INFERRED_PERIOD_DAYS,
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
 * mistyped date permanently skewing the average.
 *
 * When nothing is plausible the fallback is deliberately asymmetric,
 * because the two ends of the range fail for different reasons:
 *
 *   - Implausibly *long* gaps are unusual but real — PCOS,
 *     perimenopause, post-partum. Someone with genuine 70-day cycles is
 *     better served by 70 than by the 28-day settings default, so those
 *     are kept as a last-resort signal.
 *   - Implausibly *short* gaps are not a cycle at all. They come from a
 *     period logged twice or a mistyped date, and taking them literally
 *     produced a "2-day average cycle" that reported itself as
 *     calculated, put ovulation before its own period, and filled the
 *     calendar with predictions every other day.
 *
 * Returns null when there is nothing to go on — fewer than 2 dates, or
 * only implausibly short gaps. Callers treat null as "use the fallback".
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
  if (plausible.length > 0) {
    return plausible;
  }

  const long = recent.filter((gap) => gap > MAX_PLAUSIBLE_CYCLE_GAP_DAYS);
  return long.length > 0 ? long : null;
}

/**
 * True when the logged dates carry enough usable signal for
 * computeCycleLength to return a real measurement rather than the
 * settings fallback.
 *
 * Exists so the UI can label the number honestly: a bare
 * `dates.length >= 2` check would call a fallback value "calculated"
 * whenever two dates existed, however implausible the gap between them.
 */
export function hasPlausibleCycleData(sortedPeriodDates: string[]): boolean {
  return recentPlausibleGaps(sortedPeriodDates) !== null;
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

/** Where a resolved period duration came from, so the UI can say whether
 * a number is the user's own answer or the app's best guess. */
export type PeriodDurationSource = 'explicit' | 'logged' | 'default';

export type PeriodDuration = {
  days: number;
  source: PeriodDurationSource;
};

/** The minimum a period record can represent: its start day. */
type PeriodLike = { startDate: string; endDate: string | null };

/**
 * Determines a single period's effective duration in days, instead of
 * assuming every period lasted the settings default. Priority:
 *   1. An explicit `endDate` on the period record — the user's own answer,
 *      which always wins.
 *   2. Daily-log entries with a non-null `flow` running on from the start
 *      date. Spotting counts: `flowLoggedDates` includes every non-null
 *      flow value, which is deliberate — the fiqh rules this feeds treat
 *      coloured discharge during the haid window as part of the period.
 *   3. The settings-configured default duration, when neither is available.
 *
 * The scan tolerates short gaps (MAX_FLOW_LOG_GAP_DAYS) so one forgotten
 * day does not truncate a period, and stops at MAX_INFERRED_PERIOD_DAYS so
 * a stray later entry cannot run it on forever.
 */
export function computePeriodDuration(
  period: PeriodLike,
  flowLoggedDates: Set<string>,
  defaultDurationDays: number,
): PeriodDuration {
  if (period.endDate) {
    const days =
      daysBetween(parseISODate(period.startDate), parseISODate(period.endDate)) + 1;
    // Guard against a malformed record (end before start) rather than
    // returning a zero or negative length that would break rendering.
    return { days: Math.max(1, days), source: 'explicit' };
  }

  const start = parseISODate(period.startDate);
  // Last offset from the start that had a logged flow. -1 means none at all.
  let lastLoggedOffset = -1;

  for (let offset = 0; offset < MAX_INFERRED_PERIOD_DAYS; offset++) {
    if (flowLoggedDates.has(toISODate(addDays(start, offset)))) {
      lastLoggedOffset = offset;
    } else if (offset - lastLoggedOffset > MAX_FLOW_LOG_GAP_DAYS) {
      // The run of unlogged days is now longer than we're willing to
      // bridge, so the period ended at the last logged day.
      break;
    }
  }

  if (lastLoggedOffset < 0) {
    return { days: defaultDurationDays, source: 'default' };
  }
  return { days: lastLoggedOffset + 1, source: 'logged' };
}

/**
 * True while a period should be treated as still bleeding: it is the most
 * recent one, the user has not marked an end, and today is still within
 * the longest run we are willing to infer.
 *
 * Derived rather than stored — an `is_ongoing` column would go stale the
 * moment the app sits unopened for a week.
 */
export function isPeriodOngoing(
  period: PeriodLike,
  todayISO: string,
  maxDays: number = MAX_INFERRED_PERIOD_DAYS,
): boolean {
  if (period.endDate) {
    return false;
  }
  const elapsed = daysBetween(parseISODate(period.startDate), parseISODate(todayISO));
  return elapsed >= 0 && elapsed < maxDays;
}

/**
 * The period a given day belongs to, or null if it belongs to none.
 *
 * A confirmed `endDate` is the user's own answer about where the period
 * stopped, so it bounds the period exactly: a day after it belongs to no
 * period, even though it may still fall inside the window the flow-log
 * scan would have been willing to infer. Without that check, opening a
 * day two weeks after a period whose end was already confirmed offered a
 * "period ended" switch still bound to it, and flipping that switch
 * silently rewrote the confirmed answer to the later date — turning a
 * four-day period into a twelve-day one in every average that reads it.
 *
 * Only periods without a confirmed end fall back to
 * MAX_INFERRED_PERIOD_DAYS, matching computePeriodDuration's ladder.
 *
 * Ties go to the most recent start, so a day inside two overlapping
 * windows attaches to the period that actually began nearer to it.
 */
export function findPeriodCovering<T extends PeriodLike>(
  list: T[],
  date: string,
): T | null {
  let best: T | null = null;

  for (const p of list) {
    if (p.startDate > date) continue;

    if (p.endDate) {
      if (date > p.endDate) continue;
    } else {
      const elapsed = daysBetween(parseISODate(p.startDate), parseISODate(date));
      if (elapsed >= MAX_INFERRED_PERIOD_DAYS) continue;
    }

    if (!best || p.startDate > best.startDate) {
      best = p;
    }
  }

  return best;
}

/**
 * Average period length across logged periods, as the single source of
 * truth for the Insights figure. Uses the same resolution ladder as the
 * calendar, so confirming an end date actually moves the number the user
 * sees. Periods still in progress are excluded — their length isn't known
 * yet, and counting a day-2 period would drag the average down.
 *
 * Returns null when there is nothing meaningful to average.
 */
export function computeAveragePeriodLength(
  periods: PeriodLike[],
  flowLoggedDates: Set<string>,
  defaultDurationDays: number,
  todayISO: string,
): number | null {
  const settled = periods.filter((p) => !isPeriodOngoing(p, todayISO));
  if (settled.length === 0) {
    return null;
  }

  const lengths = settled
    .map((p) => computePeriodDuration(p, flowLoggedDates, defaultDurationDays))
    // A defaulted length is just the setting echoed back; averaging it in
    // would report the user's own default to them as if it were a finding.
    .filter((d) => d.source !== 'default')
    .map((d) => d.days);

  if (lengths.length === 0) {
    return null;
  }
  return Math.round(lengths.reduce((sum, n) => sum + n, 0) / lengths.length);
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
    const end = toISODate(addDays(parseISODate(period.startDate), duration.days - 1));

    // Use the real gap to the next logged period when there is one —
    // that historical cycle's ovulation estimate is then based on what
    // actually happened, not the current best-guess average. The most
    // recent (still "open") cycle has no next period yet, so it falls
    // back to the average like a prediction would.
    //
    // Implausible gaps fall back too, using the same bounds
    // computeCycleLength applies to the average. Without this, two
    // starts logged five days apart — a mistyped date, or a period
    // entered twice — put ovulation at `start + 5 - 14`, i.e. nine days
    // *before* its own period, dragging the fertile window into the
    // previous cycle.
    const next = sortedPeriods[i + 1];
    const realGap = next
      ? daysBetween(parseISODate(period.startDate), parseISODate(next.startDate))
      : null;
    const cycleLengthForThisWindow =
      realGap !== null &&
      realGap >= MIN_PLAUSIBLE_CYCLE_GAP_DAYS &&
      realGap <= MAX_PLAUSIBLE_CYCLE_GAP_DAYS
        ? realGap
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
