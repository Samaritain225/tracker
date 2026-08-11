/**
 * Tests for pure cycle calculation functions.
 */

import {
  buildCycleWindows,
  computeCycleLength,
  computeCycleVariance,
  computeFertileWindow,
  computeNextPeriod,
  computeOvulationDay,
  computePeriodDuration,
  getDayType,
} from './cycle';
import type { CycleWindow } from './cycle';
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
  // A logged period (01-01 to 01-05) whose cycle is expected to ovulate
  // on 01-15, plus a predicted next period (01-29 to 02-02) with its
  // own, deliberately non-overlapping, ovulation/fertile estimate.
  const cycles: CycleWindow[] = [
    {
      start: '2025-01-01',
      end: '2025-01-05',
      ovulation: '2025-01-15',
      fertileStart: '2025-01-12',
      fertileEnd: '2025-01-19',
      isPrediction: false,
    },
    {
      start: '2025-01-29',
      end: '2025-02-02',
      ovulation: '2025-02-12',
      fertileStart: '2025-02-09',
      fertileEnd: '2025-02-16',
      isPrediction: true,
    },
  ];

  it('returns "period" for a day within a logged period', () => {
    const day = parseISODate('2025-01-03');
    expect(getDayType(day, cycles)).toBe('period');
  });

  it('returns "ovulation" on the ovulation day itself', () => {
    const day = parseISODate('2025-01-15');
    expect(getDayType(day, cycles)).toBe('ovulation');
  });

  it('returns "fertile" for a day in the fertile window that is not ovulation', () => {
    const day = parseISODate('2025-01-13');
    expect(getDayType(day, cycles)).toBe('fertile');
  });

  it('returns "predicted" for a day within a predicted (not-yet-logged) period', () => {
    const day = parseISODate('2025-01-30');
    expect(getDayType(day, cycles)).toBe('predicted');
  });

  it('returns "none" for a day matching nothing', () => {
    const day = parseISODate('2025-01-20');
    expect(getDayType(day, cycles)).toBe('none');
  });

  it('prioritizes "period" over an overlapping ovulation/fertile day', () => {
    // Construct a case where the ovulation date falls inside the
    // logged period range.
    const overlapping: CycleWindow[] = [
      {
        start: '2025-01-01',
        end: '2025-01-05',
        ovulation: '2025-01-03',
        fertileStart: '2025-01-01',
        fertileEnd: '2025-01-05',
        isPrediction: false,
      },
    ];
    const day = parseISODate('2025-01-03');
    expect(getDayType(day, overlapping)).toBe('period');
  });

  it('respects each cycle\'s own period length rather than a single global length', () => {
    // A short 2-day period followed by a longer 7-day one — each
    // should paint as its own length, not a shared default.
    const mixedLengthCycles: CycleWindow[] = [
      { start: '2025-01-01', end: '2025-01-02', ovulation: '1970-01-01', fertileStart: '1970-01-01', fertileEnd: '1970-01-01', isPrediction: false },
      { start: '2025-02-01', end: '2025-02-07', ovulation: '1970-01-01', fertileStart: '1970-01-01', fertileEnd: '1970-01-01', isPrediction: false },
    ];
    const day3OfFirstPeriod = parseISODate('2025-01-03'); // past the 2-day range
    const day6OfSecondPeriod = parseISODate('2025-02-06'); // within the 7-day range

    expect(getDayType(day3OfFirstPeriod, mixedLengthCycles)).not.toBe('period');
    expect(getDayType(day6OfSecondPeriod, mixedLengthCycles)).toBe('period');
  });

  it('does not paint a predicted cycle as "period" even within its date range', () => {
    const day = parseISODate('2025-01-30'); // within the predicted cycle's range
    expect(getDayType(day, cycles)).not.toBe('period');
  });
});

describe('buildCycleWindows', () => {
  const defaultPeriodDurationDays = 5;

  it('returns an empty array when there are no logged periods', () => {
    expect(buildCycleWindows([], new Set(), 28, defaultPeriodDurationDays)).toEqual([]);
  });

  it('builds one non-prediction window per logged period plus projected future windows', () => {
    const periods = [
      { startDate: '2025-01-01', endDate: null },
      { startDate: '2025-01-29', endDate: null },
    ];
    const windows = buildCycleWindows(periods, new Set(), 28, defaultPeriodDurationDays);

    const logged = windows.filter((w) => !w.isPrediction);
    const projected = windows.filter((w) => w.isPrediction);

    expect(logged).toHaveLength(2);
    expect(logged[0].start).toBe('2025-01-01');
    expect(logged[1].start).toBe('2025-01-29');
    // At a 28-day cycle length, ~370 days of projection is at least 13 cycles.
    expect(projected.length).toBeGreaterThanOrEqual(13);
    // Projection continues chronologically from the last logged period.
    expect(projected[0].start).toBe(toISODate(addDays(parseISODate('2025-01-29'), 28)));
  });

  it('uses the real gap to the next logged period for a historical cycle\'s ovulation estimate', () => {
    // Actual gap here is 30 days, not the 28-day average — the first
    // window's ovulation should reflect the real 30-day cycle.
    const periods = [
      { startDate: '2025-01-01', endDate: null },
      { startDate: '2025-01-31', endDate: null }, // 30 days later
    ];
    const windows = buildCycleWindows(periods, new Set(), 28, defaultPeriodDurationDays);
    const expectedOvulation = toISODate(computeOvulationDay('2025-01-01', 30));
    expect(windows[0].ovulation).toBe(expectedOvulation);
  });

  it('uses the average cycle length for the most recent (still-open) logged cycle', () => {
    const periods = [
      { startDate: '2025-01-01', endDate: null },
    ];
    const windows = buildCycleWindows(periods, new Set(), 28, defaultPeriodDurationDays);
    const expectedOvulation = toISODate(computeOvulationDay('2025-01-01', 28));
    expect(windows[0].ovulation).toBe(expectedOvulation);
  });

  it('derives each logged window\'s duration via computePeriodDuration', () => {
    const periods = [{ startDate: '2025-01-01', endDate: '2025-01-03' }];
    const windows = buildCycleWindows(periods, new Set(), 28, defaultPeriodDurationDays);
    expect(windows[0].end).toBe('2025-01-03');
  });
});
