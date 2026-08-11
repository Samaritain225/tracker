/**
 * Tests for pure cycle calculation functions.
 */

import {
  computeCycleLength,
  computeCycleVariance,
  computeFertileWindow,
  computeNextPeriod,
  computeOvulationDay,
  getDayType,
} from './cycle';
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

describe('getDayType priority ordering', () => {
  const periodStarts = ['2025-01-01'];
  const periodDurationDays = 5;
  const ovulationDate = parseISODate('2025-01-15');
  const fertileWindow = computeFertileWindow(ovulationDate);
  const nextPeriodDate = parseISODate('2025-01-29');

  it('returns "period" for a day within a logged period', () => {
    const day = parseISODate('2025-01-03');
    expect(
      getDayType(day, periodStarts, periodDurationDays, fertileWindow, ovulationDate, nextPeriodDate),
    ).toBe('period');
  });

  it('returns "ovulation" on the ovulation day itself', () => {
    expect(
      getDayType(ovulationDate, periodStarts, periodDurationDays, fertileWindow, ovulationDate, nextPeriodDate),
    ).toBe('ovulation');
  });

  it('returns "fertile" for a day in the fertile window that is not ovulation', () => {
    const day = parseISODate('2025-01-13');
    expect(
      getDayType(day, periodStarts, periodDurationDays, fertileWindow, ovulationDate, nextPeriodDate),
    ).toBe('fertile');
  });

  it('returns "predicted" for a day within the predicted next period', () => {
    const day = parseISODate('2025-01-30');
    expect(
      getDayType(day, periodStarts, periodDurationDays, fertileWindow, ovulationDate, nextPeriodDate),
    ).toBe('predicted');
  });

  it('returns "none" for a day matching nothing', () => {
    const day = parseISODate('2025-01-20');
    expect(
      getDayType(day, periodStarts, periodDurationDays, fertileWindow, ovulationDate, nextPeriodDate),
    ).toBe('none');
  });

  it('prioritizes "period" over an overlapping ovulation/fertile day', () => {
    // Construct a case where the ovulation date falls inside a logged period range.
    const overlappingOvulation = parseISODate('2025-01-03');
    const overlappingFertile = computeFertileWindow(overlappingOvulation);
    const day = parseISODate('2025-01-03');
    expect(
      getDayType(day, periodStarts, periodDurationDays, overlappingFertile, overlappingOvulation, nextPeriodDate),
    ).toBe('period');
  });
});
