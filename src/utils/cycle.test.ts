/**
 * Tests for pure cycle calculation functions.
 */

import {
  computeCycleLength,
  computeFertileWindow,
  computeNextPeriod,
  computeOvulationDay,
  getDayType,
} from './cycle';
import { parseISODate, toISODate } from './date';

describe('computeCycleLength', () => {
  it('returns the fallback when there are 0 dates', () => {
    expect(computeCycleLength([], 28)).toBe(28);
  });

  it('returns the fallback when there is only 1 date', () => {
    expect(computeCycleLength(['2025-01-01'], 30)).toBe(30);
  });

  it('averages a single gap for 2 dates', () => {
    expect(computeCycleLength(['2025-01-01', '2025-01-29'], 28)).toBe(28);
  });

  it('averages multiple gaps, rounding to the nearest integer', () => {
    // Gaps: 28, 30, 27 -> average 28.33 -> rounds to 28
    const dates = ['2025-01-01', '2025-01-29', '2025-02-28', '2025-03-27'];
    expect(computeCycleLength(dates, 28)).toBe(28);
  });

  it('assumes the input is already sorted ascending', () => {
    const dates = ['2025-01-01', '2025-01-31'];
    expect(computeCycleLength(dates, 28)).toBe(30);
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
