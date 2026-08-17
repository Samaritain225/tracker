/**
 * Tests for pure cycle calculation functions.
 */

import {
  buildCycleWindows,
  computeAveragePeriodLength,
  computeCycleLength,
  computeCycleVariance,
  computeFertileWindow,
  computeNextPeriod,
  computeOvulationDay,
  computePeriodDuration,
  findPeriodCovering,
  getDayType,
  hasPlausibleCycleData,
  isPeriodOngoing,
} from './cycle';
import type { CycleWindow } from './cycle';
import {
  MAX_INFERRED_PERIOD_DAYS,
  MAX_PLAUSIBLE_CYCLE_GAP_DAYS,
  MIN_PLAUSIBLE_CYCLE_GAP_DAYS,
} from '@/constants/cycle';
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

  it('keeps implausibly long gaps when nothing is in range', () => {
    // Every gap here is outside [15, 60], but long cycles are unusual
    // rather than impossible (PCOS, perimenopause, post-partum). 70 is a
    // far better answer for this user than the 28-day default.
    const dates = datesFromGaps('2025-01-01', [70, 75, 65]);
    expect(computeCycleLength(dates, 28)).toBe(70);
  });

  it('returns the fallback when the only gaps are implausibly short', () => {
    // Two starts 2 days apart is a period logged twice, not a 2-day
    // cycle. Taken literally this reported itself as "calculated", put
    // ovulation before its own period, and filled the calendar with
    // predictions every other day.
    expect(computeCycleLength(['2025-01-01', '2025-01-03'], 28)).toBe(28);
    const several = datesFromGaps('2025-01-01', [2, 5, 3]);
    expect(computeCycleLength(several, 30)).toBe(30);
  });

  it('discards short gaps but still uses long ones from the same set', () => {
    const dates = datesFromGaps('2025-01-01', [2, 70]);
    expect(computeCycleLength(dates, 28)).toBe(70);
  });

  it('prefers in-range gaps over both extremes', () => {
    const dates = datesFromGaps('2025-01-01', [2, 28, 70]);
    expect(computeCycleLength(dates, 99)).toBe(28);
  });
});

describe('hasPlausibleCycleData', () => {
  it('is false without enough dates to form a gap', () => {
    expect(hasPlausibleCycleData([])).toBe(false);
    expect(hasPlausibleCycleData(['2025-01-01'])).toBe(false);
  });

  it('is false when the only gaps are implausibly short', () => {
    expect(hasPlausibleCycleData(['2025-01-01', '2025-01-03'])).toBe(false);
  });

  it('is true for in-range gaps, and for long ones that still carry signal', () => {
    expect(hasPlausibleCycleData(datesFromGaps('2025-01-01', [28, 30]))).toBe(true);
    expect(hasPlausibleCycleData(datesFromGaps('2025-01-01', [70, 75, 65]))).toBe(true);
  });

  it('agrees with computeCycleLength about whether the result is a measurement', () => {
    const unusable = ['2025-01-01', '2025-01-03'];
    expect(hasPlausibleCycleData(unusable)).toBe(false);
    // i.e. the number the UI would label "calculated" is really the fallback.
    expect(computeCycleLength(unusable, 28)).toBe(28);
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
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays)).toEqual({
      days: 4,
      source: 'explicit',
    });
  });

  it('never reports a length below one day, even for a malformed record', () => {
    const period = { startDate: '2025-01-05', endDate: '2025-01-01' };
    expect(computePeriodDuration(period, new Set(), defaultDurationDays).days).toBe(1);
  });

  it('derives duration from consecutive flow-logged days when no endDate is set', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    const flowLoggedDates = new Set(['2025-01-01', '2025-01-02', '2025-01-03']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays)).toEqual({
      days: 3,
      source: 'logged',
    });
  });

  it('counts a trailing spotting day as part of the period', () => {
    // Spotting is a flow value like any other, so it lands in
    // flowLoggedDates. This is deliberate rather than incidental: the
    // duration-sensitive fiqh rules treat coloured discharge during the
    // haid window as part of the period.
    const period = { startDate: '2025-01-01', endDate: null };
    const flowLoggedDates = new Set(['2025-01-01', '2025-01-02', '2025-01-03']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays).days).toBe(3);
  });

  it('bridges a single unlogged day rather than truncating the period', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    // 03 was never logged, but 04 was — one forgotten day shouldn't cut
    // the period short at two days.
    const flowLoggedDates = new Set(['2025-01-01', '2025-01-02', '2025-01-04']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays)).toEqual({
      days: 4,
      source: 'logged',
    });
  });

  it('stops at a gap longer than one day', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    // 03 and 04 unlogged: too long a break to be the same period, so the
    // later entry on 05 belongs to something else.
    const flowLoggedDates = new Set(['2025-01-01', '2025-01-02', '2025-01-05']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays).days).toBe(2);
  });

  it('caps the inferred length so a stray later entry cannot run it on forever', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    // An unbroken run far longer than any real period.
    const flowLoggedDates = new Set(
      Array.from({ length: 40 }, (_, i) => toISODate(addDays(parseISODate('2025-01-01'), i))),
    );
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays).days).toBe(
      MAX_INFERRED_PERIOD_DAYS,
    );
  });

  it('falls back to the default when neither endDate nor flow logs are available', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    expect(computePeriodDuration(period, new Set(), defaultDurationDays)).toEqual({
      days: defaultDurationDays,
      source: 'default',
    });
  });

  it('still counts from the start when only the start day is unlogged', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    // The user logged the start but forgot to record flow that day. The
    // period demonstrably includes its own start date, so the run is
    // 01→03, not a fallback to the default.
    const flowLoggedDates = new Set(['2025-01-02', '2025-01-03']);
    expect(computePeriodDuration(period, flowLoggedDates, defaultDurationDays)).toEqual({
      days: 3,
      source: 'logged',
    });
  });
});

