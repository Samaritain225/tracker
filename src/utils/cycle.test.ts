/**
 * Tests for pure cycle calculation functions.
 */

import {
  computeCycleLength,
  computeCycleVariance,
  computeFertileWindow,
  computeNextPeriod,
  computeOvulationDay,
  computePeriodDuration,
  getDayType,
} from './cycle';
import type { PeriodRange } from './cycle';
import { addDays, parseISODate, toISODate } from './date';

/**
 * Builds a sorted list of ISO period start dates from a starting date
 * and a sequence of gaps (in days) between consecutive periods.
 */
function datesFromGaps(start: string, gaps: number[]): string[] {
  const dates = [start];
  let current = parseISODate(start);
  for (const gap of gaps) {
    current = addDays(current, gap);
    dates.push(toISODate(current));
  }
  return dates;
}

describe('computeCycleLength', () => {
  it('returns the fallback when there are 0 dates', () => {
    expect(computeCycleLength([], 28)).toBe(28);
  });

  it('returns the fallback when there is only 1 date', () => {
    expect(computeCycleLength(['2025-01-01'], 30)).toBe(30);
  });

  it('uses the single gap for 2 dates', () => {
    expect(computeCycleLength(['2025-01-01', '2025-01-29'], 28)).toBe(28);
  });

  it('takes the median of multiple gaps', () => {
    // Gaps: 28, 30, 27 -> sorted [27, 28, 30] -> median 28
    const dates = datesFromGaps('2025-01-01', [28, 30, 27]);
    expect(computeCycleLength(dates, 28)).toBe(28);
  });

  it('averages the two middle gaps for an even-length window', () => {
    // Gaps: 26, 28, 30, 32 -> sorted [26,28,30,32] -> median (28+30)/2 = 29
    const dates = datesFromGaps('2025-01-01', [26, 28, 30, 32]);
    expect(computeCycleLength(dates, 28)).toBe(29);
  });

  it('assumes the input is already sorted ascending', () => {
    const dates = ['2025-01-01', '2025-01-31'];
    expect(computeCycleLength(dates, 28)).toBe(30);
  });

  it('only considers the most recent 6 gaps (RECENT_CYCLE_WINDOW)', () => {
    // 7 gaps: one very old outlier (90) that would skew the median if
    // included, followed by 6 consistent 28-day gaps.
    const dates = datesFromGaps('2025-01-01', [90, 28, 28, 28, 28, 28, 28]);
    expect(computeCycleLength(dates, 28)).toBe(28);
  });

  it('is far more robust to a single mistyped date than a plain mean would be', () => {
    // One wildly wrong gap (3 days) among five normal ones. A mean
    // would drop the estimate to ~24; the median stays at 28.
    const dates = datesFromGaps('2025-01-01', [28, 28, 3, 28, 28, 28]);
    expect(computeCycleLength(dates, 28)).toBe(28);
  });

  it('falls back to the unfiltered gaps when every recent gap is implausible', () => {
    // Every gap here is outside [15, 60], so nothing passes the
    // plausibility filter — the median of the raw gaps is used instead
    // of silently discarding all the data.
    const dates = datesFromGaps('2025-01-01', [70, 75, 65]);
    expect(computeCycleLength(dates, 28)).toBe(70);
  });
});

describe('computeCycleVariance', () => {
  it('returns null when fewer than 2 dates are available', () => {
    expect(computeCycleVariance([])).toBeNull();
    expect(computeCycleVariance(['2025-01-01'])).toBeNull();
  });

  it('returns 0 for perfectly consistent gaps', () => {
    const dates = datesFromGaps('2025-01-01', [28, 28, 28]);
    expect(computeCycleVariance(dates)).toBe(0);
  });

  it('returns the mean absolute deviation from the median', () => {
    // Gaps: 26, 28, 30 -> median 28 -> deviations 2, 0, 2 -> mean 1.33 -> rounds to 1
    const dates = datesFromGaps('2025-01-01', [26, 28, 30]);
    expect(computeCycleVariance(dates)).toBe(1);
  });
});

describe('computeNextPeriod / computeOvulationDay', () => {
  it('computeNextPeriod adds the cycle length to the last period date', () => {
    const next = computeNextPeriod('2025-01-01', 28);
    expect(toISODate(next)).toBe('2025-01-29');
  });

  it('computeOvulationDay is cycle length minus 14 days after the last period', () => {
    const ovulation = computeOvulationDay('2025-01-01', 28);
    expect(toISODate(ovulation)).toBe('2025-01-15'); // day 14 -> Jan 1 + 14
  });

  it('computeOvulationDay shifts earlier for a shorter cycle', () => {
    const ovulation = computeOvulationDay('2025-01-01', 21);
    expect(toISODate(ovulation)).toBe('2025-01-08'); // 21 - 14 = 7
  });
});