describe('isPeriodOngoing', () => {
  it('is true while bleeding is within the inferable window', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    expect(isPeriodOngoing(period, '2025-01-03')).toBe(true);
  });

  it('is true on the start day itself', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    expect(isPeriodOngoing(period, '2025-01-01')).toBe(true);
  });

  it('is false once an end has been recorded', () => {
    const period = { startDate: '2025-01-01', endDate: '2025-01-04' };
    expect(isPeriodOngoing(period, '2025-01-02')).toBe(false);
  });

  it('is false past the maximum inferable run, so a forgotten period does not stay open forever', () => {
    const period = { startDate: '2025-01-01', endDate: null };
    expect(isPeriodOngoing(period, '2025-03-01')).toBe(false);
  });

  it('is false for a period that has not started yet', () => {
    const period = { startDate: '2025-02-01', endDate: null };
    expect(isPeriodOngoing(period, '2025-01-15')).toBe(false);
  });
});

describe('findPeriodCovering', () => {
  const open = { id: 'open', startDate: '2026-01-01', endDate: null };
  const closed = { id: 'closed', startDate: '2026-01-01', endDate: '2026-01-04' };

  it('returns null when no period started on or before the date', () => {
    expect(findPeriodCovering([open], '2025-12-31')).toBeNull();
    expect(findPeriodCovering([], '2026-01-01')).toBeNull();
  });

  it('covers the start day itself', () => {
    expect(findPeriodCovering([open], '2026-01-01')).toBe(open);
    expect(findPeriodCovering([closed], '2026-01-01')).toBe(closed);
  });

  it('covers up to and including a confirmed end date', () => {
    expect(findPeriodCovering([closed], '2026-01-03')).toBe(closed);
    expect(findPeriodCovering([closed], '2026-01-04')).toBe(closed);
  });

  // The regression this function was extracted for: a day past a
  // confirmed end used to still resolve to that period, so the
  // "period ended" switch could rewrite the user's own answer.
  it('does not cover a day past a confirmed end, even inside the inferred window', () => {
    expect(findPeriodCovering([closed], '2026-01-05')).toBeNull();
    expect(findPeriodCovering([closed], '2026-01-12')).toBeNull();
  });

  it('falls back to the inferred window only when no end is confirmed', () => {
    // MAX_INFERRED_PERIOD_DAYS is 15: offsets 0..14 are covered, 15 is not.
    const lastCovered = toISODate(
      addDays(parseISODate(open.startDate), MAX_INFERRED_PERIOD_DAYS - 1),
    );
    const firstUncovered = toISODate(
      addDays(parseISODate(open.startDate), MAX_INFERRED_PERIOD_DAYS),
    );
    expect(findPeriodCovering([open], lastCovered)).toBe(open);
    expect(findPeriodCovering([open], firstUncovered)).toBeNull();
  });

  it('prefers the most recent start when windows overlap', () => {
    const earlier = { id: 'earlier', startDate: '2026-01-01', endDate: null };
    const later = { id: 'later', startDate: '2026-01-06', endDate: null };
    expect(findPeriodCovering([earlier, later], '2026-01-08')).toBe(later);
    // Order in the list must not matter.
    expect(findPeriodCovering([later, earlier], '2026-01-08')).toBe(later);
  });

  it('skips a closed period to find an older open one still covering the day', () => {
    const older = { id: 'older', startDate: '2026-01-01', endDate: null };
    const recentClosed = { id: 'recent', startDate: '2026-01-05', endDate: '2026-01-07' };
    // 2026-01-09 is past the closed period's end, but still inside the
    // older one's inferred window.
    expect(findPeriodCovering([older, recentClosed], '2026-01-09')).toBe(older);
  });
});

describe('computeAveragePeriodLength', () => {
  const today = '2025-06-01';

  it('averages resolved lengths across settled periods', () => {
    const periods = [
      { startDate: '2025-01-01', endDate: '2025-01-04' }, // 4
      { startDate: '2025-02-01', endDate: '2025-02-07' }, // 7
    ];
    expect(computeAveragePeriodLength(periods, new Set(), 5, today)).toBe(6);
  });

  it('lets a confirmed end date move the number', () => {
    const flow = new Set(['2025-01-01', '2025-01-02', '2025-01-03']);
    const inferred = [{ startDate: '2025-01-01', endDate: null }];
    const confirmed = [{ startDate: '2025-01-01', endDate: '2025-01-06' }];
    expect(computeAveragePeriodLength(inferred, flow, 5, today)).toBe(3);
    expect(computeAveragePeriodLength(confirmed, flow, 5, today)).toBe(6);
  });

  it('ignores periods whose length is only the default echoed back', () => {
    // Nothing logged and no end marked — reporting the user's own
    // setting back at them as an insight would be meaningless.
    const periods = [{ startDate: '2025-01-01', endDate: null }];
    expect(computeAveragePeriodLength(periods, new Set(), 5, today)).toBeNull();
  });

  it('excludes a period still in progress, whose length is not known yet', () => {
    const periods = [
      { startDate: '2025-01-01', endDate: '2025-01-06' }, // 6, settled
      { startDate: '2025-06-01', endDate: null }, // started today
    ];
    expect(computeAveragePeriodLength(periods, new Set(['2025-06-01']), 5, today)).toBe(6);
  });

  it('returns null when there is nothing to average', () => {
    expect(computeAveragePeriodLength([], new Set(), 5, today)).toBeNull();
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

  it('falls back to the average when the real gap is implausibly short', () => {
    // Two starts 5 days apart — a mistyped date, or a period logged
    // twice. Taken literally, ovulation would land at start + 5 - 14,
    // nine days *before* the period it belongs to.
    const periods = [
      { startDate: '2025-01-01', endDate: null },
      { startDate: '2025-01-06', endDate: null },
    ];
    const windows = buildCycleWindows(periods, new Set(), 28, defaultPeriodDurationDays);

    expect(windows[0].ovulation).toBe(toISODate(computeOvulationDay('2025-01-01', 28)));
    // The guard's whole point: the estimate stays inside its own cycle.
    expect(windows[0].ovulation > windows[0].start).toBe(true);
    expect(windows[0].fertileStart > windows[0].start).toBe(true);
  });

  it('falls back to the average when the real gap is implausibly long', () => {
    const periods = [
      { startDate: '2025-01-01', endDate: null },
      { startDate: '2025-06-01', endDate: null }, // ~151 days
    ];
    const windows = buildCycleWindows(periods, new Set(), 28, defaultPeriodDurationDays);
    expect(windows[0].ovulation).toBe(toISODate(computeOvulationDay('2025-01-01', 28)));
  });

  it('still uses gaps at the edges of the plausible range', () => {
    for (const gap of [MIN_PLAUSIBLE_CYCLE_GAP_DAYS, MAX_PLAUSIBLE_CYCLE_GAP_DAYS]) {
      const second = toISODate(addDays(parseISODate('2025-01-01'), gap));
      const periods = [
        { startDate: '2025-01-01', endDate: null },
        { startDate: second, endDate: null },
      ];
      const windows = buildCycleWindows(periods, new Set(), 28, defaultPeriodDurationDays);
      expect(windows[0].ovulation).toBe(toISODate(computeOvulationDay('2025-01-01', gap)));
    }
  });

  it('derives each logged window\'s duration via computePeriodDuration', () => {
    const periods = [{ startDate: '2025-01-01', endDate: '2025-01-03' }];
    const windows = buildCycleWindows(periods, new Set(), 28, defaultPeriodDurationDays);
    expect(windows[0].end).toBe('2025-01-03');
  });
});