describe('computeFertileWindow', () => {
  it('spans 3 days before and 4 days after ovulation', () => {
    const ovulation = parseISODate('2025-01-15');
    const window = computeFertileWindow(ovulation);
    expect(toISODate(window.start)).toBe('2025-01-12');
    expect(toISODate(window.end)).toBe('2025-01-19');
  });
});

describe('computePeriodDuration', () => {
  const defaultDurationDays = 5;

  it('uses the explicit endDate when set, overriding everything else', () => {
    const period = { startDate: '2025-01-01', endDate: '2025-01-04' };
    // Even with flow logged for a different, longer span, endDate wins.
    const flowLoggedDates = new Set(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays)).toBe(4);
  });

  it('derives duration from consecutive flow-logged days when no endDate is set', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    const flowLoggedDates = new Set(['2025-01-01', '2025-01-02', '2025-01-03']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays)).toBe(3);
  });

  it('stops at the first gap in flow-logged days', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    // 01 and 02 logged, 03 skipped, 04 logged — duration stops at the gap.
    const flowLoggedDates = new Set(['2025-01-01', '2025-01-02', '2025-01-04']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays)).toBe(2);
  });

  it('falls back to the default when neither endDate nor flow logs are available', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    expect(computePeriodDuration(period, new Set(), defaultDurationDays)).toBe(defaultDurationDays);
  });

  it('falls back to the default when the start date itself has no flow logged', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    // Flow logged starting the day after — doesn't count since it
    // doesn't begin at the period's start date.
    const flowLoggedDates = new Set(['2025-01-02', '2025-01-03']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays)).toBe(defaultDurationDays);
  });
});

describe('getDayType priority ordering', () => {
  const periodRanges: PeriodRange[] = [{ startDate: '2025-01-01', durationDays: 5 }];
  const nextPeriodDurationDays = 5;
  const ovulationDate = parseISODate('2025-01-15');
  const fertileWindow = computeFertileWindow(ovulationDate);
  const nextPeriodDate = parseISODate('2025-01-29');

  it('returns "period" for a day within a logged period', () => {
    const day = parseISODate('2025-01-03');
    expect(
      getDayType(day, periodRanges, fertileWindow, ovulationDate, nextPeriodDate, nextPeriodDurationDays),
    ).toBe('period');
  });

  it('returns "ovulation" on the ovulation day itself', () => {
    expect(
      getDayType(ovulationDate, periodRanges, fertileWindow, ovulationDate, nextPeriodDate, nextPeriodDurationDays),
    ).toBe('ovulation');
  });

  it('returns "fertile" for a day in the fertile window that is not ovulation', () => {
    const day = parseISODate('2025-01-13');
    expect(
      getDayType(day, periodRanges, fertileWindow, ovulationDate, nextPeriodDate, nextPeriodDurationDays),
    ).toBe('fertile');
  });

  it('returns "predicted" for a day within the predicted next period', () => {
    const day = parseISODate('2025-01-30');
    expect(
      getDayType(day, periodRanges, fertileWindow, ovulationDate, nextPeriodDate, nextPeriodDurationDays),
    ).toBe('predicted');
  });

  it('returns "none" for a day matching nothing', () => {
    const day = parseISODate('2025-01-20');
    expect(
      getDayType(day, periodRanges, fertileWindow, ovulationDate, nextPeriodDate, nextPeriodDurationDays),
    ).toBe('none');
  });

  it('prioritizes "period" over an overlapping ovulation/fertile day', () => {
    // Construct a case where the ovulation date falls inside a logged period range.
    const overlappingOvulation = parseISODate('2025-01-03');
    const overlappingFertile = computeFertileWindow(overlappingOvulation);
    const day = parseISODate('2025-01-03');
    expect(
      getDayType(day, periodRanges, overlappingFertile, overlappingOvulation, nextPeriodDate, nextPeriodDurationDays),
    ).toBe('period');
  });

  it('respects each period range\'s own duration rather than a single global length', () => {
    // A short 2-day period followed by a longer 7-day one — each
    // should paint as its own length, not a shared default.
    const ranges: PeriodRange[] = [
      { startDate: '2025-01-01', durationDays: 2 },
      { startDate: '2025-02-01', durationDays: 7 },
    ];
    const day3OfFirstPeriod = parseISODate('2025-01-03'); // past the 2-day range
    const day6OfSecondPeriod = parseISODate('2025-02-06'); // within the 7-day range

    expect(
      getDayType(day3OfFirstPeriod, ranges, fertileWindow, ovulationDate, nextPeriodDate, nextPeriodDurationDays),
    ).not.toBe('period');
    expect(
      getDayType(day6OfSecondPeriod, ranges, fertileWindow, ovulationDate, nextPeriodDate, nextPeriodDurationDays),
    ).toBe('period');
  });
});
